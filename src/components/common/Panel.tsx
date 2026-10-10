import type { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title?: ReactNode;
  titleId?: string;
  headingLevel?: 2 | 3;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flat?: boolean;
  as?: 'section' | 'div';
}

/** A titled surface for one group of related information. */
export function Panel({
  title,
  titleId,
  headingLevel = 2,
  description,
  actions,
  children,
  className,
  flat,
  as = 'section',
}: PanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const Tag = as;
  return (
    <Tag
      className={[styles.panel, flat ? styles.flat : '', className ?? ''].filter(Boolean).join(' ')}
      aria-labelledby={title && titleId ? titleId : undefined}
    >
      {(title || actions) && (
        <div className={styles.header}>
          <div className={styles.titles}>
            {title && <Heading id={titleId}>{title}</Heading>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
