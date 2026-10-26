// 佔位符渲染（05 第 10 節）：money、percent、number、date、option、term、raw 的純文字輸出；值的來源是 vars、compiled.values 與 compiled.expected
import { describe, expect, it } from 'vitest';
import type { QuestionSnapshot } from '../src/lib/content.ts';
import {
  formatValuePlaceholder,
  inlineTermLabel,
  isSentenceStart,
  nestOptionQuotes,
  ratioAnswerTarget,
  renderPlain,
  resolveValueRef,
  splitMarkup,
  valueContextOf,
} from '../src/features/quiz/placeholders.ts';
import { qRatioNumeric, qSingle } from './quiz-fixtures.ts';

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

describe('nestOptionQuotes：解說引用的選項外面有一層引號，選項自己的引號改成第二層', () => {
  it('中文「」換成『』，其他字不動', () => {
    expect(nestOptionQuotes('進貨時就借記營業成本，所以「本期進貨」就是營業成本', 'zh-TW')).toBe('進貨時就借記營業成本，所以『本期進貨』就是營業成本');
    expect(nestOptionQuotes('資產：都是店裡擁有、之後能帶來好處的資源', 'zh-TW')).toBe('資產：都是店裡擁有、之後能帶來好處的資源');
  });
  it('英文第一層是英式的 ‘ ’：選項自己的 ‘ ’ 換成 “ ”，字中間與字尾的撇號不動，本來的 “ ” 不動（M3 驗收第 7 輪）', () => {
    expect(nestOptionQuotes('The gym’s ‘profit but little cash’ view', 'en')).toBe('The gym’s “profit but little cash” view');
    expect(nestOptionQuotes('A ‘customer’s deposit’ is a liability', 'en')).toBe('A “customer’s deposit” is a liability');
    expect(nestOptionQuotes('The gym’s “profit but little cash” view', 'en')).toBe('The gym’s “profit but little cash” view');
    expect(nestOptionQuotes('Assets: all are resources the shop owns', 'en')).toBe('Assets: all are resources the shop owns');
  });
});

describe('valueContextOf：ratio_numeric 的 expected.answer（04 第 16.1 節）', () => {
  // QA 第 2 輪：快照只有 compiled.ratio，沒有 compiled.expected，解說的 {{…:expected.answer.value}} 以前畫成空白
  const eps: QuestionSnapshot = {
    ...qRatioNumeric,
    id: 'q_3p5t3st1',
    vars: { netIncome: 1800000, shareCapital: 6000000, parValue: 10 },
    answerUnit: 'currency_per_share',
    explanation: '本期淨利 {{money:vars.netIncome}} ÷ 股數 ＝ {{number:expected.answer.value|digits=2}}。',
    compiled: { ratio: { ratioRef: 'eps@excel', status: 'ok', exact: { num: '3', den: '1' }, displayValue: 3 } },
  };

  it('由 compiled.ratio.exact 推出精確值：百分比取 0.25 顯示 25.00%，不是 displayValue 的 25', () => {
    const ctx = valueContextOf(qRatioNumeric);
    expect(resolveValueRef('expected.answer.value', ctx)).toBe(0.25);
    expect(renderPlain('負債比率 ＝ {{percent:expected.answer.value}}', ctx, 'zh-TW')).toBe('負債比率 ＝ 25.00%');
    expect(renderPlain('= {{percent:expected.answer.value}}', ctx, 'en')).toBe('= 25.00%');
  });

  it('每股盈餘的 number|digits=2，兩種語言都有數字', () => {
    expect(renderPlain(eps['explanation'] as string, valueContextOf(eps), 'zh-TW')).toBe('本期淨利 NT$1,800,000 ÷ 股數 ＝ 3.00。');
    expect(renderPlain(eps['explanation'] as string, valueContextOf(eps), 'en')).toBe('本期淨利 NT$1,800,000 ÷ 股數 ＝ 3.00。');
  });

  it('不能整除的分數保留精確值，由格式化函式四捨五入', () => {
    const q = {
      ...qRatioNumeric,
      compiled: { ratio: { ratioRef: 'debt_ratio@excel', status: 'ok' as const, exact: { num: '1', den: '3' }, displayValue: 33.33 } },
    };
    expect(resolveValueRef('expected.answer.value', valueContextOf(q))).toBeCloseTo(1 / 3, 12);
    expect(renderPlain('{{percent:expected.answer.value}}', valueContextOf(q), 'zh-TW')).toBe('33.33%');
  });

  it('正解是 N/A（exact 為 null）：value 是 null，佔位符解析不到；status 照樣帶出', () => {
    const na = { ...qRatioNumeric, compiled: { ratio: { ratioRef: 'debt_ratio@excel', status: 'na' as const, exact: null, displayValue: null } } };
    expect(ratioAnswerTarget(na.compiled.ratio)).toEqual({ value: null, status: 'na' });
    expect(resolveValueRef('expected.answer.value', valueContextOf(na))).toBeUndefined();
    expect(resolveValueRef('expected.answer.status', valueContextOf(na))).toBe('na');
  });

  it('快照已有 expected.answer 時以快照為準；其他 target 照樣保留', () => {
    const q = { ...qRatioNumeric, compiled: { ...qRatioNumeric.compiled, expected: { answer: { value: 0.5 }, t1: { delta: 10 } } } };
    expect(resolveValueRef('expected.answer.value', valueContextOf(q))).toBe(0.5);
    expect(resolveValueRef('expected.t1.delta', valueContextOf(q))).toBe(10);
    const merged = { ...qRatioNumeric, compiled: { ...qRatioNumeric.compiled, expected: { t1: { delta: 10 } } } };
    expect(resolveValueRef('expected.answer.value', valueContextOf(merged))).toBe(0.25);
    expect(resolveValueRef('expected.t1.delta', valueContextOf(merged))).toBe(10);
  });

  it('其他題型不推 answer：vars 與 compiled 照原樣', () => {
    expect(valueContextOf(qSingle)).toEqual({ vars: { loan: 240000 } });
    const notRatio = { ...qSingle, compiled: { ratio: qRatioNumeric.compiled!.ratio! } };
    expect(resolveValueRef('expected.answer.value', valueContextOf(notRatio))).toBeUndefined();
  });
});

describe('英文句中名詞的大小寫（inlineTermLabel）', () => {
  it('句首、換行與句號之後保留大寫，句中轉小寫', () => {
    expect(isSentenceStart('')).toBe(true);
    expect(isSentenceStart('Look at it. ')).toBe(true);
    expect(isSentenceStart('Why? (')).toBe(true);
    expect(isSentenceStart('First line\n')).toBe(true);
    expect(isSentenceStart('The numerator of ')).toBe(false);
    expect(isSentenceStart('two parts: ')).toBe(false);
    expect(inlineTermLabel('Inventory turnover', 'en', 'The numerator of ')).toBe('inventory turnover');
    expect(inlineTermLabel('Inventory turnover', 'en', '')).toBe('Inventory turnover');
    expect(inlineTermLabel('Inventory turnover', 'en', 'Done. ')).toBe('Inventory turnover');
  });
  it('縮寫與帶內部大寫的寫法不轉；中文原樣', () => {
    for (const label of ['ROA', 'R&D intensity', 'DuPont analysis', 'T-account', 'P/E ratio', 'EPS']) expect(inlineTermLabel(label, 'en', 'the ')).toBe(label);
    expect(inlineTermLabel('Earnings per share (EPS)', 'en', 'the ')).toBe('earnings per share (EPS)');
    expect(inlineTermLabel('存貨週轉率', 'zh-TW', '的')).toBe('存貨週轉率');
  });
  it('renderPlain 依前文判斷：佔位符算一般字元', () => {
    const term = (id: string) => (id === 'tm_a' ? 'Cost of sales' : id === 'tm_b' ? 'Inventory turnover' : undefined);
    expect(renderPlain('{{term:tm_b|plain}} uses {{term:tm_a|plain}}.', {}, 'en', { term })).toBe('Inventory turnover uses cost of sales.');
    expect(renderPlain('{{money:1000}} of {{term:tm_a}}', {}, 'en', { term })).toBe('NT$1,000 of cost of sales');
    expect(renderPlain('{{term:tm_a}} 是成本', {}, 'zh-TW', { term })).toBe('Cost of sales 是成本');
  });
});
