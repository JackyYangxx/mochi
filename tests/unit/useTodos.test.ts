import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import { useTodos } from '../../src-renderer/hooks/useTodos';
import { useStore } from '../../src-renderer/store';
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

// 用 ref 捕获 useTodos 返回值, 避开 renderHook 内部 cleanup 的副作用
let lastResult: ReturnType<typeof useTodos> | null = null;
function TestComp() {
  lastResult = useTodos();
  return null;
}
const renderTestComp = () => render(React.createElement(TestComp));

describe('useTodos — 跨本地零点重算过滤', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 重置 zustand store, 避免 test 间 store 状态泄漏
    useStore.setState({
      todos: [],
      searchQuery: '',
      showInput: false,
      showSettings: false,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('窗口重新获焦时也立即重算 (不等定时器)', async () => {
    vi.setSystemTime(new Date(2026, 5, 22, 12, 0, 0));

    const yesterdayDone = makeTodo({
      id: 'done',
      isCompleted: true,
      // Day 1 本地 10:00 (UTC+8 下 = 2026-06-22T02:00:00.000Z)
      completedAt: '2026-06-22T02:00:00.000Z',
    });
    const stillOpen = makeTodo({ id: 'open', isCompleted: false });

    // 整个 setup 包在 act 里 — 避免 loadTodos 中 setTodos/setIsLoading 触发
    // "outside act" warning, 导致 React 内部 cleanup listener。
    await act(async () => {
      useStore.setState({ todos: [yesterdayDone, stillOpen] });
      renderTestComp();
    });

    // 跨过本地零点, 通过 dispatch focus 触发 useTodos 的 forceTick
    await act(async () => {
      vi.setSystemTime(new Date(2026, 5, 23, 12, 0, 0));
      window.dispatchEvent(new Event('focus'));
    });

    // 不再 await waitFor — fake timer 下 waitFor 内部 setTimeout 不会自动 advance,
    // 即使 expect 第一次就满足, waitFor 仍会等 polling interval → 永远 timeout。
    // tick 已经在 act 里同步触发 + flushSync 完成 re-render, 直接 assert 即可。
    expect(lastResult!.todos.map((t) => t.id)).toEqual(['open']);
  });
});