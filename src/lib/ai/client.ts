import type { z } from 'zod';
import { AiError, classifyAiError, RETRYABLE_KINDS } from './errors';

/**
 * Minimal surface of the official @google/genai SDK that NutriLedger uses.
 * Declaring it here lets tests inject a mock without network access.
 */
export interface GenAiResponseLike {
  text?: string | undefined;
  promptFeedback?: { blockReason?: string | undefined } | undefined;
  candidates?: Array<{ finishReason?: string | undefined }> | undefined;
}

export type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface GenAiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: Array<{ role: 'user'; parts: ContentPart[] }>;
      config?: Record<string, unknown>;
    }): Promise<GenAiResponseLike>;
    get(params: { model: string; config?: Record<string, unknown> }): Promise<unknown>;
  };
}

type ClientLoader = (apiKey: string) => Promise<GenAiClientLike>;

/** The SDK is loaded on demand so users who never use AI never download it. */
const defaultLoader: ClientLoader = async (apiKey) => {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey }) as unknown as GenAiClientLike;
};

let loader: ClientLoader = defaultLoader;
let cached: { apiKey: string; client: GenAiClientLike } | null = null;

export function setClientLoaderForTests(fn: ClientLoader | null) {
  loader = fn ?? defaultLoader;
  cached = null;
}

async function getClient(apiKey: string): Promise<GenAiClientLike> {
  if (cached && cached.apiKey === apiKey) return cached.client;
  const client = await loader(apiKey);
  cached = { apiKey, client };
  return client;
}

export const DEFAULT_TIMEOUT_MS = 45_000;
export const MAX_ATTEMPTS = 3;

export interface RequestOptions {
  apiKey: string | null;
  model: string;
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  /** Injected for tests to avoid real waiting. */
  sleep?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
}

const defaultSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/**
 * Runs one SDK call with: key/offline pre-checks, a combined user-cancel +
 * timeout AbortSignal, and at most MAX_ATTEMPTS tries for transient server
 * errors only (exponential backoff). Never retries auth, quota or validation errors.
 */
async function runWithControls<T>(
  opts: RequestOptions,
  call: (client: GenAiClientLike, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!opts.apiKey) throw new AiError('missing-key');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline');
  if (opts.signal?.aborted) throw new AiError('cancelled');

  const controller = new AbortController();
  let timedOut = false;
  const onUserAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onUserAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const sleep = opts.sleep ?? defaultSleep;

  try {
    const client = await getClient(opts.apiKey);
    let attempt = 0;
    for (;;) {
      attempt += 1;
      // Cancellation or timeout may have happened while the SDK was loading or between retries.
      if (controller.signal.aborted) throw new AiError(timedOut ? 'timeout' : 'cancelled');
      try {
        return await call(client, controller.signal);
      } catch (raw) {
        if (controller.signal.aborted) throw new AiError(timedOut ? 'timeout' : 'cancelled');
        const err = classifyAiError(raw);
        if (!RETRYABLE_KINDS.has(err.kind) || attempt >= MAX_ATTEMPTS) throw err;
        await sleep(800 * 2 ** (attempt - 1), controller.signal).catch(() => {
          throw new AiError(timedOut ? 'timeout' : 'cancelled');
        });
      }
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUserAbort);
  }
}

const BLOCKING_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY', 'RECITATION']);

function extractText(res: GenAiResponseLike): string {
  if (res.promptFeedback?.blockReason) throw new AiError('safety');
  const finish = res.candidates?.[0]?.finishReason;
  if (finish && BLOCKING_FINISH.has(finish)) throw new AiError('safety');
  let text: string | undefined;
  try {
    text = res.text;
  } catch {
    text = undefined;
  }
  if (!text || !text.trim()) throw new AiError('empty');
  return text;
}

export interface GenerateParams extends RequestOptions {
  systemInstruction: string;
  parts: ContentPart[];
  temperature?: number;
}

export async function generateText(params: GenerateParams): Promise<string> {
  return runWithControls(params, async (client, signal) => {
    const res = await client.models.generateContent({
      model: params.model,
      contents: [{ role: 'user', parts: params.parts }],
      config: {
        systemInstruction: params.systemInstruction,
        temperature: params.temperature ?? 0.4,
        abortSignal: signal,
      },
    });
    return extractText(res);
  });
}

/** Strips a ```json fence if a model adds one despite JSON mode. */
export function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m?.[1] ?? t;
}

/**
 * Requests JSON constrained by `jsonSchema`, then validates it with Zod.
 * The model's output is untrusted: anything that fails validation is rejected.
 */
export async function generateJson<T>(
  params: GenerateParams & { jsonSchema: Record<string, unknown>; schema: z.ZodType<T> },
): Promise<T> {
  const text = await runWithControls(params, async (client, signal) => {
    const res = await client.models.generateContent({
      model: params.model,
      contents: [{ role: 'user', parts: params.parts }],
      config: {
        systemInstruction: params.systemInstruction,
        temperature: params.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: params.jsonSchema,
        abortSignal: signal,
      },
    });
    return extractText(res);
  });
  let raw: unknown;
  try {
    raw = JSON.parse(stripJsonFence(text));
  } catch {
    throw new AiError('malformed');
  }
  const parsed = params.schema.safeParse(raw);
  if (!parsed.success) throw new AiError('malformed');
  return parsed.data;
}

/** Verifies the key and model with a metadata lookup (no content is generated or sent). */
export async function testConnection(opts: RequestOptions): Promise<void> {
  await runWithControls(opts, async (client, signal) => {
    await client.models.get({ model: opts.model, config: { abortSignal: signal } });
  });
}
