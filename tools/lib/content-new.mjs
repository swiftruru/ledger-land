// content:new 的純函式（08 第 4.1、5.8 節）：收集既有 ID（內容檔與 lock，含草稿與已下架）、產生不碰撞的新 ID、各實體的草稿骨架。
// 不讀檔也不寫檔，content-new.mjs 負責讀寫與列印；tools/test 直接呼叫。
import { ID_RULES, QUESTION_TYPES, generateId } from '@ledgerland/content-schema';

export const NEW_KINDS = ['question', 'level', 'objective', 'term', 'chapter'];

/** 內容檔與 lock 裡所有已使用的 ID（含選項、項目、迷思、步驟這類巢狀 ID，保守起見一律視為已用） */
export function collectIds(bundle, lock) {
  const ids = new Set();
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v.id === 'string') ids.add(v.id);
    for (const x of Object.values(v)) walk(x);
  };
  for (const list of Object.values(bundle ?? {})) walk(list);
  for (const item of lock?.items ?? []) ids.add(item.id);
  return ids;
}

/** 產生不在 taken 裡的 ID；碰撞就重抽。random 可注入（測試） */
export function uniqueId(kind, taken, random = Math.random, maxTries = 1000) {
  for (let i = 0; i < maxTries; i++) {
    const id = generateId(kind, random);
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
  throw new Error(`uniqueId：${kind} 連續 ${maxTries} 次都碰撞，請檢查 random 來源`);
}

const lt = (zh, en) => ({ 'zh-TW': zh, en });
const managed = () => ({ rev: 1, revKind: 'text', status: 'draft' });

function questionSkeleton(id, chapterId, type, taken, random) {
  const option = (zh, en) => ({
    id: uniqueId('option', taken, random),
    text: lt(zh, en),
    feedback: lt('（回饋：先肯定再說明為什麼）', '(Feedback: acknowledge, then explain why)'),
  });
  const base = {
    id,
    ...managed(),
    type,
    chapterId,
    objectiveId: 'obj_000000',
    difficulty: 1,
    tags: [],
    termRefs: [],
    scored: true,
    prompt: lt('（題幹）', '(Prompt)'),
    explanation: lt('（解說：說明為什麼，連到名詞卡）', '(Explanation: say why, link to a term card)'),
  };
  const scenario = () => ({
    opening: { balances: { cash: 100000, share_capital: 100000 } },
    events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 30000 } }],
    policy: 'teacher@1',
    layout: 'teacher@1',
    window: 'cumulative',
    targets: [{ id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' }],
  });
  switch (type) {
    case 'single_choice':
    case 'pick_statement':
    case 'ratio_interpret': {
      const options = [option('（選項一）', '(Option one)'), option('（選項二）', '(Option two)'), option('（選項三）', '(Option three)')];
      return { ...base, options, correctOptionId: options[0].id, ...(type === 'ratio_interpret' ? { ratioRef: 'roa@excel' } : {}) };
    }
    case 'multi_choice': {
      const options = [option('（選項一）', '(Option one)'), option('（選項二）', '(Option two)'), option('（選項三）', '(Option three)')];
      return { ...base, options, correctOptionIds: [options[0].id, options[1].id], scoringMode: 'all_correct' };
    }
    case 'true_false': {
      const { prompt: _p, ...rest } = base;
      return {
        ...rest,
        statement: lt('（敘述）', '(Statement)'),
        correct: true,
        feedbackTrue: lt('（答「對」時的回饋）', '(Feedback when answering true)'),
        feedbackFalse: lt('（答「不對」時的回饋）', '(Feedback when answering false)'),
      };
    }
    case 'judgment': {
      const opt = (zh, en) => ({
        id: uniqueId('option', taken, random),
        text: lt(zh, en),
        upside: lt('（好處）', '(Upside)'),
        downside: lt('（代價）', '(Downside)'),
      });
      return {
        ...base,
        scored: false,
        options: [opt('（方案一）', '(Option one)'), opt('（方案二）', '(Option two)'), opt('（方案三）', '(Option three)')],
        viewpoint: lt('（網站觀點）', '(Site viewpoint)'),
        attribution: 'site',
      };
    }
    case 'classify':
      return {
        ...base,
        dimension: 'element',
        items: [
          { id: uniqueId('item', taken, random), account: 'cash' },
          { id: uniqueId('item', taken, random), account: 'accounts_payable' },
        ],
      };
    case 'transaction_effect':
      return { ...base, scenario: scenario(), choices: ['up', 'down', 'unchanged'] };
    case 'five_step_fill':
      return { ...base, scenario: { ...scenario(), targets: [] }, openCells: ['bs_cash'] };
    case 'pick_line':
      return { ...base, scenario: { ...scenario(), targets: [] }, statement: 'bs', correctLines: ['bs_cash'] };
    case 'ratio_numeric':
      return {
        ...base,
        vars: { netIncome: 120000, totalAssets: 600000 },
        compute: { ratioRef: 'roa@excel', measures: { is_net_income: 'vars.netIncome', bs_total_assets: 'vars.totalAssets' } },
        answerUnit: 'percent',
        decimals: 2,
        tolerance: 0.01,
        prompt: lt(
          '本期淨利 {{money:vars.netIncome}}，資產總計 {{money:vars.totalAssets}}，ROA 是多少？',
          'Net income {{money:vars.netIncome}}, total assets {{money:vars.totalAssets}}. What is ROA?',
        ),
      };
    case 'journal_entry':
      return { ...base, scenario: { ...scenario(), window: 'transaction', targets: [] }, accountChoices: ['cash', 'inventory', 'accounts_payable'] };
    default:
      throw new Error(`content:new：不認得的題型 ${type}（可用：${QUESTION_TYPES.join('、')}）`);
  }
}

/**
 * 建立骨架。回傳 { id, data }；objective 的 data 是單一目標（content-new.mjs 會放進該章的檔案）。
 * @param {'question' | 'level' | 'objective' | 'term' | 'chapter'} kind
 * @param {{ chapterId?: string; type?: string; order?: number }} options
 * @param {Set<string>} taken 既有 ID（會把新產生的 ID 加進去）
 * @returns {{ id: string; data: any }}
 */
export function skeleton(kind, options, taken, random = Math.random) {
  if (!NEW_KINDS.includes(kind)) throw new Error(`content:new：kind 只能是 ${NEW_KINDS.join('、')}`);
  if (['question', 'level', 'objective'].includes(kind) && !options.chapterId) throw new Error(`content:new：${kind} 需要 --chapter <chapterId>`);
  const id = uniqueId(kind, taken, random);
  const order = options.order ?? 1;
  switch (kind) {
    case 'question':
      return { id, data: questionSkeleton(id, options.chapterId, options.type ?? 'single_choice', taken, random) };
    case 'level':
      return {
        id,
        data: { id, ...managed(), chapterId: options.chapterId, order, title: lt('（關卡名稱）', '(Level title)'), objectiveIds: [], questionIds: [] },
      };
    case 'objective':
      return {
        id,
        data: {
          id,
          ...managed(),
          chapterId: options.chapterId,
          order,
          statement: lt('能（學生學完要能做到什麼）', 'Can (what the learner can do afterwards)'),
          skill: 'identify',
          misconceptions: [{ id: uniqueId('misconception', taken, random), text: lt('（常見迷思）', '(Common misconception)') }],
          plannedQuestions: 5,
          suggestedTypes: ['single_choice'],
          termRefs: [],
        },
      };
    case 'term':
      return {
        id,
        data: {
          id,
          ...managed(),
          category: 'concept',
          label: lt('（名詞）', '(Term)'),
          teacherLabel: '（教材用語）',
          currentTwLabel: null,
          ifrsEnglish: '(IFRS English)',
          aliases: { 'zh-TW': [], en: [] },
          flags: [],
          confidence: 'high',
          pendingRefs: [],
          definition: lt('（定義）', '(Definition)'),
        },
      };
    case 'chapter':
      return {
        id,
        data: {
          id,
          ...managed(),
          order,
          scope: 'core',
          examScope: 'unconfirmed',
          title: lt('（章名）', '(Chapter title)'),
          summary: lt('（章節簡介）', '(Chapter summary)'),
          objectiveIds: [],
          levelIds: [],
        },
      };
    default:
      throw new Error(`content:new：不認得的 kind ${String(kind)}`);
  }
}

export { ID_RULES };
