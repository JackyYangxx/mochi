interface Props {
  year: number;
  heatmap: Map<string, number>;
  onMonthClick: (year: number, month: number) => void;
}

export function YearHeatmap(_props: Props) {
  return <div className="placeholder">YearHeatmap (Task 6 will implement)</div>;
}