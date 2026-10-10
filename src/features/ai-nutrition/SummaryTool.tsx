import { useMemo, useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { Badge } from '../../components/common/Badge';
import { Checkbox, TextField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { useAiRequest } from '../../hooks/useAiRequest';
import { useData } from '../../app/dataContext';
import { useTodayKey } from '../../hooks/useTodayKey';
import { addDays, daysBetween, isValidDayKey } from '../../lib/formatting/dates';
import { buildSummaryPayload } from '../../lib/ai/facts';
import { summarizeRecords } from '../../lib/ai/tasks';
import { useAiAvailability } from './useAiAvailability';
import { Payload, RequestStatus, SendButton, SendsDisclosure } from './shared';
import { AiText } from './AiText';
import styles from './Ai.module.css';

const MAX_RANGE_DAYS = 92;

export function SummaryTool() {
  const today = useTodayKey();
  const [start, setStart] = useState(() => addDays(today, -6));
  const [end, setEnd] = useState(today);
  const [includeNames, setIncludeNames] = useState(false);
  const entries = useData((s) => s.foodEntries);
  const target = useData((s) => s.targets.calories);
  const { ready, reason, options } = useAiAvailability();
  const req = useAiRequest<string>();

  const rangeError = !isValidDayKey(start) || !isValidDayKey(end)
    ? 'Choose valid dates.'
    : start > end
      ? 'The start date must be on or before the end date.'
      : daysBetween(start, end) + 1 > MAX_RANGE_DAYS
        ? `Choose a range of up to ${MAX_RANGE_DAYS} days.`
        : null;

  const payload = useMemo(
    () => (rangeError ? null : buildSummaryPayload(entries, start, end, { includeFoodNames: includeNames }, target)),
    [entries, start, end, includeNames, target, rangeError],
  );

  const send = () => {
    if (!payload) return;
    const text = payload.text;
    void req.run((signal) => summarizeRecords(options(signal), text));
  };

  return (
    <Panel title="Summarise my records" titleId="tool-title" description="A plain-language look at your logged days. No notes are ever sent.">
      <div className="stack">
        <div className={formStyles.grid2}>
          <TextField label="From" type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} />
          <TextField label="To" type="date" value={end} max={today} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {rangeError && (
          <Notice tone="danger" role="alert">
            {rangeError}
          </Notice>
        )}
        <Checkbox checked={includeNames} onChange={setIncludeNames}>
          Include food names (otherwise only daily totals are sent)
        </Checkbox>
        {payload && payload.loggedDays === 0 && <Notice tone="info">No food is logged in this range, so there is nothing to summarise.</Notice>}
        {payload && payload.loggedDays > 0 && (
          <SendsDisclosure summary={`daily totals for ${payload.loggedDays} logged ${payload.loggedDays === 1 ? 'day' : 'days'}${includeNames ? ' and food names' : ''}`}>
            <p>Exactly this text is sent. Notes, profile details and weights are not included.</p>
            <Payload text={payload.text} />
          </SendsDisclosure>
        )}
        <SendButton
          ready={ready && Boolean(payload && payload.loggedDays > 0)}
          reason={reason}
          loading={req.state.status === 'loading'}
          onClick={send}
        >
          Summarise
        </SendButton>
        <RequestStatus state={req.state} onCancel={req.cancel} onRetry={send} loadingLabel="Asking Gemini for a summary…" />
        {req.state.status === 'success' && (
          <div className={styles.resultBox}>
            <div className={styles.resultHead}>
              <Badge tone="ai">AI-written summary</Badge>
            </div>
            <AiText text={req.state.data} />
            <p className="small muted">Summaries can misread data. Your diary and progress charts are the source of truth.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
