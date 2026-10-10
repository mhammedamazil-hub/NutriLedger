import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Calculator, Camera, FileText, HelpCircle, Lightbulb, PenLine } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Panel } from '../../components/common/Panel';
import { Notice } from '../../components/feedback/Notice';
import { buttonClass } from '../../components/common/buttonClass';
import { useKeyState } from '../../lib/ai/keyStore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { EstimateTextTool } from './EstimateTextTool';
import { EstimatePhotoTool } from './EstimatePhotoTool';
import { MealIdeasTool } from './MealIdeasTool';
import { ExplainTool } from './ExplainTool';
import { SummaryTool } from './SummaryTool';
import { AskTool } from './AskTool';
import styles from './Ai.module.css';

const TOOLS = [
  { id: 'estimate', label: 'Estimate from text', icon: <PenLine aria-hidden="true" />, render: () => <EstimateTextTool /> },
  { id: 'photo', label: 'Estimate from photo', icon: <Camera aria-hidden="true" />, render: () => <EstimatePhotoTool /> },
  { id: 'ideas', label: 'Meal ideas', icon: <Lightbulb aria-hidden="true" />, render: () => <MealIdeasTool /> },
  { id: 'explain', label: 'Explain calculations', icon: <Calculator aria-hidden="true" />, render: () => <ExplainTool /> },
  { id: 'summary', label: 'Summarise records', icon: <FileText aria-hidden="true" />, render: () => <SummaryTool /> },
  { id: 'ask', label: 'Ask a question', icon: <HelpCircle aria-hidden="true" />, render: () => <AskTool /> },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: ReactNode; render: () => ReactNode }>;

type ToolId = (typeof TOOLS)[number]['id'];

export default function AiPage() {
  const [params] = useSearchParams();
  const { apiKey } = useKeyState();
  const online = useOnlineStatus();
  const requested = params.get('tool');
  const tool = TOOLS.find((t) => t.id === requested) ?? TOOLS[0];
  const current: ToolId = tool.id;

  return (
    <>
      <PageHeader
        title="AI nutrition assistant"
        description="Optional helpers powered by Google Gemini with your own API key. Results are suggestions you review — never saved automatically."
      />
      <div className="stack">
        {!apiKey && (
          <Panel title="Set up AI (optional)" titleId="ai-setup">
            <div className="stack">
              <p className="small">
                To use these tools, add a free or paid Gemini API key from Google AI Studio in Settings. The key stays in this browser
                and requests go straight to Google. Everything else in NutriLedger works without it.
              </p>
              <div>
                <Link to="/settings#ai" className={buttonClass('primary')}>
                  Add API key in Settings
                </Link>
              </div>
            </div>
          </Panel>
        )}
        {!online && (
          <Notice tone="warning" title="You’re offline" role="status">
            AI tools need an internet connection, so sending is turned off. Your diary, calculator and progress work offline.
          </Notice>
        )}

        <nav aria-label="AI tools">
          <ul className={styles.tools}>
            {TOOLS.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/ai?tool=${t.id}`}
                  replace
                  className={styles.toolLink}
                  aria-current={t.id === current ? 'page' : undefined}
                >
                  {t.icon}
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div key={current}>{tool.render()}</div>
      </div>
    </>
  );
}
