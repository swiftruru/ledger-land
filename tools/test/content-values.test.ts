// ans.placeholderResolves（08 第 5.5 節）：題目文字的數值佔位符依快照的 vars、compiled.values、compiled.expected 都解析得到數字。
// ratio_numeric 的 expected.answer 由 compiled.ratio.exact 推出（和 apps/web 的 valueContextOf 相同）；用 04 第 17 節的範例題。
import { describe, expect, it } from 'vitest';
import { validateBundle } from '@ledgerland/content-schema';
import { parseBundle, runAccountingChecks } from '../lib/content-rules.mjs';
import { placeholderValueContext, ratioAnswerValue, resolvePlaceholderValue } from '../lib/content-values.mjs';
import { bundleWith, q172, qCurrentRatioNa, qRoa } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const run = (questions: Record<string, unknown>[]) => {
  const bundle = bundleWith(questions);
  const schema = validateBundle(bundle);
  const acct = runAccountingChecks(parseBundle(bundle), { samples: 0 });
  return { schema, acct, issues: acct.issues.filter((i) => i.rule === 'ans.placeholderResolves') };
};

describe('ratio_numeric 的 expected.answer', () => {
  it('由 exact 換成比例，不用 displayValue；N/A 是 null', () => {
    expect(ratioAnswerValue({ ratioRef: 'roa@excel', status: 'ok', exact: { num: '2', den: '25' }, displayValue: 8 })).toBe(0.08);
    expect(ratioAnswerValue({ ratioRef: 'current_ratio@excel', status: 'na', exact: null, displayValue: null })).toBeNull();
  });

  it('04 第 17.3 節的 ROA 題：解說的 {{percent:expected.answer.value}} 解析成 0.25，沒有問題', () => {
    const r = run([qRoa]);
    expect(r.schema).toEqual([]);
    expect(r.issues).toEqual([]);
    expect(resolvePlaceholderValue('expected.answer.value', placeholderValueContext(qRoa, r.acct.compiled.get(qRoa.id)))).toBe(0.25);
  });

  it('正解是 N/A 的題目引用 expected.answer.value：錯誤，訊息指出不得引用', () => {
    const q = {
      ...qCurrentRatioNa,
      explanation: lt('流動比率 ＝ {{number:expected.answer.value|digits=2}}。', 'Current ratio = {{number:expected.answer.value|digits=2}}.'),
    };
    const r = run([q]);
    expect(r.schema).toEqual([]);
    expect(r.issues.map((i) => [i.path, i.severity])).toEqual([
      ['explanation.zh-TW', 'error'],
      ['explanation.en', 'error'],
    ]);
    expect(r.issues[0]!.message).toContain('N/A');
  });
});

describe('情境題的 expected 與事件值', () => {
  it('04 第 17.2 節的交易影響題：expected.t1.delta 與 e1.costOfAllInventory 都解析得到', () => {
    const r = run([q172]);
    expect(r.schema).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it('target 存在但欄位不是數字或不存在、事件值不存在：validateBundle 不擋，這條規則擋；草稿只是警告', () => {
    const bad = {
      ...q172,
      explanation: lt(
        '現金 {{money:expected.t1.direction}}，毛利 {{money:expected.t3.nope}}，運費 {{money:e1.freight}}。',
        'Cash {{money:expected.t1.direction}}, gross profit {{money:expected.t3.nope}}, freight {{money:e1.freight}}.',
      ),
    };
    const r = run([bad]);
    expect(r.schema).toEqual([]);
    expect(r.issues).toHaveLength(6);
    expect(r.issues.every((i) => i.severity === 'error')).toBe(true);
    expect(r.issues[0]!.message).toContain('"up"');
    const draft = run([{ ...bad, status: 'draft' }]);
    expect(draft.issues).toHaveLength(6);
    expect(draft.issues.every((i) => i.severity === 'warning')).toBe(true);
  });
});
