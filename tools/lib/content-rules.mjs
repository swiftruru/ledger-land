// 會計與答案規則（08 第 5.4 節 acct.*、第 5.5 節的 ans.expectedMatchesCore、ans.notMeaningful、ans.acceptStatus、ans.ratioNumericFields）：
// 全部呼叫 packages/core，不另寫會計邏輯。這個模組不讀檔也不列印，content-check.mjs 與 content-lock.mjs 負責讀檔與輸出，tools/test 直接呼叫。
// 故事只做性質檢查：訊息只寫規則、列、步驟與事件，不印任何金額（D2）。
import { Chapter, Question, Story, Term, TransactionTemplate } from '@ledgerland/content-schema';
import {
  SCENARIO_STEP_ID,
  buildChart,
  buildStatements,
  canonicalJson,
  checkStatementInvariants,
  compileTemplate,
  computeRatio,
  createCoreContext,
  createLedger,
  defaultAccounts,
  defaultRatioRegistry,
  expectedJournalEntries,
  fiveStepCheck,
  getRatioVersion,
  instantiateTemplate,
  measureMap,
  replayStory,
  solveScenario,
  traceAllLines,
  validateEntry,
  verifyTraceTree,
} from '@ledgerland/core';
import { integer as fcInteger, record as fcRecord, sample as fcSample } from 'fast-check';

/**
 * @typedef {{ rule: string; file: string; path: string; message: string; severity: 'error' | 'warning' }} RuleIssue
 * @typedef {{ file: string; data: any }} Parsed
 * @typedef {{ terms: Parsed[]; chapters: Parsed[]; templates: Parsed[]; stories: Parsed[]; questions: Parsed[] }} ParsedBundle
 * @typedef {{ expected?: Record<string, unknown>; values?: Record<string, number>; expectedEntries?: readonly unknown[]; ratio?: unknown; categories?: Record<string, string> }} CompiledQuestion
 */

/** 隨機抽樣的預設：固定種子，相同內容每次抽到同一組參數 */
export const DEFAULT_SEED = 20261023;
export const DEFAULT_SAMPLES = 50;

/** 只收 Zod 驗證通過的項目；結構錯誤由 validateBundle 回報，這裡不重複 */
function parseEntries(entries, schema) {
  const out = [];
  for (const e of entries ?? []) {
    const r = schema.safeParse(e.data);
    if (r.success) out.push({ file: e.file, data: r.data });
  }
  return out;
}

/** @returns {ParsedBundle} */
export function parseBundle(bundle) {
  return {
    terms: parseEntries(bundle.terms, Term),
    chapters: parseEntries(bundle.chapters, Chapter),
    templates: parseEntries(bundle.templates, TransactionTemplate),
    stories: parseEntries(bundle.stories, Story),
    questions: parseEntries(bundle.questions, Question),
  };
}

/**
 * acct.templateBalanced 與 acct.templatePreconditions 用的合成狀態（借方減貸方）：現金充足到任何參數上限都付得起，
 * 應收、存貨、設備（含累計折舊）、設立費、應付、短期借款與應付所得稅都有餘額，所以 21 個內建範本的前置條件在預設參數下都成立；
 * 股本讓期初平衡。自編數字，與任何故事無關。
 */
const SYNTHETIC_DEBITS = {
  cash: 2_000_000_000_000,
  accounts_receivable: 2_000_000,
  inventory: 500_000,
  machinery_equipment: 400_000,
  deferred_organisation_costs: 100_000,
};
const SYNTHETIC_CREDITS = {
  accumulated_depreciation_machinery: 100_000,
  accounts_payable: 300_000,
  short_term_borrowings: 900_000,
  income_tax_payable: 50_000,
};
export function syntheticOpening() {
  /** @type {Record<string, number>} */
  const opening = { ...SYNTHETIC_DEBITS };
  let credits = 0;
  for (const [id, v] of Object.entries(SYNTHETIC_CREDITS)) {
    opening[id] = -v;
    credits += v;
  }
  const debits = Object.values(SYNTHETIC_DEBITS).reduce((a, b) => a + b, 0);
  opening.share_capital = -(debits - credits);
  return opening;
}

function paramArbitrary(spec) {
  if (spec.type === 'rate') {
    const steps = 10_000;
    return fcInteger({ min: 0, max: steps }).map((n) => Number((spec.min + ((spec.max - spec.min) * n) / steps).toFixed(6)));
  }
  return fcInteger({ min: spec.min, max: spec.max });
}

/** 預設值、每個參數的 min 與 max（其餘預設）、固定種子的隨機抽樣 */
function paramCombos(template, seed, samples) {
  const combos = [{ label: '預設參數', params: {} }];
  for (const p of template.params) {
    combos.push({ label: `${p.name} 取 min`, params: { [p.name]: p.min } });
    combos.push({ label: `${p.name} 取 max`, params: { [p.name]: p.max } });
  }
  if (template.params.length > 0 && samples > 0) {
    const arb = fcRecord(Object.fromEntries(template.params.map((p) => [p.name, paramArbitrary(p)])));
    fcSample(arb, { seed, numRuns: samples }).forEach((params, i) => combos.push({ label: `隨機抽樣第 ${i + 1} 組`, params }));
  }
  return combos;
}

function describeEntryError(error) {
  switch (error.code) {
    case 'entry.unbalanced':
      return '借貸不相等';
    case 'entry.account_disabled':
      return `引用了這套政策停用的科目 ${String(error.account ?? error.message.params?.account ?? '')}（應由前置條件或 policyWhen 篩掉）`;
    default:
      return `分錄驗證失敗（${error.code}）`;
  }
}

function describeStepError(error) {
  const at = error.at ? `步驟 ${error.at.stepId} 事件 ${error.at.eventId}` : '';
  const detail =
    error.precondition !== undefined ? `，前置條件 ${String(error.precondition)}` : error.account !== undefined ? `，科目 ${String(error.account)}` : '';
  return `${at}${at ? '：' : ''}${error.code}${detail}`;
}

/**
 * acct.templateBalanced、acct.templatePreconditions：每個範本能編譯；在預設、上下限與隨機參數下，teacher@1 與 ifrs@1 兩套政策的分錄都通過核心的 validateEntry
 * （借貸相等、沒有引用停用科目）；前置條件不成立的組合跳過並計數。預設參數在合成狀態下必須滿足前置條件（teacher@1）。
 */
function checkTemplates(parsed, issues, { seed, samples }) {
  const chart = buildChart(defaultAccounts);
  const compiled = new Map();
  for (const t of parsed.templates) {
    const r = compileTemplate(t.data, chart);
    if (!r.ok) {
      const e = r.error;
      issues.push(
        error('acct.templateBalanced', t.file, `${String(e.where ?? '')}${e.name ? `.${String(e.name)}` : ''}` || '(root)', `範本無法編譯：${e.code}`),
      );
      continue;
    }
    compiled.set(t.data.id, r.value);
  }
  if (compiled.size === 0) return { chart, compiled, contexts: [], stats: { combos: 0, skipped: 0 } };
  const contexts = [createCoreContext({ templates: compiled }), createCoreContext({ policy: 'ifrs@1', templates: compiled })];
  const state = createLedger(chart, syntheticOpening());
  const stats = { combos: 0, skipped: 0 };
  for (const t of parsed.templates) {
    const template = compiled.get(t.data.id);
    if (template === undefined) continue;
    const combos = paramCombos(template, seed, samples);
    for (const ctx of contexts) {
      const reported = new Set();
      for (const combo of combos) {
        stats.combos++;
        const inst = instantiateTemplate(template, combo.params, state, ctx.policy, { eventId: 'e1' });
        if (!inst.ok) {
          if (inst.error.code === 'precondition.failed') {
            stats.skipped++;
            if (combo.label === '預設參數' && ctx.policy.id === 'teacher@1')
              issues.push(
                error(
                  'acct.templatePreconditions',
                  t.file,
                  `preconditions.${String(inst.error.precondition)}`,
                  `預設參數在合成狀態下不滿足前置條件 ${String(inst.error.precondition)}（${String(inst.error.preconditionMessage?.['zh-TW'] ?? '')}）`,
                ),
              );
            continue;
          }
          const key = `inst:${inst.error.code}`;
          if (!reported.has(key)) {
            reported.add(key);
            issues.push(error('acct.templateBalanced', t.file, 'lines', `${combo.label}在政策 ${ctx.policy.id} 下無法實例化：${inst.error.code}`));
          }
          continue;
        }
        if (inst.value.noEffect) continue;
        const valid = validateEntry(inst.value.entry, chart, ctx.policy, {});
        if (valid.ok) continue;
        for (const e of valid.error) {
          const key = `entry:${e.code}:${String(e.account ?? '')}`;
          if (reported.has(key)) continue;
          reported.add(key);
          issues.push(error('acct.templateBalanced', t.file, 'lines', `${combo.label}在政策 ${ctx.policy.id} 下${describeEntryError(e)}`));
        }
      }
    }
  }
  return { chart, compiled, contexts, stats };
}

/**
 * acct.storyReplay、acct.invariants：故事全部重播成功；每一步的累計與本筆變動報表不變式全部成立、五步驟四個勾稽點差額為 0、
 * 每條可見列的追蹤樹通過 verifyTraceTree。只寫規則與位置，不印金額。
 */
function checkStory(entry, ctx, issues) {
  const story = entry.data;
  const run = replayStory(story, [], ctx);
  if (!run.ok) {
    const at = run.error.at;
    const i = story.steps.findIndex((s) => s.id === at.stepId);
    const j = i >= 0 ? story.steps[i].events.findIndex((e) => e.id === at.eventId) : -1;
    issues.push(error('acct.storyReplay', entry.file, i >= 0 ? `steps.${i}.events.${Math.max(j, 0)}` : 'steps', `重播失敗：${describeStepError(run.error)}`));
    return null;
  }
  const { layout, policy } = ctx;
  for (const step of run.value.steps) {
    const index = story.steps.findIndex((s) => s.id === step.stepId);
    const path = `steps.${index}`;
    /** @type {import('@ledgerland/core').StatementWindow[]} */
    const windows = [
      { kind: 'cumulative', to: step.stepId },
      { kind: 'transaction', step: step.stepId },
    ];
    for (const win of windows) {
      const st = buildStatements(run.value, win, layout, policy);
      const label = win.kind === 'cumulative' ? '累計' : '本筆變動';
      for (const r of checkStatementInvariants(st)) {
        if (!r.pass) issues.push(error('acct.invariants', entry.file, path, `${label}視窗的不變式 ${r.rule} 不成立：${r.line} 對 ${r.against}`));
      }
      if (win.kind === 'cumulative') {
        for (const c of fiveStepCheck(st).checks) {
          if (!c.pass)
            issues.push(error('acct.invariants', entry.file, path, `五步驟檢查步驟 ${c.step}（${c.alias}）兩邊不相等：${c.left.line} 對 ${c.right.line}`));
        }
      }
      for (const node of traceAllLines(run.value, win, layout, policy, { statements: st })) {
        if (!st.lines.get(node.line)?.visible) continue;
        const v = verifyTraceTree(node, layout, { statements: st });
        if (!v.pass) {
          const rules = [...new Set(v.failures.map((f) => `${f.rule}${f.at ? `（${f.at}）` : ''}`))].join('、');
          issues.push(error('acct.invariants', entry.file, path, `${label}視窗 ${node.line} 的追蹤樹不成立：${rules}`));
        }
      }
    }
  }
  return run.value;
}

const DIMENSION_VALUES = {
  element: ['asset', 'liability', 'equity', 'revenue', 'expense'],
  current: ['current', 'noncurrent'],
  cf_activity: ['operating', 'investing', 'financing'],
  ratio_category: [
    'financial_structure',
    'solvency',
    'activity',
    'profitability',
    'cash_flow',
    'leverage',
    'dupont',
    'department',
    'market',
    'income_structure',
  ],
};

/** acct.classifyDerived：account 項目依科目表、ratio 項目依指標登錄檔推導正解；text 項目的 correctCategories 要是該維度的合法值 */
function checkClassify(entry, q, chart, registry, issues) {
  /** @type {Record<string, string>} */
  const categories = {};
  const allowed = DIMENSION_VALUES[q.dimension];
  q.items.forEach((item, i) => {
    const path = `items.${i}`;
    if (item.account !== undefined) {
      const account = chart.byId.get(item.account);
      if (account === undefined) {
        issues.push(error('acct.classifyDerived', entry.file, `${path}.account`, `科目表沒有科目 ${item.account}`));
        return;
      }
      if (account.contraOf !== null && item.allowContra !== true) {
        issues.push(error('acct.classifyDerived', entry.file, path, `${item.account} 是抵銷科目，要標 allowContra 才能出題`));
        return;
      }
      let derived;
      switch (q.dimension) {
        case 'element':
          derived = account.element;
          break;
        case 'current':
          derived = account.current === null ? undefined : account.current ? 'current' : 'noncurrent';
          break;
        case 'cf_activity':
          derived = account.cashFlow.defaultActivity ?? undefined;
          break;
        default:
          derived = undefined;
      }
      if (derived === undefined) {
        issues.push(error('acct.classifyDerived', entry.file, path, `科目 ${item.account} 在維度 ${q.dimension} 下沒有可推導的正解`));
        return;
      }
      categories[item.id] = derived;
    } else if (item.ratio !== undefined) {
      const definition = registry.byId.get(item.ratio);
      if (definition === undefined) {
        issues.push(error('acct.classifyDerived', entry.file, `${path}.ratio`, `指標登錄檔沒有指標 ${item.ratio}`));
        return;
      }
      if (q.dimension !== 'ratio_category') {
        issues.push(error('acct.classifyDerived', entry.file, path, `指標項目只能用在維度 ratio_category，這一題是 ${q.dimension}`));
        return;
      }
      categories[item.id] = definition.category;
    } else {
      const given = q.correctCategories?.[item.id];
      if (given === undefined) return; // schema 已回報缺 correctCategories
      if (!allowed.includes(given)) {
        issues.push(
          error('acct.classifyDerived', entry.file, `correctCategories.${item.id}`, `${given} 不是維度 ${q.dimension} 的類別（${allowed.join('、')}）`),
        );
        return;
      }
      categories[item.id] = given;
    }
    const authored = q.correctCategories?.[item.id];
    if (item.text === undefined && authored !== undefined) {
      if (authored !== categories[item.id])
        issues.push(
          error('acct.classifyDerived', entry.file, `correctCategories.${item.id}`, `作者填的 ${authored} 與核心推導的 ${categories[item.id]} 不一致`),
        );
      else
        issues.push(
          error(
            'acct.classifyDerived',
            entry.file,
            `correctCategories.${item.id}`,
            'correctCategories 只給自訂文字項目，account 或 ratio 項目的正解由核心推導',
          ),
        );
    }
  });
  return categories;
}

function scenarioOf(q) {
  if (q.type === 'ratio_numeric') return { scenario: q.compute.scenario, path: 'compute.scenario' };
  if ('scenario' in q) return { scenario: q.scenario, path: 'scenario' };
  return { scenario: undefined, path: 'scenario' };
}

/** 指標答案的可序列化形狀（進 answerHash 與快照）：狀態、精確值與顯示值 */
function ratioAnswer(result) {
  return { ratioRef: result.ratioRef, status: result.status, exact: result.exact, displayValue: result.displayValue };
}

/** ans.notMeaningful、ans.acceptStatus：數字題的正解狀態不得是 not_meaningful；acceptStatus 與核心狀態一致 */
function checkRatioStatus(entry, q, result, issues) {
  if (result.status === 'not_meaningful')
    issues.push(error('ans.notMeaningful', entry.file, 'compute.ratioRef', `核心算出的正解狀態是 not_meaningful，數字題不得以它為正解`));
  const accept = q.acceptStatus ?? [];
  if (result.status === 'na' && !accept.includes('na'))
    issues.push(error('ans.acceptStatus', entry.file, 'acceptStatus', '核心算出的正解狀態是 na，acceptStatus 必須列出 na'));
  if (accept.includes('na') && result.status !== 'na')
    issues.push(error('ans.acceptStatus', entry.file, 'acceptStatus', `acceptStatus 列了 na，但核心算出的正解狀態是 ${result.status}`));
}

/**
 * 一題的會計與答案檢查；回傳核心算出的答案（給 answerHash 與快照），任何錯誤回傳 null。
 * @returns {CompiledQuestion | null}
 */
function checkQuestion(entry, ctx, stories, templatesById, registry, issues) {
  const q = entry.data;
  /** @type {CompiledQuestion} */
  const compiled = {};
  let failed = false;
  const { scenario, path } = scenarioOf(q);
  if (scenario !== undefined) {
    if (scenario.policy !== 'teacher@1' || scenario.layout !== 'teacher@1') {
      issues.push(error('acct.teacherPolicy', entry.file, path, `計分題的 policy 與 layout 只能是 teacher@1（${scenario.policy}、${scenario.layout}）`));
      failed = true;
    }
    scenario.events.forEach((ev, j) => {
      const tpl = templatesById.get(ev.template);
      if (tpl === undefined) return; // ref.template 由 validateBundle 回報
      if (q.type === 'journal_entry' && (tpl.entryQuestionBlockedBy?.length ?? 0) > 0) {
        issues.push(
          error(
            'acct.entryBlocked',
            entry.file,
            `${path}.events.${j}.template`,
            `範本 ${ev.template} 的 entryQuestionBlockedBy 列有 ${tpl.entryQuestionBlockedBy.join('、')}，不得用來出分錄題`,
          ),
        );
        failed = true;
      }
      if (q.scored && (tpl.pendingRefs?.length ?? 0) > 0)
        issues.push(
          warning(
            'acct.pendingBlocked',
            entry.file,
            `${path}.events.${j}.template`,
            `計分題用到帶 pendingRefs（${tpl.pendingRefs.join('、')}）的範本 ${ev.template}，審稿者要確認正解不受影響`,
          ),
        );
    });
    if (failed) return null;
    const r = solveScenario(scenario, ctx, { stories, ratios: registry });
    if (!r.ok) {
      const e = r.error;
      const ambiguous = e.code === 'scenario.direction_ambiguous' || e.code === 'scenario.direction_not_meaningful';
      const at = /** @type {{ eventId: string } | undefined} */ (e.at);
      const where = e.target !== undefined ? `${path}.targets（${String(e.target)}）` : at !== undefined ? `${path}.events（${at.eventId}）` : path;
      issues.push(
        error(
          ambiguous ? 'acct.directionAmbiguous' : 'acct.scenarioComputes',
          entry.file,
          where,
          ambiguous
            ? `方向題有歧義：${e.code}（${String(e.ratioRef ?? '')}）`
            : `核心無法算出答案：${e.code}${e.precondition !== undefined ? `，前置條件 ${String(e.precondition)}` : ''}`,
        ),
      );
      return null;
    }
    compiled.expected = r.value.expected;
    compiled.values = r.value.values;
    if (scenario.expected !== undefined) {
      const authored = scenario.expected;
      const core = r.value.expected;
      const ids = new Set([...Object.keys(authored), ...Object.keys(core)]);
      const differing = [...ids].filter((id) => canonicalJson(authored[id] ?? null) !== canonicalJson(core[id] ?? null)).sort();
      if (differing.length > 0) {
        issues.push(
          error(
            'ans.expectedMatchesCore',
            entry.file,
            `${path}.expected`,
            `作者填的期望值與核心結果不一致：target ${differing.join('、')}（刪掉 expected 讓核心產生，或改成與核心相同）`,
          ),
        );
        failed = true;
      }
    }
    if (q.type === 'journal_entry') compiled.expectedEntries = expectedJournalEntries(r.value);
    if (q.type === 'ratio_numeric') {
      const run = r.value.run;
      const after = buildStatements(run, { kind: 'cumulative', to: SCENARIO_STEP_ID }, ctx.layout, ctx.policy);
      const start = buildStatements(
        { steps: [], finalState: createLedger(ctx.chart, run.finalState.opening) },
        { kind: 'cumulative', to: null },
        ctx.layout,
        ctx.policy,
      );
      if (getRatioVersion(registry, q.compute.ratioRef) === undefined) {
        issues.push(error('ref.ratio', entry.file, 'compute.ratioRef', `指標登錄檔沒有 ${q.compute.ratioRef}`));
        return null;
      }
      const result = computeRatio(q.compute.ratioRef, measureMap(after), {}, registry, { opening: measureMap(start) });
      checkRatioStatus(entry, q, result, issues);
      compiled.ratio = ratioAnswer(result);
    }
  } else if (q.type === 'ratio_numeric' && q.compute.measures !== undefined) {
    const version = getRatioVersion(registry, q.compute.ratioRef);
    if (version === undefined) {
      issues.push(error('ref.ratio', entry.file, 'compute.ratioRef', `指標登錄檔沒有 ${q.compute.ratioRef}`));
      return null;
    }
    /** @type {Record<string, number>} */
    const measures = {};
    /** @type {Record<string, number>} */
    const inputs = {};
    for (const [key, ref] of Object.entries(/** @type {Record<string, string>} */ (q.compute.measures))) {
      const value = q.vars?.[ref.slice('vars.'.length)];
      if (value === undefined) return null; // schema 已回報未宣告的 vars
      if (key.startsWith('input.')) inputs[key.slice('input.'.length)] = value;
      else measures[key] = value;
    }
    const missing = version.lineRefs.filter((l) => !(l in measures));
    const extra = Object.keys(measures).filter((l) => !version.lineRefs.includes(l));
    if (missing.length > 0) issues.push(error('ans.ratioNumericFields', entry.file, 'compute.measures', `公式用到的線沒有給值：${missing.join('、')}`));
    if (extra.length > 0) issues.push(error('ans.ratioNumericFields', entry.file, 'compute.measures', `公式沒用到的線不准多給：${extra.join('、')}`));
    if (missing.length > 0 || extra.length > 0) return null;
    const result = computeRatio(q.compute.ratioRef, measures, inputs, registry);
    checkRatioStatus(entry, q, result, issues);
    compiled.ratio = ratioAnswer(result);
  }
  if (q.type === 'classify') compiled.categories = checkClassify(entry, q, ctx.chart, registry, issues);
  return failed ? null : compiled;
}

function error(rule, file, path, message) {
  return { rule, file, path, message, severity: /** @type {const} */ ('error') };
}
function warning(rule, file, path, message) {
  return { rule, file, path, message, severity: /** @type {const} */ ('warning') };
}

/**
 * 跑全部會計與答案規則。
 * @param {ParsedBundle} parsed
 * @param {{ seed?: number; samples?: number }} [options]
 * @returns {{ issues: RuleIssue[]; compiled: Map<string, CompiledQuestion>; stats: { combos: number; skipped: number; storiesReplayed: number; templates: number } }}
 */
export function runAccountingChecks(parsed, options = {}) {
  const seed = options.seed ?? DEFAULT_SEED;
  const samples = options.samples ?? DEFAULT_SAMPLES;
  /** @type {RuleIssue[]} */
  const issues = [];
  const { compiled: compiledTemplates, contexts, stats } = checkTemplates(parsed, issues, { seed, samples });
  const compiled = new Map();
  const teacher = contexts[0];
  let storiesReplayed = 0;
  if (teacher !== undefined) {
    for (const s of parsed.stories) if (checkStory(s, teacher, issues) !== null) storiesReplayed++;
    const stories = new Map(parsed.stories.map((s) => [s.data.id, s.data]));
    const templatesById = new Map(parsed.templates.map((t) => [t.data.id, t.data]));
    const registry = defaultRatioRegistry();
    for (const q of parsed.questions) {
      const c = checkQuestion(q, teacher, stories, templatesById, registry, issues);
      if (c !== null) compiled.set(q.data.id, c);
    }
  }
  return { issues, compiled, stats: { ...stats, storiesReplayed, templates: compiledTemplates.size } };
}

export const hasErrors = (issues) => issues.some((i) => i.severity === 'error');
