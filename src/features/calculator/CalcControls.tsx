import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import styles from './Calculator.module.css';

/**
 * Calculator-specific form controls. They follow the same accessibility
 * contract as the shared fields (label → input, `aria-invalid`,
 * `aria-describedby` for hint/error, "(optional)" in the accessible name) but
 * are drawn on the calculator's 8-point grid with instrument-style numerals.
 */

const describedBy = (id: string, hint: unknown, error: unknown) =>
  [error ? `${id}-error` : '', hint && !error ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

interface MeasureFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'children'> {
  label: string;
  /** Unit shown inside the field, e.g. "kg". Hidden from assistive tech (the label carries meaning). */
  unit?: string | undefined;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  /** Text-like inputs (dates) use the sans face instead of display numerals. */
  plain?: boolean;
}

export function MeasureField({ label, unit, hint, error, optional, plain, className, type = 'text', ...rest }: MeasureFieldProps) {
  const id = useId();
  const numeric = type === 'text' && !plain;
  return (
    <div className={[styles.field, className ?? ''].join(' ')}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {optional && (
          <>
            {' '}
            <span className={styles.fieldOptional}>(optional)</span>
          </>
        )}
      </label>
      <div className={styles.fieldWell} data-invalid={error ? 'true' : undefined}>
        <input
          id={id}
          type={type}
          className={[styles.fieldInput, numeric ? styles.fieldNumeric : ''].join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...(numeric ? { inputMode: 'decimal' as const, autoComplete: 'off', spellCheck: false } : {})}
          {...rest}
        />
        {unit && (
          <span className={styles.fieldUnit} aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {hint && !error && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

interface NotesFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  optional?: boolean;
}

export function NotesField({ label, optional, className, ...rest }: NotesFieldProps) {
  const id = useId();
  return (
    <div className={[styles.field, className ?? ''].join(' ')}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
        {optional && (
          <>
            {' '}
            <span className={styles.fieldOptional}>(optional)</span>
          </>
        )}
      </label>
      <div className={styles.fieldWell}>
        <textarea id={id} className={`${styles.fieldInput} ${styles.fieldTextarea}`} {...rest} />
      </div>
    </div>
  );
}

interface ToggleOption<T extends string> {
  value: T;
  label: string;
  detail?: string;
}

/**
 * Two-to-three option radio group drawn as a track with a sliding thumb.
 * Native radios keep arrow-key navigation and form semantics.
 */
export function Toggle<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  error,
  hint,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: ReadonlyArray<ToggleOption<T>>;
  onChange: (value: T) => void;
  error?: string | undefined;
  hint?: ReactNode;
}) {
  const id = useId();
  const index = options.findIndex((o) => o.value === value);
  const described = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className={styles.toggle} aria-describedby={described}>
      <legend className={styles.fieldLabel}>{legend}</legend>
      <div
        className={styles.toggleTrack}
        data-invalid={error ? 'true' : undefined}
        style={{ '--n': options.length, '--i': Math.max(index, 0) } as CSSProperties}
      >
        <span className={styles.toggleThumb} data-visible={index >= 0 ? 'true' : undefined} aria-hidden="true" />
        {options.map((o) => (
          <label key={o.value} className={styles.toggleOption} data-checked={value === o.value ? 'true' : undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className={styles.toggleLabel}>{o.label}</span>
            {o.detail && <span className={styles.toggleDetail}>{o.detail}</span>}
          </label>
        ))}
      </div>
      {hint && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </fieldset>
  );
}

/** Custom-drawn arrow for the Calculate action (no icon library). */
export function ArrowGlyph() {
  return (
    <svg className={styles.arrowGlyph} viewBox="0 0 24 16" width="24" height="16" aria-hidden="true" focusable="false">
      <path d="M0 8h21M15 1.5 21.5 8 15 14.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}
