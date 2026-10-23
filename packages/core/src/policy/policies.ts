// 認列政策模組（04 第 10 節）：policyWhen 的比對與政策查詢。
import { defaultPolicies } from '../data/index.ts';
import { POLICY_SWITCH_KEYS, type PolicyDefinition, type PolicySwitches, type PolicyWhen } from './types.ts';

/** policyWhen 沒有或是空物件時永遠相符；否則列出的每個開關都要等於目前政策的值 */
export function policyWhenMatches(switches: PolicySwitches, policyWhen: PolicyWhen | undefined): boolean {
  if (policyWhen === undefined) return true;
  for (const key of POLICY_SWITCH_KEYS) {
    const wanted = policyWhen[key];
    if (wanted !== undefined && wanted !== switches[key]) return false;
  }
  return true;
}

/** 以 ID（例如 teacher@1）取得政策；找不到回傳 undefined */
export function getPolicy(id: string, policies: readonly PolicyDefinition[] = defaultPolicies): PolicyDefinition | undefined {
  return policies.find((p) => p.id === id);
}

export const DEFAULT_POLICY_ID = 'teacher@1';
