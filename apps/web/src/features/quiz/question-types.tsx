// 要等核心資料（科目表、教材版面、指標登錄檔）才畫得出作答區的四種題型（03 第 2.4 節表二）：分錄、五步驟勾稽填格、指標計算、交易影響。
// 這四種題型的作答區要等核心資料，所以元件本身也和資料一起延後載入（lazy-data.ts 的 loadQuestionTypes），
// 作答頁第一波的 chunk 不帶分錄編輯器、勾稽填格、影響選擇與指標輸入（06 第 8.2 節、14 第 5.2 節）。題幹、選項類與分類題照舊在 QuestionView.tsx。
// 沒有骨架（維護者 2026-10-26）：核心資料已經載好時（回饋期間預載）名稱在第一次渲染就同步算好；還沒載好時回報「還沒齊」（useAsync.ts 的 usePendingReport），
// 整張題目卡等齊了再出現。核心資料載不到時在 render 裡丟出錯誤，交給路由的 RouteError（重新整理），不會一直停在空白。
import { useLingui } from '@lingui/react/macro';
import type { Direction } from '@ledgerland/content-schema';
import { formatMoney } from '@ledgerland/i18n';
import { useMemo } from 'react';
import {
  FiveStepFill,
  ImpactPicker,
  JournalEntryEditor,
  RatioNumeric,
  useDirectionLabels,
  useStatementNames,
  type FiveStepCell,
  type FiveStepCellResult,
  type ImpactAnswer,
  type ImpactResult,
  type JournalEntryResult,
  type RatioNumericResult,
} from '@ledgerland/web-ui';
import { ELEMENT_ORDER, accountOptionsIn } from './accounts-lazy.ts';
import {
  journalLineStatuses,
  journalLinesOf,
  openCellsOf,
  ratioInputUnitOf,
  targetsOf,
  withEffectAnswer,
  type EffectUiAnswers,
  type JournalUiLine,
  type RatioUiAnswer,
} from './answers.ts';
import { useCategoryLabels } from './categories.ts';
import { cellMetaIn, checkLetterOf, stepMark, type CellMeta } from './five-step.ts';
import type { CoreData } from './lazy-data.ts';
import { layoutOf, lineLabelIn } from './layout-lazy.ts';
import { ratioLabel, termByRef, useRatioStrings, type QuestionViewProps } from './QuestionView.tsx';
import { formatRatioValue } from './ratio-format.ts';
import { ratioInfoIn } from './ratio-lazy.ts';
import type { RatioUnit } from './ratio-units.ts';
import { useTerms } from './terms.tsx';
import { useCoreData, usePendingReport } from './useAsync.ts';

/** 核心資料：已載好就同步給；還沒載好回報「還沒齊」並回傳 null；載不到就丟出錯誤（RouteError） */
function useRequiredCore(): CoreData | null {
  const core = useCoreData();
  usePendingReport(core.value === null && core.error === undefined);
  if (core.error !== undefined) throw core.error;
  return core.value;
}

/** QuestionView 依題型轉進來的四種題型 */
export function DeferredQuestionView(props: QuestionViewProps) {
  switch (props.q.type) {
    case 'five_step_fill':
      return <FiveStepQuestion {...props} />;
    case 'ratio_numeric':
      return <RatioNumericQuestion {...props} />;
    case 'journal_entry':
      return <JournalEntryQuestion {...props} />;
    default:
      return <EffectQuestion {...props} />;
  }
}

function EffectQuestion({ q, answer, checked, result, onChange }: QuestionViewProps) {
  const { locale, terms, labelOf } = useTerms();
  const directionLabels = useDirectionLabels();
  const core = useRequiredCore();
  const targets = targetsOf(q) as {
    id: string;
    kind: string;
    line?: string;
    account?: string;
    ratioRef?: string;
    measure: 'direction' | 'delta' | 'value' | 'status';
  }[];
  const labels = useMemo(() => {
    if (core === null) return null;
    const layout = layoutOf(core);
    const out: Record<string, string> = {};
    for (const tg of targets) {
      if (tg.line !== undefined) out[tg.id] = lineLabelIn(layout, tg.line, locale, labelOf);
      else if (tg.account !== undefined) out[tg.id] = termByRef(terms, 'accountRef', tg.account)?.label ?? tg.account;
      else if (tg.ratioRef !== undefined) out[tg.id] = termByRef(terms, 'ratioRef', tg.ratioRef)?.label ?? tg.ratioRef;
      else out[tg.id] = tg.id;
    }
    return out;
  }, [core, targets, locale, labelOf, terms]);
  if (labels === null) return null;
  const answers: EffectUiAnswers = typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? (answer as EffectUiAnswers) : {};
  const choices = q['choices'] as Direction[] | undefined;
  const results: Record<string, ImpactResult> | undefined =
    result?.detail.kind === 'transaction_effect'
      ? Object.fromEntries(
          result.detail.targets.map((tg) => [
            tg.id,
            {
              correct: tg.correct,
              expected:
                typeof tg.expected === 'number'
                  ? formatMoney(tg.expected, locale)
                  : tg.expected === null
                    ? ''
                    : (directionLabels[tg.expected as Direction] ?? String(tg.expected)),
            },
          ]),
        )
      : undefined;
  return (
    <ImpactPicker
      name={`q-${q.id}`}
      targets={targets
        .filter((tg) => tg.measure !== 'status')
        .map((tg) => ({ id: tg.id, label: labels[tg.id] ?? tg.id, measure: tg.measure as 'direction' | 'delta' | 'value', unit: 'money' }))}
      {...(choices === undefined ? {} : { choices })}
      answers={answers as Readonly<Partial<Record<string, ImpactAnswer>>>}
      onChange={(targetId, a) => onChange(withEffectAnswer(answers, targetId, a), a.raw)}
      checked={checked}
      {...(results === undefined ? {} : { results })}
    />
  );
}

function FiveStepQuestion({ q, answer, checked, result, promptId, onChange }: QuestionViewProps) {
  const { t } = useLingui();
  const { locale, labelOf } = useTerms();
  const names = useStatementNames();
  const core = useRequiredCore();
  const cellIds = openCellsOf(q);
  const data = useMemo(() => {
    if (core === null) return null;
    const layout = layoutOf(core);
    const labels: Record<string, string> = {};
    for (const id of cellIds) labels[id] = lineLabelIn(layout, id, locale, labelOf);
    return { meta: cellMetaIn(layout, cellIds), labels };
  }, [core, cellIds, locale, labelOf]);
  if (data === null) return null;
  const values: Record<string, string> = {};
  if (typeof answer === 'object' && answer !== null && !Array.isArray(answer))
    for (const [k, v] of Object.entries(answer)) if (typeof v === 'string') values[k] = v;
  const cells: FiveStepCell[] = cellIds.map((id) => {
    const meta: CellMeta = data.meta[id] ?? { statement: 'bs' };
    const statement = names[meta.statement];
    const line = data.labels[id] ?? id;
    const step = meta.step === undefined ? '' : stepMark(meta.step, locale);
    const letter = meta.step === undefined ? '' : checkLetterOf(meta.step);
    const label =
      meta.step === undefined
        ? t({ id: 'quiz.fiveStep.cell', message: `${statement}的${line}`, comment: '五步驟勾稽填格的格子標籤；statement 是報表名稱、line 是列名' })
        : t({
            id: 'quiz.fiveStep.cellWithCheck',
            message: `步驟${step}（勾稽點 ${letter}），${statement}的${line}`,
            comment: '五步驟勾稽填格的格子標籤（14 T13：數字是步驟、字母是勾稽點）；step 是步驟編號、letter 是勾稽點字母、statement 是報表名稱、line 是列名',
          });
    return { id, label, unit: 'money' };
  });
  const results: Record<string, FiveStepCellResult> | undefined =
    result?.detail.kind === 'five_step_fill'
      ? Object.fromEntries(
          result.detail.cells.map((c) => [
            c.line,
            {
              correct: c.correct,
              expected: formatMoney(c.expected, locale),
              ...(c.selected === null ? {} : { difference: formatMoney(Math.abs(c.selected - c.expected), locale) }),
            },
          ]),
        )
      : undefined;
  return (
    <FiveStepFill
      cells={cells}
      values={values}
      onChange={(cellId, raw) => onChange({ ...values, [cellId]: raw }, raw)}
      checked={checked}
      {...(results === undefined ? {} : { results })}
      labelledBy={promptId}
    />
  );
}

function RatioNumericQuestion({ q, answer, checked, result, onChange }: QuestionViewProps) {
  const { t } = useLingui();
  const { locale, labelOf, terms } = useTerms();
  const { suffixOf, versionLabel, flagNote } = useRatioStrings();
  const compute = q['compute'] as { ratioRef: string } | undefined;
  const ratioRef = compute?.ratioRef ?? '';
  const answerUnit = q['answerUnit'] as RatioUnit | undefined;
  const decimals = typeof q['decimals'] === 'number' ? q['decimals'] : undefined;
  const core = useRequiredCore();
  const info = useMemo(() => (core === null ? undefined : ratioInfoIn(core, ratioRef, locale, labelOf)), [core, ratioRef, locale, labelOf]);
  if (core === null) return null;
  const ui: RatioUiAnswer = typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? (answer as RatioUiAnswer) : {};
  const label = ratioLabel(info, ratioRef.split('@')[0] ?? ratioRef, terms, labelOf);
  const suffix = suffixOf(answerUnit);
  const naText = t({ id: 'quiz.ratio.na', message: 'N/A', comment: '指標正解是 N/A 時顯示的文字' });
  const res: RatioNumericResult | undefined =
    result?.detail.kind === 'numeric'
      ? {
          correct: result.correct,
          expected: result.detail.expectedValue === null ? naText : formatRatioValue(result.detail.expectedValue, answerUnit, locale, decimals),
        }
      : undefined;
  const note = info === undefined ? undefined : flagNote(info.flags);
  const version = info?.version;
  return (
    <RatioNumeric
      label={label}
      unit={ratioInputUnitOf(q)}
      {...(suffix === undefined ? {} : { suffix })}
      value={ui.raw ?? ''}
      onChange={(raw) => onChange({ ...(ui.na === undefined ? {} : { na: ui.na }), raw }, raw)}
      na={ui.na === true}
      onNaChange={(na) => onChange({ ...(ui.raw === undefined ? {} : { raw: ui.raw }), na })}
      checked={checked}
      {...(res === undefined ? {} : { result: res })}
      {...(info === undefined
        ? {}
        : {
            formula: {
              text: info.formula,
              versionLabel: t({
                id: 'quiz.ratio.version',
                message: `本題採${versionLabel(version ?? '')}`,
                comment: '「看公式」裡的版本說明；version 是版本名稱',
              }),
              ...(note === undefined ? {} : { note }),
            },
          })}
    />
  );
}

function JournalEntryQuestion({ q, answer, checked, result, promptId, onChange }: QuestionViewProps) {
  const { t } = useLingui();
  const { locale, terms } = useTerms();
  const categoryLabel = useCategoryLabels();
  const core = useRequiredCore();
  const options = useMemo(() => {
    if (core === null) return null;
    const ids = (q['accountChoices'] as string[] | undefined) ?? [];
    return accountOptionsIn(core, ids, locale, (id) => termByRef(terms, 'accountRef', id)?.label);
  }, [core, q, locale, terms]);
  if (options === null) return null;
  const lines: JournalUiLine[] = journalLinesOf(answer);
  const labelOfAccount = new Map(options.map((o) => [o.id, o.label] as const));
  const groups = ELEMENT_ORDER.filter((el) => options.some((o) => o.element === el)).map((el) => ({ id: el, label: categoryLabel('element', el) }));
  let feedback: JournalEntryResult | undefined;
  if (result?.detail.kind === 'journal_entry') {
    const st = journalLineStatuses(lines, result.detail);
    feedback = {
      lines: st.lines,
      missing: st.missing.map((m) => ({ side: m.side, account: labelOfAccount.get(m.account) ?? m.account, amount: formatMoney(m.amount, locale) })),
    };
  }
  return (
    <JournalEntryEditor
      accounts={options.map((o) => ({ id: o.id, label: o.label, group: o.element, aliases: o.aliases }))}
      groups={groups}
      lines={lines}
      onChange={(next) => onChange(next.map((l) => ({ key: l.key, account: l.account, side: l.side, raw: l.raw })))}
      checked={checked}
      {...(feedback === undefined ? {} : { result: feedback })}
      note={t({
        id: 'quiz.journal.note',
        message: '報表上的「本期進貨」「期末存貨」是由存貨帳推導出來的列，不是分錄裡的科目；分錄只寫科目。',
        comment: '分錄題旁的一句對應說明（03 第 2.6 節）',
      })}
      labelledBy={promptId}
    />
  );
}
