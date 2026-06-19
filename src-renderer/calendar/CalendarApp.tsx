import { useState, useCallback, useEffect } from 'react';
import { useCalendarData } from './hooks/useCalendarData';
import { CalendarMonth } from './CalendarMonth';
import { YearHeatmap } from './YearHeatmap';
import { DayDetailPanel } from './DayDetailPanel';
import './CalendarApp.css';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function CalendarApp() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { monthStats, heatmap, dayTodos, selectedDate, loading, selectDay } =
    useCalendarData(year, month);

  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const goPrev = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }, [month]);

  const goNext = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }, [month]);

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const jumpToMonth = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape' && selectedDate) selectDay('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, selectedDate, selectDay]);

  return (
    <div className="calendar-app">
      <header className="calendar-header">
        <h1>Mochi · {year}</h1>
        <div className="month-nav">
          <button onClick={goPrev} aria-label="上个月">‹</button>
          <span className="month-label">{MONTH_NAMES[month - 1]}</span>
          <button onClick={goNext} aria-label="下个月">›</button>
        </div>
        <button className="today-btn" onClick={goToday}>今天</button>
      </header>

      <YearHeatmap
        year={year}
        heatmap={heatmap}
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