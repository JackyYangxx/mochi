import { useEffect, useState, useCallback, useMemo } from 'react';
import type { MonthStat, DayStat, CalendarTodo } from '../../../src/shared/types/calendar';

declare global {
  interface Window {
    todoAPI: {
      getMonthStats: (year: number, month: number) => Promise<MonthStat[]>;
      getYearHeatmap: (year: number) => Promise<DayStat[]>;
      getDayTodos: (date: string) => Promise<CalendarTodo[]>;
      onTodosChanged: (callback: () => void) => () => void;
    };
  }
}

export function useCalendarData(year: number, month: number) {
  const [monthStats, setMonthStats] = useState<Map<number, number>>(new Map());
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [dayTodos, setDayTodos] = useState<CalendarTodo[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback((y: number, m: number, sel: string | null) => {
    setLoading(true);
    Promise.all([
      window.todoAPI.getMonthStats(y, m),
      window.todoAPI.getYearHeatmap(y),
    ]).then(([stats, heat]) => {
      setMonthStats(new Map(stats.map(s => [s.day, s.count])));
      setHeatmap(new Map(heat.map(s => [s.date, s.count])));
      setLoading(false);
    });
    if (sel) {
      window.todoAPI.getDayTodos(sel).then(setDayTodos);
    }
  }, []);

  const monthCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [date, count] of heatmap.entries()) {
      // date is 'YYYY-MM-DD'; extract month via Date parsing (timezone-safe enough
      // since we only need the month number from a YYYY-MM-DD string).
      const month = parseInt(date.slice(5, 7), 10);
      counts.set(month, (counts.get(month) ?? 0) + count);
    }
    return counts;
  }, [heatmap]);

  useEffect(() => {
    setSelectedDate(null);
    setDayTodos(null);
    refetch(year, month, null);
  }, [year, month, refetch]);

  useEffect(() => {
    if (!window.todoAPI.onTodosChanged) return;
    const off = window.todoAPI.onTodosChanged(() => {
      refetch(year, month, selectedDate);
    });
    return off;
  }, [year, month, selectedDate, refetch]);

  const selectDay = useCallback((date: string) => {
    if (!date) {
      setSelectedDate(null);
      setDayTodos(null);
      return;
    }
    setSelectedDate(date);
    window.todoAPI.getDayTodos(date).then(setDayTodos);
  }, []);

  return {
    monthStats,
    heatmap,
    monthCounts,
    dayTodos,
    selectedDate,
    loading,
    selectDay,
    refetch: () => refetch(year, month, selectedDate),
  };
}