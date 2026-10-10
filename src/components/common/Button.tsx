import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';
import type { Variant } from './buttonClass';


export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: ReactNode;
  /** Renders an icon-only button; `aria-label` is then required. */
  iconOnly?: boolean;
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly, block, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  const cls = [
    styles.button,
    styles[variant],
    size === 'sm' ? styles.sm : '',
    iconOnly ? styles.iconOnly : '',
    block ? styles.block : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {!iconOnly && children}
    </button>
  );
});
