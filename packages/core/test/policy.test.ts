// 認列政策模組（04 第 10 節）
import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY_ID, POLICY_SWITCH_KEYS, POLICY_SWITCH_VALUES, getPolicy, policyWhenMatches, type PolicySwitches } from '../src/policy/index.ts';

const teacher: PolicySwitches = {
  orgCosts: 'capitalise_amortise',
  inventoryOverage: 'reduce_cogs',
  inventoryShortage: 'increase_cogs',
  incomeTax: 'cash_direct',
  interestPaidActivity: 'operating',
  officeSupplies: 'expense_on_purchase',
};

describe('policyWhenMatches', () => {
  it('沒有 policyWhen 或空物件時永遠相符', () => {
    expect(policyWhenMatches(teacher, undefined)).toBe(true);
    expect(policyWhenMatches(teacher, {})).toBe(true);
  });

  it('列出的開關都要相符；任一不符就不產生這一行', () => {
    expect(policyWhenMatches(teacher, { orgCosts: 'capitalise_amortise' })).toBe(true);
    expect(policyWhenMatches(teacher, { orgCosts: 'expense' })).toBe(false);
    expect(policyWhenMatches(teacher, { orgCosts: 'capitalise_amortise', incomeTax: 'accrue_then_pay' })).toBe(false);
    expect(policyWhenMatches({ ...teacher, incomeTax: 'accrue_then_pay' }, { orgCosts: 'capitalise_amortise', incomeTax: 'accrue_then_pay' })).toBe(true);
  });
});

describe('getPolicy 與開關表', () => {
  it('預設政策是 teacher@1；找不到回傳 undefined；可以傳自訂清單', () => {
    expect(DEFAULT_POLICY_ID).toBe('teacher@1');
    expect(getPolicy('teacher@1')?.switches).toEqual(teacher);
    expect(getPolicy('ifrs@1')?.switches.orgCosts).toBe('expense');
    expect(getPolicy('nope@9')).toBeUndefined();
    expect(getPolicy('x@1', [{ id: 'x@1', switches: teacher, disabledAccounts: [] }])?.id).toBe('x@1');
  });

  it('開關表的鍵與 PolicySwitches 一致，每個開關至少一個值', () => {
    expect(Object.keys(POLICY_SWITCH_VALUES).sort()).toEqual([...POLICY_SWITCH_KEYS].sort());
    for (const key of POLICY_SWITCH_KEYS) expect(POLICY_SWITCH_VALUES[key].length).toBeGreaterThan(0);
  });
});
