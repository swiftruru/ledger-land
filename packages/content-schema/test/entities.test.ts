// M1 新增實體的 schema 測試：科目、運算式、範本、政策、版面、指標、故事、scenario；每個至少正反各一例
import { describe, expect, it } from 'vitest';
import { Account, Expr, ExprAst, Layout, PolicyDefinition, RatioDefinition, Scenario, Story, StoryStep, Target, TransactionTemplate } from '../src/index.ts';
import { account, layout, policy, ratio, scenario, step, story, template } from './fixtures.ts';

const ok = (schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) => schema.safeParse(data).success;
const messages = (schema: { safeParse: (d: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, data: unknown) =>
  (schema.safeParse(data).error?.issues ?? []).map((i) => i.message).join('\n');

describe('Account（04 第 4.1 節）', () => {
  it('範例通過', () => expect(ok(Account, account)).toBe(true));
  it('ifrs_treatment_differs 沒有 ifrsTreatment、資產的 current 為 null、未知欄位都失敗', () => {
    expect(ok(Account, { ...account, ifrsTreatment: null })).toBe(false);
    expect(ok(Account, { ...account, current: null })).toBe(false);
    expect(ok(Account, { ...account, extra: 1 })).toBe(false);
    expect(ok(Account, { ...account, id: 'Deferred' })).toBe(false);
    expect(ok(Account, { ...account, cashFlow: { indirect: 'Via Cash', defaultActivity: null } })).toBe(false);
  });
});

describe('受控運算式（04 第 8 節）', () => {
  it('字串：允許的字元、長度', () => {
    expect(ok(Expr, 'round(cost(machinery_equipment) / param.usefulLifeYears)')).toBe(true);
    expect(ok(Expr, 'balance(cash) >= derived.amount && !param.flag')).toBe(true);
    expect(ok(Expr, '')).toBe(false);
    expect(ok(Expr, 'a'.repeat(301))).toBe(false);
    expect(ok(Expr, 'param.x + "1"')).toBe(false);
    expect(ok(Expr, 'param.x ^ 2')).toBe(false);
  });
  it('AST：04 第 8.4 節的範例', () => {
    const ast = {
      type: 'call',
      fn: 'round',
      valueType: 'int',
      args: [
        {
          type: 'binary',
          op: '/',
          valueType: 'rat',
          left: { type: 'call', fn: 'cost', valueType: 'int', args: [{ type: 'account', id: 'machinery_equipment' }] },
          right: { type: 'ref', ns: 'param', name: 'usefulLifeYears', valueType: 'int' },
        },
      ],
    };
    expect(ok(ExprAst, ast)).toBe(true);
    expect(ok(ExprAst, { type: 'call', fn: 'eval', valueType: 'int', args: [] })).toBe(false);
    expect(ok(ExprAst, { type: 'ref', ns: 'window', name: 'x', valueType: 'int' })).toBe(false);
  });
});

describe('TransactionTemplate（04 第 7 節）', () => {
  it('範例通過', () => expect(ok(TransactionTemplate, template)).toBe(true));
  it('ID 格式', () => {
    expect(ok(TransactionTemplate, { ...template, id: 'sell_all_inventory_cash' })).toBe(false);
    expect(ok(TransactionTemplate, { ...template, id: 'tpl.Sell' })).toBe(false);
    expect(ok(TransactionTemplate, { ...template, id: 'tpl.sell-all' })).toBe(false);
  });
  it('名稱與行 ID 重複、參數範圍、policyWhen 的未知開關都失敗', () => {
    expect(messages(TransactionTemplate, { ...template, params: [template.params[0], template.params[0]] })).toContain('名稱重複');
    expect(messages(TransactionTemplate, { ...template, lines: [template.lines[0], template.lines[0]] })).toContain('範本行 ID 重複');
    expect(ok(TransactionTemplate, { ...template, params: [{ ...template.params[0], default: -1 }] })).toBe(false);
    expect(ok(TransactionTemplate, { ...template, lines: [{ ...template.lines[0], policyWhen: { orgCosts: 'expense' } }] })).toBe(true);
    expect(ok(TransactionTemplate, { ...template, lines: [{ ...template.lines[0], policyWhen: { nope: 'x' } }] })).toBe(false);
    expect(ok(TransactionTemplate, { ...template, lines: [{ ...template.lines[0], amount: 'round(param.price) ^ 2' }] })).toBe(false);
  });
});

describe('PolicyDefinition（04 第 10.1 節）', () => {
  it('範例通過；未知 ID、未知開關值、同時啟用與停用都失敗', () => {
    expect(ok(PolicyDefinition, policy)).toBe(true);
    expect(ok(PolicyDefinition, { ...policy, id: 'teacher@2' })).toBe(false);
    expect(ok(PolicyDefinition, { ...policy, switches: { ...policy.switches, orgCosts: 'defer' } })).toBe(false);
    expect(ok(PolicyDefinition, { ...policy, enabledAccounts: ['organisation_costs_expense'] })).toBe(false);
  });
});

describe('Layout（04 第 11 節）', () => {
  it('範例通過', () => expect(messages(Layout, layout)).toBe(''));
  it('線 ID 前綴、重複、未知 kind、缺必填欄位、舊欄位名、缺報表都失敗', () => {
    const base = { cell: null, label: { 'zh-TW': '測試列', en: 'Test line' }, aliases: { 'zh-TW': [], en: [] } };
    const withLine = (key: string, line: unknown) => ({
      ...layout,
      statements: { ...layout.statements, [key]: [...(layout.statements as Record<string, unknown[]>)[key]!, line] },
    });
    expect(messages(Layout, withLine('income_statement', { ...base, id: 'bs_wrong', kind: 'inventory_opening' }))).toContain('要以 is_ 開頭');
    expect(messages(Layout, withLine('balance_sheet', { ...base, id: 'bs_cash', kind: 'accounts', accounts: ['cash'], measure: 'balance' }))).toContain(
      '線 ID 重複',
    );
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'mystery' }))).toBe(false);
    // 缺 cell、label、aliases
    expect(ok(Layout, withLine('income_statement', { id: 'is_x', kind: 'inventory_opening' }))).toBe(false);
    // accounts 缺 measure；舊的 basis 欄位
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'accounts', accounts: ['cash'] }))).toBe(false);
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'accounts', accounts: ['cash'], basis: 'activity' }))).toBe(false);
    // cash_tag 用舊的單數 cfKind、缺 activity、cfKinds 為空
    expect(
      ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'cash_tag', activity: 'investing', cfKind: 'capex', sign: 'outflow_negative' })),
    ).toBe(false);
    expect(ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'cash_tag', cfKinds: ['capex'], sign: 'outflow_negative' }))).toBe(false);
    expect(
      ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'cash_tag', activity: 'investing', cfKinds: [], sign: 'outflow_negative' })),
    ).toBe(false);
    // 舊的 sign 值
    expect(
      ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'noncash_addback', accounts: ['depreciation_expense'], sign: 'add_back' })),
    ).toBe(false);
    expect(
      ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'working_capital', accounts: ['inventory'], sign: 'negate_increase_only' })),
    ).toBe(false);
    // 舊的 balance、direct_cash kind
    expect(ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'balance', account: 'cash', at: 'window_start' }))).toBe(false);
    expect(ok(Layout, withLine('cash_flow_direct', { ...base, id: 'dc_x', kind: 'direct_cash', cfKinds: ['capex'], sign: 'outflow_negative' }))).toBe(false);
    // 公式層次、不變式格式、合計為空、盤盈的政策值
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'formula', expr: 'line.is_revenue', level: 6 }))).toBe(false);
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'formula', expr: 'line.is_revenue', invariant: 'equals_line:nope' }))).toBe(
      false,
    );
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'total', sum: [] }))).toBe(false);
    expect(ok(Layout, withLine('income_statement', { ...base, id: 'is_x', kind: 'inventory_overage', appliesWhen: { inventoryOverage: ['defer'] } }))).toBe(
      false,
    );
    expect(ok(Layout, withLine('cash_flow_indirect', { ...base, id: 'cf_x', kind: 'link', from: 'is_net_income', check: 'step4' }))).toBe(false);
    expect(ok(Layout, { ...layout, options: { ...layout.options, showExtensionRows: 'sometimes' } })).toBe(false);
    expect(ok(Layout, { ...layout, statements: { ...layout.statements, cash_flow_direct: undefined } })).toBe(false);
  });
});

describe('RatioDefinition（04 第 12.1 節）', () => {
  it('範例通過', () => expect(messages(RatioDefinition, ratio)).toBe(''));
  it('ratioRef 格式、分數與 expr 二選一、沒有版本都失敗', () => {
    expect(ok(Target, { id: 't1', kind: 'ratio', ratioRef: 'roa@excel', measure: 'value' })).toBe(true);
    expect(ok(Target, { id: 't1', kind: 'ratio', ratioRef: 'roa@teacher', measure: 'value' })).toBe(false);
    expect(ok(Target, { id: 't1', kind: 'ratio', ratioRef: 'roa', measure: 'value' })).toBe(false);
    const both = { ...ratio, versions: { excel: { ...ratio.versions.excel, expr: 'line.is_net_income' } } };
    expect(messages(RatioDefinition, both)).toContain('二選一');
    const half = { ...ratio, versions: { excel: { ...ratio.versions.excel, denominator: undefined } } };
    expect(ok(RatioDefinition, half)).toBe(false);
    expect(messages(RatioDefinition, { ...ratio, versions: {} })).toContain('至少要有一個版本');
    expect(ok(RatioDefinition, { ...ratio, versions: { ...ratio.versions, slides04: ratio.versions.excel } })).toBe(false);
  });
});

describe('Story 與 StoryStep（04 第 9.1 節、08 第 3.9 節）', () => {
  it('範例通過', () => {
    expect(messages(StoryStep, step)).toBe('');
    expect(messages(Story, story)).toBe('');
  });
  it('teacher 不得有 checkpoints；original 不得有 verification', () => {
    expect(messages(Story, { ...story, origin: 'teacher' })).toContain('不填 checkpoints');
    const { checkpoints: _c, ...plain } = step;
    expect(ok(Story, { ...story, origin: 'teacher', steps: [{ ...plain, verification: 'inferred' }] })).toBe(true);
    expect(ok(Story, { ...story, steps: [{ ...plain, verification: 'inferred' }] })).toBe(false);
  });
  it('步驟 order 重複、事件 ID 重複或格式錯誤、checkpoint 引用不存在的事件都失敗', () => {
    expect(messages(Story, { ...story, steps: [step, { ...step, id: 'st_h8q3z6' }] })).toContain('order 重複');
    expect(messages(StoryStep, { ...step, events: [step.events[0], step.events[0]] })).toContain('事件 ID 重複');
    expect(ok(StoryStep, { ...step, events: [{ ...step.events[0], id: 'e0' }] })).toBe(false);
    expect(ok(StoryStep, { ...step, events: [{ ...step.events[0], id: 'event1' }] })).toBe(false);
    expect(messages(StoryStep, { ...step, checkpoints: [{ ref: 'e9.amount', value: 1 }] })).toContain('不存在的事件');
    expect(ok(StoryStep, { ...step, events: [{ ...step.events[0], extra: true }] })).toBe(false);
    expect(ok(Story, { ...story, policy: 'ifrs@1' })).toBe(false);
  });
});

describe('Scenario 與 Target（04 第 15.1 節）', () => {
  it('範例通過；自訂期初也通過', () => {
    expect(messages(Scenario, scenario)).toBe('');
    expect(ok(Scenario, { ...scenario, opening: { balances: { cash: 100000, share_capital: 100000 } } })).toBe(true);
  });
  it('target ID 重複、兩個 target 指同一個線、status 用在非指標、未知 kind 都失敗', () => {
    expect(messages(Scenario, { ...scenario, targets: [scenario.targets[0], { ...scenario.targets[1], id: 't1' }] })).toContain('target ID 重複');
    expect(messages(Scenario, { ...scenario, targets: [scenario.targets[0], { ...scenario.targets[0], id: 't9' }] })).toContain('同一個對象');
    expect(ok(Target, { id: 't1', kind: 'line', line: 'bs_cash', measure: 'status' })).toBe(false);
    expect(ok(Target, { id: 't1', kind: 'check', step: 1, measure: 'value' })).toBe(false);
    expect(ok(Target, { id: 'target1', kind: 'line', line: 'bs_cash', measure: 'value' })).toBe(false);
    expect(ok(Scenario, { ...scenario, events: [scenario.events[0], scenario.events[0]] })).toBe(false);
    expect(ok(Scenario, { ...scenario, expected: { t7: { direction: 'up' } } })).toBe(false);
    expect(ok(Scenario, { ...scenario, policy: 'ifrs@1' })).toBe(false);
  });
});
