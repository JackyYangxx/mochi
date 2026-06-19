import './DayDetailPanel.css';
import type { CalendarTodo } from '../../shared/types/calendar';

interface Props {
  date: string;
  todos: CalendarTodo[];
  onClose: () => void;
}

function formatHHmm(iso: string): string {
  // iso is 'YYYY-MM-DDTHH:MM:SS' or with offset
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function DayDetailPanel({ date, todos, onClose }: Props) {
  return (
    <aside className="day-panel" data-testid="day-panel" role="dialog" aria-label={`${date} 完成清单`}>
      <header className="day-panel-header">
        <h2 data-testid="panel-title">{date} · {todos.length} 项已完成</h2>
        <button
          className="panel-close"
          data-testid="panel-close"
          onClick={onClose}
          aria-label="关闭"
        >×</button>
      </header>

      {todos.length === 0 ? (
        <div className="panel-empty" data-testid="panel-empty">
          这天没有完成的待办 ✨
        </div>
      ) : (
        <ul className="todo-list">
          {todos.map(t => (
            <li
              key={t.id}
              className={t.parentId ? 'todo-item subtask' : 'todo-item'}
            >
              <span className="todo-content">{t.content}</span>
              <span className="todo-time">{formatHHmm(t.completedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}