// 公式索引（在 precache，每個語系一檔）的 hook：讀一次，還沒到或讀不到時是空陣列（膠囊列與篩選就不畫，不擋頁面）。
import { startTransition, useEffect, useState } from 'react';
import { loadFormulaIndex, type FormulaIndexEntry } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';

const EMPTY: readonly FormulaIndexEntry[] = [];

export function useFormulaIndex(): readonly FormulaIndexEntry[] {
  const locale = useLocale();
  const [list, setList] = useState<readonly FormulaIndexEntry[]>(EMPTY);
  useEffect(() => {
    let alive = true;
    loadFormulaIndex(locale).then(
      (entries) => alive && startTransition(() => setList(entries)),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return list;
}
