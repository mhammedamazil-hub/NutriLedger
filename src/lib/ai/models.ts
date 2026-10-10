/**
 * Controlled list of Gemini model IDs offered in Settings. Availability,
 * pricing and free-tier limits are set by Google and change over time; the
 * "Test connection" button checks that the chosen model is reachable with the
 * user's key. Verified against Google's published model list in October 2026.
 */
export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export const SUPPORTED_MODELS: readonly ModelOption[] = [
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    note: 'Stable, long-term availability. Recommended default.',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    note: 'Newest stable Flash; short-term availability model.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    note: 'Faster and lower cost; less detailed answers.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    note: 'Earlier low-cost stable model.',
  },
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash (latest alias)',
    note: 'Alias that Google moves to newer Flash models without notice.',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.5-flash';

export const isSupportedModel = (id: string): boolean => SUPPORTED_MODELS.some((m) => m.id === id);
