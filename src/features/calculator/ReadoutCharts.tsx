import { useId } from 'react';
import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { formatInt } from '../../lib/formatting/numbers';
import { ACTIVITY_LEVELS, type ActivityLevel } from '../../types/models';
import styles from './Calculator.module.css';

/**
 * Hand-built SVG visualisations for the calculator readout. Geometry is drawn
 * in SVG; every number and label is real HTML text, so it stays crisp, wraps
 * at any width and is read by screen readers. Each chart also has a one-line
 * text alternative.
 */

const pct = (n: number) => `${Math.max(0, Math.min(100, n)).toFixed(3)}%`;

/** Diagonal hatching used instead of a second colour (no gradients). */
function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" className={styles.hatchBg} />
      <line x1="0" y1="0" x2="0" y2="6" className={styles.hatchLine} />
    </pattern>
  );
}

/**
 * Likely range: population equations carry roughly ±10% individual error.
 * If the user has a calorie target, it is placed on the same scale.
 */
export function RangeScale({ tdee, target }: { tdee: number; target: number | null }) {
  const lo = tdee * 0.9;
  const hi = tdee * 1.1;
  const min = Math.min(tdee * 0.84, target !== null ? target * 0.96 : Infinity);
  const max = Math.max(tdee * 1.16, target !== null ? target * 1.04 : -Infinity);
  const x = (v: number) => ((v - min) / (max - min)) * 100;
  const targetSummary =
    target !== null ? ` Your daily target, ${formatInt(target)} kcal, is ${target < lo ? 'below' : target > hi ? 'above' : 'within'} that range.` : '';
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartCaption}>
        <span>Likely range</span>
        <span className={styles.chartCaptionNote}>±10% individual error</span>
      </figcaption>
      <div className={styles.rangePlot} role="img" aria-label={`Likely range ${formatInt(lo)} to ${formatInt(hi)} kcal per day.${targetSummary}`}>
        <svg className={styles.rangeSvg} aria-hidden="true" focusable="false">
          <line x1="0" y1="50%" x2="100%" y2="50%" className={styles.axis} />
          <rect x={pct(x(lo))} y="25%" width={pct(x(hi) - x(lo))} height="50%" className={styles.rangeBand} />
          {target !== null && <line x1={pct(x(target))} y1="8%" x2={pct(x(target))} y2="92%" className={styles.targetMarker} />}
          <line x1={pct(x(tdee))} y1="0" x2={pct(x(tdee))} y2="100%" className={styles.rangeMarker} />
        </svg>
        <span className={styles.rangeTick} style={{ left: pct(x(lo)) }} aria-hidden="true">
          {formatInt(lo)}
        </span>
        <span className={styles.rangeTick} style={{ left: pct(x(hi)) }} aria-hidden="true">
          {formatInt(hi)}
        </span>
      </div>
      {target !== null && (
        <p className={styles.chartNote}>
          <span className={styles.targetKey} aria-hidden="true" /> Your daily target: {formatInt(target)} kcal
        </p>
      )}
    </figure>
  );
}

/** Where the energy goes: resting metabolism (BMR) plus the activity allowance. */
export function EnergyComposition({ bmr, tdee }: { bmr: number; tdee: number }) {
  const hatch = `hatch${useId().replace(/[^\w-]/g, '')}`; // safe inside url(#…)
  const restShare = (bmr / tdee) * 100;
  const activity = tdee - bmr;
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartCaption}>
        <span>Where it goes</span>
        <span className={styles.chartCaptionNote}>per day</span>
      </figcaption>
      <div
        className={styles.compPlot}
        role="img"
        aria-label={`Resting metabolism ${formatInt(bmr)} kcal (${Math.round(restShare)}%) plus activity ${formatInt(activity)} kcal.`}
      >
        <svg className={styles.compSvg} aria-hidden="true" focusable="false">
          <defs>
            <Hatch id={hatch} />
          </defs>
          <rect width="100%" height="100%" fill={`url(#${hatch})`} className={styles.grow} />
          <rect width="100%" height="100%" className={`${styles.compRest} ${styles.grow}`} style={{ transform: `scaleX(${restShare / 100})` }} />
        </svg>
      </div>
      <dl className={styles.compLegend}>
        <div>
          <dt>
            <span className={`${styles.key} ${styles.keyRest}`} aria-hidden="true" />
            Resting (BMR)
          </dt>
          <dd className={styles.legendValue}>{formatInt(bmr)}</dd>
        </div>
        <div>
          <dt>
            <span className={`${styles.key} ${styles.keyActivity}`} aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
                <defs>
                  <Hatch id={`${hatch}-k`} />
                </defs>
                <rect width="16" height="16" fill={`url(#${hatch}-k)`} />
              </svg>
            </span>
            Activity
          </dt>
          <dd className={styles.legendValue}>+{formatInt(activity)}</dd>
        </div>
      </dl>
    </figure>
  );
}


/**
 * The same BMR at every activity level (TDEE = BMR × multiplier), so people
 * can see how much the activity choice drives the estimate. The current level
 * is drawn in ink and labelled “you”; its value is the headline figure.
 */
export function ActivitySpectrum({ bmr, current }: { bmr: number; current: ActivityLevel }) {
  const values = ACTIVITY_LEVELS.map((level) => ({ level, value: bmr * ACTIVITY_INFO[level].multiplier }));
  const max = values[values.length - 1]!.value;
  const summary = values.map((v) => `${ACTIVITY_INFO[v.level].label} ${formatInt(v.value)}`).join(', ');
  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartCaption}>
        <span>If your week looked different</span>
        <span className={styles.chartCaptionNote}>kcal/day</span>
      </figcaption>
      <div className={styles.spectrum} role="img" aria-label={`Estimated TDEE at each activity level: ${summary} kcal per day. Yours: ${ACTIVITY_INFO[current].label}.`}>
        {values.map(({ level, value }) => {
          const mine = level === current;
          return (
            <div key={level} className={styles.spectrumCol} data-current={mine ? 'true' : undefined} aria-hidden="true">
              <span className={styles.spectrumValue}>{mine ? 'you' : formatInt(value)}</span>
              <svg className={styles.spectrumSvg} viewBox="0 0 10 100" preserveAspectRatio="none" focusable="false">
                <rect x="1" y="0" width="8" height="100" className={`${styles.spectrumBar} ${styles.growY}`} style={{ transform: `scaleY(${value / max})` }} />
              </svg>
              <span className={styles.spectrumMult}>×{ACTIVITY_INFO[level].multiplier}</span>
            </div>
          );
        })}
      </div>
      <p className={styles.spectrumEnds} aria-hidden="true">
        <span>{ACTIVITY_INFO.sedentary.label}</span>
        <span>{ACTIVITY_INFO.extra.label}</span>
      </p>
    </figure>
  );
}

/** Placeholder geometry shown before there is an estimate: what will appear, drawn in outline. */
export function GhostCharts() {
  return (
    <div className={styles.ghost} aria-hidden="true">
      <svg className={styles.compSvg} focusable="false">
        <rect x="0.5" y="0.5" width="99.5%" height="95%" className={styles.ghostStroke} />
      </svg>
      <div className={styles.spectrum}>
        {[0.63, 0.72, 0.82, 0.91, 1].map((h, i) => (
          <div key={i} className={styles.spectrumCol}>
            <svg className={styles.spectrumSvg} viewBox="0 0 10 100" preserveAspectRatio="none" focusable="false">
              <rect x="1.5" y={100 - h * 100 + 0.5} width="7" height={h * 100 - 1} className={styles.ghostStroke} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
