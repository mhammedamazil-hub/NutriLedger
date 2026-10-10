import styles from './Button.module.css';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';

/** Button styling for non-button elements (e.g. router links that look like buttons). */
export function buttonClass(variant: Variant = 'secondary', size: 'md' | 'sm' = 'md', block = false): string {
  return [styles.button, styles[variant], size === 'sm' ? styles.sm : '', block ? styles.block : ''].filter(Boolean).join(' ');
}
