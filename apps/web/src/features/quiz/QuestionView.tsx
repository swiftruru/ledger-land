// 題型對應（03 第 2.4 節表二）：依 question.type 挑 web-ui 的題型元件，把作答工作階段的狀態與 packages/quiz 的判分結果接上去。
// 元件不判分：checked 之後從 ScoreResult.detail 取逐選項、逐卡片、逐目標的狀態。選項順序用 shuffleChoiceOptions（03 第 2.8 節），
// 報表的列、分類格、方向按鈕與是非不打散。
import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';
import type { Direction } from '@ledgerland/content-schema';
import { formatMoney } from '@ledgerland/i18n';
import type { JsonValue } from '@ledgerland/progress';
import { shuffleChoiceOptions, type ScoreResult } from '@ledgerland/quiz';
import {
  ChoiceGroup,
  ClassifyBoard,
  ImpactPicker,
  PickLine,
  PickStatement,
  Skeleton,
  TrueFalse,
  useDirectionLabels,
  useStatementNames,
  type ChoiceOptionStatus,
  type ClassifyResult,
  type ImpactAnswer,
  type ImpactResult,
  type PickLineRow,
  type StatementCard,
  type StatementCode,
} from '@ledgerland/web-ui';
import type { QuestionSnapshot, TermSnapshot } from '../../lib/content.ts';
import { targetsOf, withEffectAnswer, type EffectUiAnswers } from './answers.ts';
import { categoriesFor, useCategoryLabels, type ClassifyDimension } from './categories.ts';
import { lineLabel, statementRows, type StatementCode as CoreStatementCode } from './layout-lazy.ts';
import { Markup } from './Markup.tsx';
import { renderPlain, type ValueContext } from './placeholders.ts';
import { useTerms } from './terms.tsx';
import { useAsync } from './useAsync.ts';

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

export function valueContextOf(q: QuestionSnapshot): ValueContext {
  return {
    ...(q.vars === undefined ? {} : { vars: q.vars }),
    ...(q.compiled?.values === undefined ? {} : { values: q.compiled.values }),
    ...(q.compiled?.expected === undefined ? {} : { expected: q.compiled.expected }),
  };
}

/** 名詞資料以 accountRef 或 ratioRef 對應科目與指標（04 第 16.3 節） */
function termByRef(terms: ReadonlyMap<string, TermSnapshot>, field: 'accountRef' | 'ratioRef', value: string): TermSnapshot | undefined {
  for (const tm of terms.values()) if ((tm as { accountRef?: string; ratioRef?: string })[field] === value) return tm;
  return undefined;
}

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

export function QuestionView(props: QuestionViewProps) {
  switch (props.q.type) {
    case 'single_choice':
    case 'ratio_interpret':
    case 'multi_choice':
    case 'judgment':
      return <ChoiceQuestion {...props} />;
    case 'pick_statement':
      return <PickStatementQuestion {...props} />;
    case 'true_false':
      return <TrueFalseQuestion {...props} />;
    case 'pick_line':
      return <PickLineQuestion {...props} />;
    case 'classify':
      return <ClassifyQuestion {...props} />;
    case 'transaction_effect':
      return <EffectQuestion {...props} />;
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
  const group = (
    <ChoiceGroup
      name={`q-${q.id}`}
      promptId={promptId}
      mode={mode}
      {...(hint === undefined ? {} : { hint })}
      options={options.map((o) => ({
        id: o.id,
        text: <Markup text={o.text} ctx={ctx} plainTerms />,
        ...(o.feedback === undefined || judgment ? {} : { feedback: <Markup text={o.feedback} ctx={ctx} /> }),
      }))}
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

function PickStatementQuestion(props: QuestionViewProps) {
  const { q, answer, checked, shuffleSeed, promptId, onChange } = props;
  const names = useStatementNames();
  const { terms } = useTerms();
  const options = useShuffledOptions(q, shuffleSeed);
  const ctx = valueContextOf(q);
  // 選項文字就是三張報表的名稱時用報表卡片（一句說明取名詞資料的定義）；對不上就退回一般選項群組
  const codeOf = useMemo(() => {
    const map = new Map<string, StatementCode>();
    for (const o of options) {
      const code = (Object.keys(names) as StatementCode[]).find((c) => names[c] === o.text.trim());
      if (code) map.set(o.id, code);
    }
    return map.size === options.length && new Set(map.values()).size === options.length ? map : null;
  }, [options, names]);
  if (codeOf === null) return <ChoiceQuestion {...props} />;
  const cards: StatementCard[] = options.map((o) => {
    const code = codeOf.get(o.id)!;
    const term = [...terms.values()].find((t) => t.category === 'statement' && t.label === names[code]);
    return {
      code,
      description: term?.definition ?? '',
      ...(o.feedback === undefined ? {} : { feedback: <Markup text={o.feedback} ctx={ctx} /> }),
    };
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
  const layoutLines = useAsync(
    () => (compiledLines === undefined ? statementRows(target, locale, labelOf) : Promise.resolve(undefined)),
    `${q.id}:${q.rev}:${locale}:${compiledLines === undefined ? 'layout' : 'compiled'}`,
  );
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
  if (lines === undefined) return <Skeleton variant="table" />;
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
  const items = (q['items'] as { id: string; account?: string; ratio?: string; text?: string }[] | undefined) ?? [];
  const ctx = valueContextOf(q);
  const labels = useAsync(async () => {
    const out: Record<string, string> = {};
    for (const it of items) {
      if (it.text !== undefined) out[it.id] = renderPlain(it.text, ctx, locale, { term: labelOf });
      else if (it.account !== undefined) out[it.id] = termByRef(terms, 'accountRef', it.account)?.label ?? it.account;
      else if (it.ratio !== undefined) out[it.id] = termByRef(terms, 'ratioRef', it.ratio)?.label ?? it.ratio;
    }
    return out;
    // terms 載入完成後再算一次
  }, `${q.id}:${q.rev}:${locale}`);
  const categories = useMemo(
    () => categoriesFor(dimension, q.compiled?.categories).map((id) => ({ id, label: categoryLabel(dimension, id) })),
    [dimension, q, categoryLabel],
  );
  if (labels === undefined) return <Skeleton variant="card" />;
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

function EffectQuestion({ q, answer, checked, result, onChange }: QuestionViewProps) {
  const { locale, terms, labelOf } = useTerms();
  const directionLabels = useDirectionLabels();
  const targets = targetsOf(q) as {
    id: string;
    kind: string;
    line?: string;
    account?: string;
    ratioRef?: string;
    measure: 'direction' | 'delta' | 'value' | 'status';
  }[];
  const labels = useAsync(async () => {
    const out: Record<string, string> = {};
    for (const tg of targets) {
      if (tg.line !== undefined) out[tg.id] = await lineLabel(tg.line, locale, labelOf);
      else if (tg.account !== undefined) out[tg.id] = termByRef(terms, 'accountRef', tg.account)?.label ?? tg.account;
      else if (tg.ratioRef !== undefined) out[tg.id] = termByRef(terms, 'ratioRef', tg.ratioRef.split('@')[0]!)?.label ?? tg.ratioRef;
      else out[tg.id] = tg.id;
    }
    return out;
  }, `${q.id}:${q.rev}:${locale}`);
  if (labels === undefined) return <Skeleton variant="card" />;
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
