// 題型對應（03 第 2.4 節表二）：依 question.type 挑 web-ui 的題型元件，把作答工作階段的狀態與 packages/quiz 的判分結果接上去。
// 元件不判分：checked 之後從 ScoreResult.detail 取逐選項、逐卡片、逐目標的狀態。選項順序用 shuffleChoiceOptions（03 第 2.8 節），
// 報表的列、分類格、方向按鈕與是非不打散。
// 分錄、五步驟、指標計算、交易影響四種題型的作答區要等核心資料，元件也一起延後載入（question-types.tsx），作答頁第一波只帶其他題型的元件（06 第 8.2 節）。
// 沒有骨架（維護者 2026-10-26）：還缺模組或資料的題目用 usePendingReport 回報「還沒齊」（useAsync.ts），LevelSession 讓整張題目卡齊了才出現；
// 模組已經載好（回饋期間預載）時名稱都同步算，換題的第一次渲染就完整。
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';
import { formatMoney } from '@ledgerland/i18n';
import type { JsonValue } from '@ledgerland/progress';
import { shuffleChoiceOptions, type ScoreResult } from '@ledgerland/quiz';
import {
  ChoiceGroup,
  ClassifyBoard,
  PickLine,
  PickStatement,
  RatioTable,
  TrueFalse,
  useStatementNames,
  type ChoiceOptionStatus,
  type ClassifyResult,
  type PickLineRow,
  type RatioTableRow,
  type StatementCard,
  type StatementCode,
} from '@ledgerland/web-ui';
import type { CompiledRatio, QuestionSnapshot, TermIndexEntry } from '../../lib/content.ts';
import { categoriesFor, useCategoryLabels, type ClassifyDimension } from './categories.ts';
import { layoutOf, statementRowsIn, type StatementCode as CoreStatementCode } from './layout-lazy.ts';
import { Markup } from './Markup.tsx';
import { renderPlain, valueContextOf } from './placeholders.ts';
import { termByRef } from './term-lookup.ts';
import { digitsOf, formatRatioValue } from './ratio-format.ts';
import { ratioInfoIn, type RatioInfo } from './ratio-lazy.ts';
import type { RatioUnit } from './ratio-units.ts';
import { useTermDetails, useTerms } from './terms.tsx';
import { useCoreData, usePendingReport, useQuestionTypes } from './useAsync.ts';

export interface ChoiceOptionSnapshot {
  id: string;
  text: string;
  short?: string;
  feedback?: string;
  upside?: string;
  downside?: string;
  pin?: 'last';
}

export interface QuestionViewProps {
  q: QuestionSnapshot;
  /** 作答工作階段裡這題的介面狀態 */
  answer: JsonValue | undefined;
  checked: boolean;
  result?: ScoreResult;
  /** 選項打散的種子（作答工作階段的 shuffleSeed） */
  shuffleSeed: string;
  promptId: string;
  onChange: (answer: JsonValue, rawInput?: string) => void;
}

/** 佔位符的值來源（vars、compiled.values、compiled.expected，ratio_numeric 另由 compiled.ratio 補上 expected.answer）；實作在 placeholders.ts */
export { valueContextOf };

/** 名詞資料以 accountRef 或 ratioRef 對應科目與指標（04 第 16.3 節；實作在 term-lookup.ts，指標帶不帶版本都找得到） */
export { termByRef };

export function optionsOf(q: QuestionSnapshot): readonly ChoiceOptionSnapshot[] {
  return (q['options'] as ChoiceOptionSnapshot[] | undefined) ?? [];
}

/** 選項 ID 對顯示文字（short 優先），給 {{option:…}} 與回饋用；數值佔位符先換成純文字 */
export function useOptionTexts(q: QuestionSnapshot): ReadonlyMap<string, string> {
  const { locale, labelOf } = useTerms();
  return useMemo(() => {
    const ctx = valueContextOf(q);
    return new Map(optionsOf(q).map((o) => [o.id, renderPlain(o.short ?? o.text, ctx, locale, { term: labelOf })] as const));
  }, [q, locale, labelOf]);
}

export function useShuffledOptions(q: QuestionSnapshot, shuffleSeed: string): readonly ChoiceOptionSnapshot[] {
  return useMemo(() => shuffleChoiceOptions(optionsOf(q), { questionId: q.id, rev: q.rev, attemptId: shuffleSeed }), [q, shuffleSeed]);
}

// 分錄、五步驟、指標計算、交易影響的作答區連同元件一起延後載入（question-types.tsx、lazy-data.ts）：模組到了才畫，到之前回報「還沒齊」；
// 載不到（部署時間差、第一次造訪時斷線）丟給路由的 RouteError（重新整理）
function DeferredQuestion(props: QuestionViewProps) {
  const types = useQuestionTypes();
  usePendingReport(types.value === null && types.error === undefined);
  if (types.error !== undefined) throw types.error;
  if (types.value === null) return null;
  return <types.value.DeferredQuestionView {...props} />;
}

export function QuestionView(props: QuestionViewProps) {
  switch (props.q.type) {
    case 'single_choice':
    case 'multi_choice':
    case 'judgment':
      return <ChoiceQuestion {...props} />;
    case 'ratio_interpret':
      return <RatioInterpretQuestion {...props} />;
    case 'five_step_fill':
    case 'ratio_numeric':
    case 'journal_entry':
    case 'transaction_effect':
      return <DeferredQuestion {...props} />;
    case 'pick_statement':
      return <PickStatementQuestion {...props} />;
    case 'true_false':
      return <TrueFalseQuestion {...props} />;
    case 'pick_line':
      return <PickLineQuestion {...props} />;
    case 'classify':
      return <ClassifyQuestion {...props} />;
    default:
      return <Unsupported type={props.q.type} />;
  }
}

function Unsupported({ type }: { type: string }) {
  const { t } = useLingui();
  return (
    <p className="ll-muted">
      {t({ id: 'quiz.unsupportedType', message: `這種題型（${type}）這個版本還不能作答。`, comment: '題型還沒實作時的提示；type 是題型代號' })}
    </p>
  );
}

function ChoiceQuestion({ q, answer, checked, result, shuffleSeed, promptId, onChange }: QuestionViewProps) {
  const options = useShuffledOptions(q, shuffleSeed);
  const ctx = valueContextOf(q);
  const multi = q.type === 'multi_choice';
  const hint = multi ? (q['scoringMode'] as 'any_correct' | 'all_correct') : undefined;
  const mode = hint === 'all_correct' ? 'multiple' : 'single';
  // multi_choice 的作答一律是陣列（any_correct 只有一個元素，03 第 2.12 節）；單選類是選項 ID
  const list = Array.isArray(answer) ? (answer as string[]) : [];
  const selected: string | null | readonly string[] = mode === 'multiple' ? list : multi ? (list[0] ?? null) : typeof answer === 'string' ? answer : null;
  const statuses = useMemo(() => {
    const d = result?.detail;
    if (!d || (d.kind !== 'choice' && d.kind !== 'multi_choice')) return undefined;
    const out: Record<string, ChoiceOptionStatus> = {};
    for (const o of d.options) out[o.id] = o.status;
    return out;
  }, [result]);
  const judgment = q.type === 'judgment';
  // 作答後選項卡只留狀態行（正確答案，你選了…）：逐選項的說明只在回饋面板出現一次（引用框與「看其他選項為什麼不對」），不在卡片裡再印一次
  const group = (
    <ChoiceGroup
      name={`q-${q.id}`}
      promptId={promptId}
      mode={mode}
      {...(hint === undefined ? {} : { hint })}
      options={options.map((o) => ({ id: o.id, text: <Markup text={o.text} ctx={ctx} plainTerms /> }))}
      {...(statuses === undefined ? {} : { statuses })}
      selected={selected}
      checked={checked && !judgment}
      onSelect={(id) => {
        if (mode === 'multiple') onChange(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
        else if (multi) onChange([id]);
        else onChange(id);
      }}
    />
  );
  // 取捨題沒有對錯：確認後只鎖住，不顯示任何狀態
  if (judgment && checked)
    return (
      <fieldset disabled className="ll-judgment-locked">
        {group}
      </fieldset>
    );
  return group;
}

function TrueFalseQuestion({ q, answer, checked, promptId, onChange }: QuestionViewProps) {
  const ctx = valueContextOf(q);
  const value = typeof answer === 'boolean' ? answer : null;
  const correct = q['correct'] as boolean;
  const feedbackText = value === null ? undefined : ((value ? q['feedbackTrue'] : q['feedbackFalse']) as string | undefined);
  return (
    <TrueFalse
      name={`q-${q.id}`}
      statement={
        <span id={`${promptId}-statement`}>
          <Markup text={q['statement'] as string} ctx={ctx} plainTerms />
        </span>
      }
      value={value}
      checked={checked}
      {...(checked ? { correct } : {})}
      onChange={onChange}
      {...(feedbackText === undefined ? {} : { feedback: <Markup text={feedbackText} ctx={ctx} /> })}
    />
  );
}

/** 選報表題三張報表卡片對應的名詞 ID（報表名詞在索引裡依名稱找）；codeOf 是選項 ID 對報表代號（對不上時為 null） */
export function statementTermIds(
  codeOf: ReadonlyMap<string, StatementCode> | null,
  names: Record<StatementCode, string>,
  terms: ReadonlyMap<string, TermIndexEntry>,
): ReadonlyMap<StatementCode, string> {
  const map = new Map<StatementCode, string>();
  if (codeOf === null) return map;
  for (const code of codeOf.values()) {
    const term = [...terms.values()].find((t) => t.category === 'statement' && t.label === names[code]);
    if (term) map.set(code, term.id);
  }
  return map;
}

/** 選報表題的選項是不是三張報表的名稱（是的話回傳選項 ID 對報表代號；對不上就用一般選項群組）。選項的順序不影響結果 */
export function statementCodesOf(options: readonly ChoiceOptionSnapshot[], names: Record<StatementCode, string>): ReadonlyMap<string, StatementCode> | null {
  const map = new Map<string, StatementCode>();
  for (const o of options) {
    const code = (Object.keys(names) as StatementCode[]).find((c) => names[c] === o.text.trim());
    if (code) map.set(o.id, code);
  }
  return map.size === options.length && new Set(map.values()).size === options.length ? map : null;
}

function PickStatementQuestion(props: QuestionViewProps) {
  const { q, answer, checked, shuffleSeed, promptId, onChange } = props;
  const names = useStatementNames();
  const { locale, terms } = useTerms();
  const options = useShuffledOptions(q, shuffleSeed);
  // 選項文字就是三張報表的名稱時用報表卡片（一句說明取名詞資料的定義）；對不上就退回一般選項群組
  const codeOf = useMemo(() => statementCodesOf(options, names), [options, names]);
  // 報表名詞在索引裡找 ID，定義在完整內容檔（08 第 7.3 節的兩層名詞快照），三張報表的檔案都在 precache
  const termIdOf = useMemo(() => statementTermIds(codeOf, names, terms), [codeOf, terms, names]);
  const details = useTermDetails([...termIdOf.values()], locale);
  // 報表卡片的一句說明在完整內容檔裡：讀到之前這一題還沒齊（LevelSession 回饋期間已替下一題預讀，通常同步就有）
  usePendingReport(details === null);
  if (codeOf === null) return <ChoiceQuestion {...props} />;
  // 逐選項的說明只在回饋面板出現一次（和選擇題相同），報表卡片作答後只留狀態
  const cards: StatementCard[] = options.map((o) => {
    const code = codeOf.get(o.id)!;
    const termId = termIdOf.get(code);
    return { code, description: (termId === undefined ? undefined : details?.get(termId)?.definition) ?? '' };
  });
  const idOf = (code: StatementCode) => [...codeOf.entries()].find(([, c]) => c === code)?.[0];
  const value = typeof answer === 'string' ? (codeOf.get(answer) ?? null) : null;
  const correctCode = codeOf.get(q['correctOptionId'] as string);
  return (
    <PickStatement
      name={`q-${q.id}`}
      labelledBy={promptId}
      cards={cards}
      value={value}
      checked={checked}
      {...(checked && correctCode !== undefined ? { correct: correctCode } : {})}
      onChange={(code) => {
        const id = idOf(code);
        if (id !== undefined) onChange(id);
      }}
    />
  );
}

function PickLineQuestion({ q, answer, checked, result, onChange }: QuestionViewProps) {
  const { locale, labelOf } = useTerms();
  const names = useStatementNames();
  const ctx = valueContextOf(q);
  const target = q['statement'] as CoreStatementCode;
  // 快照有 compiled.lines（列與金額，tools/lib/content-snapshot.mjs）就直接用，不載入核心；舊快照沒有時退回只列出列名的版面資料
  const compiledLines = q.compiled?.lines;
  const core = useCoreData(compiledLines === undefined);
  usePendingReport(compiledLines === undefined && core.value === null && core.error === undefined);
  if (compiledLines === undefined && core.error !== undefined) throw core.error;
  const layoutLines = compiledLines === undefined && core.value !== null ? statementRowsIn(layoutOf(core.value), target, locale, labelOf) : undefined;
  const feedbackByLine = (q['feedbackByLine'] as Record<string, string> | undefined) ?? {};
  const correctLines = result?.detail.kind === 'pick_line' ? result.detail.correctLines : (q['correctLines'] as string[]);
  const lines: { id: string; label: string; heading: boolean; total: boolean; value?: string }[] | undefined =
    compiledLines !== undefined
      ? compiledLines.map((l) => ({
          id: l.id,
          label: l.label,
          heading: l.heading === true,
          total: l.total === true,
          ...(l.heading === true ? {} : { value: formatMoney(l.value, locale) }),
        }))
      : layoutLines;
  if (lines === undefined) return null;
  const rows: PickLineRow[] = lines.map((r) => ({
    id: r.id,
    label: r.label,
    heading: r.heading,
    total: r.total,
    ...(r.value === undefined ? {} : { value: r.value }),
    ...(feedbackByLine[r.id] === undefined ? {} : { feedback: <Markup text={feedbackByLine[r.id]!} ctx={ctx} /> }),
  }));
  return (
    <PickLine
      caption={names[target]}
      {...(compiledLines === undefined ? { valueHeader: '' } : {})}
      rows={rows}
      selected={typeof answer === 'string' ? answer : null}
      checked={checked}
      {...(checked ? { correctLineIds: correctLines } : {})}
      onSelect={(id) => onChange(id)}
    />
  );
}

function ClassifyQuestion({ q, answer, checked, result, promptId, onChange }: QuestionViewProps) {
  const { locale, labelOf, terms } = useTerms();
  const categoryLabel = useCategoryLabels();
  const dimension = q['dimension'] as ClassifyDimension;
  const items = useMemo(() => (q['items'] as { id: string; account?: string; ratio?: string; text?: string }[] | undefined) ?? [], [q]);
  // 卡片文字只靠名詞索引（LevelSession 等索引到了才畫題目），同步算，沒有載入中的狀態
  const labels = useMemo(() => {
    const ctx = valueContextOf(q);
    const out: Record<string, string> = {};
    for (const it of items) {
      if (it.text !== undefined) out[it.id] = renderPlain(it.text, ctx, locale, { term: labelOf });
      else if (it.account !== undefined) out[it.id] = termByRef(terms, 'accountRef', it.account)?.label ?? it.account;
      else if (it.ratio !== undefined) out[it.id] = termByRef(terms, 'ratioRef', it.ratio)?.label ?? it.ratio;
    }
    return out;
  }, [q, items, locale, labelOf, terms]);
  const categories = useMemo(
    () => categoriesFor(dimension, q.compiled?.categories).map((id) => ({ id, label: categoryLabel(dimension, id) })),
    [dimension, q, categoryLabel],
  );
  const placement = typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? (answer as Record<string, string>) : {};
  const results: Record<string, ClassifyResult> | undefined =
    result?.detail.kind === 'classify'
      ? Object.fromEntries(result.detail.items.map((i) => [i.id, { correct: i.correct, expectedCategoryId: i.expected }]))
      : undefined;
  return (
    <ClassifyBoard
      labelledBy={promptId}
      cards={items.map((it) => ({ id: it.id, label: labels[it.id] ?? it.id, text: labels[it.id] ?? it.id }))}
      categories={categories}
      placement={placement}
      onPlace={(cardId, categoryId) => {
        const next: Record<string, string> = { ...placement };
        if (categoryId === null) delete next[cardId];
        else next[cardId] = categoryId;
        onChange(next);
      }}
      checked={checked}
      {...(results === undefined ? {} : { results })}
    />
  );
}

/** 指標相關的介面字串：單位後綴、版本名稱、旗標說明（指標計算題與回饋區共用） */
export function useRatioStrings() {
  const { t } = useLingui();
  const suffixOf = (unit: RatioUnit | undefined): string | undefined => {
    switch (unit) {
      case 'percent':
        return '%';
      case 'turnover':
        return t({ id: 'ratio.unit.turns', message: '次', comment: '指標單位：週轉次數（資產週轉率等，04 第 12.4 節）' });
      case 'multiple':
        return t({ id: 'ratio.unit.times', message: '倍', comment: '指標單位：倍數' });
      case 'days':
        return t({ id: 'ratio.unit.days', message: '天', comment: '指標單位：天數' });
      default:
        return undefined;
    }
  };
  const versionLabel = (version: string): string => {
    switch (version) {
      case 'excel':
        return t({ id: 'ratio.version.excel', message: 'Excel 口徑', comment: '指標版本名稱（04 第 12.7 節）：課程 Excel 的公式' });
      case 'slides01':
        return t({
          id: 'ratio.version.slides01',
          message: '損益結構口徑',
          comment: '指標版本名稱（04 第 12.7 節）：損益結構比率用的公式；學生看的說法，不露出版本代號或教材單元',
        });
      case 'slides02':
        return t({
          id: 'ratio.version.slides02',
          message: '簡化公式口徑',
          comment: '指標版本名稱（04 第 12.7 節）：入門用的簡化公式（期末餘額、單期）；學生看的說法，不露出版本代號或教材單元',
        });
      case 'slides03':
        return t({
          id: 'ratio.version.slides03',
          message: '年報公式口徑',
          comment: '指標版本名稱（04 第 12.7 節）：依年報財務分析寫法的公式；學生看的說法，不露出版本代號或教材單元',
        });
      case 'dupont':
        return t({ id: 'ratio.version.dupont', message: '杜邦分析口徑', comment: '指標版本名稱：杜邦分析的公式' });
      default:
        return version;
    }
  };
  const flagNote = (flags: readonly string[]): string | undefined => {
    const notes: string[] = [];
    if (flags.includes('single_period_approx'))
      notes.push(t({ id: 'ratio.flag.singlePeriod', message: '單期近似：平均值以期末代替', comment: '指標旗標說明' }));
    if (flags.includes('end_of_period_balance')) notes.push(t({ id: 'ratio.flag.endOfPeriod', message: '以期末餘額計算', comment: '指標旗標說明' }));
    if (flags.includes('excel_approximation')) notes.push(t({ id: 'ratio.flag.excelApprox', message: 'Excel 的近似做法', comment: '指標旗標說明' }));
    return notes.length === 0 ? undefined : notes.join('；');
  };
  return { suffixOf, versionLabel, flagNote };
}

export function ratioLabel(
  info: RatioInfo | undefined,
  ratioId: string,
  terms: ReadonlyMap<string, TermIndexEntry>,
  labelOf: (id: string) => string | undefined,
): string {
  return (info === undefined ? undefined : labelOf(info.termRef)) ?? termByRef(terms, 'ratioRef', ratioId)?.label ?? ratioId;
}

/** 指標判讀題上方的小表格：數字一律來自快照 compiled（ratios 或單一 ratio），沒有就不顯示 */
function RatioInterpretQuestion(props: QuestionViewProps) {
  const { q } = props;
  const { t } = useLingui();
  const { locale, labelOf, terms } = useTerms();
  const { versionLabel } = useRatioStrings();
  const compiledRatios: readonly CompiledRatio[] = q.compiled?.ratios ?? (q.compiled?.ratio === undefined ? [] : [q.compiled.ratio]);
  // 小表格的版本名稱與小數位數來自指標登錄檔：有指標才載，載到之前這一題還沒齊；載不到時降級（名稱退回名詞資料、數字照快照的位數）
  const core = useCoreData(compiledRatios.length > 0);
  usePendingReport(compiledRatios.length > 0 && core.value === null && core.error === undefined);
  const rows: RatioTableRow[] = compiledRatios.map((r) => {
    const info = core.value === null ? undefined : ratioInfoIn(core.value, r.ratioRef, locale, labelOf);
    const id = r.ratioRef.split('@')[0] ?? r.ratioRef;
    const value =
      r.displayValue === null
        ? undefined
        : formatRatioValue(r.displayValue, info?.unit, locale, info === undefined ? digitsOf(r.displayValue) : info.displayDecimals);
    return {
      id: r.ratioRef,
      label: ratioLabel(info, id, terms, labelOf),
      ...(value === undefined ? {} : { value }),
      status: r.status,
      ...(info === undefined ? {} : { note: versionLabel(info.version) }),
    };
  });
  return (
    <>
      {rows.length > 0 && (
        <RatioTable caption={t({ id: 'quiz.ratio.tableCaption', message: '這一題的指標', comment: '指標判讀題上方小表格的標題' })} rows={rows} />
      )}
      <ChoiceQuestion {...props} />
    </>
  );
}
