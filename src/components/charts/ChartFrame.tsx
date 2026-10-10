import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '../feedback/ErrorBoundary';
import styles from './ChartFrame.module.css';

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

interface Props<T> {
  /** Plain-language summary of what the chart shows (visible and read by screen readers). */
  summary: ReactNode;
  label: string;
  height: number;
  children: ReactNode;
  legend?: ReactNode;
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
}

/**
 * Chart wrapper: the SVG is decorative for assistive tech, while a text
 * summary and an expandable data table carry the same information.
 */
export function ChartFrame<T>({ summary, label, height, children, legend, rows, columns, rowKey }: Props<T>) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.summary}>{summary}</figcaption>
      {legend && <div className={styles.legend}>{legend}</div>}
      <ErrorBoundary label={label}>
        <div className={styles.chart} style={{ height }} aria-hidden="true" inert>
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </ErrorBoundary>
      <details className={styles.details}>
        <summary>Show data table</summary>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`${label} data`}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} scope="col">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={rowKey(r)}>
                  {columns.map((c) => (
                    <td key={c.header}>{c.cell(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function LegendItem({ color, children, dashed }: { color?: string; children: ReactNode; dashed?: boolean }) {
  return (
    <span>
      {dashed ? <span className={styles.line} /> : <span className={styles.swatch} style={{ background: color }} />}
      {children}
    </span>
  );
}
