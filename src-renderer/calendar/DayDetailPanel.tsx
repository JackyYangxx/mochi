interface Props {
  date: string;
  todos: { id: string; content: string; completedAt: string; parentId: string | null }[];
  onClose: () => void;
}

export function DayDetailPanel(_props: Props) {
  return <div className="placeholder">DayDetailPanel (Task 7 will implement)</div>;
}