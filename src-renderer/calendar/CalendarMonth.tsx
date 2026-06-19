import './CalendarMonth.css';

interface Props {
  year: number;
  month: number;
  stats: Map<number, number>;
  todayStr: string;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
}

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildCells(year: number, month: number): { day: number | null; dateStr: string | null }[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number | null; dateStr: string | null }[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, dateStr: null });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      dateStr: `${year}-${pad2(month)}-${pad2(d)}`,
    });
  }

  while (cells.length < 42) {
    cells.push({ day: null, dateStr: null });
  }
  return cells;
}

function colorClass(count: number): string {
  if (count === 0) return 'count-0';
  if (count <= 2) return 'count-1';
  if (count <= 5) return 'count-3';
  if (count <= 10) return 'count-6';
  return 'count-11';
}

export function CalendarMonth({ year, month, stats, todayStr, selectedDate, onSelectDay }: Props) {
  const cells = buildCells(year, month);

  return (
    <div className="calendar-month">
      <div className="dow-row">
        {DOW.map((d, i) => (
          <div key={i} className="dow-cell" data-testid="dow-header">{d}</div>
        ))}
      </div>
      <div className="day-grid">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return (
              <div key={i} className="day-cell-slot placeholder" data-testid="day-cell-placeholder">
                <div className="day-cell" data-testid="day-cell" />
              </div>
            );
          }
          const count = stats.get(cell.day) ?? 0;
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const innerClasses = ['day-cell', colorClass(count)].join(' ');
          const slotClasses = ['day-cell-slot', isToday && 'today', isSelected && 'selected']
            .filter(Boolean).join(' ');

          let outerTestId: string;
          if (isToday) outerTestId = 'day-cell-today';
          else if (isSelected) outerTestId = 'day-cell-selected';
          else outerTestId = `day-cell-${cell.day}`;

          return (
            <div
              key={i}
              className={slotClasses}
              data-testid={outerTestId}
              onClick={() => onSelectDay(cell.dateStr!)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDay(cell.dateStr!);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={cell.dateStr!}
              aria-pressed={isSelected || undefined}
              aria-current={isToday ? 'date' : undefined}
            >
              <div
                className={innerClasses}
                data-testid="day-cell"
                title={count > 0 ? `${cell.dateStr} · ${count} 个待办` : cell.dateStr!}
              >
                <span className="day-number">{cell.day}</span>
                {count > 0 && (
                  <span className="day-count" data-testid={`day-cell-count-${cell.day}`}>{count}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}