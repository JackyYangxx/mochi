import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthPicker } from '../../src-renderer/calendar/MonthPicker';

describe('MonthPicker', () => {
  it('renders 12 month cells', () => {
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={3}
        monthCounts={new Map()}
        onMonthClick={vi.fn()}
      />
    );
    // 10 normal + current + selected = 12
    const cells = screen.getAllByTestId(/^month-cell/);
    expect(cells).toHaveLength(12);
  });

  it('clicking a cell calls onMonthClick with the month number', () => {
    const onMonthClick = vi.fn();
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={6}
        monthCounts={new Map()}
        onMonthClick={onMonthClick}
      />
    );
    fireEvent.click(screen.getByTestId('month-cell-3'));
    expect(onMonthClick).toHaveBeenCalledWith(3);
  });

  it('highlights the current real month', () => {
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={3}
        monthCounts={new Map()}
        onMonthClick={vi.fn()}
      />
    );
    const current = screen.getByTestId('month-cell-current');
    expect(current.textContent).toContain('6月');
  });

  it('highlights the selected month distinctly from current', () => {
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={3}
        monthCounts={new Map()}
        onMonthClick={vi.fn()}
      />
    );
    const selected = screen.getByTestId('month-cell-selected');
    expect(selected.textContent).toContain('3月');
  });

  it('renders zero-count months with neutral class', () => {
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={6}
        monthCounts={new Map()}
        onMonthClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('month-cell-1').className).toMatch(/count-0/);
  });

  it('renders high-count months with deepest class', () => {
    const counts = new Map<number, number>([[6, 120]]);
    render(
      <MonthPicker
        year={2026}
        currentMonth={1}
        selectedMonth={1}
        monthCounts={counts}
        onMonthClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('month-cell-6').className).toMatch(/count-11/);
  });

  it('shows count badge only when count > 0', () => {
    const counts = new Map<number, number>([[3, 8], [7, 25]]);
    render(
      <MonthPicker
        year={2026}
        currentMonth={6}
        selectedMonth={6}
        monthCounts={counts}
        onMonthClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('month-cell-count-3').textContent).toBe('8');
    expect(screen.getByTestId('month-cell-count-7').textContent).toBe('25');
    expect(screen.queryByTestId('month-cell-count-1')).toBeNull();
  });
});
