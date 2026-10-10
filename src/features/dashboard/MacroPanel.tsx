import { Panel } from '../../components/common/Panel';
import { MacroBar } from '../../components/common/MacroBar';
import type { NutritionTotals } from '../../lib/calculations/nutrition';
import type { Targets } from '../../types/models';

export function MacroPanel({ totals, targets }: { totals: NutritionTotals; targets: Targets }) {
  const anyTarget = targets.protein !== null || targets.carbs !== null || targets.fat !== null;
  return (
    <Panel
      title="Macronutrients"
      titleId="macro-title"
      description={anyTarget ? 'Recorded today, compared with your targets.' : 'Recorded today. Macro targets are optional.'}
    >
      <div className="stack">
        <MacroBar label="Protein" color="var(--c-chart-protein)" total={totals.protein} entryCount={totals.entryCount} target={targets.protein} />
        <MacroBar label="Carbohydrate" color="var(--c-chart-carbs)" total={totals.carbs} entryCount={totals.entryCount} target={targets.carbs} />
        <MacroBar label="Fat" color="var(--c-chart-fat)" total={totals.fat} entryCount={totals.entryCount} target={targets.fat} />
        {totals.fiber.recordedCount > 0 && (
          <MacroBar label="Fiber" color="var(--c-text-2)" total={totals.fiber} entryCount={totals.entryCount} target={null} />
        )}
      </div>
    </Panel>
  );
}
