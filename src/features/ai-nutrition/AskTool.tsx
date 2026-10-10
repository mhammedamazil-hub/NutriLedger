import { useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { Badge } from '../../components/common/Badge';
import { TextAreaField } from '../../components/forms/Field';
import { useAiRequest } from '../../hooks/useAiRequest';
import { askNutritionQuestion, MAX_PROMPT_CHARS } from '../../lib/ai/tasks';
import { useAiAvailability } from './useAiAvailability';
import { RequestStatus, SendButton, SendsDisclosure } from './shared';
import { AiText } from './AiText';
import styles from './Ai.module.css';

export function AskTool() {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState('');
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<string>();

  const send = () => {
    const q = question.trim();
    if (!q) return setError('Type a question first.');
    setError(null);
    setAsked(q);
    void req.run((signal) => askNutritionQuestion(options(signal), q));
  };

  return (
    <Panel
      title="Ask a nutrition question"
      titleId="tool-title"
      description="General information only — not medical advice. For medical conditions, pregnancy or eating concerns, talk to a qualified professional."
    >
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <TextAreaField
          label="Your question"
          rows={3}
          maxLength={MAX_PROMPT_CHARS}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
          hint="e.g. “What foods are good sources of fiber?”"
        />
        <SendsDisclosure summary="your question only">
          <p>Only the question text is sent. Your records are not included unless you type them into the question.</p>
        </SendsDisclosure>
        <SendButton type="submit" ready={ready} reason={reason} loading={req.state.status === 'loading'}>
          Ask
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Waiting for Gemini…" />
      </form>
      {req.state.status === 'success' && (
        <div className={styles.resultBox} style={{ marginTop: 'var(--space-4)' }}>
          <div className={styles.resultHead}>
            <Badge tone="ai">AI answer — may be inaccurate</Badge>
          </div>
          <p className="small muted">Q: {asked}</p>
          <AiText text={req.state.data} />
        </div>
      )}
    </Panel>
  );
}
