import { useCallback, useEffect, useRef, useState } from 'react';
import { AiError, classifyAiError } from '../lib/ai/errors';

export type AiRequestState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined; notice?: string | undefined }
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: AiError };

/**
 * Lifecycle for one AI action: single in-flight request, cancellation via
 * AbortController, and protection against stale responses (a newer request
 * or a cancel always wins). Callers keep their own input state, so typed text
 * survives failures.
 */
export function useAiRequest<T>() {
  const [state, setState] = useState<AiRequestState<T>>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const run = useCallback(async (task: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const id = ++requestId.current;
    setState({ status: 'loading' });
    try {
      const data = await task(controller.signal);
      if (id !== requestId.current) return undefined;
      setState({ status: 'success', data });
      return data;
    } catch (err) {
      if (id !== requestId.current) return undefined;
      const e = classifyAiError(err);
      if (e.kind === 'cancelled') setState({ status: 'idle', notice: 'Request cancelled. Nothing was saved.' });
      else setState({ status: 'error', error: e });
      return undefined;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    requestId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ status: 'idle', notice: 'Request cancelled. Nothing was saved.' });
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(
    () => () => {
      requestId.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  return { state, run, cancel, reset };
}
