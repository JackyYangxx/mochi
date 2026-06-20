import { useState, useCallback, useEffect } from 'react';
import { useCalendarData } from './hooks/useCalendarData';
import { CalendarMonth } from './CalendarMonth';
import { MonthPicker } from './MonthPicker';
import { DayDetailPanel } from './DayDetailPanel';
import './CalendarApp.css';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function CalendarApp() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { monthStats, monthCounts, dayTodos, selectedDate, loading, selectDay, refetch } =
    useCalendarData(year, month);

  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const goPrevYear = useCallback(() => setYear(y => y - 1), []);
  const goNextYear = useCallback(() => setYear(y => y + 1), []);

  const jumpToMonth = useCallback((m: number) => {
    setMonth(m);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDate) selectDay('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDate, selectDay]);

  // Refetch when the window regains focus, in case a `todos:changed` event
  // fired while the calendar was hidden (e.g. behind the main pet window).
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  return (
    <div className="calendar-app">
      <header className="calendar-header">
        <div className="year-nav">
          <button onClick={goPrevYear} aria-label="上一年" data-testid="year-prev">‹</button>
          <h1 data-testid="year-label">{year}</h1>
          <button onClick={goNextYear} aria-label="下一年" data-testid="year-next">›</button>
        </div>
        <button className="today-btn" onClick={goToday}>今天</button>
      </header>

      <MonthPicker
        year={year}
        currentMonth={today.getMonth() + 1}
        selectedMonth={month}
        monthCounts={monthCounts}
        onMonthClick={jumpToMonth}
      />

      {loading ? (
        <div className="loading">加载中…</div>
      ) : (
        <CalendarMonth
          year={year}
          month={month}
          stats={monthStats}
          todayStr={todayStr}
          selectedDate={selectedDate}
          onSelectDay={selectDay}
        />
      )}

      {selectedDate && dayTodos !== null && (
        <DayDetailPanel
          date={selectedDate}
          todos={dayTodos}
          onClose={() => selectDay('')}
        />
      )}
    </div>
  );
}

export default CalendarApp;
