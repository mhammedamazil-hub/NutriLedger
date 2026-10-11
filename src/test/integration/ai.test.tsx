import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';
import { setClientLoaderForTests, type GenAiClientLike, type GenAiResponseLike } from '../../lib/ai/client';
import { EMPTY_PROFILE } from '../../types/models';

const KEY = 'AIzaSyTEST-not-a-real-key-1234567890';

function installClient(generate: () => Promise<GenAiResponseLike>, get: () => Promise<unknown> = async () => ({})) {
  const generateContent = vi.fn(generate);
  const client: GenAiClientLike = { models: { generateContent, get: vi.fn(get) } };
  setClientLoaderForTests(async () => client);
  return generateContent;
}

const estimateJson = {
  status: 'estimate',
  food_name: 'Chicken burrito',
  portion_description: 'One large burrito',
  quantity: 1,
  unit: 'burrito',
  calories: 850,
  protein_g: 42,
  carbs_g: 95,
  fat_g: 32,
  fiber_g: 9,
  confidence: 'medium',
  assumptions: ['Includes rice, beans and cheese'],
  clarifying_questions: [],
};

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(() => {
  disposeStores();
  setClientLoaderForTests(null);
  vi.restoreAllMocks();
});

describe('AI nutrition page', () => {
  it('shows a setup state without a key and never sends', async () => {
    const generate = installClient(async () => ({ text: '{}' }));
    renderApp('/ai');
    expect(await screen.findByRole('heading', { name: 'Set up AI (optional)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimate nutrition' })).toBeDisabled();
    expect(screen.getByText('Add a Gemini API key in Settings to send this.')).toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();
  });

  it('disables sending while offline', async () => {
    keyStore.setKey(KEY, false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/ai');
    expect(await screen.findByText('You’re offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimate nutrition' })).toBeDisabled();
  });

  it('estimates from text, requires review, and saves as an AI estimate', async () => {
    keyStore.setKey(KEY, false);
    const generate = installClient(async () => ({ text: JSON.stringify(estimateJson) }));
    const { user, repo } = renderApp('/ai?tool=estimate');
    await user.type(await screen.findByRole('textbox', { name: 'What did you eat?' }), 'a big chicken burrito');
    await user.click(screen.getByRole('button', { name: 'Estimate nutrition' }));
    expect(await screen.findByText('AI estimate — unverified')).toBeInTheDocument();
    expect(generate).toHaveBeenCalledTimes(1);
    // Only the description was sent.
    const sent = JSON.stringify(generate.mock.calls[0]);
    expect(sent).toContain('a big chicken burrito');
    expect(sent).not.toContain(KEY);
    // Nothing saved until confirmed.
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);

    const review = screen.getByRole('form', { name: 'Review the estimate' });
    const cal = within(review).getByRole('textbox', { name: 'Calories' });
    expect(cal).toHaveValue('850');
    await user.clear(cal);
    await user.type(cal, '800');
    await user.click(within(review).getByRole('button', { name: 'Save to diary' }));
    expect(await screen.findByText('Saved to your diary')).toBeInTheDocument();
    const [saved] = (await repo.loadAll()).snapshot.foodEntries;
    expect(saved).toMatchObject({ name: 'Chicken burrito', calories: 800, protein: 42, source: 'ai-estimate' });
  });

  it('shows a specific error for an invalid key and keeps the input', async () => {
    keyStore.setKey(KEY, false);
    installClient(async () => {
      throw Object.assign(new Error('API key not valid. Please pass a valid API key.'), { name: 'ApiError', status: 400 });
    });
    const { user, repo } = renderApp('/ai?tool=estimate');
    const box = await screen.findByRole('textbox', { name: 'What did you eat?' });
    await user.type(box, 'toast');
    await user.click(screen.getByRole('button', { name: 'Estimate nutrition' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/rejected the API key/);
    expect(within(alert).getByRole('link', { name: 'Open AI settings' })).toBeInTheDocument();
    expect(box).toHaveValue('toast');
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);
  });

  it('rejects malformed model output instead of showing it', async () => {
    keyStore.setKey(KEY, false);
    installClient(async () => ({ text: JSON.stringify({ ...estimateJson, calories: -50 }) }));
    const { user } = renderApp('/ai?tool=estimate');
    await user.type(await screen.findByRole('textbox', { name: 'What did you eat?' }), 'soup');
    await user.click(screen.getByRole('button', { name: 'Estimate nutrition' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be understood or failed validation/);
    expect(screen.queryByText('AI estimate — unverified')).not.toBeInTheDocument();
  });

  it('can cancel an in-flight request', async () => {
    keyStore.setKey(KEY, false);
    installClient(() => new Promise<GenAiResponseLike>(() => undefined));
    const { user } = renderApp('/ai?tool=ask');
    await user.type(await screen.findByRole('textbox', { name: 'Your question' }), 'What is fiber?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(/Request cancelled/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('renders answers as plain text, without interpreting markup', async () => {
    keyStore.setKey(KEY, false);
    installClient(async () => ({ text: '**Fiber** helps digestion.\n\n- Oats\n- Beans <img src=x onerror=alert(1)>' }));
    const { user, container } = renderApp('/ai?tool=ask');
    await user.type(await screen.findByRole('textbox', { name: 'Your question' }), 'fiber?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Fiber helps digestion.')).toBeInTheDocument();
    expect(screen.getByText('Beans')).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('explains calculations from locally computed facts and shows them before sending', async () => {
    keyStore.setKey(KEY, false);
    const generate = installClient(async () => ({ text: 'Your BMR of 1743 kcal is calculated with 10 × 80. An unrelated 9999 appears.' }));
    const { user } = renderApp('/ai?tool=explain', {
      seed: { profile: { ...EMPTY_PROFILE, age: 35, sex: 'male', heightCm: 178, weightKg: 80, activity: 'moderate', updatedAt: new Date().toISOString() } },
    });
    await user.click(await screen.findByText(/What will be sent/));
    expect(screen.getByText(/BMR = 10 × 80 \+ 6.25 × 178 − 5 × 35 \+ 5 \(male variant\) = 1743 kcal\/day/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain my results' }));
    expect(await screen.findByText('Check these numbers')).toBeInTheDocument();
    expect(screen.getByText(/mentions 9999/)).toBeInTheDocument();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('tests the connection on explicit request and reports the result', async () => {
    keyStore.setKey(KEY, false);
    installClient(async () => ({ text: '' }), async () => {
      throw Object.assign(new Error('Resource exhausted. You exceeded your current quota'), { name: 'ApiError', status: 429 });
    });
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByText(/usage quota is used up/)).toBeInTheDocument());
  });
});
