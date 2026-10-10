import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface Props {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  headingLevel?: 'h2' | 'h3' | 'p';
}

/** Guides the user to a next step; never looks like a failure. */
export function EmptyState({ icon, title, children, action, compact, headingLevel = 'p' }: Props) {
  const H = headingLevel;
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <H className={styles.title}>{title}</H>
      {children && <div className={styles.text}>{children}</div>}
      {action}
    </div>
  );
}
