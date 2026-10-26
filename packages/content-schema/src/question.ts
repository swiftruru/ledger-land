// Question 題目（04 第 16.2 節、08 第 3.6 節）：12 種題型以 type 區分。跨檔案的規則（章節範圍、引用存在、佔位符作用範圍）在 validate.ts。
import { z } from 'zod';
import { Difficulty, LINE_ID_RE, LineId, Managed, Markup, Name, PendingRef, RatioRef, SemanticId, idSchema } from './common.ts';
import { RatioUnit } from './ratio.ts';
import { Direction, Scenario } from './scenario.ts';

export const QUESTION_TYPES = [
  'single_choice',
  'true_false',
  'pick_statement',
  'pick_line',
  'classify',
  'transaction_effect',
  'five_step_fill',
  'ratio_numeric',
  'ratio_interpret',
  'judgment',
  'journal_entry',
  'multi_choice',
] as const;
export const QuestionType = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof QuestionType>;

export const ScoringMode = z.enum(['any_correct', 'all_correct']);
export type ScoringMode = z.infer<typeof ScoringMode>;
export const StatementCode = z.enum(['is', 'bs', 'cf']);

/** 選項（03 第 2.8 節）：short 是給 {{option:o_xxxx}} 引用的簡短版；pin: "last" 讓「以上皆是」這類選項固定在最後，不參與打散 */
export const ChoiceOption = z
  .object({
    id: idSchema('option'),
    text: Markup,
    short: Markup.optional(),
    feedback: Markup,
    misconceptionId: idSchema('misconception').optional(),
    pin: z.literal('last').optional(),
  })
  .strict()
  .meta({ id: 'ChoiceOption' });
export type ChoiceOption = z.infer<typeof ChoiceOption>;

const base = Managed.extend({
  id: idSchema('question'),
  chapterId: idSchema('chapter'),
  objectiveId: idSchema('objective'),
  difficulty: Difficulty,
  tags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
  termRefs: z.array(idSchema('term')),
  labRef: z
    .object({ story: idSchema('story'), step: idSchema('step') })
    .strict()
    .optional(),
  scored: z.boolean(),
  vars: z.record(Name, z.number()).optional(),
  prompt: Markup,
  explanation: Markup,
  hint: Markup.optional(),
  display: z
    .object({ statements: z.array(StatementCode).optional(), scenario: z.literal('self').optional() })
    .strict()
    .optional(),
  pendingRefs: z.array(PendingRef).optional(),
});
export const QuestionBase = base;

/** 指標的量值來源（ratio_numeric 的 compute.measures 與 ratio_interpret 的 ratioTable.measures 共用）：鍵是版面線 ID 或 input.<名稱>，值引用題目的 vars */
export const MeasuresMap = z.record(z.string().regex(/^([a-z][a-z0-9_]*|input\.[a-z][a-z0-9_]*)$/), z.string().regex(/^vars\.[a-z][A-Za-z0-9_]*$/));

/**
 * ratio_interpret 畫面上方的指標小表格（08 第 3.6 節，M3）：列出 ratioRefs，數字由核心算（scenario 過帳後的累計報表，或作者 vars 經 measures 給值），
 * 寫進快照的 compiled.ratios；沒有這個欄位時快照不帶 compiled.ratios，介面不顯示表格。scenario 與 measures 二選一。
 */
export const RatioTable = z
  .object({ ratioRefs: z.array(RatioRef).min(1), scenario: Scenario.optional(), measures: MeasuresMap.optional() })
  .strict()
  .meta({ id: 'RatioTable' });
export type RatioTable = z.infer<typeof RatioTable>;

const singleChoiceLike = base.extend({
  type: z.literal(['single_choice', 'pick_statement', 'ratio_interpret']),
  options: z.array(ChoiceOption).min(3).max(4),
  correctOptionId: idSchema('option'),
  ratioRef: RatioRef.optional(),
  distractorExprs: z.record(idSchema('option'), z.string().min(1).max(300)).optional(),
  /** 只給 ratio_interpret */
  ratioTable: RatioTable.optional(),
});

export const SingleChoiceQuestion = singleChoiceLike.strict();
export const MultiChoiceQuestion = base
  .extend({
    type: z.literal('multi_choice'),
    options: z.array(ChoiceOption).min(3).max(5),
    correctOptionIds: z.array(idSchema('option')).min(2),
    scoringMode: ScoringMode,
  })
  .strict();
export const TrueFalseQuestion = base
  .omit({ prompt: true })
  .extend({
    type: z.literal('true_false'),
    statement: Markup,
    correct: z.boolean(),
    feedbackTrue: Markup,
    feedbackFalse: Markup,
    misconceptionId: idSchema('misconception').optional(),
  })
  .strict();
export const PickLineQuestion = base
  .extend({
    type: z.literal('pick_line'),
    scenario: Scenario,
    statement: StatementCode,
    correctLines: z.array(LineId).min(1),
    feedbackByLine: z.record(LineId, Markup).optional(),
  })
  .strict();
export const ClassifyItem = z
  .object({ id: idSchema('item'), account: SemanticId.optional(), ratio: SemanticId.optional(), text: Markup.optional(), allowContra: z.boolean().optional() })
  .strict();
export const ClassifyQuestion = base
  .extend({
    type: z.literal('classify'),
    dimension: z.enum(['element', 'current', 'cf_activity', 'ratio_category']),
    items: z.array(ClassifyItem).min(2),
    correctCategories: z.record(idSchema('item'), z.string().regex(/^[a-z][a-z0-9_]*$/)).optional(),
  })
  .strict();
/** 交易影響題的計分（03 第 2.4 節）：預設全部 target 都對才算對（allOrNothing），可改為逐 target 計分（perTarget） */
export const TransactionEffectScoring = z.enum(['allOrNothing', 'perTarget']);
export type TransactionEffectScoring = z.infer<typeof TransactionEffectScoring>;
export const TransactionEffectQuestion = base
  .extend({
    type: z.literal('transaction_effect'),
    scenario: Scenario,
    choices: z.array(Direction).min(1).optional(),
    scoring: TransactionEffectScoring.optional(),
  })
  .strict();
export const FiveStepFillQuestion = base.extend({ type: z.literal('five_step_fill'), scenario: Scenario, openCells: z.array(LineId).min(1) }).strict();
export const RatioNumericQuestion = base
  .extend({
    type: z.literal('ratio_numeric'),
    compute: z
      .object({
        ratioRef: RatioRef,
        scenario: Scenario.optional(),
        measures: MeasuresMap.optional(),
      })
      .strict(),
    answerUnit: RatioUnit,
    decimals: z.number().int().min(0).max(6),
    tolerance: z.number().min(0),
    acceptStatus: z.array(z.literal('na')).optional(),
  })
  .strict();
export const JudgmentOption = z.object({ id: idSchema('option'), text: Markup, upside: Markup, downside: Markup }).strict();
export const JudgmentQuestion = base
  .extend({
    type: z.literal('judgment'),
    scored: z.literal(false),
    options: z.array(JudgmentOption).length(3),
    viewpoint: Markup,
    attribution: z.literal('site'),
  })
  .strict();
export const JournalEntryQuestion = base
  .extend({ type: z.literal('journal_entry'), scenario: Scenario, accountChoices: z.array(SemanticId).min(1), allowAliases: z.boolean().optional() })
  .strict();

const QuestionUnion = z.discriminatedUnion('type', [
  SingleChoiceQuestion,
  MultiChoiceQuestion,
  TrueFalseQuestion,
  PickLineQuestion,
  ClassifyQuestion,
  TransactionEffectQuestion,
  FiveStepFillQuestion,
  RatioNumericQuestion,
  JudgmentQuestion,
  JournalEntryQuestion,
]);

function uniqueIds(items: { id: string }[], ctx: z.RefinementCtx, field: string, what: string) {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (seen.has(it.id)) ctx.addIssue({ code: 'custom', path: [field, i, 'id'], message: `${what} ID 重複：${it.id}` });
    seen.add(it.id);
  });
}

export const Question = QuestionUnion.superRefine((q, ctx) => {
  if (q.pendingRefs && q.pendingRefs.length > 0 && q.scored) {
    ctx.addIssue({ code: 'custom', path: ['scored'], message: 'pendingRefs 非空的題目暫不計分，scored 必須是 false' });
  }
  if ('options' in q) {
    uniqueIds(q.options, ctx, 'options', '選項');
    const pinned = q.options.filter((o) => 'pin' in o && o.pin === 'last');
    if (pinned.length > 1) ctx.addIssue({ code: 'custom', path: ['options'], message: '最多只能有一個選項 pin 在最後' });
  }
  switch (q.type) {
    case 'single_choice':
    case 'pick_statement':
    case 'ratio_interpret': {
      if (!q.options.some((o) => o.id === q.correctOptionId))
        ctx.addIssue({ code: 'custom', path: ['correctOptionId'], message: 'correctOptionId 必須是 options 裡的選項' });
      if (q.type === 'ratio_interpret' && !q.ratioRef) ctx.addIssue({ code: 'custom', path: ['ratioRef'], message: 'ratio_interpret 必須填 ratioRef' });
      if (q.ratioTable !== undefined) {
        if (q.type !== 'ratio_interpret')
          ctx.addIssue({ code: 'custom', path: ['ratioTable'], message: 'ratioTable 只給 ratio_interpret（指標判讀題上方的指標小表格）' });
        const t = q.ratioTable;
        if (new Set(t.ratioRefs).size !== t.ratioRefs.length)
          ctx.addIssue({ code: 'custom', path: ['ratioTable', 'ratioRefs'], message: 'ratioTable.ratioRefs 不得重複' });
        if ((t.scenario !== undefined) === (t.measures !== undefined))
          ctx.addIssue({ code: 'custom', path: ['ratioTable'], message: 'ratioTable.scenario 與 ratioTable.measures 二選一' });
        const vars = q.vars ?? {};
        for (const [k, v] of Object.entries(t.measures ?? {})) {
          const name = v.slice('vars.'.length);
          if (!(name in vars)) ctx.addIssue({ code: 'custom', path: ['ratioTable', 'measures', k], message: `引用未宣告的 vars.${name}` });
        }
      }
      for (const k of Object.keys(q.distractorExprs ?? {}))
        if (!q.options.some((o) => o.id === k))
          ctx.addIssue({ code: 'custom', path: ['distractorExprs', k], message: 'distractorExprs 的鍵必須是 options 裡的選項' });
      break;
    }
    case 'multi_choice': {
      const optionIds = new Set(q.options.map((o) => o.id));
      const correct = new Set(q.correctOptionIds);
      if (correct.size !== q.correctOptionIds.length) ctx.addIssue({ code: 'custom', path: ['correctOptionIds'], message: 'correctOptionIds 不得重複' });
      for (const id of q.correctOptionIds)
        if (!optionIds.has(id)) ctx.addIssue({ code: 'custom', path: ['correctOptionIds'], message: `正解 ${id} 不在 options 裡` });
      if (q.options.every((o) => correct.has(o.id)))
        ctx.addIssue({ code: 'custom', path: ['correctOptionIds'], message: '至少要留一個不是正解的選項，否則題目沒有鑑別力' });
      break;
    }
    case 'classify': {
      uniqueIds(q.items, ctx, 'items', '項目');
      const textItems = new Set<string>();
      q.items.forEach((it, i) => {
        const sources = [it.account, it.ratio, it.text].filter((x) => x !== undefined).length;
        if (sources !== 1) ctx.addIssue({ code: 'custom', path: ['items', i], message: '每個項目要在 account、ratio、text 之中剛好填一個' });
        if (it.text !== undefined) textItems.add(it.id);
      });
      const cats = q.correctCategories ?? {};
      for (const k of Object.keys(cats))
        if (!textItems.has(k)) ctx.addIssue({ code: 'custom', path: ['correctCategories', k], message: 'correctCategories 只給自訂文字項目' });
      for (const id of textItems)
        if (!(id in cats)) ctx.addIssue({ code: 'custom', path: ['correctCategories'], message: `自訂文字項目 ${id} 缺 correctCategories` });
      break;
    }
    case 'transaction_effect': {
      const hasDirection = q.scenario.targets.some((t) => t.measure === 'direction');
      if (hasDirection && !q.choices) ctx.addIssue({ code: 'custom', path: ['choices'], message: '有 direction 目標時 choices 必填' });
      if (!hasDirection && q.choices) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'choices 只適用於 direction 目標' });
      if (q.scenario.targets.length === 0) ctx.addIssue({ code: 'custom', path: ['scenario', 'targets'], message: 'transaction_effect 至少要有一個 target' });
      break;
    }
    case 'ratio_numeric': {
      const hasScenario = q.compute.scenario !== undefined;
      const hasMeasures = q.compute.measures !== undefined;
      if (hasScenario === hasMeasures) ctx.addIssue({ code: 'custom', path: ['compute'], message: 'compute.scenario 與 compute.measures 二選一' });
      const vars = q.vars ?? {};
      for (const [k, v] of Object.entries(q.compute.measures ?? {})) {
        const name = v.slice('vars.'.length);
        if (!(name in vars)) ctx.addIssue({ code: 'custom', path: ['compute', 'measures', k], message: `引用未宣告的 vars.${name}` });
      }
      break;
    }
    case 'five_step_fill': {
      for (const c of q.openCells) if (!LINE_ID_RE.test(c)) ctx.addIssue({ code: 'custom', path: ['openCells'], message: `openCells 的 ${c} 不是線 ID` });
      break;
    }
    default:
      break;
  }
});
export type Question = z.infer<typeof Question>;
export type QuestionInput = z.input<typeof Question>;

/** 題目的 scenario 放在哪裡：計算題在 scenario、ratio_numeric 在 compute.scenario、ratio_interpret 的指標小表格在 ratioTable.scenario；沒有就 undefined */
export function questionScenario(q: Question): { scenario: z.infer<typeof Scenario> | undefined; path: string } {
  if (q.type === 'ratio_numeric') return { scenario: q.compute.scenario, path: 'compute.scenario' };
  if (q.type === 'ratio_interpret') return { scenario: q.ratioTable?.scenario, path: 'ratioTable.scenario' };
  if ('scenario' in q) return { scenario: q.scenario, path: 'scenario' };
  return { scenario: undefined, path: 'scenario' };
}

/** 題目內可引用的名稱集合，給佔位符的作用範圍檢查用（validate.ts）；沒有 scenario 的題型回傳 undefined，代表沒有事件或 target 可引用 */
export function questionScope(q: Question): { vars: Set<string>; eventIds?: Set<string>; targetIds?: Set<string>; optionIds: Set<string> } {
  const { scenario } = questionScenario(q);
  const targetIds = scenario ? new Set(scenario.targets.map((t) => t.id)) : q.type === 'ratio_numeric' ? new Set<string>() : undefined;
  if (q.type === 'ratio_numeric') targetIds?.add('answer');
  return {
    vars: new Set(Object.keys(q.vars ?? {})),
    eventIds: scenario ? new Set(scenario.events.map((e) => e.id)) : undefined,
    targetIds,
    optionIds: new Set('options' in q ? q.options.map((o) => o.id) : []),
  };
}
