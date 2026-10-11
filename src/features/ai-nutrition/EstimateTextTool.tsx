import { useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { TextAreaField } from '../../components/forms/Field';
import { useAiRequest } from '../../hooks/useAiRequest';
import { estimateFromDescription, MAX_PROMPT_CHARS } from '../../lib/ai/tasks';
import type { NutritionEstimate } from '../../lib/ai/schemas';
import { useAiAvailability } from './useAiAvailability';
import { Payload, RequestStatus, SendButton, SendsDisclosure } from './shared';
import { EstimateReview } from './EstimateReview';

export function EstimateTextTool() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<NutritionEstimate>();

  const send = () => {
    if (!text.trim()) return setError('Describe what you ate, including amounts if you know them.');
    if (text.length > MAX_PROMPT_CHARS) return setError(`Keep the description under ${MAX_PROMPT_CHARS} characters.`);
    setError(null);
    void req.run((signal) => estimateFromDescription(options(signal), text));
  };

  return (
    <Panel title="Estimate a meal from a description" titleId="tool-title" description="Gemini suggests calories and macros. You review and edit before anything is saved.">
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <TextAreaField
          label="What did you eat?"
          rows={3}
          maxLength={MAX_PROMPT_CHARS}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
          hint="For example: “2 scrambled eggs with butter, 1 slice of wholemeal toast, a medium banana”. More detail gives a better estimate."
        />
        <SendsDisclosure summary="your description only">
          <p>Only the text in the box above is sent to Gemini with instructions to return an estimate. No other records, profile data or notes are included.</p>
          {text.trim() && <Payload text={text.trim()} />}
        </SendsDisclosure>
        <SendButton type="submit" ready={ready} reason={reason} loading={req.state.status === 'loading'}>
          Estimate nutrition
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Asking Gemini for an estimate…" />
      </form>
      {req.state.status === 'success' && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <EstimateReview key={JSON.stringify(req.state.data)} estimate={req.state.data} onDiscard={req.reset} />
        </div>
      )}
    </Panel>
  );
}
