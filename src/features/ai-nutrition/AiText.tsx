import { useMemo } from 'react';
import { parseAiText } from '../../lib/formatting/aiText';
import styles from './Ai.module.css';

/** Renders model output as plain text blocks. Never uses innerHTML. */
export function AiText({ text }: { text: string }) {
  const blocks = useMemo(() => parseAiText(text), [text]);
  return (
    <div className={styles.aiText}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') return <h3 key={i}>{b.text}</h3>;
        if (b.type === 'paragraph') return <p key={i}>{b.text}</p>;
        const items = b.items.map((it, j) => <li key={j}>{it}</li>);
        return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
      })}
    </div>
  );
}
