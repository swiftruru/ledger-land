// oxlint-disable vitest/no-standalone-expect -- @fast-check/vitest 的 test.prop 不被 vitest 外掛認得
// 05 第 16 節的單元測試：登錄檔、路徑函式、格式化、輸入正規化（格式化的字串比對只在同一引擎內成立）
import { describe, expect, it } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import {
  BASE_LOCALE,
  LOCALES,
  checkRegistry,
  completeNonBaseLocales,
  fallbackChain,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatUnit,
  localeFromPath,
  localePath,
  matchLocale,
  matchLocaleOrNull,
  moneyParts,
  normalizeNumericInput,
  normalizePath,
  partsToNumber,
  stripLocale,
  switchLocalePath,
} from '../src/index.ts';

describe('登錄檔', () => {
  it('通過自我檢查', () => {
    expect(checkRegistry()).toEqual([]);
  });
  it('zh-TW 與 en 都是 complete；en 是唯一要檢查缺字的語系', () => {
    expect(LOCALES.every((l) => l.status === 'complete')).toBe(true);
    expect(completeNonBaseLocales()).toEqual(['en']);
  });
  it('會抓到壞掉的登錄檔', () => {
    const bad = LOCALES.map((l) => (l.code === 'en' ? { ...l, urlSegment: 'Play', fallback: ['en'] } : l));
    const problems = checkRegistry(bad as never);
    expect(problems.some((p) => p.includes('小寫'))).toBe(true);
    expect(problems.some((p) => p.includes('循環') || p.includes('最後'))).toBe(true);
  });
  it('matchLocale 依順序比對前綴', () => {
    expect(matchLocale(['ja', 'zh-Hant-TW'])).toBe('zh-TW');
    expect(matchLocale(['en-US'])).toBe('en');
    expect(matchLocale(['ja'])).toBe(BASE_LOCALE);
    expect(matchLocaleOrNull(['ja', 'ko'])).toBeNull();
    expect(fallbackChain('en')).toEqual(['en', 'zh-TW']);
  });
});

describe('網址的語系片段', () => {
  it.each([
    ['/', 'zh-TW', '/'],
    ['/en', 'en', '/'],
    ['/en/', 'en', '/'],
    ['/en/level/lv_k7m2q9xd/', 'en', '/level/lv_k7m2q9xd/'],
    ['/level/lv_k7m2q9xd/', 'zh-TW', '/level/lv_k7m2q9xd/'],
    ['/english/', 'zh-TW', '/english/'],
    ['/EN/level/', 'en', '/level/'],
  ])('%s → %s，去掉語系片段後 %s', (path, locale, stripped) => {
    expect(localeFromPath(path)).toBe(locale);
    expect(stripLocale(path)).toBe(stripped);
  });
  it('localePath 與 switchLocalePath', () => {
    expect(localePath('en', '/')).toBe('/en/');
    expect(localePath('en', '/terms/')).toBe('/en/terms/');
    expect(localePath('zh-TW', '/terms/')).toBe('/terms/');
    expect(switchLocalePath('en', '/level/lv_k7m2q9xd/', '?term=tm_a', '#x')).toBe('/en/level/lv_k7m2q9xd/?term=tm_a#x');
    expect(switchLocalePath('zh-TW', '/en/level/lv_k7m2q9xd/')).toBe('/level/lv_k7m2q9xd/');
  });
  it.each([
    ['/EN/Level/LV_K7M2Q9XD', '/en/level/lv_k7m2q9xd/'],
    ['/en', '/en/'],
    ['/zh-tw/terms/tm_a/', '/terms/tm_a/'],
    ['/zh/', '/'],
    ['/terms', '/terms/'],
    ['/en//terms/', '/en/terms/'],
    ['/', '/'],
  ])('normalizePath(%s) = %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
  // 第一段剛好等於語系代碼（例如 /en/）的路徑本來就會被當成語系前綴，不在這個性質的範圍內
  test.prop([fc.array(fc.stringMatching(/^[a-z0-9_]{1,10}$/), { minLength: 0, maxLength: 4 }).filter((segs) => !LOCALES.some((l) => l.code === segs[0]))])(
    'localePath 再 stripLocale 後不變',
    (segs) => {
      const path = segs.length ? `/${segs.join('/')}/` : '/';
      for (const l of LOCALES) expect(stripLocale(localePath(l.code, path))).toBe(path);
    },
  );
});

describe('格式化（05 第 10 節）', () => {
  it('金額兩種語系都顯示 NT$，負數帶負號，-0 顯示 NT$0', () => {
    for (const code of ['zh-TW', 'en'] as const) {
      expect(formatMoney(1234000, code)).toBe('NT$1,234,000');
      expect(formatMoney(-36000, code)).toBe('-NT$36,000');
      expect(formatMoney(-0, code)).toBe('NT$0');
      expect(formatMoney(12000, code, { sign: true })).toBe('+NT$12,000');
      expect(formatMoney(0, code, { sign: true })).toBe('NT$0');
    }
  });
  it('百分比與 sign 選項', () => {
    expect(formatPercent(0.0734, 'en')).toBe('7.34%');
    expect(formatPercent(-0.0000004, 'zh-TW')).toBe('0.00%');
    expect(formatPercent(0.0125, 'en', { sign: true })).toBe('+1.25%');
    expect(formatPercent(-0.0000004, 'en', { sign: true })).toBe('0.00%');
  });
  it('單位與複數', () => {
    expect(formatUnit(3.5, 'zh-TW', 'times', { digits: 2 })).toBe('3.50 倍');
    expect(formatUnit(3.5, 'en', 'times', { digits: 2 })).toBe('3.50×');
    expect(formatUnit(1, 'en', 'day')).toBe('1 day');
    expect(formatUnit(45.62, 'en', 'day', { digits: 2 })).toBe('45.62 days');
    expect(formatUnit(1, 'zh-TW', 'day')).toBe('1 天');
  });
  it('萬元 / million', () => {
    expect(formatMoneyCompact(2480000, 'zh-TW')).toBe('248 萬元');
    expect(formatMoneyCompact(2480000, 'en')).toBe('NT$2.48 million');
    expect(formatMoneyCompact(150000000, 'zh-TW')).toBe('1.5 億元');
    expect(formatMoneyCompact(152340000, 'zh-TW')).toBe('15,234 萬元');
    expect(formatMoneyCompact(152340000, 'en')).toBe('NT$152.34 million');
    expect(formatMoneyCompact(-2480000, 'en')).toBe('-NT$2.48 million');
    expect(() => formatMoneyCompact(2485000, 'zh-TW')).toThrow(/compact/);
    expect(() => formatMoneyCompact(999999, 'en')).toThrow(/compact/);
  });
  it('日期用 UTC，en 為英式', () => {
    expect(formatDate('2026-11-03', 'en')).toBe('3 November 2026');
    expect(formatDate('2026-11-03', 'zh-TW')).toBe('2026年11月3日');
  });
  it('formatNumber 的千分位', () => {
    expect(formatNumber(1234567.5, 'en', { digits: 1 })).toBe('1,234,567.5');
    expect(formatNumber(-0, 'zh-TW')).toBe('0');
  });
  test.prop([fc.integer({ min: -999_999_999, max: 999_999_999 })])('金額經 formatToParts 往返後相等', (v) => {
    for (const code of ['zh-TW', 'en'] as const) expect(partsToNumber(moneyParts(v, code))).toBe(Object.is(v, -0) ? 0 : v);
  });
});

describe('輸入正規化（05 第 11 節）', () => {
  it.each<[string, 'money' | 'percent' | 'times' | 'plain', unknown]>([
    ['１，０００．５', 'plain', { ok: true, value: 1000.5 }],
    ['−1,234', 'money', { ok: true, value: -1234 }],
    ['－1,234', 'money', { ok: true, value: -1234 }],
    ['-NT$1,234', 'money', { ok: true, value: -1234 }],
    ['NT$-1,234', 'money', { ok: true, value: -1234 }],
    ['1,234 元', 'money', { ok: true, value: 1234 }],
    ['$1,234', 'money', { ok: true, value: 1234 }],
    ['７．３４％', 'percent', { ok: true, value: 7.34 }],
    ['3.5倍', 'times', { ok: true, value: 3.5 }],
    ['3.5x', 'times', { ok: true, value: 3.5 }],
    ['12。5', 'plain', { ok: true, value: 12.5 }],
    ['-0', 'plain', { ok: true, value: 0 }],
    ['(1,234)', 'money', { ok: false, reason: 'parentheses' }],
    ['--5', 'plain', { ok: false, reason: 'invalid' }],
    ['-+5', 'plain', { ok: false, reason: 'invalid' }],
    ['abc', 'plain', { ok: false, reason: 'invalid' }],
    ['', 'plain', { ok: false, reason: 'empty' }],
    ['   ', 'money', { ok: false, reason: 'empty' }],
  ])('%s（%s）', (raw, unit, expected) => {
    expect(normalizeNumericInput(raw, unit)).toEqual(expected);
  });
  test.prop([fc.integer({ min: -99_999_999, max: 99_999_999 })])('格式化後再正規化會還原整數金額', (v) => {
    for (const code of ['zh-TW', 'en'] as const) {
      const r = normalizeNumericInput(formatMoney(v, code), 'money');
      expect(r).toEqual({ ok: true, value: Object.is(v, -0) ? 0 : v });
    }
  });
});
