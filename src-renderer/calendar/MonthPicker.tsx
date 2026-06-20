import './MonthPicker.css';

interface Props {
  year: number;
  currentMonth: number;
  selectedMonth: number;
  monthCounts: Map<number, number>;
  onMonthClick: (month: number) => void;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function monthColorClass(count: number): string {
  if (count === 0) return 'count-0';
  if (count <= 10) return 'count-1';
  if (count <= 30) return 'count-3';
  if (count <= 70) return 'count-6';
  return 'count-11';
}

export function MonthPicker({ year, currentMonth, selectedMonth, monthCounts, onMonthClick }: Props) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="month-picker" role="group" aria-label={`${year} 年月份切换`}>
      {months.map(m => {
        const count = monthCounts.get(m) ?? 0;
        const isCurrent = year === new Date().getFullYear() && m === currentMonth;
        const isSelected = m === selectedMonth;
        const classes = [
          'month-cell',
          monthColorClass(count),
          isCurrent && 'current',
          isSelected && 'selected',
        ].filter(Boolean).join(' ');
        const handleClick = () => onMonthClick(m);
        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        };

        let testId: string;
        if (isCurrent) testId = 'month-cell-current';
        else if (isSelected) testId = 'month-cell-selected';
        else testId = `month-cell-${m}`;

        return (
          <div
            key={m}
            className={classes}
            data-testid={testId}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`${m}月 · ${count} 个待办`}
            aria-pressed={isSelected || undefined}
            aria-current={isCurrent ? 'true' : undefined}
            title={count > 0 ? `${m}月 · ${count} 个待办` : `${m}月`}
          >
            <span className="month-label">{MONTH_LABELS[m - 1]}</span>
            {count > 0 && (
              <span className="month-count" data-testid={`month-cell-count-${m}`}>{count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
