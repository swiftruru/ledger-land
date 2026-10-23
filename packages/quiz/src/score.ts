// 判分（03 第 2.4、2.5、2.12 節；04 第 2、12.5、14 節）。每題得分 0 到 1；只有分類題與逐目標計分的交易影響題有部分分數。
// 正解一律由呼叫端算好放在 context（核心的 ScenarioAnswer.expected、RatioResult、expectedJournalEntries、科目表推導的分類），本模組不含會計知識。
// 作答裡不存在的選項、目標或格子一律算錯，不 throw；缺少 context 的正解、作答形狀與題型不符是程式錯誤，才 throw。
import type { Direction, Question, QuestionType, RatioStatus, RatioUnit, ScoringMode, TargetAnswer } from '@ledgerland/content-schema';
import type { Chart, EntryLine, Money, Rat, RatioResult, Result } from '@ledgerland/core';
import {
  compareEntries,
  err,
  ok,
  rat,
  ratCmp,
  ratFromExact,
  ratFromInt,
  ratFromNumber,
  ratMul,
  ratNeg,
  ratRoundHalfAwayFromZero,
  ratSub,
  ratToNumber,
} from '@ledgerland/core';
import {
  type Answer,
  type AnswerByType,
  type AnswerParseError,
  type ClassifyAnswer,
  type EffectAnswer,
  type FiveStepAnswer,
  type JournalEntryAnswer,
  type NumericAnswer,
  parseAnswer,
} from './answers.ts';

type ClassifyQuestion = Question & { type: 'classify' };
export type ClassifyItem = ClassifyQuestion['items'][number];
export type ClassifyDimension = ClassifyQuestion['dimension'];
export type EffectScoring = 'allOrNothing' | 'perTarget';

/** 判分需要的正解，由呼叫端用核心算出 */
export interface ScoreContext {
  /** classify：科目卡與指標卡的正解分類（由科目表或指標登錄檔推導）；自訂文字項目用題目的 correctCategories */
  readonly classifyKey?: (item: ClassifyItem, dimension: ClassifyDimension) => string | undefined;
  /** transaction_effect：核心 ScenarioAnswer.expected，以 target ID 為鍵 */
  readonly expected?: Readonly<Record<string, TargetAnswer>>;
  /** transaction_effect 的計分方式；題目沒有 scoring 欄位時用這個，預設 allOrNothing */
  readonly effectScoring?: EffectScoring;
  /** five_step_fill：開放格子（版面線 ID）的正確金額 */
  readonly expectedCells?: Readonly<Record<string, Money>>;
  /** ratio_numeric：核心依題目 ratioRef 算出的指標結果 */
  readonly ratio?: RatioResult;
  /** journal_entry：核心 expectedJournalEntries 的正解與科目表 */
  readonly expectedEntries?: readonly (readonly EntryLine[])[];
  readonly chart?: Chart;
}

export type OptionStatus = 'correct_selected' | 'correct_not_selected' | 'also_reasonable' | 'wrong_selected' | 'wrong_not_selected';

export interface OptionDetail {
  readonly id: string;
  readonly status: OptionStatus;
}

export type ScoreDetail =
  | { readonly kind: 'choice'; readonly selected: string; readonly correctOptionId: string; readonly options: readonly OptionDetail[] }
  | {
      readonly kind: 'multi_choice';
      readonly scoringMode: ScoringMode;
      readonly selected: readonly string[];
      readonly correctOptionIds: readonly string[];
      readonly options: readonly OptionDetail[];
    }
  | { readonly kind: 'true_false'; readonly selected: boolean; readonly expected: boolean }
  | { readonly kind: 'pick_line'; readonly selected: string; readonly correctLines: readonly string[] }
  | { readonly kind: 'classify'; readonly items: readonly ClassifyItemDetail[]; readonly correctCount: number; readonly total: number }
  | {
      readonly kind: 'transaction_effect';
      readonly scoring: EffectScoring;
      readonly targets: readonly EffectTargetDetail[];
      readonly correctCount: number;
      readonly total: number;
    }
  | { readonly kind: 'five_step_fill'; readonly cells: readonly FiveStepCellDetail[]; readonly correctCount: number; readonly total: number }
  | NumericDetail
  | JournalEntryDetail
  | { readonly kind: 'unscored'; readonly unscored: true };

export interface ClassifyItemDetail {
  readonly id: string;
  readonly selected: string | null;
  readonly expected: string;
  readonly correct: boolean;
}

export interface EffectTargetDetail {
  readonly id: string;
  readonly measure: 'direction' | 'delta' | 'value' | 'status';
  readonly selected: Direction | RatioStatus | number | null;
  readonly expected: Direction | RatioStatus | number | null;
  readonly correct: boolean;
}

export interface FiveStepCellDetail {
  readonly line: string;
  readonly selected: number | null;
  readonly expected: Money;
  readonly correct: boolean;
}

export interface NumericDetail {
  readonly kind: 'numeric';
  readonly expectedStatus: RatioStatus;
  /** 核心精確值換成作答單位、依 decimals 四捨五入後的值；na 時為 null */
  readonly expectedValue: number | null;
  /** 學習者填的數字；按 N/A 時為 null */
  readonly submitted: number | null;
  /** |submitted − expectedValue|；任一邊沒有數字時為 null */
  readonly difference: number | null;
  readonly tolerance: number;
}

export interface JournalEntryDetail {
  readonly kind: 'journal_entry';
  readonly missing: readonly EntryLine[];
  readonly extra: readonly EntryLine[];
  readonly unresolved: readonly string[];
}

export interface ScoreResult {
  /** 0 到 1 */
  readonly score: number;
  readonly correct: boolean;
  readonly detail: ScoreDetail;
}

export const UNSCORED: ScoreResult = { score: 0, correct: false, detail: { kind: 'unscored', unscored: true } };

const binary = (correct: boolean, detail: ScoreDetail): ScoreResult => ({ score: correct ? 1 : 0, correct, detail });

function hasOwn<K extends string, V>(record: Readonly<Record<K, V>>, key: string): key is K {
  return Object.hasOwn(record, key);
}

// 單選類：single_choice、pick_statement、ratio_interpret
function scoreChoice(correctOptionId: string, optionIds: readonly string[], selected: string): ScoreResult {
  const correct = selected === correctOptionId;
  const options = optionIds.map((id): OptionDetail => {
    const isCorrect = id === correctOptionId;
    const isSelected = id === selected;
    return { id, status: isCorrect ? (isSelected ? 'correct_selected' : 'correct_not_selected') : isSelected ? 'wrong_selected' : 'wrong_not_selected' };
  });
  return binary(correct, { kind: 'choice', selected, correctOptionId, options });
}

export interface MultiChoiceSpec {
  readonly optionIds: readonly string[];
  readonly correctOptionIds: readonly string[];
  readonly scoringMode: ScoringMode;
}

/** 多正解題（03 第 2.12 節）：any_correct 剛好選一個且在正解中；all_correct 集合完全相同。都不給部分分數；逐選項狀態給回饋用 */
export function scoreMultiChoice(selected: readonly string[], spec: MultiChoiceSpec): ScoreResult {
  const chosen = new Set(selected);
  const correctSet = new Set(spec.correctOptionIds);
  let correct: boolean;
  if (spec.scoringMode === 'any_correct') {
    correct = chosen.size === 1 && [...chosen].every((id) => correctSet.has(id));
  } else {
    correct = chosen.size === correctSet.size && [...correctSet].every((id) => chosen.has(id));
  }
  const options = spec.optionIds.map((id): OptionDetail => {
    const isCorrect = correctSet.has(id);
    const isSelected = chosen.has(id);
    let status: OptionStatus;
    if (isCorrect) status = isSelected ? 'correct_selected' : spec.scoringMode === 'any_correct' ? 'also_reasonable' : 'correct_not_selected';
    else status = isSelected ? 'wrong_selected' : 'wrong_not_selected';
    return { id, status };
  });
  return binary(correct, {
    kind: 'multi_choice',
    scoringMode: spec.scoringMode,
    selected: [...chosen].sort(),
    correctOptionIds: spec.correctOptionIds,
    options,
  });
}

function scoreClassify(q: ClassifyQuestion, answer: ClassifyAnswer, ctx: ScoreContext): ScoreResult {
  const items = q.items.map((item): ClassifyItemDetail => {
    const expected = item.text !== undefined ? q.correctCategories?.[item.id] : ctx.classifyKey?.(item, q.dimension);
    if (expected === undefined) throw new TypeError(`scoreQuestion：分類項目 ${item.id} 沒有正解分類，呼叫端要提供 classifyKey 或題目的 correctCategories`);
    const selected = (hasOwn(answer, item.id) ? answer[item.id] : undefined) ?? null;
    return { id: item.id, selected, expected, correct: selected === expected };
  });
  const correctCount = items.filter((i) => i.correct).length;
  return { score: correctCount / items.length, correct: correctCount === items.length, detail: { kind: 'classify', items, correctCount, total: items.length } };
}

function effectScoringOf(q: Question & { type: 'transaction_effect' }, ctx: ScoreContext): EffectScoring {
  // 題目的 scoring 欄位優先（03 第 2.4 節），其次是 context，預設 allOrNothing
  return q.scoring ?? ctx.effectScoring ?? 'allOrNothing';
}

function expectedOf(measure: EffectTargetDetail['measure'], answer: TargetAnswer): EffectTargetDetail['expected'] | undefined {
  switch (measure) {
    case 'direction':
      return answer.direction;
    case 'delta':
      return answer.delta;
    case 'value':
      return answer.after;
    case 'status':
      return answer.status;
  }
}

function scoreEffect(q: Question & { type: 'transaction_effect' }, answer: EffectAnswer, ctx: ScoreContext): ScoreResult {
  const expected = ctx.expected;
  if (expected === undefined) throw new TypeError('scoreQuestion：transaction_effect 需要 context.expected（核心 ScenarioAnswer.expected）');
  const scoring = effectScoringOf(q, ctx);
  const targets = q.scenario.targets.map((t): EffectTargetDetail => {
    const target = hasOwn(expected, t.id) ? expected[t.id] : undefined;
    const want = target === undefined ? undefined : expectedOf(t.measure, target);
    if (want === undefined) throw new TypeError(`scoreQuestion：target ${t.id} 的 ${t.measure} 沒有正解`);
    const selected = (hasOwn(answer, t.id) ? answer[t.id] : undefined) ?? null;
    return { id: t.id, measure: t.measure, selected, expected: want, correct: selected !== null && selected === want };
  });
  const correctCount = targets.filter((t) => t.correct).length;
  const detail: ScoreDetail = { kind: 'transaction_effect', scoring, targets, correctCount, total: targets.length };
  if (scoring === 'perTarget') return { score: correctCount / targets.length, correct: correctCount === targets.length, detail };
  return binary(correctCount === targets.length, detail);
}

function scoreFiveStep(q: Question & { type: 'five_step_fill' }, answer: FiveStepAnswer, ctx: ScoreContext): ScoreResult {
  const expectedCells = ctx.expectedCells;
  if (expectedCells === undefined) throw new TypeError('scoreQuestion：five_step_fill 需要 context.expectedCells');
  const cells = q.openCells.map((line): FiveStepCellDetail => {
    const expected = hasOwn(expectedCells, line) ? expectedCells[line] : undefined;
    if (expected === undefined) throw new TypeError(`scoreQuestion：格子 ${line} 沒有正確金額`);
    const selected = (hasOwn(answer, line) ? answer[line] : undefined) ?? null;
    return { line, selected, expected, correct: selected === expected };
  });
  const correctCount = cells.filter((c) => c.correct).length;
  return binary(correctCount === cells.length, { kind: 'five_step_fill', cells, correctCount, total: cells.length });
}

export interface NumericSpec {
  readonly decimals: number;
  /** 以作答單位計；省略時是 10 的負 decimals 次方 */
  readonly tolerance?: number;
  readonly answerUnit: RatioUnit;
  /** 作答按 N/A 時可接受的正解狀態；省略時按 N/A 一律算錯 */
  readonly acceptStatus?: readonly RatioStatus[];
}

function ratAbs(a: Rat): Rat {
  return a.num < 0n ? ratNeg(a) : a;
}

/** 數字題比對（04 第 12.5 節）：核心精確值換成作答單位（percent 以百分點計）、依 decimals 四捨五入（.5 遠離 0）後，與作答的差距不超過 tolerance 就算對；
 * 正解是 na 時只有按 N/A 才對（依 acceptStatus 判定），正解是數字時按 N/A 算錯。比對在有理數上進行，沒有浮點誤差 */
export function scoreNumeric(answer: NumericAnswer, expected: RatioResult, spec: NumericSpec): ScoreResult {
  if (!Number.isInteger(spec.decimals) || spec.decimals < 0 || spec.decimals > 20)
    throw new RangeError(`scoreNumeric：decimals 必須是 0 到 20 的整數，收到 ${String(spec.decimals)}`);
  const tolerance = spec.tolerance ?? 10 ** -spec.decimals;
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError(`scoreNumeric：tolerance 必須是非負數，收到 ${String(tolerance)}`);
  let rounded: Rat | null = null;
  if (expected.exact !== null && expected.status !== 'na') {
    let exact = ratFromExact(expected.exact);
    if (spec.answerUnit === 'percent') exact = ratMul(exact, ratFromInt(100));
    const scale = 10n ** BigInt(spec.decimals);
    rounded = rat(ratRoundHalfAwayFromZero(rat(exact.num * scale, exact.den)).num, scale);
  }
  const expectedValue = rounded === null ? null : ratToNumber(rounded);
  const base = { kind: 'numeric', expectedStatus: expected.status, expectedValue, tolerance } as const;
  if (answer.kind === 'na') {
    const correct = (spec.acceptStatus ?? []).includes(expected.status);
    return binary(correct, { ...base, submitted: null, difference: null });
  }
  if (rounded === null || expected.status === 'not_meaningful') {
    return binary(false, { ...base, submitted: answer.value, difference: null });
  }
  const diff = ratAbs(ratSub(ratFromNumber(answer.value), rounded));
  const correct = ratCmp(diff, ratFromNumber(tolerance)) <= 0;
  return binary(correct, { ...base, submitted: answer.value, difference: ratToNumber(diff) });
}

export interface JournalEntryOptions {
  /** 是否接受科目別名（預設 true） */
  readonly allowAliases?: boolean;
}

/** 分錄題（04 第 14 節）：呼叫核心的 compareEntries 做正規化比對；全對才得分，detail 列出少了與多了的 (科目, 方向, 金額) */
export function scoreJournalEntry(
  submitted: JournalEntryAnswer,
  expected: readonly (readonly EntryLine[])[],
  chart: Chart,
  options: JournalEntryOptions = {},
): ScoreResult {
  const cmp = compareEntries(submitted, expected, chart, { allowAliases: options.allowAliases ?? true });
  return binary(cmp.equal, { kind: 'journal_entry', missing: cmp.missing, extra: cmp.extra, unresolved: cmp.unresolved });
}

function scoreParsed(question: Question, answer: Answer, ctx: ScoreContext): ScoreResult {
  if (!question.scored) return UNSCORED;
  switch (question.type) {
    case 'single_choice':
    case 'pick_statement':
    case 'ratio_interpret':
      return scoreChoice(
        question.correctOptionId,
        question.options.map((o) => o.id),
        answer as AnswerByType['single_choice'],
      );
    case 'multi_choice':
      return scoreMultiChoice(answer as AnswerByType['multi_choice'], {
        optionIds: question.options.map((o) => o.id),
        correctOptionIds: question.correctOptionIds,
        scoringMode: question.scoringMode,
      });
    case 'true_false': {
      const selected = answer as AnswerByType['true_false'];
      return binary(selected === question.correct, { kind: 'true_false', selected, expected: question.correct });
    }
    case 'pick_line': {
      const selected = answer as AnswerByType['pick_line'];
      return binary(question.correctLines.includes(selected), { kind: 'pick_line', selected, correctLines: question.correctLines });
    }
    case 'classify':
      return scoreClassify(question, answer as AnswerByType['classify'], ctx);
    case 'transaction_effect':
      return scoreEffect(question, answer as AnswerByType['transaction_effect'], ctx);
    case 'five_step_fill':
      return scoreFiveStep(question, answer as AnswerByType['five_step_fill'], ctx);
    case 'ratio_numeric': {
      if (ctx.ratio === undefined) throw new TypeError('scoreQuestion：ratio_numeric 需要 context.ratio（核心的 RatioResult）');
      return scoreNumeric(answer as AnswerByType['ratio_numeric'], ctx.ratio, {
        decimals: question.decimals,
        tolerance: question.tolerance,
        answerUnit: question.answerUnit,
        acceptStatus: question.acceptStatus,
      });
    }
    case 'journal_entry': {
      if (ctx.expectedEntries === undefined || ctx.chart === undefined)
        throw new TypeError('scoreQuestion：journal_entry 需要 context.expectedEntries 與 context.chart');
      return scoreJournalEntry(answer as AnswerByType['journal_entry'], ctx.expectedEntries, ctx.chart, { allowAliases: question.allowAliases ?? true });
    }
  }
}

/** 判一題。取捨題（schema 固定 scored 為 false）與其他 scored 為 false 的題目一律回 UNSCORED（score 0、correct false、detail.unscored）；作答形狀與題型不符是程式錯誤 */
export function scoreQuestion<T extends QuestionType>(
  question: Question & { readonly type: T },
  answer: AnswerByType[T],
  context: ScoreContext = {},
): ScoreResult {
  const parsed = parseAnswer(question.type, answer);
  if (!parsed.ok) throw new TypeError(`scoreQuestion：${question.type} 的作答形狀不對：${parsed.error.issues.map((i) => `${i.path} ${i.message}`).join('；')}`);
  return scoreParsed(question, parsed.value, context);
}

/** 先解析未知形狀的作答（例如從儲存讀回）再判分；形狀不對以 Result 回傳 */
export function scoreAttempt(question: Question, raw: unknown, context: ScoreContext = {}): Result<ScoreResult, AnswerParseError> {
  const parsed = parseAnswer(question.type, raw);
  if (!parsed.ok) return err(parsed.error);
  return ok(scoreParsed(question, parsed.value, context));
}
