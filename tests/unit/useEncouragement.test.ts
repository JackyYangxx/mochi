import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEncouragement } from '../../src-renderer/hooks/useEncouragement';
import { ENCOURAGEMENTS } from '../../src-renderer/data/encouragements';

// 用确定性随机:始终返回区间内一个固定值,让"下一个 tick 在 6 分钟后"可预测
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const FIRST_INTERVAL_MS = 5 * 60_000 + 0.1 * 10 * 60_000; // 6 min
const DISPLAY_MS = 7_000;

describe('useEncouragement', () => {
  it('uses builtin list when AI is disabled', async () => {
    const generate = vi.fn();
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: false, isExternalTipActive: false, generate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });

    expect(generate).not.toHaveBeenCalled();
    expect(result.current.currentTip).not.toBeNull();
    expect(ENCOURAGEMENTS).toContain(result.current.currentTip);
  });

  it('uses AI generator when AI is enabled and call succeeds', async () => {
    const generate = vi.fn().mockResolvedValue('今天也要记得微笑呀');
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: true, isExternalTipActive: false, generate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.current.currentTip).toBe('今天也要记得微笑呀');
  });

  it('falls back to builtin list when AI call fails', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('llm-error'));
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: true, isExternalTipActive: false, generate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });

    expect(generate).toHaveBeenCalled();
    expect(result.current.currentTip).not.toBeNull();
    expect(ENCOURAGEMENTS).toContain(result.current.currentTip);
  });

  it('falls back to builtin list when AI returns empty string', async () => {
    const generate = vi.fn().mockResolvedValue('   ');
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: true, isExternalTipActive: false, generate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });

    expect(result.current.currentTip).not.toBeNull();
    expect(ENCOURAGEMENTS).toContain(result.current.currentTip);
  });

  it('hides tip after display window and schedules next round', async () => {
    const generate = vi.fn();
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: false, isExternalTipActive: false, generate })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });
    expect(result.current.currentTip).not.toBeNull();
    const firstTip = result.current.currentTip;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISPLAY_MS + 100);
    });
    expect(result.current.currentTip).toBeNull();

    // 下一轮再次出现
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });
    expect(result.current.currentTip).not.toBeNull();
    expect(result.current.currentTip).not.toBe(firstTip);
  });

  it('skips pick when external tip is active, retries after conflict window', async () => {
    const generate = vi.fn();
    const { result, rerender } = renderHook(
      ({ externalActive }: { externalActive: boolean }) =>
        useEncouragement({ aiEnabled: false, isExternalTipActive: externalActive, generate }),
      { initialProps: { externalActive: false } }
    );

    // 第一轮:无冲突,出现 tip
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
    });
    expect(result.current.currentTip).not.toBeNull();

    // 7s 后隐藏
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISPLAY_MS + 100);
    });
    expect(result.current.currentTip).toBeNull();

    // 外部 tip 激活,在冲突窗口 30s + 一个完整 5-15min 区间内不应出现
    rerender({ externalActive: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 30_000 + 100);
    });
    expect(result.current.currentTip).toBeNull();

    // 外部 tip 清除后,下一轮应正常出现。
    // 此时已经有 pending 的 30s 重试定时器,只要再等 30s 触发该 tick 即可。
    rerender({ externalActive: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000 + 100);
    });
    expect(result.current.currentTip).not.toBeNull();
  });

  it('avoids immediate repeats in builtin mode (recent window)', async () => {
    const generate = vi.fn();
    const { result } = renderHook(() =>
      useEncouragement({ aiEnabled: false, isExternalTipActive: false, generate })
    );

    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIRST_INTERVAL_MS + 100);
      });
      if (result.current.currentTip) seen.push(result.current.currentTip);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DISPLAY_MS + 100);
      });
    }
    // 相邻两条不应相同(recent window 10 > 任何相邻间隔)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).not.toBe(seen[i - 1]);
    }
  });
});
