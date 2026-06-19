import './YearHeatmap.css';

interface Props {
  year: number;
  heatmap: Map<string, number>;
  onMonthClick: (year: number, month: number) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function colorClass(count: number): string {
  if (count === 0) return 'count-0';
  if (count <= 2) return 'count-1';
  if (count <= 5) return 'count-3';
  if (count <= 10) return 'count-6';
  return 'count-11';
}

function buildYearGrid(year: number): { date: Date; dateStr: string }[] {
  const start = new Date(year, 0, 1);
  // Walk back to the Sunday on or before Jan 1
  start.setDate(start.getDate() - start.getDay());
  const cells: { date: Date; dateStr: string }[] = [];
  for (let i = 0; i < 7 * 53; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      dateStr: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    });
  }
  return cells;
}

export function YearHeatmap({ year, heatmap, onMonthClick }: Props) {
  const cells = buildYearGrid(year);

  return (
    <div className="year-heatmap" role="grid" aria-label={`${year} 年完成热力图`}>
      {cells.map(({ date, dateStr }) => {
        const inYear = date.getFullYear() === year;
        const count = heatmap.get(dateStr) ?? 0;
        const classes = [
          'heatmap-cell',
          inYear ? colorClass(count) : 'out-of-year',
        ].join(' ');
        return (
          <div
            key={dateStr}
            className={classes}
            data-testid={`heatmap-cell-${dateStr}`}
            data-in-year={inYear ? 'true' : 'false'}
            title={inYear ? `${dateStr} · ${count} 个待办` : ''}
            onClick={inYear ? () => onMonthClick(year, date.getMonth() + 1) : undefined}
            role={inYear ? 'button' : undefined}
            tabIndex={inYear ? 0 : undefined}
          />
        );
      })}
    </div>
  );
}
