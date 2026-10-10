import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import styles from './Notice.module.css';

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

const ICONS: Record<Tone, ReactNode> = {
  info: <Info aria-hidden="true" />,
  neutral: <Info aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  danger: <XCircle aria-hidden="true" />,
  success: <CheckCircle2 aria-hidden="true" />,
};

interface NoticeProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  /** Use "alert" only for errors that need immediate attention. */
  role?: 'status' | 'alert' | 'note';
  className?: string;
}

export function Notice({ tone = 'info', title, children, role, className }: NoticeProps) {
  return (
    <div className={[styles.notice, styles[tone], className ?? ''].join(' ')} role={role}>
      {ICONS[tone]}
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
