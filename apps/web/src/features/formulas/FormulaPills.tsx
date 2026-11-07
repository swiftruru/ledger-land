// 苦練頁的「相關公式」膠囊（2026-11-07）：背題閱讀頁的解析下面、作答頁答完後的回饋、模擬考成績的逐題、錯題清單都用同一列。
// 公式索引（在 precache）用 useFormulasOfQuestions 讀一次做成「題目 → 公式」的反查；膠囊連到公式頁（返回鍵回到原本的題）。
// 作答中的模擬考不放（不給提示）。字串在第二層 catalog（pages）。
import { useLingui } from '@lingui/react/macro';
import { startTransition, useEffect, useId, useState } from 'react';
import { localePath } from '@ledgerland/i18n';
import { TermPill, TermPillList } from '@ledgerland/web-ui';
import { loadFormulaIndex, type FormulaIndexEntry } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { formulasOfQuestion } from './catalogue.ts';
import '../../styles/formula-pills.css';

export type FormulasOfQuestion = ReadonlyMap<string, FormulaIndexEntry[]>;
const EMPTY: FormulasOfQuestion = new Map();

/** 題目 ID 對相關公式；索引還沒到或讀不到時是空的 Map（膠囊列就不畫，不擋頁面） */
export function useFormulasOfQuestions(): FormulasOfQuestion {
  const locale = useLocale();
  const [map, setMap] = useState<FormulasOfQuestion>(EMPTY);
  useEffect(() => {
    let alive = true;
    loadFormulaIndex(locale).then(
      (list) => alive && startTransition(() => setMap(formulasOfQuestion(list))),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return map;
}

export function FormulaPills({ questionId, formulas, className }: { questionId: string; formulas: FormulasOfQuestion; className?: string }) {
  const { t } = useLingui();
  const locale = useLocale();
  const id = useId();
  const list = formulas.get(questionId);
  if (!list || list.length === 0) return null;
  return (
    <div className={`ll-fxpills${className ? ` ${className}` : ''}`} data-testid="formula-pills">
      <p id={id} className="ll-fxpills__title">
        {t({ id: 'formulas.pills.title', message: '相關公式', comment: '苦練頁題目底下「相關公式」膠囊列的小標' })}
      </p>
      <TermPillList aria-labelledby={id} className="ll-fxpills__list">
        {list.map((f) => (
          <TermPill key={f.id} href={localePath(locale, `/formulas/${f.id}/`)} cellProps={{ 'data-formula-id': f.id }}>
            {f.label}
          </TermPill>
        ))}
      </TermPillList>
    </div>
  );
}
