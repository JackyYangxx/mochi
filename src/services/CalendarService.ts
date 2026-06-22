import { getDb } from '../database/connection';
import type { MonthStat, DayStat, CalendarTodo } from '../shared/types/calendar';

interface CompletedAtRow {
  completed_at: string;
}

interface TodoRow {
  id: string;
  content: string;
  completed_at: string;
  parent_id: string | null;
  notes: string | null;
}

const TZ_SUFFIX_RE = /Z|[+-]\d{2}:?\d{2}$/;

/**
 * Convert an ISO 8601 timestamp string to a local 'YYYY-MM-DD' calendar day.
 *
 * Handles both naive timestamps (no timezone, e.g. '2026-06-15T09:00:00') and
 * UTC timestamps with 'Z' suffix (e.g. '2026-06-15T09:00:00.000Z').
 * - Naive: literal date prefix (treated as local time).
 * - Z-suffixed: parsed as UTC, then converted to local time.
 *
 * Local-day extraction happens in JS rather than SQL date(..., 'localtime')
 * to keep behavior consistent across the better-sqlite3 test shim
 * (node:sqlite) and real better-sqlite3, which disagree on how naive
 * timestamps interact with the 'localtime' modifier.
 */
function localDay(completedAt: string): string {
  if (TZ_SUFFIX_RE.test(completedAt)) {
    const d = new Date(completedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return completedAt.slice(0, 10);
}

export class CalendarService {
  getMonthStats(year: number, month: number): MonthStat[] {
    const db = getDb();
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    // Over-fetch with a 1-day buffer on each end to catch boundary rows
    // whose local day falls outside the month range (e.g. UTC 23:00 → next
    // day local). The JS filter handles both naive and Z-suffixed timestamps.
    const rows = db.prepare(`
      SELECT completed_at
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        AND completed_at < ?
    `).all(`${start} 00:00:00`, `${end} 23:59:59.999`) as CompletedAtRow[];

    const counts = new Map<string, number>();
    for (const r of rows) {
      const day = localDay(r.completed_at);
      if (day >= start && day < end) {
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({
        day: parseInt(day.slice(-2), 10),
        count,
      }));
  }

  getYearHeatmap(year: number): DayStat[] {
    const db = getDb();
    const start = `${year}-01-01`;
    const end = `${year + 1}-01-01`;
    const rows = db.prepare(`
      SELECT completed_at
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        AND completed_at < ?
    `).all(`${start} 00:00:00`, `${end} 23:59:59.999`) as CompletedAtRow[];

    const counts = new Map<string, number>();
    for (const r of rows) {
      const day = localDay(r.completed_at);
      if (day >= start && day < end) {
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  getDayTodos(date: string): CalendarTodo[] {
    const db = getDb();
    // Over-fetch with a 1-day buffer on each side to catch timezone-boundary
    // cases (e.g. UTC '2026-06-14T16:00:00Z' can land on local '2026-06-15'
    // in UTC+8). JS-level filter to the exact local day.
    //
    // Ordering invariant: SQL `ORDER BY completed_at ASC` is followed by a
    // JS localDay filter, but the final order is still correct: within a
    // single query, all rows share the same TZ offset, so UTC ordering
    // (lexicographic on Z-suffixed ISO) is preserved after local-day
    // conversion. No post-filter re-sort needed.
    const dayStart = Date.parse(`${date}T00:00:00Z`);
    const prev = utcYmd(new Date(dayStart - 86_400_000));
    const next = utcYmd(new Date(dayStart + 86_400_000));
    const rows = db.prepare(`
      SELECT id, content, completed_at, parent_id, notes
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        AND completed_at < ?
      ORDER BY completed_at ASC
    `).all(`${prev} 00:00:00`, `${next} 23:59:59.999`) as TodoRow[];
    return rows
      .filter(r => localDay(r.completed_at) === date)
      .map(r => ({
        id: r.id,
        content: r.content,
        completedAt: r.completed_at,
        parentId: r.parent_id,
        notes: r.notes,
      }));
  }
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}