// 數字滾動（17 第 3.4 節、07 第 3.2 節）：數值改變時從目前顯示的數字滾到新值（約 600ms、等寬數字）；減少動態時直接換數字。
import { useEffect, useRef, useState } from 'react';
import { uiPrefersReducedMotion } from './motion.ts';

export interface RollingNumberProps {
  value: number;
  /** 滾動時長（ms） */
  duration?: number;
  /** false 時直接換數字（例如資料剛載入、還不是「變化」的時候） */
  animate?: boolean;
  className?: string;
}

export function RollingNumber({ value, duration = 600, animate = true, className }: RollingNumberProps) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    if (!animate || uiPrefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const next = p >= 1 ? value : Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, animate]);
  return (
    <span className={`ll-rollnum ll-num${className ? ` ${className}` : ''}`} data-rolling={shown !== value ? 'true' : undefined} data-value={value}>
      {shown}
    </span>
  );
}
