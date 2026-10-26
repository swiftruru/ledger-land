// 名詞圖鑑的純函式（03 第 2.10 節）：解鎖對照、在哪一關會遇到、分組與搜尋；最後一段是「一次出現」的原始碼守門（維護者 2026-10-26）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Unlock } from '@ledgerland/progress';
import {
  chapterOfLevelMap,
  collectedRatio,
  collectionCounts,
  groupByChapter,
  groupByName,
  groupGlossary,
  groupProgress,
  isReferenceTerm,
  levelPosition,
  matchesQuery,
  meetLevelOf,
  newlyCollected,
  numberChapters,
  termUnlockId,
  unlockedTermMap,
  type ChapterIndexEntry,
  type GlossaryTerm,
} from '../src/features/glossary/unlocks.ts';
import { hasTermRefs, plainParagraphs } from '../src/features/term-page/term-text.ts';
import { splitParagraphs } from '../src/features/quiz/placeholders.ts';

const chapters: ChapterIndexEntry[] = [
  { id: 'ch_000002', order: 2, chapterNo: 2, extension: false, levelIds: ['lv_2a2a2a2a', 'lv_2b2b2b2b'] },
  { id: 'ch_000001', order: 1, chapterNo: 1, extension: false, levelIds: ['lv_1a1a1a1a', 'lv_1b1b1b1b'] },
];

function term(id: string, label: string, extra: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return {
    id,
    category: 'concept',
    label,
    teacherLabel: label,
    currentTwLabel: null,
    ifrsEnglish: null,
    flags: [],
    ...extra,
  };
}

describe('unlockedTermMap', () => {
  it('只收 term: 的 unlock，去掉前綴', () => {
    const unlocks: Unlock[] = [
      { id: 'term:tm_aaaaaaaa', kind: 'term', unlockedAt: '2026-10-20T10:00:00.000+08:00' },
      { id: 'badge:ch_000001', kind: 'badge', unlockedAt: '2026-10-21T10:00:00.000+08:00' },
    ];
    const map = unlockedTermMap(unlocks);
    expect([...map.entries()]).toEqual([['tm_aaaaaaaa', '2026-10-20T10:00:00.000+08:00']]);
    expect(termUnlockId('tm_aaaaaaaa')).toBe('term:tm_aaaaaaaa');
  });
});

describe('meetLevelOf 與 levelPosition', () => {
  const lookup = chapterOfLevelMap(chapters);
  it('沒有 unlock 時用 firstLevel', () => {
    const t = term('tm_a', '現金', { firstLevel: { levelId: 'lv_1b1b1b1b', chapterId: 'ch_000001' } });
    expect(meetLevelOf(t, lookup)).toEqual({ levelId: 'lv_1b1b1b1b', chapterId: 'ch_000001' });
    expect(levelPosition(chapters, 'ch_000001', 'lv_1b1b1b1b')).toEqual({ chapterNo: 1, extension: false, levelNo: 2 });
  });
  it('作者另設 unlock.levelId 時以它為準，章節由關卡對照查', () => {
    const t = term('tm_b', '存貨', { firstLevel: { levelId: 'lv_1a1a1a1a', chapterId: 'ch_000001' }, unlock: { levelId: 'lv_2b2b2b2b' } });
    expect(meetLevelOf(t, lookup)).toEqual({ levelId: 'lv_2b2b2b2b', chapterId: 'ch_000002' });
  });
  it('沒有任何關卡用到時回 undefined；關卡不在章節清單時 levelNo 為 undefined', () => {
    expect(meetLevelOf(term('tm_c', '其他'), lookup)).toBeUndefined();
    expect(levelPosition(chapters, 'ch_000001', 'lv_zzzzzzzz')).toEqual({ chapterNo: 1, extension: false, levelNo: undefined });
    expect(levelPosition(chapters, 'ch_nope', 'lv_1a1a1a1a')).toBeUndefined();
  });
});

describe('章序和地圖一致（numberChapters）', () => {
  // 回歸：圖鑑以前用 order 當章號，延伸章寫成「第 11 章」，地圖與章節頁卻是「延伸第 1 章」
  it('依 order 排序，主線與延伸區各自從 1 起算；levelPosition 帶出延伸與否', () => {
    const numbered = numberChapters([
      { id: 'ch_e2', order: 12, scope: 'extension', levelIds: ['lv_e2a'] },
      { id: 'ch_c2', order: 2, scope: 'core' },
      { id: 'ch_e1', order: 11, scope: 'extension', levelIds: ['lv_e1a', 'lv_e1b'] },
      { id: 'ch_c1', order: 1 },
    ]);
    expect(numbered.map((c) => [c.id, c.chapterNo, c.extension])).toEqual([
      ['ch_c1', 1, false],
      ['ch_c2', 2, false],
      ['ch_e1', 1, true],
      ['ch_e2', 2, true],
    ]);
    expect(numbered.find((c) => c.id === 'ch_c2')!.levelIds).toEqual([]);
    expect(levelPosition(numbered, 'ch_e1', 'lv_e1b')).toEqual({ chapterNo: 1, extension: true, levelNo: 2 });
    expect(levelPosition(numbered, 'ch_e2', 'lv_e2a')).toEqual({ chapterNo: 2, extension: true, levelNo: 1 });
  });
});

describe('名詞頁的長文（分段與佔位符）', () => {
  // 回歸：M3 的名詞定義用空行分段，名詞頁與名詞卡以前把兩段黏成一段
  it('空行分段、去掉前後空白、略過空段；段內單一換行保留', () => {
    expect(splitParagraphs('第一段。\n\n第二段。')).toEqual(['第一段。', '第二段。']);
    expect(splitParagraphs('  a \n \n\n b\nc  \n\n')).toEqual(['a', 'b\nc']);
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('只有一段')).toEqual(['只有一段']);
  });
  it('{{term:…}} 換成名詞名稱、數值佔位符依語系格式化；沒有名稱時留 ID', () => {
    const text = '和 {{term:tm_aaaaaaaa|plain}} 一起看。\n\n門檻 {{percent:1.3}}。';
    expect(hasTermRefs(text)).toBe(true);
    expect(hasTermRefs('沒有引用', undefined)).toBe(false);
    const labels = new Map([['tm_aaaaaaaa', '營業利益']]);
    expect(plainParagraphs(text, 'zh-TW', (id) => labels.get(id))).toEqual(['和 營業利益 一起看。', '門檻 130.00%。']);
    expect(plainParagraphs(text, 'en')).toEqual(['和 tm_aaaaaaaa 一起看。', '門檻 130.00%。']);
  });
});

describe('分組', () => {
  const collator = new Intl.Collator('zh-TW');
  const terms = [
    term('tm_1', '負債', { firstLevel: { levelId: 'lv_2a2a2a2a', chapterId: 'ch_000002' } }),
    term('tm_2', '資產', { firstLevel: { levelId: 'lv_1b1b1b1b', chapterId: 'ch_000001' } }),
    term('tm_3', '現金', { firstLevel: { levelId: 'lv_1a1a1a1a', chapterId: 'ch_000001' } }),
    term('tm_4', '商譽'),
  ];
  it('依章節：章節照 order、章內照第一次遇到的關卡順序，沒有關卡的放最後', () => {
    const groups = groupByChapter(terms, chapters, collator);
    expect(groups.map((g) => g.key)).toEqual(['ch_000001', 'ch_000002', 'none']);
    expect(groups[0]!.terms.map((t) => t.id)).toEqual(['tm_3', 'tm_2']);
    expect(groups[2]!.terms.map((t) => t.id)).toEqual(['tm_4']);
  });
  it('依名稱：中文只排序成一組；英文依首字母分組', () => {
    const zh = groupByName(terms, 'zh-TW', collator);
    expect(zh).toHaveLength(1);
    expect(zh[0]!.terms).toHaveLength(4);
    const en = groupByName([term('tm_a', 'Cash'), term('tm_b', 'Assets'), term('tm_c', 'Accrual'), term('tm_d', '5-step')], 'en', new Intl.Collator('en'));
    expect(en.map((g) => [g.key, g.terms.map((t) => t.label)])).toEqual([
      ['#', ['5-step']],
      ['A', ['Accrual', 'Assets']],
      ['C', ['Cash']],
    ]);
  });
});

describe('參考名詞（沒有任何已發布題目用到）', () => {
  const collator = new Intl.Collator('zh-TW');
  const terms = [
    term('tm_1', '負債', { firstLevel: { levelId: 'lv_2a2a2a2a', chapterId: 'ch_000002' } }),
    term('tm_2', '資產', { firstLevel: { levelId: 'lv_1b1b1b1b', chapterId: 'ch_000001' } }),
    term('tm_3', '商譽'),
    term('tm_4', '本益比'),
    // 作者另設 unlock 的名詞不是參考名詞（會在那一關收進圖鑑）
    term('tm_5', '股利', { unlock: { levelId: 'lv_1a1a1a1a' } }),
  ];
  it('沒有 firstLevel 也沒有 unlock 才是參考名詞', () => {
    expect(terms.map((t) => [t.id, isReferenceTerm(t)])).toEqual([
      ['tm_1', false],
      ['tm_2', false],
      ['tm_3', true],
      ['tm_4', true],
      ['tm_5', false],
    ]);
  });
  it('「已收進 X／N」只算收集區：參考名詞不算分母，已解鎖的參考名詞也不算分子；進度沒讀到時 done 是 null', () => {
    expect(collectionCounts(terms, null)).toEqual({ done: null, total: 3 });
    const unlocked = new Map([
      ['tm_1', '2026-10-20T10:00:00.000Z'],
      ['tm_3', '2026-10-20T10:00:00.000Z'],
    ]);
    expect(collectionCounts(terms, unlocked)).toEqual({ done: 1, total: 3 });
    // 傳進已讀到的 Map 時 done 是數字（型別上也是）：頁面在進度齊了之後才畫，頁首的「X／N」與分組的「X／N 已收進」沒有「…」的分支
    const counted: { done: number; total: number } = collectionCounts(terms, unlocked);
    expect(counted.done).toBe(1);
    const grouped: { done: number; total: number } = groupProgress(terms.slice(0, 2), unlocked);
    expect(grouped).toEqual({ done: 1, total: 2 });
    expect(groupProgress(terms, null)).toEqual({ done: null, total: 5 });
  });
  it('依章節或依名稱分組時，參考名詞都在最後的 reference 組、依名稱排序；沒有參考名詞時不出現這一組', () => {
    const byChapter = groupGlossary(terms, 'chapter', chapters, 'zh-TW', collator);
    expect(byChapter.map((g) => g.key)).toEqual(['ch_000001', 'ch_000002', 'reference']);
    expect(byChapter[0]!.terms.map((t) => t.id)).toEqual(['tm_5', 'tm_2']);
    const byLabel = [terms[2]!, terms[3]!].sort((a, b) => collator.compare(a.label, b.label)).map((t) => t.id);
    expect(byChapter[2]!.terms.map((t) => t.id)).toEqual(byLabel);
    const byName = groupGlossary(terms, 'name', chapters, 'zh-TW', collator);
    expect(byName.map((g) => g.key)).toEqual(['all', 'reference']);
    expect(byName[0]!.terms).toHaveLength(3);
    expect(groupGlossary(terms.slice(0, 2), 'chapter', chapters, 'zh-TW', collator).map((g) => g.key)).toEqual(['ch_000001', 'ch_000002']);
  });
  it('之後有題目用到（快照有了 firstLevel）就自動回到收集區', () => {
    const later = terms.map((t) => (t.id === 'tm_3' ? { ...t, firstLevel: { levelId: 'lv_1a1a1a1a', chapterId: 'ch_000001' } } : t));
    expect(collectionCounts(later, null).total).toBe(4);
    const groups = groupGlossary(later, 'chapter', chapters, 'zh-TW', collator);
    expect(groups.find((g) => g.key === 'ch_000001')!.terms.map((t) => t.id)).toContain('tm_3');
    expect(groups.find((g) => g.key === 'reference')!.terms.map((t) => t.id)).toEqual(['tm_4']);
  });
});

describe('matchesQuery', () => {
  const t = term('tm_x', '權責發生制', {
    currentTwLabel: '應計基礎',
    ifrsEnglish: 'Accrual basis of accounting',
    aliases: { 'zh-TW': ['應計制'], en: ['Accrual accounting'] },
  });
  it('空字串全部符合；比對名稱、現行用語、IFRS 英文與別名，不分大小寫', () => {
    expect(matchesQuery(t, '  ')).toBe(true);
    expect(matchesQuery(t, '權責')).toBe(true);
    expect(matchesQuery(t, '應計基礎')).toBe(true);
    expect(matchesQuery(t, 'ACCRUAL')).toBe(true);
    expect(matchesQuery(t, '應計制')).toBe(true);
    expect(matchesQuery(t, '存貨')).toBe(false);
  });
});

describe('collectedRatio（收集進度卡的百分比）', () => {
  it('0 個是 0%、收齊是 100%；其餘無條件捨去，夾在 1% 到 99% 之間', () => {
    expect(collectedRatio(0, 107)).toBe(0);
    expect(collectedRatio(107, 107)).toBe(1);
    expect(collectedRatio(1, 250)).toBe(0.01);
    expect(collectedRatio(249, 250)).toBe(0.99);
    expect(collectedRatio(53, 107)).toBe(0.49);
    expect(collectedRatio(0, 0)).toBe(0);
  });
});

describe('蓋章動畫的對象（newlyCollected）', () => {
  const unlocked = new Map([
    ['tm_1', '2026-10-20T10:00:00.000Z'],
    ['tm_2', '2026-10-21T10:00:00.000Z'],
  ]);
  it('上次離開時還沒收進、現在已收進的才播；讀不到上次的清單或進度還沒到時一張都不播', () => {
    expect([...newlyCollected(['tm_1'], unlocked)]).toEqual(['tm_2']);
    expect([...newlyCollected([], unlocked)].sort()).toEqual(['tm_1', 'tm_2']);
    expect(newlyCollected(['tm_1', 'tm_2'], unlocked).size).toBe(0);
    expect(newlyCollected(null, unlocked).size).toBe(0);
    expect(newlyCollected(['tm_1'], null).size).toBe(0);
  });
});

describe('一次出現（維護者 2026-10-26）：名詞圖鑑、名詞頁與錯題本的原始碼守門', () => {
  const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
  const pages = ['pages/Terms.tsx', 'pages/Term.tsx', 'pages/Review.tsx'];
  it('三頁都向 usePageReady 回報，沒有骨架元件、沒有「…」的數字佔位', () => {
    const facts = pages.map((rel) => {
      const code = src(rel);
      // 介面字串裡不得有省略號佔位（註解裡提到它沒關係：只看字串常值）
      return { rel, pageReady: code.includes('usePageReady('), skeleton: /\bSkeleton\b/.test(code), ellipsis: code.match(/'…'|"…"|`…`/g) ?? [] };
    });
    expect(facts).toEqual(pages.map((rel) => ({ rel, pageReady: true, skeleton: false, ellipsis: [] })));
  });
  it('進度、章節索引與名詞索引一掛載就讀，不再延到第一次繪製之後（afterFirstPaint）', () => {
    const files = ['features/glossary/useUnlocks.ts', 'features/glossary/useGlossaryIndex.ts', 'pages/Terms.tsx', 'pages/Term.tsx'];
    expect(files.filter((rel) => src(rel).includes('afterFirstPaint'))).toEqual([]);
  });
  it('名詞卡的印章和卡片同一次繪製出現：名詞圖鑑不再傳 pending 狀態', () => {
    expect(src('pages/Terms.tsx')).not.toMatch(/'pending'/);
  });
});
