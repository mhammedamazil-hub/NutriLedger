import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatInt, formatOne } from '../../lib/formatting/numbers';
import type { FoodEntry } from '../../types/models';
import styles from './Diary.module.css';

const g = (n: number | null) => (n === null ? '—' : `${formatOne(n)} g`);

export function EntryRow({
  entry,
  onEdit,
  onDelete,
  onDuplicate,
  showDate,
}: {
  entry: FoodEntry;
  onEdit: (e: FoodEntry) => void;
  onDelete: (e: FoodEntry) => void;
  onDuplicate: (e: FoodEntry) => void;
  showDate?: string;
}) {
  const incomplete = entry.protein === null || entry.carbs === null || entry.fat === null;
  const portion = entry.quantity !== null ? `${formatOne(entry.quantity)}${entry.unit ? ` ${entry.unit}` : ''}` : entry.unit;
  return (
    <li className={styles.entry}>
      <div className={styles.entryMain}>
        <span className={styles.entryName}>
          {entry.name}
          {entry.source === 'ai-estimate' && <Badge tone="ai">AI estimate</Badge>}
          {entry.source === 'label' && <Badge>Label</Badge>}
        </span>
        <span className={styles.entryMeta}>
          {showDate && <>{showDate} · </>}
          {portion && <>{portion} · </>}P {g(entry.protein)} · C {g(entry.carbs)} · F {g(entry.fat)}
          {incomplete && <span className="visually-hidden"> (some macros not recorded)</span>}
        </span>
        {entry.notes && <span className={`${styles.entryMeta} small`}>{entry.notes}</span>}
      </div>
      <div className={styles.entrySide}>
        <span className={styles.entryKcal}>{formatInt(entry.calories)} kcal</span>
        <Button iconOnly variant="ghost" size="sm" aria-label={`Edit ${entry.name}`} onClick={() => onEdit(entry)} icon={<Pencil aria-hidden="true" />} />
        <Button iconOnly variant="ghost" size="sm" aria-label={`Duplicate ${entry.name}`} onClick={() => onDuplicate(entry)} icon={<Copy aria-hidden="true" />} />
        <Button iconOnly variant="ghost" size="sm" aria-label={`Delete ${entry.name}`} onClick={() => onDelete(entry)} icon={<Trash2 aria-hidden="true" />} />
      </div>
    </li>
  );
}
