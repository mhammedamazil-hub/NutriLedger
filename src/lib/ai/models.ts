/**
 * Controlled list of Gemini model IDs offered in Settings. Availability,
 * pricing and free-tier limits are set by Google and change over time; the
 * "Test connection" button checks that the chosen model is reachable with the
 * user's key. Checked against Google's Gemini API model list (ai.google.dev, updated 2026-10-09):
 * gemini-3.5-flash is deprecated there and is no longer offered.
 */
export interface ModelOption {
  id: string;
  label: string;
  note: string;
}

export const SUPPORTED_MODELS: readonly ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    note: 'Newest stable Flash model. Recommended default.',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    note: 'Previous-generation stable Flash model.',
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
    note: 'Alias that Google moves to newer Flash releases; behaviour can change.',
  },
];

/**
 * Saved preferences holding a model that is no longer offered (for example
 * the deprecated `gemini-3.5-flash`) fall back to this default when read.
 */
export const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

export const isSupportedModel = (id: string): boolean => SUPPORTED_MODELS.some((m) => m.id === id);
