// 苦練頁的「相關公式」膠囊（2026-11-07）：背題閱讀頁的解析下面、作答頁答完後的回饋、模擬考成績的逐題、錯題清單都用同一列。
// 公式索引（在 precache）用 useFormulasOfQuestions 讀一次做成「題目 → 公式」的反查。膠囊是連到公式頁的連結，一般的點按改成開公式面板（FormulaSheet，
// 2026-11-08）：不離開作答，面板腳部再連到完整條目；按住修飾鍵或滑鼠中鍵仍照連結開新分頁，面板或內容載不到時退回連結。
// 作答中的模擬考不放（不給提示）。字串在第二層 catalog（pages）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { TermPill, TermPillList } from '@ledgerland/web-ui';
import { loadFormulaDetail, type FormulaIndexEntry, type FormulaSnapshot } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { formulasOfQuestion } from './catalogue.ts';
import { loadFormulaSheet, type FormulaSheetComponent } from './formula-sheet-lazy.ts';
import { useFormulaIndex } from './useFormulaIndex.ts';
import '../../styles/formula-pills.css';

export type FormulasOfQuestion = ReadonlyMap<string, FormulaIndexEntry[]>;

/** 題目 ID 對相關公式；索引還沒到或讀不到時是空的 Map（膠囊列就不畫，不擋頁面） */
export function useFormulasOfQuestions(): FormulasOfQuestion {
  const index = useFormulaIndex();
  return useMemo(() => formulasOfQuestion(index), [index]);
}

export function FormulaPills({ questionId, formulas, className }: { questionId: string; formulas: FormulasOfQuestion; className?: string }) {
  const { t } = useLingui();
  const locale = useLocale();
  const navigate = useNavigate();
  const id = useId();
  const list = formulas.get(questionId);
  // 面板：按下膠囊後同時載元件與完整內容，齊了才開（對話框一次到位）；關閉後焦點回到那顆膠囊
  const [sheet, setSheet] = useState<{ Comp: FormulaSheetComponent; formula: FormulaSnapshot } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (opening === null) return;
    let alive = true;
    Promise.all([loadFormulaSheet(), loadFormulaDetail(opening, locale)]).then(
      ([Comp, formula]) => {
        if (!alive) return;
        setOpening(null);
        if (formula === undefined) navigate(localePath(locale, `/formulas/${opening}/`));
        else setSheet({ Comp, formula });
      },
      () => {
        if (!alive) return;
        setOpening(null);
        navigate(localePath(locale, `/formulas/${opening}/`));
      },
    );
    return () => {
      alive = false;
    };
  }, [opening, locale, navigate]);
  if (!list || list.length === 0) return null;
  const onPill = (formulaId: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    returnTo.current = e.currentTarget;
    setOpening(formulaId);
  };
  return (
    <div className={`ll-fxpills${className ? ` ${className}` : ''}`} data-testid="formula-pills">
      <p id={id} className="ll-fxpills__title">
        {t({ id: 'formulas.pills.title', message: '相關公式', comment: '苦練頁題目底下「相關公式」膠囊列的小標' })}
      </p>
      <TermPillList aria-labelledby={id} className="ll-fxpills__list">
        {list.map((f) => (
          <TermPill
            key={f.id}
            href={localePath(locale, `/formulas/${f.id}/`)}
            onClick={onPill(f.id)}
            cellProps={{ 'data-formula-id': f.id }}
            data-testid="formula-pill"
          >
            {f.label}
          </TermPill>
        ))}
      </TermPillList>
      {sheet && <sheet.Comp open onClose={() => setSheet(null)} formula={sheet.formula} returnFocusTo={returnTo} />}
    </div>
  );
}
