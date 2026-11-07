// 會計公式總覽的純函式（features/formulas/catalogue.ts）：搜尋比對（名稱、別名、公式、另一語系名稱、全形半形）、分組順序、題目反查、返回狀態。資料是自己編的。
import { describe, expect, it } from 'vitest';
import { formulaReturnPath, formulaReturnSearch, formulasOfQuestion, groupFormulas, matchesFormulaQuery } from '../src/features/formulas/catalogue.ts';
import type { FormulaIndexEntry } from '../src/lib/content.ts';

const f = (id: string, label: string, category: string, extra: Partial<FormulaIndexEntry> = {}): FormulaIndexEntry => ({
  id,
  kind: 'ratio',
  category,
  label,
  aliases: [],
  formula: '分子 ÷ 分母',
  termRef: 'tm_t3st0001',
  questionIds: [],
  ...extra,
});
const roe = f('fm_t3st0001', '權益報酬率（ROE）', 'profitability', {
  aliases: ['股東權益報酬率', 'ROE'],
  formula: '本期淨利 ÷ 股東權益總額',
  questionIds: ['hq_a', 'hq_b'],
});
const eq = f('fm_t3st0002', '會計恆等式', 'statement', { kind: 'relation', formula: '資產 ＝ 負債 ＋ 股東權益', questionIds: ['hq_b'] });
const dso = f('fm_t3st0003', '平均收現日數', 'activity', { questionIds: ['hq_c'] });
const odd = f('fm_t3st0004', '不明分類', 'mystery');
const collator = new Intl.Collator('zh-Hant-TW');

describe('matchesFormulaQuery', () => {
  it('比名稱、別名、公式一行與另一語系的名稱；不分大小寫與全形半形；空字串全部算', () => {
    expect(matchesFormulaQuery(roe, '')).toBe(true);
    expect(matchesFormulaQuery(roe, 'roe')).toBe(true);
    expect(matchesFormulaQuery(roe, 'ＲＯＥ')).toBe(true);
    expect(matchesFormulaQuery(roe, '股東權益報酬')).toBe(true);
    expect(matchesFormulaQuery(roe, '本期淨利')).toBe(true);
    expect(matchesFormulaQuery(roe, 'return on equity', 'Return on equity (ROE)')).toBe(true);
    expect(matchesFormulaQuery(roe, 'return on equity')).toBe(false);
    expect(matchesFormulaQuery(roe, '存貨')).toBe(false);
  });
});

describe('groupFormulas', () => {
  it('分類照固定順序（報表關係最前）、組內依名稱排、空的組不列、不認得的分類併進報表關係', () => {
    const groups = groupFormulas([dso, roe, eq, odd], collator);
    expect(groups.map((g) => [g.category, g.formulas.map((x) => x.id)])).toEqual([
      ['statement', ['fm_t3st0004', 'fm_t3st0002']],
      ['profitability', ['fm_t3st0001']],
      ['activity', ['fm_t3st0003']],
    ]);
  });
});

describe('formulasOfQuestion 與返回狀態', () => {
  it('題目對公式，順序照索引', () => {
    const map = formulasOfQuestion([roe, eq, dso]);
    expect(map.get('hq_b')?.map((x) => x.id)).toEqual(['fm_t3st0001', 'fm_t3st0002']);
    expect(map.get('hq_c')?.map((x) => x.id)).toEqual(['fm_t3st0003']);
    expect(map.get('hq_z')).toBeUndefined();
  });
  it('返回狀態只認字串', () => {
    expect(formulaReturnSearch({ llFormulaSearch: 'q=roe' })).toBe('q=roe');
    expect(formulaReturnSearch(null)).toBe('');
    expect(formulaReturnSearch({ llFormulaSearch: 3 })).toBe('');
    expect(formulaReturnPath('/formulas/', '')).toBe('/formulas/');
    expect(formulaReturnPath('/formulas/', 'q=roe')).toBe('/formulas/?q=roe');
  });
});
