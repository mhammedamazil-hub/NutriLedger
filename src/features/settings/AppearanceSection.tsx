import { Panel } from '../../components/common/Panel';
import { Segmented } from '../../components/forms/Field';
import { preferencesStore, usePreferences } from '../../app/preferences';
import type { ThemePreference, UnitSystem } from '../../types/models';

export function AppearanceSection() {
  const prefs = usePreferences();
  return (
    <Panel title="Appearance and units" titleId="appearance" as="section">
      <div className="stack">
        <Segmented<ThemePreference>
          legend="Theme"
          name="theme"
          value={prefs.theme}
          onChange={(theme) => preferencesStore.update({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Segmented<UnitSystem>
          legend="Units for body measurements"
          name="settings-units"
          value={prefs.units}
          onChange={(units) => preferencesStore.update({ units })}
          options={[
            { value: 'metric', label: 'Metric (kg, cm)' },
            { value: 'imperial', label: 'Imperial (lb, ft/in)' },
          ]}
        />
        <p className="small muted">Data is always stored in metric; switching units only changes how values are shown and entered. Food energy is always in kcal.</p>
      </div>
    </Panel>
  );
}
