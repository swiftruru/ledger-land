// 語系登錄檔（05 第 2.2 節）。zh-TW 與 en 從 M0b 起都是 complete；beta 只給日後新增的第三種語言。
import type { LocaleDef } from './types.ts';

export const LOCALES = [
  {
    code: 'zh-TW',
    nativeName: '繁體中文',
    shortLabel: '中',
    englishName: 'Traditional Chinese (Taiwan)',
    htmlLang: 'zh-TW',
    hreflang: 'zh-TW',
    ogLocale: 'zh_TW',
    dir: 'ltr',
    status: 'complete',
    fallback: [],
    urlSegment: null,
    match: ['zh'],
    intlLocale: 'zh-TW',
    dateStyle: 'long',
    money: { mode: 'currency', symbol: 'NT$' },
    compact: [
      { minAbs: 100_000_000, factor: 100_000_000, maxFractionDigits: 2, pattern: '{n} 億元' },
      { minAbs: 1_000_000, factor: 10_000, maxFractionDigits: 0, pattern: '{n} 萬元' },
    ],
    units: { day: { other: '{n} 天' }, times: { other: '{n} 倍' }, turns: { other: '{n} 次' } },
  },
  {
    code: 'en',
    nativeName: 'English',
    shortLabel: 'EN',
    englishName: 'English',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_GB',
    dir: 'ltr',
    status: 'complete',
    fallback: ['zh-TW'],
    urlSegment: 'en',
    match: ['en'],
    intlLocale: 'en-GB',
    dateStyle: 'long',
    money: { mode: 'currency', symbol: 'NT$' },
    compact: [
      { minAbs: 1_000_000_000, factor: 1_000_000_000, maxFractionDigits: 2, pattern: 'NT${n} billion' },
      { minAbs: 1_000_000, factor: 1_000_000, maxFractionDigits: 2, pattern: 'NT${n} million' },
    ],
    units: { day: { one: '{n} day', other: '{n} days' }, times: { other: '{n}×' }, turns: { other: '{n}×' } },
  },
] as const satisfies readonly LocaleDef[];

/** 語系代號的型別；content-schema 的 LocalizedText 也從這裡匯入 */
export type Locale = (typeof LOCALES)[number]['code'];
export const BASE_LOCALE = 'zh-TW' satisfies Locale;
export const LOCALE_CODES = LOCALES.map((l) => l.code) as readonly Locale[];

/** 路徑字詞（02 第 1.2 節）；urlSegment 不得與這些字詞相同 */
export const PATH_WORDS = ['play', 'chapter', 'level', 'review', 'lab', 'terms', 'me', 'install', 'privacy', 'about', 'debug'] as const;
