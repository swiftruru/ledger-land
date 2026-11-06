// 三表並排時，每張表放不放得下「交易前、交易後、本筆變動」三欄（StatementTable 的 columns 檢視）：量表格區實際的寬度，不看視窗寬度。
// 以前用視窗寬度（1440 起）判斷，但內容區最寬只有 1040px，每張表只分到 336px 左右，三欄放不下，現金流量表與資產負債表都要左右捲
// （2026-11-06）。放不下時每張表只有一欄，用「累計／本筆變動」切換，和 1024 到 1439 一樣。
import { useEffect, useState } from 'react';

/** 三欄並列時一張表要的寬度：名稱欄 9em 加三個金額欄（七位數的金額加箭頭） */
export const COLUMNS_TABLE_MIN_WIDTH = 520;

/** 表格區的寬度分給 count 張表（扣掉欄距）之後，每張夠不夠放三欄 */
export function columnsFit(gridWidth: number, gap: number, count = 3): boolean {
  return (gridWidth - gap * (count - 1)) / count >= COLUMNS_TABLE_MIN_WIDTH;
}

/** 回傳 [ref, fits]：ref 掛在表格區（.ll-lab-tables__grid）上；還沒量到或瀏覽器沒有 ResizeObserver 時是 false（一欄） */
export function useColumnsFit(count = 3): [(el: HTMLElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') {
      setFits(false);
      return;
    }
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      setFits(columnsFit(el.clientWidth, gap, count));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, count]);
  return [setEl, fits];
}
