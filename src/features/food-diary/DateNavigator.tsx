import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { addDays, formatDayLong, isValidDayKey, relativeDayLabel } from '../../lib/formatting/dates';
import styles from './Diary.module.css';

interface Props {
  date: string;
  today: string;
  onChange: (date: string) => void;
}

export function DateNavigator({ date, today, onChange }: Props) {
  const rel = relativeDayLabel(date, today);
  return (
    <div className={styles.dateNav} role="group" aria-label="Choose diary date">
      <Button iconOnly variant="ghost" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))} icon={<ChevronLeft aria-hidden="true" />} />
      <label className="visually-hidden" htmlFor="diary-date">
        Diary date
      </label>
      <input
        id="diary-date"
        type="date"
        className={styles.dateInput}
        value={date}
        onChange={(e) => {
          if (isValidDayKey(e.target.value)) onChange(e.target.value);
        }}
      />
      <Button iconOnly variant="ghost" aria-label="Next day" onClick={() => onChange(addDays(date, 1))} icon={<ChevronRight aria-hidden="true" />} />
      {date !== today && (
        <Button size="sm" onClick={() => onChange(today)}>
          Today
        </Button>
      )}
      <span className="visually-hidden" aria-live="polite">
        Showing {rel !== formatDayLong(date) ? `${rel}, ` : ''}
        {formatDayLong(date)}
      </span>
    </div>
  );
}
