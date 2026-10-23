// 內容編譯測試（04 第 18 節的「內容編譯測試」、10 第 8 節 M1 完成標準）：content:check 的會計與答案規則直接呼叫 tools/lib/content-rules.mjs。
// 用 04 第 17 節的範例搭配核心的自編故事；不含老師的金額。
import { describe, expect, it } from 'vitest';
import { validateBundle } from '@ledgerland/content-schema';
import { DEFAULT_OPEN_REFS, hasErrors, openPendingRefs, parseBundle, runAccountingChecks } from '../lib/content-rules.mjs';
import {
  blockedTemplateEntry,
  bundleWith,
  q172,
  q172Expected,
  q172Values,
  qCurrentRatioNa,
  qJournal,
  qJournalExpectedEntries,
  qMulti,
  qRoa,
  storyEntry,
} from './fixtures.ts';

const FAST = { samples: 2 };
/** 測試用：把 T04 與 T11 當成仍開放的編號（正式的 tools/lib/open-refs.json 目前為空） */
const OPEN = ['T04', 'T11'];
const run = (questions: Record<string, unknown>[], extra?: Parameters<typeof bundleWith>[1], options: Record<string, unknown> = {}) => {
  const bundle = bundleWith(questions, extra);
  const schema = validateBundle(bundle);
  const acct = runAccountingChecks(parseBundle(bundle), { ...FAST, ...options });
  return { schema, acct, rules: acct.issues.map((i) => i.rule), errors: acct.issues.filter((i) => i.severity === 'error') };
};

describe('範本與故事（acct.templateBalanced、acct.templatePreconditions、acct.storyReplay、acct.invariants）', () => {
  const r = run([]);

  it('21 個內建範本在兩套政策下借貸相等、預設參數滿足前置條件；自編故事重播與不變式全部通過', () => {
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.acct.stats.templates).toBe(21);
    expect(r.acct.stats.storiesReplayed).toBe(1);
  });

  it('故事事件引用不存在的範本：validateBundle 回報 ref.template，核心重播回報 acct.storyReplay', () => {
    const story = structuredClone(storyEntry.data) as { id: string; steps: { events: { template: string }[] }[] };
    story.id = 'story_zz9999';
    story.steps = story.steps.map((s, i) => ({ ...s, id: `st_zz${String(i).padStart(4, '0')}` })) as typeof story.steps;
    story.steps[6]!.events[0]!.template = 'tpl.does_not_exist';
    const bundle = bundleWith([], { stories: [{ file: 'content/stories/story_zz9999.json', data: story }] });
    const schema = validateBundle(bundle);
    expect(schema.some((i) => i.path === 'steps.6.events.0.template' && i.message.includes('tpl.does_not_exist'))).toBe(true);
    const acct = runAccountingChecks(parseBundle(bundle), FAST);
    const replay = acct.issues.filter((i) => i.rule === 'acct.storyReplay');
    expect(replay).toHaveLength(1);
    expect(replay[0]!.path).toBe('steps.6.events.0');
    expect(replay[0]!.message).toContain('story.unknown_template');
  });
});

describe('04 第 17.2 節的交易影響題（acct.scenarioComputes、ans.expectedMatchesCore）', () => {
  it('核心算出的 expected 與 values 和文件相同', () => {
    const r = run([q172]);
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    const compiled = r.acct.compiled.get('q_tx7h2c9d');
    expect(compiled?.expected).toEqual(q172Expected);
    expect(compiled?.values).toEqual(q172Values);
  });

  it('作者填的 expected 與核心一致時通過', () => {
    const r = run([{ ...q172, scenario: { ...q172.scenario, expected: q172Expected } }]);
    expect(r.errors).toEqual([]);
  });

  it('作者填錯 expected 時被擋（ans.expectedMatchesCore），訊息只列 target 不列金額', () => {
    const wrong = { ...q172Expected, t3: { ...q172Expected.t3, direction: 'down' } };
    const r = run([{ ...q172, scenario: { ...q172.scenario, expected: wrong } }]);
    const hit = r.errors.filter((i) => i.rule === 'ans.expectedMatchesCore');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.path).toBe('scenario.expected');
    expect(hit[0]!.message).toContain('t3');
    expect(hit[0]!.message).not.toContain('480000');
    expect(r.acct.compiled.has('q_tx7h2c9d')).toBe(false);
  });

  it('不存在的線由核心回報（acct.scenarioComputes）', () => {
    const targets = [{ id: 't1', kind: 'line', line: 'bs_no_such_line', measure: 'direction' }];
    const r = run([{ ...q172, scenario: { ...q172.scenario, targets } }]);
    expect(r.rules).toContain('acct.scenarioComputes');
  });
});

describe('04 第 17.11 節的分錄題（acct.entryBlocked）', () => {
  it('正解分錄由核心產生，與文件相同', () => {
    const r = run([qJournal]);
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    // 核心依科目表 order 排序（現金在前），文件的範例只是列舉；比對行的集合
    const byAccount = (lines: readonly unknown[] | undefined) => [...(lines as { account: string }[])].sort((a, b) => a.account.localeCompare(b.account));
    expect(byAccount(r.acct.compiled.get('q_y3m7k2dw')?.expectedEntries)).toEqual(byAccount(qJournalExpectedEntries));
  });

  it('用帶 entryQuestionBlockedBy 的自編範本（tpl.test_blocked_amortise，T99）被擋；內建範本都不帶這個欄位', () => {
    const events = [{ id: 'e1', template: 'tpl.test_blocked_amortise', params: { years: 5 } }];
    const r = run([{ ...qJournal, scenario: { ...qJournal.scenario, opening: { storyRef: 'story_q7m2v9', afterStep: 'st_f4g5h6' }, events } }], {
      templates: [blockedTemplateEntry],
    });
    const hit = r.errors.filter((i) => i.rule === 'acct.entryBlocked');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.path).toBe('scenario.events.0.template');
    expect(hit[0]!.message).toContain('T99');
    // schema 層（validateBundle）也擋
    expect(r.schema.some((i) => i.path === 'scenario.events.0.template' && i.message.includes('entryQuestionBlockedBy'))).toBe(true);
    // 同一題改用內建的攤銷範本就不再被擋（T04、T05 已決定）；把 T04 當成仍開放時只剩 pendingRefs 的警告
    const builtIn = run(
      [
        {
          ...qJournal,
          scenario: {
            ...qJournal.scenario,
            opening: { storyRef: 'story_q7m2v9', afterStep: 'st_f4g5h6' },
            events: [{ ...events[0]!, template: 'tpl.amortise_org_costs' }],
          },
        },
      ],
      undefined,
      { openRefs: OPEN },
    );
    expect(builtIn.errors.filter((i) => i.rule === 'acct.entryBlocked')).toEqual([]);
    expect(builtIn.schema.some((i) => i.message.includes('entryQuestionBlockedBy'))).toBe(false);
    expect(builtIn.acct.issues.some((i) => i.rule === 'acct.pendingBlocked' && i.message.includes('T04'))).toBe(true);
  });

  it('acct.pendingBlocked 只看仍開放的編號：範本的 pendingRefs 列有 open-refs 裡的編號才警告，不擋', () => {
    const r = run([qJournal], undefined, { openRefs: OPEN });
    const warn = r.acct.issues.filter((i) => i.rule === 'acct.pendingBlocked');
    expect(warn).toHaveLength(1);
    expect(warn[0]!.severity).toBe('warning');
    expect(warn[0]!.message).toContain('T11');
    expect(warn[0]!.message).not.toContain('T04');
    // 只開放不相干的編號：不警告
    expect(run([qJournal], undefined, { openRefs: ['T99'] }).rules).not.toContain('acct.pendingBlocked');
  });

  it('預設的 open-refs.json 目前為空（T 系列已全部決定）：pendingRefs 不再產生 acct.pendingBlocked 警告', () => {
    expect(DEFAULT_OPEN_REFS).toEqual([]);
    expect(openPendingRefs(['T04', 'T11'], DEFAULT_OPEN_REFS)).toEqual([]);
    expect(openPendingRefs(['T04', 'T11'], ['T11', 'D03'])).toEqual(['T11']);
    expect(openPendingRefs(undefined, ['T11'])).toEqual([]);
    const r = run([qJournal]);
    expect(r.rules).not.toContain('acct.pendingBlocked');
  });

  it('學習目標的 pendingRefs 列有仍開放的編號時，已發布的計分題在 objectiveId 警告', () => {
    const bundle = bundleWith([qJournal]);
    const objectives = [
      {
        file: 'content/objectives/ch_e4j7r2.json',
        data: {
          chapterId: 'ch_e4j7r2',
          items: [
            {
              id: 'obj_9wr3e6',
              rev: 1,
              revKind: 'text',
              status: 'published',
              chapterId: 'ch_e4j7r2',
              order: 1,
              statement: { 'zh-TW': '目標', en: 'Objective' },
              skill: 'identify',
              plannedQuestions: 1,
              pendingRefs: ['T04'],
            },
          ],
        },
      },
    ];
    const parsed = parseBundle({ ...bundle, objectives, levels: [] });
    const withOpen = runAccountingChecks(parsed, { ...FAST, openRefs: ['T04'] }).issues.filter(
      (i) => i.rule === 'acct.pendingBlocked' && i.path === 'objectiveId',
    );
    expect(withOpen).toHaveLength(1);
    expect(withOpen[0]!.message).toContain('obj_9wr3e6');
    const closed = runAccountingChecks(parsed, FAST).issues.filter((i) => i.rule === 'acct.pendingBlocked');
    expect(closed).toEqual([]);
  });
});

describe('04 第 17.10 節的多正解題：schema 層的四條規則（validateBundle）', () => {
  const issuesOf = (q: Record<string, unknown>) => validateBundle(bundleWith([q])).map((i) => `${i.path}：${i.message}`);

  it('合法的題目通過', () => {
    expect(issuesOf(qMulti)).toEqual([]);
  });
  it('correctOptionIds 少於兩個', () => {
    expect(issuesOf({ ...qMulti, correctOptionIds: ['o_f3k8'] }).some((m) => m.startsWith('correctOptionIds'))).toBe(true);
  });
  it('缺少 scoringMode', () => {
    const { scoringMode: _s, ...rest } = qMulti;
    expect(issuesOf(rest).some((m) => m.startsWith('scoringMode'))).toBe(true);
  });
  it('scoringMode 不是 any_correct 或 all_correct', () => {
    expect(issuesOf({ ...qMulti, scoringMode: 'majority' }).some((m) => m.startsWith('scoringMode'))).toBe(true);
  });
  it('全部選項都是正解', () => {
    expect(issuesOf({ ...qMulti, correctOptionIds: ['o_f3k8', 'o_g6v4', 'o_h7n2', 'o_j2c9'] }).some((m) => m.includes('至少要留一個'))).toBe(true);
  });
});

describe('04 第 17.3 節的指標計算題（ans.notMeaningful、ans.acceptStatus、ans.ratioNumericFields）', () => {
  it('ROA 的正解狀態 ok、顯示值 25；流動比率為 N/A 時 acceptStatus 有 na 就通過', () => {
    const r = run([qRoa, qCurrentRatioNa]);
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.acct.compiled.get('q_r8n2v5qe')?.ratio).toMatchObject({ ratioRef: 'roa@excel', status: 'ok', displayValue: 25, exact: { num: '1', den: '4' } });
    expect(r.acct.compiled.get('q_c3k7w1nb')?.ratio).toMatchObject({ ratioRef: 'current_ratio@excel', status: 'na', displayValue: null, exact: null });
  });

  it('正解是 N/A 但沒有 acceptStatus 時被擋；acceptStatus 列了 na 但正解算得出來也被擋', () => {
    const { acceptStatus: _a, ...noAccept } = qCurrentRatioNa;
    expect(run([noAccept]).rules).toContain('ans.acceptStatus');
    expect(run([{ ...qRoa, acceptStatus: ['na'] }]).rules).toContain('ans.acceptStatus');
  });

  it('measures 缺線或多給線被擋（ans.ratioNumericFields）', () => {
    const missing = { ...qRoa, compute: { ratioRef: 'roa@excel', measures: { is_net_income: 'vars.netIncome' } } };
    expect(run([missing]).rules).toContain('ans.ratioNumericFields');
    const extra = { ...qRoa, vars: { ...qRoa.vars, x: 1 }, compute: { ratioRef: 'roa@excel', measures: { ...qRoa.compute.measures, bs_cash: 'vars.x' } } };
    expect(run([extra]).rules).toContain('ans.ratioNumericFields');
  });

  it('DOL 在毛利為 0、營業利益為負的自訂期初下是 not_meaningful，數字題被擋（ans.notMeaningful）', () => {
    const q = {
      ...qRoa,
      id: 'q_d0x1n0tm',
      vars: {},
      compute: {
        ratioRef: 'dol@excel',
        scenario: {
          opening: { balances: { cash: 1000000, share_capital: 1000000 } },
          events: [{ id: 'e1', template: 'tpl.pay_outsourcing_cash', params: { amount: 100000 } }],
          policy: 'teacher@1',
          layout: 'teacher@1',
          window: 'cumulative',
          targets: [],
        },
      },
      answerUnit: 'multiple',
      prompt: { 'zh-TW': '營運槓桿度是多少？', en: 'What is the degree of operating leverage?' },
      explanation: { 'zh-TW': '毛利為 0。', en: 'Gross profit is zero.' },
    };
    const r = run([q]);
    expect(r.rules).toContain('ans.notMeaningful');
  });
});

describe('分類題（acct.classifyDerived）', () => {
  const classify = (dimension: string, items: Record<string, unknown>[], correctCategories?: Record<string, string>) => ({
    id: 'q_c14ss1fy',
    rev: 1,
    revKind: 'text',
    status: 'published',
    type: 'classify',
    chapterId: 'ch_n3f8q1',
    objectiveId: 'obj_5vk2m7',
    difficulty: 1,
    tags: ['classify'],
    termRefs: [],
    scored: true,
    dimension,
    items,
    ...(correctCategories === undefined ? {} : { correctCategories }),
    prompt: { 'zh-TW': '把每個項目分到正確的類別。', en: 'Sort each item into the right category.' },
    explanation: { 'zh-TW': '依科目表分類。', en: 'Classified by the chart of accounts.' },
  });

  it('account 項目依科目表推導、ratio 項目依登錄檔類別、text 項目用 correctCategories', () => {
    const r = run([
      classify(
        'element',
        [
          { id: 'it_a1b2', account: 'cash' },
          { id: 'it_c3d4', account: 'revenue' },
          { id: 'it_e5f6', text: { 'zh-TW': '股東出資', en: 'Capital paid in' } },
        ],
        { it_e5f6: 'equity' },
      ),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.acct.compiled.get('q_c14ss1fy')?.categories).toEqual({ it_a1b2: 'asset', it_c3d4: 'revenue', it_e5f6: 'equity' });
    const ratios = run([
      classify('ratio_category', [
        { id: 'it_a1b2', ratio: 'roa' },
        { id: 'it_c3d4', ratio: 'current_ratio' },
      ]),
    ]);
    expect(ratios.errors).toEqual([]);
    expect(ratios.acct.compiled.get('q_c14ss1fy')?.categories).toEqual({ it_a1b2: 'profitability', it_c3d4: 'solvency' });
    const current = run([
      classify('current', [
        { id: 'it_a1b2', account: 'inventory' },
        { id: 'it_c3d4', account: 'machinery_equipment' },
      ]),
    ]);
    expect(current.acct.compiled.get('q_c14ss1fy')?.categories).toEqual({ it_a1b2: 'current', it_c3d4: 'noncurrent' });
  });

  it('抵銷科目沒有 allowContra、權益科目問流動性、作者替 account 項目填正解，都被擋', () => {
    expect(
      run([
        classify('element', [
          { id: 'it_a1b2', account: 'accumulated_depreciation_machinery' },
          { id: 'it_c3d4', account: 'cash' },
        ]),
      ]).rules,
    ).toContain('acct.classifyDerived');
    expect(
      run([
        classify('element', [
          { id: 'it_a1b2', account: 'accumulated_depreciation_machinery', allowContra: true },
          { id: 'it_c3d4', account: 'cash' },
        ]),
      ]).errors,
    ).toEqual([]);
    expect(
      run([
        classify('current', [
          { id: 'it_a1b2', account: 'share_capital' },
          { id: 'it_c3d4', account: 'cash' },
        ]),
      ]).rules,
    ).toContain('acct.classifyDerived');
    const authored = run([
      classify(
        'element',
        [
          { id: 'it_a1b2', account: 'cash' },
          { id: 'it_c3d4', account: 'revenue' },
        ],
        { it_a1b2: 'asset' },
      ),
    ]);
    // schema 層先擋下（correctCategories 只給自訂文字項目），所以不會進到核心推導
    expect(authored.schema.some((i) => i.message.includes('只給自訂文字項目'))).toBe(true);
  });
});

describe('hasErrors', () => {
  it('只看 error，不看 warning', () => {
    expect(hasErrors([{ rule: 'x', file: 'f', path: 'p', message: 'm', severity: 'warning' }])).toBe(false);
    expect(hasErrors([{ rule: 'x', file: 'f', path: 'p', message: 'm', severity: 'error' }])).toBe(true);
  });
});
