import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YearHeatmap } from '../../src-renderer/calendar/YearHeatmap';

describe('YearHeatmap', () => {
  it('renders 7 rows of weekday cells × 53 columns', () => {
    render(<YearHeatmap year={2026} heatmap={new Map()} onMonthClick={vi.fn()} />);
    const cells = screen.getAllByTestId(/^heatmap-cell-/);
    expect(cells.length).toBe(7 * 53);
  });

  it('clicking a cell calls onMonthClick with the year and month', () => {
    const onMonthClick = vi.fn();
    const heatmap = new Map<string, number>([['2026-06-15', 3]]);
    render(<YearHeatmap year={2026} heatmap={heatmap} onMonthClick={onMonthClick} />);

    fireEvent.click(screen.getByTestId('heatmap-cell-2026-06-15'));
    expect(onMonthClick).toHaveBeenCalledWith(2026, 6);
  });

  it('renders zero-count cells with neutral class', () => {
    render(<YearHeatmap year={2026} heatmap={new Map()} onMonthClick={vi.fn()} />);
    expect(screen.getByTestId('heatmap-cell-2026-03-10').className).toMatch(/count-0/);
  });

  it('renders high-count cells with deepest class', () => {
    const heatmap = new Map<string, number>([['2026-04-15', 20]]);
    render(<YearHeatmap year={2026} heatmap={heatmap} onMonthClick={vi.fn()} />);
    expect(screen.getByTestId('heatmap-cell-2026-04-15').className).toMatch(/count-11/);
  });

  it('marks out-of-year cells (Jan 1, 2026 is a Thursday → grid starts on Dec 28, 2025)', () => {
    const onMonthClick = vi.fn();
    render(<YearHeatmap year={2026} heatmap={new Map()} onMonthClick={onMonthClick} />);
    const prevYearCell = screen.getByTestId('heatmap-cell-2025-12-28');
    expect(prevYearCell.className).toMatch(/out-of-year/);
    fireEvent.click(prevYearCell);
    expect(onMonthClick).not.toHaveBeenCalled();
  });
});
