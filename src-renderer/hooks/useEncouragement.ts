import { useState, useEffect, useRef, useCallback } from 'react';
import { ENCOURAGEMENTS } from '../data/encouragements';

const MIN_INTERVAL_MS = 5 * 60_000;
const MAX_INTERVAL_MS = 15 * 60_000;
const DISPLAY_DURATION_MS = 7_000;
const CONFLICT_RETRY_MS = 30_000;
const RECENT_WINDOW = 10;
const LLM_TIMEOUT_MS = 8_000;

interface UseEncouragementOpts {
  aiEnabled: boolean;
  isExternalTipActive: boolean;
  generate: () => Promise<string>;
  generateTimeoutMs?: number;
}

interface UseEncouragementResult {
  currentTip: string | null;
}

function pickFromBuiltin(recent: string[]): string {
  const pool = ENCOURAGEMENTS.filter((s) => !recent.includes(s));
  const list = pool.length > 0 ? pool : ENCOURAGEMENTS;
  return list[Math.floor(Math.random() * list.length)];
}

function withTimeout<T>(p: Promise<T>, ms: number, err: Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(err), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export function useEncouragement(opts: UseEncouragementOpts): UseEncouragementResult {
  const { aiEnabled, isExternalTipActive, generate, generateTimeoutMs = LLM_TIMEOUT_MS } = opts;
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const recentRef = useRef<string[]>([]);
  const timersRef = useRef<{ next?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({});
  // 始终读到最新 prop,避免 setTimeout 闭包陷阱
  const aiEnabledRef = useRef(aiEnabled);
  const externalTipRef = useRef(isExternalTipActive);
  const generateRef = useRef(generate);
  const generateTimeoutRef = useRef(generateTimeoutMs);
  const tickRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);
  useEffect(() => { externalTipRef.current = isExternalTipActive; }, [isExternalTipActive]);
  useEffect(() => { generateRef.current = generate; }, [generate]);
  useEffect(() => { generateTimeoutRef.current = generateTimeoutMs; }, [generateTimeoutMs]);

  const tick = useCallback(async () => {
    if (externalTipRef.current) {
      timersRef.current.next = setTimeout(() => { void tickRef.current(); }, CONFLICT_RETRY_MS);
      return;
    }
    let phrase: string | null = null;
    if (aiEnabledRef.current) {
      try {
        const text = await withTimeout(generateRef.current(), generateTimeoutRef.current, new Error('timeout'));
        const trimmed = text.trim();
        if (trimmed && trimmed.length <= 40) phrase = trimmed;
      } catch {
        phrase = null;
      }
    }
    if (phrase === null) {
      const picked = pickFromBuiltin(recentRef.current);
      recentRef.current = [picked, ...recentRef.current].slice(0, RECENT_WINDOW);
      phrase = picked;
    }
    if (phrase === null) {
      // 防御: 内置列表为空
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timersRef.current.next = setTimeout(() => { void tickRef.current(); }, delay);
      return;
    }
    setCurrentTip(phrase);
    timersRef.current.hide = setTimeout(() => {
      setCurrentTip(null);
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timersRef.current.next = setTimeout(() => { void tickRef.current(); }, delay);
    }, DISPLAY_DURATION_MS);
  }, []);

  useEffect(() => { tickRef.current = tick; }, [tick]);

  useEffect(() => {
    const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    timersRef.current.next = setTimeout(() => { void tickRef.current(); }, delay);
    const timers = timersRef.current;
    return () => {
      if (timers.next) clearTimeout(timers.next);
      if (timers.hide) clearTimeout(timers.hide);
    };
  }, [tick]);

  return { currentTip };
}
