import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarMonth } from '../../src-renderer/calendar/CalendarMonth';

describe('CalendarMonth', () => {
  it('renders a 6-row × 7-col grid with day-of-week headers', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const headers = screen.getAllByTestId('dow-header');
    expect(headers).toHaveLength(7);
    expect(headers[0].textContent).toBe('日');
    expect(headers[6].textContent).toBe('六');

    const cells = screen.getAllByTestId('day-cell');
    expect(cells.length).toBe(42);
  });

  it('highlights today cell', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const today = screen.getByTestId('day-cell-today');
    expect(today.textContent).toContain('19');
  });

  it('shows count badge only when count > 0', () => {
    const stats = new Map<number, number>([[5, 2], [12, 7]]);
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={stats}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    expect(screen.getByTestId('day-cell-count-5').textContent).toBe('2');
    expect(screen.getByTestId('day-cell-count-12').textContent).toBe('7');
    expect(screen.queryByTestId('day-cell-count-1')).toBeNull();
  });

  it('calls onSelectDay with YYYY-MM-DD on cell click', () => {
    const onSelectDay = vi.fn();
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={onSelectDay}
      />
    );
    fireEvent.click(screen.getByTestId('day-cell-15'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-06-15');
  });

  it('marks out-of-month cells as placeholders', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const placeholders = screen.getAllByTestId('day-cell-placeholder');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('marks selectedDate cell', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate="2026-06-10"
        onSelectDay={vi.fn()}
      />
    );
    const selected = screen.getByTestId('day-cell-selected');
    expect(selected.textContent).toContain('10');
  });
});