import {
  useId,
  type InputHTMLAttributes,
  type Ref,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.css';

interface FieldShellProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

function FieldShell({ id, label, hint, error, optional, children, className }: FieldShellProps) {
  return (
    <div className={[styles.field, className ?? ''].join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && (
          <>
            {' '}
            <span className={styles.optional}>(optional)</span>
          </>
        )}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

const describedBy = (id: string, hint: unknown, error: unknown) =>
  [error ? `${id}-error` : '', hint && !error ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  suffix?: string;
  fieldClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, hint, error, optional, suffix, fieldClassName, className, ref, ...rest }: TextFieldProps) {
  const id = useId();
  const input = (
    <input
      ref={ref}
      id={id}
      className={[styles.control, className ?? ''].join(' ')}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...rest}
    />
  );
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      {suffix ? (
        <div className={styles.withSuffix}>
          {input}
          <span className={styles.suffix} aria-hidden="true">
            {suffix}
          </span>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
}

/** Numeric input that keeps the raw string so partially typed or invalid values are never lost. */
export function NumberField(props: Omit<TextFieldProps, 'type' | 'inputMode'>) {
  return <TextField type="text" inputMode="decimal" autoComplete="off" spellCheck={false} {...props} />;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  children: ReactNode;
  fieldClassName?: string;
}

export function SelectField({ label, hint, error, optional, children, fieldClassName, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      <select
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  fieldClassName?: string;
}

export function TextAreaField({ label, hint, error, optional, fieldClassName, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      <textarea
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SegmentedProps<T extends string> {
  legend: ReactNode;
  name: string;
  value: T | null;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  error?: string | undefined;
  hideLegend?: boolean;
}

/** Native radio group styled as a segmented control (keyboard arrows work natively). */
export function Segmented<T extends string>({ legend, name, value, options, onChange, error, hideLegend }: SegmentedProps<T>) {
  const id = useId();
  return (
    <fieldset className={styles.segmented} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={hideLegend ? 'visually-hidden' : undefined}>{legend}</legend>
      <div className={styles.segmentGroup}>
        {options.map((o) => (
          <label key={o.value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </fieldset>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
