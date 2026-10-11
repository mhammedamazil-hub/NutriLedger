import { afterEach, describe, expect, it, vi } from 'vitest';
import { setClientLoaderForTests, testConnection, type GenAiClientLike, type GenAiResponseLike } from './client';
import { AiError, classifyAiError } from './errors';
import { askNutritionQuestion, estimateFromDescription, suggestMeals } from './tasks';
import { buildCalculationFacts, buildSummaryPayload, findUnexpectedNumbers } from './facts';
import { makeAssessment, makeEntry } from '../../test/factories';

class FakeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function mockClient(impl: (params: unknown) => Promise<GenAiResponseLike>, get?: () => Promise<unknown>) {
  const generateContent = vi.fn(impl);
  const getFn = vi.fn(get ?? (async () => ({ name: 'models/x' })));
  const client: GenAiClientLike = { models: { generateContent, get: getFn } };
  const loader = vi.fn(async () => client);
  setClientLoaderForTests(loader);
  return { generateContent, get: getFn, loader };
}

const opts = { apiKey: 'test-key', model: 'gemini-3.8-flash', sleep: async () => undefined };

const goodEstimate = {
  status: 'estimate',
  food_name: 'Chicken salad',
  portion_description: 'One large bowl, about 350 g',
  quantity: 350,
  unit: 'g',
  calories: 420,
  protein_g: 35,
  carbs_g: 12,
  fat_g: 25,
  fiber_g: 4,
  confidence: 'medium',
  assumptions: ['Olive-oil dressing, about 1 tbsp'],
  clarifying_questions: [],
};

afterEach(() => {
  setClientLoaderForTests(null);
  vi.unstubAllGlobals();
});

describe('AI request controls', () => {
  it('fails fast without a key and never loads the SDK', async () => {
    const { loader } = mockClient(async () => ({ text: '{}' }));
    await expect(estimateFromDescription({ ...opts, apiKey: null }, 'toast')).rejects.toMatchObject({
      kind: 'missing-key',
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it('does not call the API when offline', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const { generateContent } = mockClient(async () => ({ text: '{}' }));
    await expect(askNutritionQuestion(opts, 'Is fibre important?')).rejects.toMatchObject({ kind: 'offline' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns a validated estimate and requests JSON with abort support', async () => {
    const { generateContent } = mockClient(async () => ({ text: JSON.stringify(goodEstimate) }));
    const r = await estimateFromDescription(opts, 'a big chicken salad');
    expect(r.calories).toBe(420);
    const call = generateContent.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['not json at all', 'malformed'],
    [JSON.stringify({ ...goodEstimate, calories: 'lots' }), 'malformed'],
    [JSON.stringify({ ...goodEstimate, calories: -50 }), 'malformed'],
    [JSON.stringify({ ...goodEstimate, calories: 1e9 }), 'malformed'],
    [JSON.stringify({ ...goodEstimate, confidence: 'certain' }), 'malformed'],
    [JSON.stringify((({ food_name: _f, ...rest }) => rest)(goodEstimate)), 'malformed'],
    ['', 'empty'],
  ])('rejects invalid output %#', async (text, kind) => {
    mockClient(async () => ({ text }));
    await expect(estimateFromDescription(opts, 'toast')).rejects.toMatchObject({ kind });
  });

  it('accepts fenced JSON', async () => {
    mockClient(async () => ({ text: '```json\n' + JSON.stringify(goodEstimate) + '\n```' }));
    await expect(estimateFromDescription(opts, 'salad')).resolves.toMatchObject({ calories: 420 });
  });

  it('accepts a clarification request without numbers', async () => {
    mockClient(async () => ({
      text: JSON.stringify({
        ...goodEstimate,
        status: 'needs_clarification',
        calories: null,
        protein_g: null,
        clarifying_questions: ['How large was the portion?'],
      }),
    }));
    const r = await estimateFromDescription(opts, 'food');
    expect(r.status).toBe('needs_clarification');
  });

  it('detects safety blocks', async () => {
    mockClient(async () => ({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(askNutritionQuestion(opts, 'q')).rejects.toMatchObject({ kind: 'safety' });
    mockClient(async () => ({ text: 'partial', candidates: [{ finishReason: 'SAFETY' }] }));
    await expect(askNutritionQuestion(opts, 'q')).rejects.toMatchObject({ kind: 'safety' });
  });

  it.each([
    [new FakeApiError(400, 'API key not valid. Please pass a valid API key.'), 'invalid-key'],
    [new FakeApiError(403, 'Permission denied'), 'permission'],
    [new FakeApiError(404, 'models/foo is not found'), 'model-unavailable'],
    [new FakeApiError(429, 'You exceeded your current quota, please check your plan and billing details.'), 'quota'],
    [new FakeApiError(429, 'Quota exceeded for metric: generate_content requests per minute'), 'rate-limit'],
    [new TypeError('Failed to fetch'), 'network'],
  ])('maps provider failures to clear errors (%#) without retrying', async (error, kind) => {
    const { generateContent } = mockClient(async () => {
      throw error;
    });
    await expect(askNutritionQuestion(opts, 'q')).rejects.toMatchObject({ kind });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries transient server errors a bounded number of times', async () => {
    const { generateContent } = mockClient(async () => {
      throw new FakeApiError(503, 'overloaded');
    });
    await expect(askNutritionQuestion(opts, 'q')).rejects.toMatchObject({ kind: 'service-unavailable' });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('recovers when a retry succeeds', async () => {
    let n = 0;
    mockClient(async () => {
      n += 1;
      if (n === 1) throw new FakeApiError(500, 'internal');
      return { text: 'Fibre supports digestion.' };
    });
    await expect(askNutritionQuestion(opts, 'q')).resolves.toBe('Fibre supports digestion.');
  });

  it('supports user cancellation', async () => {
    mockClient(
      (params) =>
        new Promise((_, reject) => {
          const signal = (params as { config: { abortSignal: AbortSignal } }).config.abortSignal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const controller = new AbortController();
    const p = askNutritionQuestion({ ...opts, signal: controller.signal }, 'q');
    controller.abort();
    await expect(p).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('times out slow requests', async () => {
    mockClient(
      (params) =>
        new Promise((_, reject) => {
          const signal = (params as { config: { abortSignal: AbortSignal } }).config.abortSignal;
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    await expect(askNutritionQuestion({ ...opts, timeoutMs: 20 }, 'q')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('tests the connection with a metadata lookup only', async () => {
    const { generateContent, get } = mockClient(async () => ({ text: 'x' }));
    await testConnection(opts);
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.8-flash' }));
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('validates meal ideas', async () => {
    mockClient(async () => ({ text: JSON.stringify({ ideas: [], caution_note: '' }) }));
    await expect(
      suggestMeals(opts, { mealType: 'dinner', preferences: '', restrictions: '', ingredients: '' }),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('never puts the API key into error messages', async () => {
    mockClient(async () => {
      throw new FakeApiError(400, 'API key not valid: test-key');
    });
    try {
      await askNutritionQuestion(opts, 'q');
    } catch (e) {
      expect((e as Error).message).not.toContain('test-key');
    }
  });
});

describe('classifyAiError', () => {
  it('passes AiError through and classifies aborts', () => {
    expect(classifyAiError(new AiError('quota')).kind).toBe('quota');
    expect(classifyAiError(new DOMException('x', 'AbortError')).kind).toBe('cancelled');
    expect(classifyAiError('weird').kind).toBe('unknown');
  });
});

describe('locally built AI payloads', () => {
  it('builds calculation facts from local results', () => {
    const a = makeAssessment();
    const facts = buildCalculationFacts(a.inputs, a.results);
    expect(facts).toContain('= 1780 kcal/day');
    expect(facts).toContain('1780 × 1.55 = 2759 kcal/day');
  });

  it('flags explanation numbers that do not match the calculation', () => {
    const a = makeAssessment();
    const facts = buildCalculationFacts(a.inputs, a.results);
    expect(findUnexpectedNumbers('Your BMR is 1780 and TDEE 2759 kcal.', facts)).toEqual([]);
    expect(findUnexpectedNumbers('Your BMR is about 1,850 kcal.', facts)).toEqual(['1850']);
  });

  it('summary payload excludes notes and, by default, food names', () => {
    const entries = [
      makeEntry({ date: '2026-10-01', name: 'Secret snack', notes: 'private note' }),
      makeEntry({ date: '2026-10-20', name: 'Out of range' }),
    ];
    const { text, loggedDays } = buildSummaryPayload(entries, '2026-10-01', '2026-10-07', { includeFoodNames: false }, null);
    expect(loggedDays).toBe(1);
    expect(text).not.toContain('private note');
    expect(text).not.toContain('Secret snack');
    expect(text).not.toContain('Out of range');
    const withNames = buildSummaryPayload(entries, '2026-10-01', '2026-10-07', { includeFoodNames: true }, 2000);
    expect(withNames.text).toContain('Secret snack');
    expect(withNames.text).not.toContain('private note');
  });
});
