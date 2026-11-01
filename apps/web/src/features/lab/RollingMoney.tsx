// 會滾動的金額：掛上去時從 from 滾到 to（requestAnimationFrame，LAB_ROLL_MS），滾完顯示的字串和 formatMoney(to) 完全相同。
// animate 為 false（減少動態、沒有變動）時直接顯示 to，不碰 rAF。表格不是 live region，滾動中的值不會被螢幕閱讀器重複播報。
import { useEffect, useState } from 'react';
import { formatMoney } from '@ledgerland/i18n';
import { LAB_ROLL_MS, rollingValue } from './rolling.ts';

export interface RollingMoneyProps {
  from: number;
  to: number;
  animate: boolean;
  locale: 'zh-TW' | 'en';
}

export function RollingMoney({ from, to, animate, locale }: RollingMoneyProps) {
  const rolling = animate && from !== to && typeof requestAnimationFrame === 'function';
  const [value, setValue] = useState(rolling ? from : to);
  useEffect(() => {
    if (!rolling) {
      setValue(to);
      return undefined;
    }
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const next = rollingValue(from, to, now - start);
      setValue(next);
      if (next !== to || now - start < LAB_ROLL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, rolling]);
  return (
    <span className="ll-lab-roll" data-rolling={rolling && value !== to ? 'true' : undefined}>
      {formatMoney(value, locale)}
    </span>
  );
}
