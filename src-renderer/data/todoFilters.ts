import type { Todo } from '../store';

// 前台过滤规则: 保留所有未完成 + 今天本地零点之后完成的;
// 之前完成的一律归档(不在前台展示), DB 数据不动, 日历视图仍能查。
//
// 为什么不直接用"现在减 24h"? 跨过本地零点时窗口会偏移半天,
// 用"今天零点"更符合用户对"昨天"的直觉。
export function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function filterTodosForForeground(
  todos: readonly Todo[],
  now: Date = new Date()
): Todo[] {
  const cutoff = getStartOfDay(now).getTime();
  const result: Todo[] = [];
  for (const t of todos) {
    if (!t.isCompleted) {
      result.push(t);
      continue;
    }
    if (t.completedAt && new Date(t.completedAt).getTime() >= cutoff) {
      result.push(t);
    }
    // isCompleted && !completedAt 视为异常数据, 不在前台展示
  }
  // 全保留时直接返回原引用, 避免下游 useMemo 失效
  return result.length === todos.length ? (todos as Todo[]) : result;
}
