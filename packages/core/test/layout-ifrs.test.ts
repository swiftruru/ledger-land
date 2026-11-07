// oxlint-disable vitest/no-conditional-expect, vitest/valid-expect, vitest/expect-expect -- 靜態資料檢查依每一列的 kind 分支斷言；expect 的第二個引數是失敗時指出哪一列的訊息；逐步、逐列的檢查寫成迴圈
// IFRS 對照的版面 layouts/ifrs@1.json（04 第 10.3 節，D10(f)，M4b）：和 teacher@1 共用線 ID、沒有經常利益與非常損益、沒有攤銷與遞延資產的列，
// cell 全為 null；ifrs@1 政策預設配這套版面；青檸文具社在這套政策與版面下的不變式、五步驟（步驟①沒有經常利益）與追蹤樹都成立；
// 指標登錄檔引用的每一條線都在（指標不用改）。期望金額在 lime-leaf-ifrs.golden.test.ts，這裡只看結構與不變式。
import { Layout as LayoutSchema } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { buildChart } from '../src/accounts/index.ts';
import { fiveStepCheck } from '../src/checks/index.ts';
import { defaultAccounts, defaultLayouts, defaultRatios, getLayout, ifrsLayout, teacherLayout } from '../src/data/index.ts';
import { LAYOUT_LINE_KINDS, STATEMENT_IDS, type LayoutLine } from '../src/layout/index.ts';
import { layoutLineIds } from '../src/ratios/index.ts';
import { unwrap } from '../src/result.ts';
import { buildStatements, checkStatementInvariants, lineValue } from '../src/statements/index.ts';
import { createCoreContext, orderedSteps, replayStory } from '../src/story/index.ts';
import { traceAllLines, verifyTraceTree } from '../src/trace/index.ts';
import { expectBritish, expectNoDash, refsOf } from './helpers.ts';
import { limeLeafStory } from './fixtures/story-lime-leaf.ts';

const chart = buildChart(defaultAccounts);
const lines = (layout: typeof ifrsLayout): LayoutLine[] => STATEMENT_IDS.flatMap((s) => [...layout.statements[s]]);
const ifrsLines = lines(ifrsLayout);
const ifrsIds = new Set(ifrsLines.map((l) => l.id));
const teacherIds = new Set(lines(teacherLayout).map((l) => l.id));
const byId = new Map(ifrsLines.map((l) => [l.id, l]));

/** teacher@1 有、ifrs@1 沒有的列：經常利益、非常損益、攤銷遞延資產、遞延資產分組、營業成本分組、攤銷加回（04 第 10.3 節） */
const REMOVED = [
  'is_cogs_group',
  'is_amortisation',
  'is_ordinary_income',
  'is_extraordinary_gains',
  'is_extraordinary_losses',
  'bs_deferred_assets_group',
  'cf_other_noncash_losses',
];
/** 保留為不顯示的計算列：存貨四列給 is_cogs 與指標（ap_turnover 引用 is_purchases）、遞延資產兩列給指標（值在 ifrs@1 下是 0） */
const HIDDEN = [
  'is_opening_inventory',
  'is_purchases',
  'is_inventory_overage_excluded',
  'is_closing_inventory',
  'bs_deferred_org_costs',
  'bs_deferred_dev_costs',
];

describe('layouts/ifrs@1.json 的結構', () => {
  it('ID 是 ifrs@1，通過 content-schema 的 Layout，四張表都有，列在內建版面清單裡並可用 getLayout 取得', () => {
    expect(ifrsLayout.id).toBe('ifrs@1');
    expect(LayoutSchema.safeParse(ifrsLayout).success).toBe(true);
    for (const s of STATEMENT_IDS) expect(ifrsLayout.statements[s].length, s).toBeGreaterThan(0);
    expect(defaultLayouts.map((l) => l.id)).toEqual(['teacher@1', 'ifrs@1']);
    expect(getLayout('ifrs@1')).toBe(ifrsLayout);
    expect(getLayout('teacher@1')).toBe(teacherLayout);
    expect(getLayout('nope@1')).toBeUndefined();
  });

  it('線 ID 是 teacher@1 的子集合：少掉的只有經常利益、非常損益、攤銷、遞延資產分組、營業成本分組與攤銷加回；其餘每一條線都在', () => {
    for (const id of ifrsIds) expect(teacherIds.has(id), id).toBe(true);
    const missing = [...teacherIds].filter((id) => !ifrsIds.has(id)).sort();
    expect(missing).toEqual([...REMOVED].sort());
    expect(ifrsLines.length).toBe(ifrsIds.size);
    for (const l of ifrsLines) {
      expect(LAYOUT_LINE_KINDS).toContain(l.kind);
      expect(Object.keys(l).slice(0, 5)).toEqual(['id', 'cell', 'kind', 'label', 'aliases']);
    }
  });

  it('cell 全為 null（不匯出老師的 Excel）；沒有任何列帶 not_ifrs_line、japanese、old_name 或 typo_fixed 旗標', () => {
    for (const l of ifrsLines) {
      expect(l.cell, l.id).toBeNull();
      for (const f of l.flags ?? []) expect(['not_ifrs_line', 'japanese', 'old_name', 'typo_fixed'], `${l.id} ${f}`).not.toContain(f);
    }
  });

  it('計算列 hidden：存貨四列與遞延資產兩列；其他列和 teacher@1 的 hidden 相同', () => {
    for (const id of HIDDEN) expect(byId.get(id)?.hidden, id).toBe(true);
    for (const l of lines(teacherLayout)) {
      const mine = byId.get(l.id);
      if (mine === undefined || HIDDEN.includes(l.id)) continue;
      expect(mine.hidden === true, l.id).toBe(l.hidden === true);
    }
  });

  it('列引用的線、科目與公式都存在，公式只引用 line.*；group 的 children 與 total 的 sum 不再指向拿掉的列', () => {
    const has = (id: string, where: string) => expect(ifrsIds.has(id), `${where} 引用了不存在的線 ${id}`).toBe(true);
    for (const l of ifrsLines) {
      switch (l.kind) {
        case 'accounts':
        case 'working_capital':
        case 'noncash_addback':
          for (const a of l.accounts) expect(chart.byId.has(a), `${l.id} ${a}`).toBe(true);
          break;
        case 'formula':
          for (const ref of refsOf(l.expr, 'line')) has(ref, l.id);
          break;
        case 'link':
          has(l.from, l.id);
          break;
        case 'retained_earnings':
          has(l.netIncomeLine, l.id);
          break;
        case 'group':
          for (const c of l.children ?? []) has(c, l.id);
          break;
        case 'total':
          for (const s of l.sum) has(s, l.id);
          break;
        case 'balance_end':
          for (const s of l.from) has(s, l.id);
          break;
        default:
          break;
      }
    }
  });

  it('損益表四層利益（沒有第 3 層經常利益）；稅前淨利直接由營業利益加營業外收入減營業外費損；營業外費損只有財務成本', () => {
    const is = ifrsLayout.statements.income_statement;
    const levels = is.flatMap((l) => (l.kind === 'formula' && l.level ? [[l.level, l.id] as const] : []));
    expect(levels).toEqual([
      [1, 'is_gross_profit'],
      [2, 'is_operating_income'],
      [4, 'is_pretax_income'],
      [5, 'is_net_income'],
    ]);
    const pretax = byId.get('is_pretax_income');
    expect(pretax?.kind === 'formula' && pretax.expr).toBe('line.is_operating_income + line.is_non_operating_income - line.is_non_operating_expense_total');
    const nonOp = byId.get('is_non_operating_expense_total');
    expect(nonOp?.kind === 'total' && nonOp.sum).toEqual(['is_interest_expense']);
    const sga = byId.get('is_sga_total');
    expect(sga?.label['zh-TW']).toBe('營業費用合計');
    expect(ifrsLayout.options.showOrdinaryIncome).toBe(false);
    expect(ifrsLayout.options.showExtraordinaryRows).toBe(false);
  });

  it('資產總計不含遞延資產；營業活動小計不含攤銷加回；勾稽點（step2、step3、equals_line）和 teacher@1 相同', () => {
    const assets = byId.get('bs_total_assets');
    expect(assets?.kind === 'total' && assets.sum).not.toContain('bs_deferred_org_costs');
    expect(assets?.kind === 'total' && assets.sum).not.toContain('bs_deferred_dev_costs');
    const subtotal = byId.get('cf_operating_subtotal');
    expect(subtotal?.kind === 'total' && subtotal.sum).not.toContain('cf_other_noncash_losses');
    const h11 = byId.get('cf_pretax_income');
    expect(h11?.kind === 'link' && h11.check).toBe('step2');
    const h41 = byId.get('cf_cash_end');
    expect(h41?.kind === 'balance_end' && h41.check).toBe('step3');
    const n29 = byId.get('bs_total_liabilities_equity');
    expect(n29?.kind === 'total' && n29.invariant).toBe('equals_line:bs_total_assets');
  });

  it('指標登錄檔（ratios.json）引用的每一條線都在 ifrs@1 版面裡，所以登錄檔不用改', () => {
    const ids = layoutLineIds(ifrsLayout);
    for (const r of defaultRatios)
      for (const v of Object.values(r.versions)) {
        if (v === undefined) continue;
        for (const expr of [v.numerator, v.denominator, v.expr])
          if (expr !== undefined) for (const ref of refsOf(expr, 'line')) expect(ids.has(ref), `${r.id} ${ref}`).toBe(true);
      }
  });

  it('每一列的別名不重複、不和主要顯示相同；文字沒有破折號，英文用英式拼字', () => {
    for (const l of ifrsLines) {
      for (const lang of ['zh-TW', 'en'] as const) {
        const aliases = l.aliases[lang];
        expect(new Set(aliases).size, `${l.id} ${lang}`).toBe(aliases.length);
        expect(aliases, `${l.id} ${lang}`).not.toContain(l.label[lang]);
      }
      expectNoDash(l.label['zh-TW']);
      expectNoDash(l.label.en);
      expectBritish(l.label.en);
      for (const a of l.aliases.en) expectBritish(a);
    }
  });
});

describe('ifrs@1 政策配 ifrs@1 版面', () => {
  const ctx = createCoreContext({ policy: 'ifrs@1' });
  const run = unwrap(replayStory(limeLeafStory, [], ctx));
  const stepIds = orderedSteps(limeLeafStory).map((s) => s.id);

  it('createCoreContext 只給政策時自動配同名版面；給了版面就照給的', () => {
    expect(ctx.policy.id).toBe('ifrs@1');
    expect(ctx.layout.id).toBe('ifrs@1');
    expect(createCoreContext().layout.id).toBe('teacher@1');
    expect(createCoreContext({ policy: 'ifrs@1', layout: teacherLayout }).layout.id).toBe('teacher@1');
  });

  it('青檸文具社每一步：累計與本筆變動的不變式成立、四個勾稽點差額為 0、步驟①沒有經常利益、每條可見列的追蹤樹成立', () => {
    for (const stepId of stepIds) {
      for (const win of [{ kind: 'cumulative', to: stepId } as const, { kind: 'transaction', step: stepId } as const]) {
        const st = buildStatements(run, win, ctx.layout, ctx.policy);
        expect(st.layoutId).toBe('ifrs@1');
        expect(
          checkStatementInvariants(st)
            .filter((r) => !r.pass)
            .map((r) => `${r.rule} ${r.line}`),
          `${stepId} ${win.kind}`,
        ).toEqual([]);
        for (const node of traceAllLines(run, win, ctx.layout, ctx.policy, { statements: st })) {
          if (!st.lines.get(node.line)?.visible) continue;
          expect(verifyTraceTree(node, ctx.layout, { statements: st }).failures, `${stepId} ${win.kind} ${node.line}`).toEqual([]);
        }
        if (win.kind === 'cumulative') {
          const five = fiveStepCheck(st);
          expect(
            five.checks.map((c) => c.diff),
            stepId,
          ).toEqual([0, 0, 0, 0]);
          expect(five.step1.ordinaryIncome, stepId).toBeNull();
          expect(five.step1.pretaxIncome).toBe(lineValue(st, 'is_pretax_income').value);
        }
      }
    }
  });

  it('沒有經常利益、非常損益、攤銷與遞延資產的列；設立費費用化的列在第 5 步起可見；存貨四列與遞延資產兩列算值但不顯示', () => {
    const st = buildStatements(run, { kind: 'cumulative', to: null }, ctx.layout, ctx.policy);
    for (const id of REMOVED) expect(st.lines.has(id), id).toBe(false);
    expect(lineValue(st, 'is_organisation_costs_expense')).toMatchObject({ value: 150_000, visible: true });
    expect(lineValue(st, 'is_purchases')).toMatchObject({ value: 3_440_000, visible: false });
    expect(lineValue(st, 'is_closing_inventory')).toMatchObject({ value: 420_000, visible: false });
    expect(lineValue(st, 'bs_deferred_org_costs')).toMatchObject({ value: 0, visible: false });
    expect(lineValue(st, 'is_cogs')).toMatchObject({ value: 3_020_000, visible: true });
    const visibleIs = st.statements.income_statement.filter((r) => r.visible).map((r) => r.id);
    expect(visibleIs).not.toContain('is_opening_inventory');
    expect(visibleIs).toContain('is_cogs');
    expect(st.statements.income_statement.every((r) => !r.flags.includes('not_ifrs_line'))).toBe(true);
  });
});
