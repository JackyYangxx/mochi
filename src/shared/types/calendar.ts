export interface MonthStat {
  day: number;       // 1-31
  count: number;
}

export interface DayStat {
  date: string;      // 'YYYY-MM-DD'
  count: number;
}

export interface CalendarTodo {
  id: string;
  content: string;
  completedAt: string;
  parentId: string | null;
  notes: string | null;
}