interface Props {
  year: number;
  month: number;
  stats: Map<number, number>;
  todayStr: string;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
}

export function CalendarMonth(_props: Props) {
  return <div className="placeholder">CalendarMonth (Task 5 will implement)</div>;
}