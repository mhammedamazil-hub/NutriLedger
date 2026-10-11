import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { Badge } from '../../components/common/Badge';
import { Notice } from '../../components/feedback/Notice';
import { EmptyState } from '../../components/feedback/EmptyState';
import { useAiRequest } from '../../hooks/useAiRequest';
import { useProfileEstimate } from '../../hooks/useDerived';
import { buildCalculationFacts, findUnexpectedNumbers } from '../../lib/ai/facts';
import { explainCalculation } from '../../lib/ai/tasks';
import { useAiAvailability } from './useAiAvailability';
import { Payload, RequestStatus, SendButton, SendsDisclosure } from './shared';
import { AiText } from './AiText';
import styles from './Ai.module.css';

export function ExplainTool() {
  const estimate = useProfileEstimate();
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<string>();
  const facts = useMemo(
    () => (estimate.status === 'ok' ? buildCalculationFacts(estimate.inputs, estimate.estimate.results) : null),
    [estimate],
  );
  const unexpected = useMemo(
    () => (req.state.status === 'success' && facts ? findUnexpectedNumbers(req.state.data, facts) : []),
    [req.state, facts],
  );

  if (!facts) {
    return (
      <Panel title="Explain my calculations" titleId="tool-title">
        <EmptyState compact title="No calculation to explain" action={<Link to="/calculator">Open calculator</Link>}>
          {estimate.status === 'ok' ? '' : estimate.status === 'incomplete' ? 'Complete your profile in the calculator first.' : estimate.reason}
        </EmptyState>
      </Panel>
    );
  }

  const send = () => void req.run((signal) => explainCalculation(options(signal), facts));

  return (
    <Panel
      title="Explain my calculations"
      titleId="tool-title"
      description="NutriLedger does the arithmetic locally. Gemini is only asked to explain the results in plain language."
    >
      <div className="stack">
        <SendsDisclosure summary="your computed results (shown below)">
          <p>Exactly this text is sent. It includes your age, height, weight and activity level because the explanation refers to them.</p>
          <Payload text={facts} />
        </SendsDisclosure>
        <SendButton ready={ready} reason={reason} loading={req.state.status === 'loading'} onClick={send}>
          Explain my results
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Asking Gemini to explain…" />
        {req.state.status === 'success' && (
          <div className={styles.resultBox}>
            <div className={styles.resultHead}>
              <Badge tone="ai">AI-written explanation</Badge>
            </div>
            {unexpected.length > 0 && (
              <Notice tone="warning" title="Check these numbers">
                The explanation mentions {unexpected.join(', ')}, which {unexpected.length === 1 ? 'is' : 'are'} not in your calculated
                results. Trust the figures in the calculator, not the explanation.
              </Notice>
            )}
            <AiText text={req.state.data} />
          </div>
        )}
      </div>
    </Panel>
  );
}
