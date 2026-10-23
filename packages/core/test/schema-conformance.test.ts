// 內建資料與 content-schema 的一致性（09 第 8 節：Zod schema 是內容格式的唯一來源）：
// packages/core/data 的科目表、範本、政策、版面與指標都要通過 @ledgerland/content-schema 的 safeParse。
// 失敗時列出每個 issue 的路徑與訊息，方便判斷是資料寫錯還是 schema 太嚴。
import { Account, Layout, PolicyDefinition, RatioDefinition, TransactionTemplate } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { defaultAccounts, defaultPolicies, defaultRatios, defaultTemplates, teacherLayout } from '../src/data/index.ts';
import { STATEMENT_IDS } from '../src/layout/index.ts';

interface ParseResult {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}

/** 把 safeParse 的 issue 整理成「路徑：訊息」的清單；通過時是空陣列 */
function issuesOf(schema: { safeParse: (data: unknown) => ParseResult }, data: unknown): string[] {
  const r = schema.safeParse(data);
  return (r.error?.issues ?? []).map((i) => `${i.path.map(String).join('.') || '(root)'}：${i.message}`);
}

describe('packages/core/data 符合 content-schema', () => {
  it('45 個科目都通過 Account', () => {
    expect(defaultAccounts).toHaveLength(45);
    for (const a of defaultAccounts) expect(issuesOf(Account, a), `科目 ${a.id}`).toEqual([]);
  });

  it('21 個範本都通過 TransactionTemplate', () => {
    expect(defaultTemplates).toHaveLength(21);
    for (const t of defaultTemplates) expect(issuesOf(TransactionTemplate, t), `範本 ${t.id}`).toEqual([]);
  });

  it('2 個政策都通過 PolicyDefinition', () => {
    expect(defaultPolicies).toHaveLength(2);
    for (const p of defaultPolicies) expect(issuesOf(PolicyDefinition, p), `政策 ${p.id}`).toEqual([]);
  });

  it('teacher@1 版面通過 Layout，四張表都有', () => {
    for (const s of STATEMENT_IDS) expect(teacherLayout.statements[s].length, `版面缺 ${s}`).toBeGreaterThan(0);
    expect(issuesOf(Layout, teacherLayout), `版面 ${teacherLayout.id}`).toEqual([]);
  });

  it('43 個指標都通過 RatioDefinition', () => {
    expect(defaultRatios).toHaveLength(43);
    for (const r of defaultRatios) expect(issuesOf(RatioDefinition, r), `指標 ${r.id}`).toEqual([]);
  });
});
