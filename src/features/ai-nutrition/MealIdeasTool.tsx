import { useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { Badge } from '../../components/common/Badge';
import { SelectField, TextField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { useAiRequest } from '../../hooks/useAiRequest';
import { buildMealIdeasPrompt, suggestMeals, type MealIdeasRequest } from '../../lib/ai/tasks';
import type { MealIdeas } from '../../lib/ai/schemas';
import { formatInt } from '../../lib/formatting/numbers';
import { useAiAvailability } from './useAiAvailability';
import { Payload, RequestStatus, SendButton, SendsDisclosure } from './shared';
import styles from './Ai.module.css';

export function MealIdeasTool() {
  const [form, setForm] = useState<MealIdeasRequest>({ mealType: 'dinner', preferences: '', restrictions: '', ingredients: '' });
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<MealIdeas>();
  const set = (k: keyof MealIdeasRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const send = () => void req.run((signal) => suggestMeals(options(signal), form));

  return (
    <Panel title="Meal ideas" titleId="tool-title" description="Suggestions only. Calorie figures are rough approximations, not verified data.">
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className={formStyles.grid2}>
          <SelectField label="Meal" value={form.mealType} onChange={set('mealType')}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </SelectField>
          <TextField label="Preferences" optional maxLength={500} value={form.preferences} onChange={set('preferences')} hint="e.g. high protein, quick, vegetarian" />
          <TextField label="Restrictions or allergies" optional maxLength={500} value={form.restrictions} onChange={set('restrictions')} hint="e.g. no nuts, lactose-free" />
          <TextField label="Ingredients you have" optional maxLength={500} value={form.ingredients} onChange={set('ingredients')} />
        </div>
        <SendsDisclosure summary="the fields above only">
          <p>Exactly this text is sent. Your diary, profile and targets are not included.</p>
          <Payload text={buildMealIdeasPrompt(form)} />
        </SendsDisclosure>
        <SendButton type="submit" ready={ready} reason={reason} loading={req.state.status === 'loading'}>
          Suggest meals
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Asking Gemini for ideas…" />
      </form>
      {req.state.status === 'success' && (
        <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
          <div>
            <Badge tone="ai">AI suggestions — unverified</Badge>
          </div>
          <ul className={styles.ideas}>
            {req.state.data.ideas.map((idea, i) => (
              <li key={`${idea.name}-${i}`} className={styles.idea}>
                <h3>{idea.name}</h3>
                <p className="small">{idea.summary}</p>
                {idea.key_ingredients.length > 0 && <p className="small muted">Ingredients: {idea.key_ingredients.join(', ')}</p>}
                <p className="small muted num">
                  {idea.approx_calories !== null && `Roughly ${formatInt(idea.approx_calories)} kcal (approximate)`}
                  {idea.approx_calories !== null && idea.prep_minutes !== null && ' · '}
                  {idea.prep_minutes !== null && `about ${formatInt(idea.prep_minutes)} min`}
                </p>
              </li>
            ))}
          </ul>
          {req.state.data.caution_note && <p className="small muted">{req.state.data.caution_note}</p>}
        </div>
      )}
    </Panel>
  );
}
