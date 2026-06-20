import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterTodosForForeground, getStartOfDay } from '../../src-renderer/data/todoFilters';
import type { Todo } from '../../src-renderer/store';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: overrides.id ?? 't-' + Math.random().toString(36).slice(2),
  content: overrides.content ?? 'sample',
  notes: overrides.notes ?? null,
  sortOrder: overrides.sortOrder ?? 0,
  createdAt: overrides.createdAt ?? '2026-06-15T10:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-06-15T10:00:00.000Z',
  completedAt: overrides.completedAt ?? null,
  isCompleted: overrides.isCompleted ?? false,
  parentId: overrides.parentId ?? null,
});

// 关键: setSystemTime 之后, 函数内部 `new Date()` 会拿到这个时间点;
// 测试用与函数同样的 getStartOfDay 推导边界, 避免依赖具体时区。
beforeEach(() => {
  vi.useFakeTimers();
  // 本地 2026-06-21 12:00。Asia/Singapore (UTC+8) 下对应 2026-06-21T04:00:00.000Z
  vi.setSystemTime(new Date(2026, 5, 21, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('filterTodosForForeground', () => {
  it('keeps incomplete todos regardless of date', () => {
    const todos: Todo[] = [
      makeTodo({ id: 'a', isCompleted: false }),
      makeTodo({ id: 'b', isCompleted: false, createdAt: '2020-01-01T00:00:00.000Z' }),
    ];
    expect(filterTodosForForeground(todos).map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps todos completed today (after local midnight)', () => {
    const startOfToday = getStartOfDay(new Date());
    const plusOneHour = new Date(startOfToday.getTime() + 60 * 60 * 1000);
    const endOfToday = new Date(startOfToday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000);
    const todos: Todo[] = [
      makeTodo({ id: 'morning', isCompleted: true, completedAt: plusOneHour.toISOString() }),
      makeTodo({ id: 'late', isCompleted: true, completedAt: endOfToday.toISOString() }),
    ];
    expect(filterTodosForForeground(todos).map((t) => t.id).sort()).toEqual(['late', 'morning']);
  });

  it('keeps todo completed exactly at local midnight', () => {
    // 边界: 恰好 00:00:00.000 当天, 应该保留
    const startOfToday = getStartOfDay(new Date());
    const todo = makeTodo({ id: 'edge', isCompleted: true, completedAt: startOfToday.toISOString() });
    expect(filterTodosForForeground([todo])).toEqual([todo]);
  });

  it('filters out todos completed yesterday (before local midnight)', () => {
    const startOfToday = getStartOfDay(new Date());
    const oneMsBefore = new Date(startOfToday.getTime() - 1);
    const todo = makeTodo({ id: 'yesterday', isCompleted: true, completedAt: oneMsBefore.toISOString() });
    expect(filterTodosForForeground([todo])).toEqual([]);
  });

  it('filters out todos completed several days ago', () => {
    const todos: Todo[] = [
      makeTodo({ id: 'old-1', isCompleted: true, completedAt: '2026-06-15T08:00:00.000Z' }),
      makeTodo({ id: 'old-2', isCompleted: true, completedAt: '2025-12-01T00:00:00.000Z' }),
    ];
    expect(filterTodosForForeground(todos)).toEqual([]);
  });

  it('filters out completed todos with null completedAt (defensive: 异常数据)', () => {
    const todos: Todo[] = [
      makeTodo({ id: 'bad-data', isCompleted: true, completedAt: null }),
    ];
    expect(filterTodosForForeground(todos)).toEqual([]);
  });

  it('applies the same rule to subtasks (parentId set)', () => {
    const startOfToday = getStartOfDay(new Date());
    const childToday = makeTodo({
      id: 'child-today',
      isCompleted: true,
      parentId: 'parent',
      completedAt: new Date(startOfToday.getTime() + 60_000).toISOString(),
    });
    const childYesterday = makeTodo({
      id: 'child-yesterday',
      isCompleted: true,
      parentId: 'parent',
      completedAt: new Date(startOfToday.getTime() - 60_000).toISOString(),
    });
    const parent = makeTodo({ id: 'parent', isCompleted: false });
    const result = filterTodosForForeground([parent, childToday, childYesterday]);
    expect(result.map((t) => t.id).sort()).toEqual(['child-today', 'parent']);
  });

  it('uses system time when "now" is not injected', () => {
    // 把系统时间快进 24h, 同一条"今天完成的"记录变成"昨天完成的"
    const startOfToday = getStartOfDay(new Date());
    const todo = makeTodo({
      id: 'boundary',
      isCompleted: true,
      completedAt: new Date(startOfToday.getTime() + 1000).toISOString(),
    });
    expect(filterTodosForForeground([todo])).toEqual([todo]);

    vi.setSystemTime(new Date(2026, 5, 22, 12, 0, 0));
    expect(filterTodosForForeground([todo])).toEqual([]);
  });

  it('returns the same array instance when nothing is filtered out', () => {
    const todos: Todo[] = [
      makeTodo({ id: 'a', isCompleted: false }),
      makeTodo({ id: 'b', isCompleted: true, completedAt: '2026-06-21T03:00:00.000Z' }),
    ];
    expect(filterTodosForForeground(todos)).toBe(todos);
  });
});

describe('getStartOfDay', () => {
  it('returns local midnight of the given date', () => {
    const d = new Date(2026, 5, 21, 15, 30, 45);  // local 15:30
    const start = getStartOfDay(d);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(21);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });
});
