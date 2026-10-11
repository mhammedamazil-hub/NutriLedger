import { useEffect, type ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface Props {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Document title; defaults to the page title. */
  documentTitle?: string;
}

export function PageHeader({ title, eyebrow, description, actions, documentTitle }: Props) {
  useEffect(() => {
    document.title = `${documentTitle ?? title} · NutriLedger`;
  }, [title, documentTitle]);
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
