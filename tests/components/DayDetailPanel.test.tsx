import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayDetailPanel } from '../../src-renderer/calendar/DayDetailPanel';
import type { CalendarTodo } from '../../src/shared/types/calendar';

const SAMPLE_TODOS: CalendarTodo[] = [
  { id: '1', content: 'morning task', completedAt: '2026-06-15T09:00:00', parentId: null, notes: null },
  { id: '2', content: 'afternoon task', completedAt: '2026-06-15T14:30:00', parentId: null, notes: '下午三点开完会, 任务闭环' },
  { id: '3', content: 'child of 1', completedAt: '2026-06-15T10:00:00', parentId: '1', notes: '细分子项' },
];

describe('DayDetailPanel', () => {
  it('renders date and todo count in the header', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('panel-title').textContent).toContain('2026-06-15');
    expect(screen.getByTestId('panel-title').textContent).toContain('3');
  });

  it('renders each todo with its content and HH:mm time', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={vi.fn()} />
    );
    expect(screen.getByText('morning task')).toBeDefined();
    expect(screen.getByText('09:00')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
    expect(screen.getByText('child of 1')).toBeDefined();
  });

  it('renders empty state when no todos', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={[]} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('panel-empty').textContent).toContain('这天没有完成的待办');
  });

  it('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId('panel-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders notes per todo when present, hides when null', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={vi.fn()} />
    );
    const notesEls = screen.getAllByTestId('todo-notes');
    expect(notesEls).toHaveLength(2);
    expect(notesEls[0].textContent).toBe('下午三点开完会, 任务闭环');
    expect(notesEls[1].textContent).toBe('细分子项');
  });
});