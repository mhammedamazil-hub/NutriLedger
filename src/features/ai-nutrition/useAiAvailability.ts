import { usePreferences } from '../../app/preferences';
import { useKeyState } from '../../lib/ai/keyStore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { RequestOptions } from '../../lib/ai/client';

/** Whether an AI request can be sent right now, and why not. */
export function useAiAvailability(): { ready: boolean; reason: string | null; options: (signal: AbortSignal) => RequestOptions } {
  const { apiKey } = useKeyState();
  const { aiModel } = usePreferences();
  const online = useOnlineStatus();
  const reason = !apiKey ? 'Add a Gemini API key in Settings to send this.' : !online ? 'You’re offline. Connect to the internet to send this.' : null;
  return { ready: reason === null, reason, options: (signal) => ({ apiKey, model: aiModel, signal }) };
}

