// 佔位符渲染（05 第 10 節）：money、percent、number、date、option、term、raw 的純文字輸出；值的來源是 vars、compiled.values 與 compiled.expected
import { describe, expect, it } from 'vitest';
import { formatValuePlaceholder, renderPlain, resolveValueRef, splitMarkup } from '../src/features/quiz/placeholders.ts';

const ctx = {
  vars: { loan: 240000, change: 0.0125, days: 45.62, due: 0 },
  values: { 'e1.price': 85000, 'e1.costOfAllInventory': 40000 },
  expected: { t1: { direction: 'down', delta: -36000, after: 250000 } },
};

describe('splitMarkup', () => {
  it('切成文字與佔位符片段，保留前後文字', () => {
    expect(splitMarkup('借了 {{money:vars.loan}}，{{term:tm_x1|plain}}不用還')).toEqual([
      { kind: 'text', text: '借了 ' },
      { kind: 'placeholder', type: 'money', ref: 'vars.loan', options: [] },
      { kind: 'text', text: '，' },
      { kind: 'placeholder', type: 'term', ref: 'tm_x1', options: ['plain'] },
      { kind: 'text', text: '不用還' },
    ]);
    expect(splitMarkup('沒有佔位符')).toEqual([{ kind: 'text', text: '沒有佔位符' }]);
  });
});

describe('resolveValueRef', () => {
  it('vars、事件值、expected 與數字字面值', () => {
    expect(resolveValueRef('vars.loan', ctx)).toBe(240000);
    expect(resolveValueRef('e1.price', ctx)).toBe(85000);
    expect(resolveValueRef('expected.t1.delta', ctx)).toBe(-36000);
    expect(resolveValueRef('expected.t1.direction', ctx)).toBe('down');
    expect(resolveValueRef('0.5', ctx)).toBe(0.5);
    expect(resolveValueRef('vars.nope', ctx)).toBeUndefined();
    expect(resolveValueRef('expected.t9.delta', ctx)).toBeUndefined();
  });
});

describe('formatValuePlaceholder', () => {
  it('money：兩種語系都是 NT$；sign 選項正數帶加號', () => {
    expect(formatValuePlaceholder('money', 'vars.loan', [], ctx, 'zh-TW')).toBe('NT$240,000');
    expect(formatValuePlaceholder('money', 'e1.price', [], ctx, 'en')).toBe('NT$85,000');
    expect(formatValuePlaceholder('money', 'expected.t1.delta', [], ctx, 'zh-TW')).toBe('-NT$36,000');
    expect(formatValuePlaceholder('money', 'e1.costOfAllInventory', ['sign'], ctx, 'en')).toBe('+NT$40,000');
  });
  it('percent 與 number 的 digits、unit 選項；找不到的值輸出空字串', () => {
    expect(formatValuePlaceholder('percent', 'vars.change', ['sign'], ctx, 'zh-TW')).toBe('+1.25%');
    expect(formatValuePlaceholder('percent', '0.5', [], ctx, 'en')).toBe('50.00%');
    expect(formatValuePlaceholder('number', 'vars.days', ['digits=2', 'unit=day'], ctx, 'zh-TW')).toBe('45.62 天');
    expect(formatValuePlaceholder('number', 'vars.days', ['digits=2', 'unit=day'], ctx, 'en')).toBe('45.62 days');
    expect(formatValuePlaceholder('money', 'vars.missing', [], ctx, 'zh-TW')).toBe('');
  });
  it('compact：萬元與 million', () => {
    const c = { vars: { sales: 2480000 } };
    expect(formatValuePlaceholder('money', 'vars.sales', ['compact'], c, 'zh-TW')).toBe('248 萬元');
    expect(formatValuePlaceholder('money', 'vars.sales', ['compact'], c, 'en')).toBe('NT$2.48 million');
  });
});

describe('renderPlain', () => {
  it('option 換成選項文字、term 換成名詞、raw 原樣；沒給對照時留 ID', () => {
    const text = '答案是{{option:o_k3x9}}，{{term:tm_n7v3}}要看 {{raw:2027}} 年，金額 {{money:vars.loan}}。';
    expect(
      renderPlain(text, ctx, 'zh-TW', { option: (id) => (id === 'o_k3x9' ? '減少' : undefined), term: (id) => (id === 'tm_n7v3' ? '存貨' : undefined) }),
    ).toBe('答案是減少，存貨要看 2027 年，金額 NT$240,000。');
    expect(renderPlain('{{option:o_zz}}', ctx, 'en')).toBe('o_zz');
  });
});
