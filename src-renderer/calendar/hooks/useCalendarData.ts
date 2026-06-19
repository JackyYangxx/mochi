import { useEffect, useState, useCallback } from 'react';
import type { MonthStat, DayStat, CalendarTodo } from '../../../src/shared/types/calendar';

declare global {
  interface Window {
    todoAPI: {
      getMonthStats: (year: number, month: number) => Promise<MonthStat[]>;
      getYearHeatmap: (year: number) => Promise<DayStat[]>;
      getDayTodos: (date: string) => Promise<CalendarTodo[]>;
    };
  }
}

export function useCalendarData(year: number, month: number) {
  const [monthStats, setMonthStats] = useState<Map<number, number>>(new Map());
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [dayTodos, setDayTodos] = useState<CalendarTodo[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedDate(null);
    setDayTodos(null);
    Promise.all([
      window.todoAPI.getMonthStats(year, month),
      window.todoAPI.getYearHeatmap(year),
    ]).then(([m, h]) => {
      setMonthStats(new Map(m.map(s => [s.day, s.count])));
      setHeatmap(new Map(h.map(s => [s.date, s.count])));
      setLoading(false);
    });
  }, [year, month]);

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
    dayTodos,
    selectedDate,
    loading,
    selectDay,
  };
}