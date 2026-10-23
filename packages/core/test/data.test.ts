// oxlint-disable vitest/no-conditional-expect, vitest/valid-expect, vitest/expect-expect -- 靜態資料檢查依每一列的 kind 與選填欄位分支斷言；expect 的第二個引數是失敗時指出哪一筆資料的訊息；文字規則的斷言在 helpers.ts 裡
// 內建資料的靜態檢查（04 第 7 節的建置期檢查、第 11 節的版面、第 12 節的指標）。測試不寫入老師的金額。
import { parsePlaceholders } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { buildChart, isAccountEnabled } from '../src/accounts/index.ts';
import {
  CASH_FLOW_KINDS,
  INVENTORY_TAGS,
  RATIO_VERSION_IDS,
  defaultAccounts,
  defaultPolicies,
  defaultRatios,
  defaultTemplates,
  teacherLayout,
} from '../src/data/index.ts';
import { LAYOUT_LINE_KINDS, STATEMENT_IDS, type LayoutLine } from '../src/layout/index.ts';
import { POLICY_SWITCH_KEYS, POLICY_SWITCH_VALUES, policyWhenMatches, type PolicySwitchKey } from '../src/policy/index.ts';
import { TERM_ID_RE, WRITTEN_TERM_IDS, accountRefsOf, allStrings, expectBritish, expectNoDash, refsOf } from './helpers.ts';

const chart = buildChart(defaultAccounts);
const allLines: LayoutLine[] = STATEMENT_IDS.flatMap((s) => [...teacherLayout.statements[s]]);
const lineIds = new Set(allLines.map((l) => l.id));
const ratioById = new Map(defaultRatios.map((r) => [r.id, r]));

/** 04 第 17 節表列、資料沿用的名詞 ID（版面列與範本可以引用） */
const TABLE_TERM_IDS = [
  'tm_g8p4w1rz',
  'tm_b6s3k9hn',
  'tm_n4e8t2jy',
  'tm_p2a7c5vk',
  'tm_t7a3s6wb',
  'tm_f9a4c6md',
  'tm_c2y9b5ex',
  'tm_n9s2t7ak',
  'tm_x5c9e3nb',
  'tm_m8d3n6qa',
  'tm_w2j8d5ky',
  'tm_v6j2k8sr',
  'tm_p7h3c5xq',
  'tm_q4k9v2nd',
];
const knownTermRefs = new Set([
  ...defaultAccounts.map((a) => a.termRef),
  ...defaultRatios.map((r) => r.termRef),
  ...allLines.flatMap((l) => (l.termRef ? [l.termRef] : [])),
  ...TABLE_TERM_IDS,
]);

const placeholderKeys = (text: string) =>
  parsePlaceholders(text)
    .map((p) => `${p.type}:${p.ref}`)
    .sort();

describe('policies.json（04 第 10.2 節）', () => {
  it('有 teacher@1 與 ifrs@1，開關值合法，teacher@1 停用設立費費用化科目', () => {
    expect(defaultPolicies.map((p) => p.id)).toEqual(['teacher@1', 'ifrs@1']);
    for (const p of defaultPolicies) {
      expect(Object.keys(p.switches).sort()).toEqual([...POLICY_SWITCH_KEYS].sort());
      for (const key of POLICY_SWITCH_KEYS) expect(POLICY_SWITCH_VALUES[key] as readonly string[]).toContain(p.switches[key]);
    }
    const teacher = defaultPolicies[0]!;
    expect(teacher.switches).toEqual({
      orgCosts: 'capitalise_amortise',
      inventoryOverage: 'reduce_cogs',
      inventoryShortage: 'increase_cogs',
      incomeTax: 'cash_direct',
      interestPaidActivity: 'operating',
      officeSupplies: 'expense_on_purchase',
    });
    expect(teacher.disabledAccounts).toEqual(['organisation_costs_expense']);
    const ifrs = defaultPolicies[1]!;
    expect(ifrs.switches.orgCosts).toBe('expense');
    expect(ifrs.switches.inventoryOverage).toBe('reduce_cogs');
    expect(ifrs.disabledAccounts).toContain('deferred_organisation_costs');
  });
});

describe('templates/*.json（04 第 7 節的建置期檢查）', () => {
  const EXPECTED_IDS = [
    'tpl.issue_shares_cash',
    'tpl.buy_office_supplies_cash',
    'tpl.buy_equipment_cash',
    'tpl.pay_outsourcing_cash',
    'tpl.pay_org_costs',
    'tpl.purchase_inventory_cash',
    'tpl.sell_all_inventory_cash',
    'tpl.borrow_short_term',
    'tpl.purchase_inventory_credit',
    'tpl.sell_all_inventory_credit',
    'tpl.pay_all_payables',
    'tpl.collect_receivables',
    'tpl.pay_directors_remuneration_cash',
    'tpl.pay_packing_freight_cash',
    'tpl.repay_all_short_term_loans_with_interest',
    'tpl.inventory_count',
    'tpl.depreciation_straight_line',
    'tpl.amortise_org_costs',
    'tpl.pay_income_tax_cash',
    'tpl.pay_income_tax_payable',
    'tpl.pay_dividends_cash',
  ];

  it('涵蓋教材故事 18 種交易與黃金測試需要的範本，ID 唯一、rev 1、已發布', () => {
    expect(defaultTemplates.map((t) => t.id)).toEqual(EXPECTED_IDS);
    for (const t of defaultTemplates) {
      expect(t.id).toMatch(/^tpl\.[a-z][a-z0-9_]*$/);
      expect(t.rev).toBe(1);
      expect(t.revKind).toBe('text');
      expect(t.status).toBe('published');
      expect(Object.keys(t).slice(0, 12)).toEqual([
        'id',
        'rev',
        'revKind',
        'status',
        'title',
        'summary',
        'params',
        'derived',
        'preconditions',
        'lines',
        'explanation',
        'termRefs',
      ]);
    }
  });

  it('參數與推導值：名稱唯一、範圍包含預設值、型別合法；推導值只引用前面的推導值與已宣告的參數', () => {
    for (const t of defaultTemplates) {
      const paramNames = t.params.map((p) => p.name);
      expect(new Set(paramNames).size).toBe(paramNames.length);
      for (const p of t.params) {
        expect(['money', 'count', 'rate', 'years']).toContain(p.type);
        expect(p.min).toBeLessThanOrEqual(p.default);
        expect(p.default).toBeLessThanOrEqual(p.max);
        expect(p.max).toBeLessThanOrEqual(999999999999);
        expect(['increasing', 'decreasing', 'none']).toContain(p.monotonic);
        expect(Object.keys(p)).toEqual(['name', 'type', 'min', 'max', 'default', 'label', 'monotonic']);
      }
      const seen: string[] = [];
      for (const d of t.derived) {
        expect(['money', 'number']).toContain(d.type);
        for (const ref of refsOf(d.expr, 'param')) expect(paramNames, `${t.id} ${d.name}`).toContain(ref);
        for (const ref of refsOf(d.expr, 'derived')) expect(seen, `${t.id} ${d.name} 引用了後面的 ${ref}`).toContain(ref);
        for (const id of accountRefsOf(d.expr)) expect(chart.byId.has(id), `${t.id} ${id}`).toBe(true);
        expect(/\b(line|input|ratio)\./.test(d.expr)).toBe(false);
        seen.push(d.name);
      }
      expect(new Set(seen).size).toBe(seen.length);
      for (const pre of t.preconditions) {
        for (const ref of refsOf(pre.expr, 'param')) expect(paramNames).toContain(ref);
        for (const ref of refsOf(pre.expr, 'derived')) expect(seen).toContain(ref);
        for (const id of accountRefsOf(pre.expr)) expect(chart.byId.has(id)).toBe(true);
      }
    }
  });

  it('分錄行：ID 唯一、科目存在、金額不用 round、引用已宣告的參數與推導值', () => {
    for (const t of defaultTemplates) {
      const ids = t.lines.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
      const paramNames = t.params.map((p) => p.name);
      const derivedNames = t.derived.map((d) => d.name);
      for (const l of t.lines) {
        expect(chart.byId.has(l.account), `${t.id} ${l.account}`).toBe(true);
        expect(['debit', 'credit']).toContain(l.side);
        expect(l.amount).not.toMatch(/round\(/);
        for (const ref of refsOf(l.amount, 'param')) expect(paramNames).toContain(ref);
        for (const ref of refsOf(l.amount, 'derived')) expect(derivedNames).toContain(ref);
        for (const id of accountRefsOf(l.amount)) expect(chart.byId.has(id)).toBe(true);
      }
    }
  });

  it('每條現金行恰好一個 cf 且 kind 屬於該活動；非現金行沒有 cf', () => {
    for (const t of defaultTemplates) {
      for (const l of t.lines) {
        if (l.account === 'cash') {
          expect(l.cf, `${t.id} ${l.id}`).toBeDefined();
          expect(CASH_FLOW_KINDS[l.cf!.activity], `${t.id} ${l.id}`).toContain(l.cf!.kind);
        } else {
          expect(l.cf, `${t.id} ${l.id}`).toBeUndefined();
        }
      }
    }
  });

  it('每條存貨行有存貨類標籤且方向正確；借記未分配盈餘要標 dividend 或 reserve_appropriation；其他行沒有標籤', () => {
    for (const t of defaultTemplates) {
      for (const l of t.lines) {
        if (l.account === 'inventory') {
          expect(INVENTORY_TAGS as readonly string[], `${t.id} ${l.id}`).toContain(l.tag);
          const expectedSide = l.tag === 'purchase' || l.tag === 'count_overage' ? 'debit' : 'credit';
          expect(l.side, `${t.id} ${l.id}`).toBe(expectedSide);
        } else if (l.account === 'retained_earnings' && l.side === 'debit') {
          expect(['dividend', 'reserve_appropriation']).toContain(l.tag);
        } else {
          expect(l.tag, `${t.id} ${l.id}`).toBeUndefined();
        }
      }
    }
  });

  it('policyWhen 的鍵與值合法', () => {
    for (const t of defaultTemplates) {
      for (const l of t.lines) {
        if (!l.policyWhen) continue;
        for (const [key, value] of Object.entries(l.policyWhen)) {
          expect(POLICY_SWITCH_KEYS as readonly string[]).toContain(key);
          expect(POLICY_SWITCH_VALUES[key as PolicySwitchKey] as readonly string[]).toContain(value);
        }
      }
    }
  });

  it('對每一套政策篩選後：借貸的金額運算式對稱、引用的科目在該政策下啟用、行數為 0 或至少 2', () => {
    for (const policy of defaultPolicies) {
      for (const t of defaultTemplates) {
        const lines = t.lines.filter((l) => policyWhenMatches(policy.switches, l.policyWhen));
        const debit = lines
          .filter((l) => l.side === 'debit')
          .map((l) => l.amount)
          .sort();
        const credit = lines
          .filter((l) => l.side === 'credit')
          .map((l) => l.amount)
          .sort();
        expect(debit, `${policy.id} ${t.id}`).toEqual(credit);
        expect(lines.length === 0 || lines.length >= 2, `${policy.id} ${t.id}`).toBe(true);
        for (const l of lines) expect(isAccountEnabled(chart, l.account, policy), `${policy.id} ${t.id} ${l.account}`).toBe(true);
      }
    }
    const amortise = defaultTemplates.find((t) => t.id === 'tpl.amortise_org_costs')!;
    expect(amortise.lines.filter((l) => policyWhenMatches(defaultPolicies[1]!.switches, l.policyWhen))).toHaveLength(0);
  });

  it('延伸科目只在帶 policyWhen 的行出現，teacher@1 下不會被選到', () => {
    const teacher = defaultPolicies[0]!;
    for (const t of defaultTemplates) {
      for (const l of t.lines) {
        const account = chart.byId.get(l.account)!;
        if (!account.flags.includes('extension')) continue;
        expect(l.policyWhen, `${t.id} ${l.id}`).toBeDefined();
        expect(policyWhenMatches(teacher.switches, l.policyWhen), `${t.id} ${l.id}`).toBe(false);
      }
    }
  });

  it('summary 與 explanation 的中英佔位符集合一致，只引用本範本的參數、推導值或名詞', () => {
    for (const t of defaultTemplates) {
      const names = new Set([...t.params.map((p) => `param.${p.name}`), ...t.derived.map((d) => `derived.${d.name}`)]);
      for (const field of [t.title, t.summary, t.explanation]) {
        expect(placeholderKeys(field['zh-TW']), t.id).toEqual(placeholderKeys(field.en));
        for (const p of parsePlaceholders(field['zh-TW'])) {
          if (p.type === 'term') expect(p.ref).toMatch(TERM_ID_RE);
          else {
            expect(['money', 'number', 'percent']).toContain(p.type);
            expect(names.has(p.ref), `${t.id} 佔位符 ${p.ref}`).toBe(true);
          }
        }
      }
      expect(placeholderKeys(t.title['zh-TW'])).toEqual([]);
      for (const p of t.params) expect(placeholderKeys(p.label['zh-TW'])).toEqual([]);
    }
  });

  it('termRefs 非空且指向已知的名詞 ID；pendingRefs 與 entryQuestionBlockedBy 是 T 編號', () => {
    for (const t of defaultTemplates) {
      expect(t.termRefs.length).toBeGreaterThan(0);
      expect(new Set(t.termRefs).size).toBe(t.termRefs.length);
      for (const ref of t.termRefs) expect(knownTermRefs.has(ref), `${t.id} ${ref}`).toBe(true);
      for (const ref of [...(t.pendingRefs ?? []), ...(t.entryQuestionBlockedBy ?? [])]) expect(ref).toMatch(/^T\d{2}$/);
      if (t.entryQuestionBlockedBy) for (const ref of t.entryQuestionBlockedBy) expect(t.pendingRefs).toContain(ref);
      for (const l of t.lines) {
        const account = chart.byId.get(l.account)!;
        if (['cash', 'inventory'].includes(l.account)) continue;
        expect(t.termRefs, `${t.id} 應引用 ${l.account} 的名詞`).toContain(account.termRef);
      }
    }
  });

  it('依 04 的指定：設立費、盤點與攤銷帶 pendingRefs 與 entryQuestionBlockedBy；還款範本只有 pendingRefs', () => {
    const byId = new Map(defaultTemplates.map((t) => [t.id, t]));
    expect(byId.get('tpl.pay_org_costs')?.pendingRefs).toEqual(['T04', 'T30']);
    expect(byId.get('tpl.pay_org_costs')?.entryQuestionBlockedBy).toEqual(['T04']);
    expect(byId.get('tpl.inventory_count')?.entryQuestionBlockedBy).toEqual(['T06']);
    expect(byId.get('tpl.amortise_org_costs')?.pendingRefs).toEqual(['T04', 'T05', 'T12']);
    expect(byId.get('tpl.amortise_org_costs')?.entryQuestionBlockedBy).toEqual(['T04', 'T05']);
    expect(byId.get('tpl.repay_all_short_term_loans_with_interest')?.pendingRefs).toEqual(['T11']);
    expect(byId.get('tpl.repay_all_short_term_loans_with_interest')?.entryQuestionBlockedBy).toBeUndefined();
    const count = byId.get('tpl.inventory_count')!;
    expect(count.params.map((p) => p.name)).toEqual(['countedAmount']);
    expect(count.derived.map((d) => d.expr)).toEqual(['max(param.countedAmount - balance(inventory), 0)', 'max(balance(inventory) - param.countedAmount, 0)']);
    expect(byId.get('tpl.pay_all_payables')?.derived[0]?.expr).toBe('balance(accounts_payable)');
    expect(byId.get('tpl.pay_income_tax_payable')?.derived[0]?.expr).toBe('balance(income_tax_payable)');
  });

  it('文字規則：沒有破折號，英文用英式拼字', () => {
    for (const t of defaultTemplates) {
      for (const s of allStrings(t)) expectNoDash(s);
      for (const field of [t.title, t.summary, t.explanation]) expectBritish(field.en);
    }
  });
});

describe('layouts/teacher@1.json（04 第 11 節）', () => {
  const cellsOf = (lines: readonly LayoutLine[]) => lines.flatMap((l) => (l.cell ? [l.cell] : []));

  it('四張表都有，線 ID 唯一且前綴正確，kind 合法', () => {
    expect(teacherLayout.id).toBe('teacher@1');
    expect(Object.keys(teacherLayout.statements)).toEqual([...STATEMENT_IDS]);
    expect(allLines.map((l) => l.id).length).toBe(lineIds.size);
    const prefix: Record<string, string> = { income_statement: 'is_', balance_sheet: 'bs_', cash_flow_indirect: 'cf_', cash_flow_direct: 'dc_' };
    for (const s of STATEMENT_IDS) for (const l of teacherLayout.statements[s]) expect(l.id, l.id).toMatch(new RegExp(`^${prefix[s]}[a-z0-9_]+$`));
    for (const l of allLines) {
      expect(LAYOUT_LINE_KINDS).toContain(l.kind);
      expect(Object.keys(l).slice(0, 5)).toEqual(['id', 'cell', 'kind', 'label', 'aliases']);
      if (l.termRef) expect(l.termRef).toMatch(TERM_ID_RE);
      for (const p of l.pendingRefs ?? []) expect(p).toMatch(/^T\d{2}$/);
    }
  });

  it('cell 不重複，04 第 11 節列出的儲存格都在；直接法與模板沒有的合計列 cell 為 null', () => {
    const cells = cellsOf(allLines);
    expect(new Set(cells).size).toBe(cells.length);
    const expected = [
      ...[
        'R10',
        'R11',
        'R12',
        'R13',
        'R14',
        'R15',
        'R16',
        'R17',
        'R18',
        'R19',
        'R20',
        'R21',
        'R22',
        'R23',
        'R24',
        'R25',
        'R26',
        'R27',
        'R28',
        'R29',
        'R30',
        'R31',
        'R32',
        'R33',
        'R34',
        'R35',
      ],
      ...[
        'L12',
        'L13',
        'L14',
        'L15',
        'L19',
        'L20',
        'L21',
        'L24',
        'L25',
        'L29',
        'N12',
        'N13',
        'N14',
        'N15',
        'N17',
        'N21',
        'N22',
        'N24',
        'N25',
        'N26',
        'N27',
        'N28',
        'N29',
      ],
      ...[
        'H10',
        'H11',
        'H12',
        'H13',
        'H14',
        'H15',
        'H16',
        'H17',
        'H18',
        'H19',
        'H20',
        'H21',
        'H22',
        'H23',
        'H25',
        'H26',
        'H27',
        'H28',
        'H29',
        'H31',
        'H32',
        'H33',
        'H34',
        'H35',
        'H36',
        'H38',
        'H39',
        'H40',
        'H41',
      ],
    ];
    for (const c of expected) expect(cells, c).toContain(c);
    for (const l of teacherLayout.statements.cash_flow_direct) expect(l.cell).toBeNull();
    for (const id of ['bs_current_assets', 'bs_current_liabilities', 'bs_noncurrent_liabilities', 'bs_total_liabilities', 'bs_total_equity', 'bs_ppe_gross']) {
      expect(allLines.find((l) => l.id === id)?.cell, id).toBeNull();
    }
    for (const l of allLines) if (l.extension) expect(l.cell, l.id).toBeNull();
  });

  it('列引用的線、科目與公式都存在；公式只引用 line.*', () => {
    const has = (id: string, where: string) => expect(lineIds.has(id), `${where} 引用了不存在的線 ${id}`).toBe(true);
    for (const l of allLines) {
      switch (l.kind) {
        case 'accounts':
        case 'working_capital':
        case 'noncash_addback':
          for (const a of l.accounts) expect(chart.byId.has(a), `${l.id} ${a}`).toBe(true);
          if (l.kind === 'working_capital') for (const a of l.excludeAccounts ?? []) expect(chart.byId.has(a)).toBe(true);
          break;
        case 'formula':
          for (const ref of refsOf(l.expr, 'line')) has(ref, l.id);
          expect(/\b(param|derived|input|ratio)\./.test(l.expr)).toBe(false);
          break;
        case 'link':
          has(l.from, l.id);
          break;
        case 'retained_earnings':
          expect(chart.byId.has(l.account)).toBe(true);
          has(l.netIncomeLine, l.id);
          break;
        case 'group':
          for (const c of l.children ?? []) has(c, l.id);
          break;
        case 'total':
          for (const s of l.sum) has(s, l.id);
          break;
        case 'balance_begin':
          expect(chart.byId.has(l.account)).toBe(true);
          break;
        case 'balance_end':
          expect(chart.byId.has(l.account)).toBe(true);
          for (const s of l.from) has(s, l.id);
          break;
        case 'cash_tag':
          for (const k of l.cfKinds) expect(CASH_FLOW_KINDS[l.activity], `${l.id} ${k}`).toContain(k);
          break;
        default:
          break;
      }
      const invariant = 'invariant' in l ? l.invariant : undefined;
      if (invariant?.startsWith('equals_line:')) has(invariant.slice('equals_line:'.length), l.id);
      if (invariant?.startsWith('equals_account_activity:')) expect(chart.byId.has(invariant.slice('equals_account_activity:'.length))).toBe(true);
    }
  });

  it('損益表五層利益齊全，起算與勾稽點正確', () => {
    const is = teacherLayout.statements.income_statement;
    const levels = is.flatMap((l) => (l.kind === 'formula' && l.level ? [[l.level, l.id] as const] : []));
    expect(levels).toEqual([
      [1, 'is_gross_profit'],
      [2, 'is_operating_income'],
      [3, 'is_ordinary_income'],
      [4, 'is_pretax_income'],
      [5, 'is_net_income'],
    ]);
    const cogs = is.find((l) => l.id === 'is_cogs');
    expect(cogs?.kind === 'formula' && cogs.invariant).toBe('equals_account_activity:cost_of_goods_sold');
    const h11 = allLines.find((l) => l.id === 'cf_pretax_income');
    expect(h11?.kind === 'link' && h11.from).toBe('is_pretax_income');
    expect(h11?.kind === 'link' && h11.check).toBe('step2');
    const h41 = allLines.find((l) => l.id === 'cf_cash_end');
    expect(h41?.kind === 'balance_end' && h41.check).toBe('step3');
    const ordinary = is.find((l) => l.id === 'is_ordinary_income');
    expect(ordinary?.flags).toContain('not_ifrs_line');
  });

  it('每個損益科目恰好出現在一條損益表科目列；每個資產負債權益科目恰好出現在一條資產負債表列', () => {
    const count = (lines: readonly LayoutLine[], id: string) =>
      lines.filter((l) => (l.kind === 'accounts' && l.accounts.includes(id) && !l.hidden) || (l.kind === 'retained_earnings' && l.account === id)).length;
    for (const a of defaultAccounts) {
      // 營業成本由存貨帳推導（04 第 5.2 節），對應的是 is_cogs 公式列的不變式，不是科目列
      if (a.id === 'cost_of_goods_sold') continue;
      const statement = a.element === 'revenue' || a.element === 'expense' ? 'income_statement' : 'balance_sheet';
      expect(count(teacherLayout.statements[statement], a.id), a.id).toBe(1);
    }
    expect(count(teacherLayout.statements.income_statement, 'cost_of_goods_sold')).toBe(0);
  });

  it('間接法：H15 與 H17 擇一、H16 與 H18 反號加註、H19 排除清單、現金標籤列的符號', () => {
    const byId = new Map(allLines.map((l) => [l.id, l]));
    const h15 = byId.get('cf_receivables_increase');
    const h17 = byId.get('cf_receivables_decrease');
    expect(h15?.kind === 'working_capital' && h15.only).toBe('increase');
    expect(h17?.kind === 'working_capital' && h17.only).toBe('decrease');
    for (const id of ['cf_inventory_increase', 'cf_payables_increase', 'cf_other_liabilities_increase']) {
      const l = byId.get(id);
      expect(l?.kind === 'working_capital' && l.oppositeSignNote).toBe('template_has_no_decrease_row');
    }
    for (const l of allLines) {
      if (l.kind !== 'cash_tag') continue;
      const outflow = l.cfKinds.every((k) => /(payments|paid|advanced|repayment|capex)/.test(k));
      expect(l.sign, l.id).toBe(outflow ? 'outflow_negative' : 'inflow_positive');
    }
    const h23 = byId.get('cf_operating_total');
    expect(h23?.kind === 'total' && h23.sum).toEqual(['cf_operating_subtotal', 'cf_interest_paid', 'cf_income_tax_paid']);
    expect(h23?.label['zh-TW']).toBe('營業活動的現金流量總計');
    expect(h23?.aliases['zh-TW']).toContain('營業活動的現金流量統計');
    expect(byId.get('cf_payables_increase')?.label['zh-TW']).toBe('應付帳款增加(+)');
    expect(byId.get('cf_interest_paid')?.label['zh-TW']).toBe('利息支出(-)');
    expect(byId.get('cf_interest_paid')?.pendingRefs).toContain('T11');
  });

  it('直接法：營業活動由現金標籤加總，六個營業類 kind 都有對應列，小計與合計勾稽到間接法', () => {
    const dc = teacherLayout.statements.cash_flow_direct;
    const kinds = dc.flatMap((l) => (l.kind === 'cash_tag' ? [...l.cfKinds] : []));
    expect([...kinds].sort()).toEqual([...CASH_FLOW_KINDS.operating].sort());
    const subtotal = dc.find((l) => l.id === 'dc_cash_generated_from_operations');
    expect(subtotal?.kind === 'total' && subtotal.invariant).toBe('equals_line:cf_operating_subtotal');
    const total = dc.find((l) => l.id === 'dc_operating_total');
    expect(total?.kind === 'total' && total.invariant).toBe('equals_line:cf_operating_total');
  });

  it('每個現金流量 kind 都恰好有一條間接法列', () => {
    const cf = teacherLayout.statements.cash_flow_indirect;
    for (const activity of ['investing', 'financing'] as const) {
      for (const kind of CASH_FLOW_KINDS[activity]) {
        expect(
          cf.filter((l) => l.kind === 'cash_tag' && l.cfKinds.includes(kind)),
          kind,
        ).toHaveLength(1);
      }
    }
    for (const kind of ['interest_paid', 'income_tax_paid'])
      expect(
        cf.filter((l) => l.kind === 'cash_tag' && l.cfKinds.includes(kind)),
        kind,
      ).toHaveLength(1);
  });

  it('版面選項與列資料一致：amortisationAddBack 決定攤銷加回在 H14 或 H12，amortisationSection 決定攤銷列所在的分組', () => {
    const byId = new Map(allLines.map((l) => [l.id, l]));
    const accountsOf = (id: string) => {
      const l = byId.get(id);
      return l?.kind === 'noncash_addback' ? l.accounts : [];
    };
    const addBack = teacherLayout.options.amortisationAddBack === 'H14' ? 'cf_other_noncash_losses' : 'cf_depreciation';
    const other = addBack === 'cf_depreciation' ? 'cf_other_noncash_losses' : 'cf_depreciation';
    expect(accountsOf(addBack)).toContain('amortisation_deferred_assets');
    expect(accountsOf(other)).not.toContain('amortisation_deferred_assets');
    const group = teacherLayout.options.amortisationSection === 'non_operating' ? 'is_non_operating_expense_group' : 'is_sga_group';
    const g = byId.get(group);
    expect(g?.kind === 'group' && g.children, group).toContain('is_amortisation');
  });

  it('建置期完整性（04 第 11.3 節）：每個科目的 cashFlow.indirect 都有對應的間接法列或排除清單', () => {
    const cf = teacherLayout.statements.cash_flow_indirect;
    const workingCapital = new Set(cf.flatMap((l) => (l.kind === 'working_capital' ? [...l.accounts] : [])));
    const addBack = new Set(cf.flatMap((l) => (l.kind === 'noncash_addback' ? [...l.accounts] : [])));
    const h19 = cf.find((l) => l.id === 'cf_other_liabilities_increase');
    const excluded = new Set(h19?.kind === 'working_capital' ? h19.excludeAccounts : []);
    const cashTagActivities = new Set(cf.flatMap((l) => (l.kind === 'cash_tag' ? [l.activity] : [])));
    for (const a of defaultAccounts) {
      switch (a.cashFlow.indirect) {
        case 'working_capital':
          expect(workingCapital.has(a.id), a.id).toBe(true);
          break;
        case 'excluded':
          expect(excluded.has(a.id), a.id).toBe(true);
          break;
        case 'noncash_addback':
          expect(addBack.has(a.id), a.id).toBe(true);
          break;
        case 'via_cash_tag':
          expect(a.cashFlow.defaultActivity, a.id).not.toBeNull();
          expect(cashTagActivities.has(a.cashFlow.defaultActivity!), a.id).toBe(true);
          break;
        case 'equity_transfer':
        case 'none':
          expect(workingCapital.has(a.id) || addBack.has(a.id), a.id).toBe(false);
          break;
        default:
          break;
      }
    }
  });

  it('文字規則：沒有破折號，英文用英式拼字', () => {
    for (const l of allLines) {
      for (const s of allStrings(l)) expectNoDash(s);
      expectBritish(l.label.en);
    }
  });
});

describe('ratios.json（04 第 12 節）', () => {
  const EXCEL_CELLS: Record<string, string> = {
    debt_ratio: 'D10',
    long_term_funds_to_ppe: 'D11',
    cash_flow_adequacy: 'D15',
    cash_flow_ratio: 'D16',
    cash_reinvestment: 'D17',
    ar_turnover: 'H11',
    days_sales_outstanding: 'H12',
    ap_turnover: 'H14',
    inventory_turnover: 'H16',
    days_inventory: 'H17',
    ppe_turnover: 'H19',
    total_asset_turnover: 'H20',
    dol: 'H24',
    dfl: 'H25',
    roa: 'L10',
    pretax_to_paid_in_capital: 'L11',
    operating_income_to_paid_in_capital: 'L12',
    roe: 'L13',
    eps: 'L14',
    net_profit_margin: 'L15',
    quick_ratio: 'L20',
    current_ratio: 'L21',
    interest_coverage: 'L22',
  };

  it('表 A 的 23 項都有 excel 版，Excel 格齊全且不重複；其他指標沒有 excel 版', () => {
    const excel = defaultRatios.filter((r) => r.versions.excel);
    expect(excel.map((r) => r.id).sort()).toEqual(Object.keys(EXCEL_CELLS).sort());
    for (const r of excel) {
      expect(r.versions.excel?.excel?.cell, r.id).toBe(EXCEL_CELLS[r.id]);
      expect(r.versions.excel?.excel?.formula).toBeTruthy();
      expect(['0.0%', '0.00']).toContain(r.versions.excel?.excel?.format);
    }
    const cells = excel.map((r) => r.versions.excel!.excel!.cell);
    expect(new Set(cells).size).toBe(23);
    for (const r of defaultRatios) {
      for (const [name, v] of Object.entries(r.versions)) if (name !== 'excel') expect(v.excel, `${r.id}@${name}`).toBeUndefined();
    }
    expect(ratioById.get('ap_turnover')?.versions.excel?.excel?.iferror).toBe('N/A(應付帳款為0)');
    expect(ratioById.get('roa')?.versions.excel?.excel?.iferror).toBe('N/A');
  });

  it('ID 與 termRef 唯一，termRef 不和科目或現有名詞重複；類別與框架合法', () => {
    const ids = defaultRatios.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = defaultRatios.map((r) => r.termRef);
    expect(new Set(refs).size).toBe(refs.length);
    const accountRefs = new Set(defaultAccounts.map((a) => a.termRef));
    for (const ref of refs) {
      expect(ref).toMatch(TERM_ID_RE);
      expect(accountRefs.has(ref)).toBe(false);
      expect(WRITTEN_TERM_IDS.has(ref)).toBe(false);
    }
    expect(ratioById.get('roa')?.termRef).toBe('tm_r0a5t3kq');
    expect(ratioById.get('current_ratio')?.termRef).toBe('tm_c8r1t4zm');
    expect(ratioById.get('interest_coverage')?.termRef).toBe('tm_h3c7v1xe');
    for (const r of defaultRatios) {
      expect([
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
      ]).toContain(r.category);
      expect([null, 'input', 'transform', 'output']).toContain(r.framework);
      expect(Object.keys(r)).toEqual(['id', 'termRef', 'category', 'framework', 'versions', 'pendingRefs']);
      for (const p of r.pendingRefs) expect(p).toMatch(/^T\d{2}$/);
    }
  });

  it('每個版本是分子分母或 expr 二選一，引用的線、指標版本與輸入值都存在', () => {
    for (const r of defaultRatios) {
      expect(Object.keys(r.versions).length).toBeGreaterThan(0);
      for (const [name, v] of Object.entries(r.versions)) {
        const where = `${r.id}@${name}`;
        expect(RATIO_VERSION_IDS as readonly string[]).toContain(name);
        const fraction = v.numerator !== undefined && v.denominator !== undefined;
        expect(fraction !== (v.expr !== undefined), where).toBe(true);
        expect(['percent', 'turnover', 'days', 'multiple', 'currency_per_share', 'currency']).toContain(v.unit);
        expect(v.notMeaningfulBase !== undefined, where).toBe(v.notMeaningfulWhen.includes('base_not_positive'));
        const exprs = [v.numerator, v.denominator, v.expr, v.notMeaningfulBase].filter((e): e is string => e !== undefined);
        for (const e of exprs) {
          for (const ref of refsOf(e, 'line')) expect(lineIds.has(ref), `${where} 引用了不存在的線 ${ref}`).toBe(true);
          for (const ref of refsOf(e, 'ratio')) {
            const [rid, ver] = ref.split('.');
            expect(ratioById.get(rid!)?.versions[ver as 'excel'], `${where} 引用了 ${ref}`).toBeDefined();
          }
          for (const ref of refsOf(e, 'input')) expect(v.inputs?.[ref], `${where} 的輸入值 ${ref}`).toBeDefined();
          expect(/\b(param|derived)\./.test(e)).toBe(false);
        }
        if (v.inputs) expect(v.naWhen).toContain('missing_input');
        if (v.expr && /ratio\./.test(v.expr)) expect(v.naWhen.some((n) => n.startsWith('chained_source'))).toBe(true);
        if (v.denominator !== undefined && !/input\./.test(v.denominator)) expect(v.naWhen).toContain('denominator_zero');
      }
    }
  });

  it('網站修正：允當比率的存貨增加額取 max，再投資比率的股利取正值；連鎖指標的 na 規則', () => {
    expect(ratioById.get('cash_flow_adequacy')?.versions.excel?.denominator).toContain('max(-line.cf_inventory_increase, 0)');
    expect(ratioById.get('cash_reinvestment')?.versions.excel?.numerator).toBe('line.cf_operating_total + line.cf_dividends_paid');
    expect(ratioById.get('days_sales_outstanding')?.versions.excel?.expr).toBe('365 / ratio.ar_turnover.excel');
    expect(ratioById.get('days_sales_outstanding')?.versions.excel?.naWhen).toEqual(['chained_source_na_or_zero']);
    expect(ratioById.get('roa')?.versions.dupont?.naWhen).toEqual(['chained_source_na']);
    expect(ratioById.get('eps')?.versions.excel?.inputs?.par_value?.default).toBe(10);
    expect(ratioById.get('dol')?.versions.excel?.notMeaningfulWhen).toEqual(['base_not_positive']);
  });

  it('文字規則：沒有破折號，輸入值的英文標籤用英式拼字', () => {
    for (const r of defaultRatios) {
      for (const s of allStrings(r)) expectNoDash(s);
      for (const v of Object.values(r.versions)) for (const input of Object.values(v.inputs ?? {})) expectBritish(input.label.en);
    }
  });
});
