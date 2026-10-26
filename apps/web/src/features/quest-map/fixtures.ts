// 開發與測試用的 fixture（17 第 10 節）：內容目前都是草稿、快照可能沒有關卡，所以地圖用這一組自編的 3 章 12 關開發與 E2E。
// 只在網址帶 ?ll-fixture=quest 時由 Play 與 Chapter 頁動態載入；關卡名稱與目標是原創的概念名稱，不是教材內容，也不是題目。
// ?ll-fixture=quest-full 是 14 章（主線 10 章加延伸區 4 章）的場景展示 fixture，只給 M3 的場景截圖與體積驗收用，章名用場景題材命名。
import type { Locale } from '@ledgerland/i18n';
import { indexData, type LevelMeta, type MapChapter, type QuestMapData, type QuestMapSource } from './data.ts';
import type { MapProgress } from './progress.ts';

type L = Record<Locale, string>;
const tx = (zh: string, en: string): L => ({ 'zh-TW': zh, en });

interface FixtureChapter {
  id: string;
  extension: boolean;
  title: L;
  summary: L;
  badge: L;
  objectives: { id: string; statement: L }[];
  levels: { id: string; title: L; objectiveIds: string[]; unscored?: boolean }[];
  /** 章末連到實驗室的故事步驟（故事在 fixture 的 manifest 裡沒有發布，地圖與章節頁不該顯示這個連結） */
  chapterEndLinks?: { kind: 'lab'; story: string; step: string }[];
}

export const FIXTURE_CHAPTERS: readonly FixtureChapter[] = [
  {
    id: 'ch_fx0001',
    extension: false,
    title: tx('一家小店的帳', 'A small shop and its books'),
    summary: tx('從一家剛開張的小店出發，認識資產、負債與股東權益。', 'Start with a newly opened shop and meet assets, liabilities and equity.'),
    badge: tx('開店了', 'Open for business'),
    objectives: [
      { id: 'obj_fx0a01', statement: tx('能分辨資產、負債與股東權益', 'Tell assets, liabilities and equity apart') },
      { id: 'obj_fx0a02', statement: tx('能說明會計恆等式為什麼永遠成立', 'Explain why the accounting equation always holds') },
    ],
    levels: [
      { id: 'lv_fx010001', title: tx('認識資產', 'Meet the assets'), objectiveIds: ['obj_fx0a01'] },
      { id: 'lv_fx010002', title: tx('認識負債', 'Meet the liabilities'), objectiveIds: ['obj_fx0a01'] },
      { id: 'lv_fx010003', title: tx('股東權益', 'Equity'), objectiveIds: ['obj_fx0a01', 'obj_fx0a02'] },
      { id: 'lv_fx010004', title: tx('會計恆等式', 'The accounting equation'), objectiveIds: ['obj_fx0a02'] },
    ],
  },
  {
    id: 'ch_fx0002',
    extension: false,
    title: tx('三張報表', 'The three statements'),
    summary: tx('認識損益表、資產負債表與現金流量表各自回答的問題。', 'Learn which question each of the three statements answers.'),
    badge: tx('看懂地圖', 'Map reader'),
    objectives: [
      { id: 'obj_fx0b01', statement: tx('能說出三張報表各自回答什麼問題', 'Say which question each statement answers') },
      { id: 'obj_fx0b02', statement: tx('能在情境裡選對報表', 'Pick the right statement for a situation') },
      { id: 'obj_fx0b03', statement: tx('能區分賺到與收到', 'Tell earning from receiving') },
    ],
    levels: [
      { id: 'lv_fx020001', title: tx('損益表說什麼', 'What the income statement says'), objectiveIds: ['obj_fx0b01'] },
      { id: 'lv_fx020002', title: tx('資產負債表說什麼', 'What the balance sheet says'), objectiveIds: ['obj_fx0b01'] },
      { id: 'lv_fx020003', title: tx('現金流量表說什麼', 'What the cash flow statement says'), objectiveIds: ['obj_fx0b01'] },
      { id: 'lv_fx020004', title: tx('賺到與收到', 'Earned and received'), objectiveIds: ['obj_fx0b03'] },
      { id: 'lv_fx020005', title: tx('選對報表', 'Choose the right statement'), objectiveIds: ['obj_fx0b02'] },
    ],
    chapterEndLinks: [{ kind: 'lab', story: 'story_fx0001', step: 'st_fx0001' }],
  },
  {
    id: 'ch_fx00e1',
    extension: true,
    title: tx('借貸與分錄', 'Debits, credits and journal entries'),
    summary: tx('想多學再來：借方與貸方的規則，以及第一筆分錄。', 'Optional: the rules of debit and credit, and your first journal entry.'),
    badge: tx('記帳員', 'Bookkeeper'),
    objectives: [{ id: 'obj_fx0e01', statement: tx('能用借貸記錄一筆交易', 'Record a transaction with debits and credits') }],
    levels: [
      { id: 'lv_fx0e0001', title: tx('借方與貸方', 'Debit and credit'), objectiveIds: ['obj_fx0e01'] },
      { id: 'lv_fx0e0002', title: tx('第一筆分錄', 'The first journal entry'), objectiveIds: ['obj_fx0e01'] },
      { id: 'lv_fx0e0003', title: tx('T 字帳', 'T accounts'), objectiveIds: ['obj_fx0e01'] },
      // 不計分關卡（全部是取捨題）：沒有星等，只有已讀完與尚未讀
      { id: 'lv_fx0e0004', title: tx('四種觀點', 'Four points of view'), objectiveIds: ['obj_fx0e01'], unscored: true },
    ],
  },
];
export const FIXTURE_UNSCORED_LEVEL = 'lv_fx0e0004';

export const FIXTURE_RETIRED_LEVEL = 'lv_fx0r0001';

export function fixtureData(locale: Locale): QuestMapData {
  let core = 0;
  let ext = 0;
  const chapters: MapChapter[] = FIXTURE_CHAPTERS.map((c, i) => ({
    id: c.id,
    order: i + 1,
    chapterNo: c.extension ? ++ext : ++core,
    extension: c.extension,
    notInExam: c.extension,
    inExam: !c.extension,
    title: c.title[locale],
    summary: c.summary[locale],
    badgeTitle: c.badge[locale],
    objectives: c.objectives.map((o) => ({ id: o.id, statement: o.statement[locale] })),
    levels: c.levels.map((l, j) => ({ id: l.id, chapterId: c.id, levelNo: j + 1, unscored: l.unscored === true })),
    chapterEndLinks: c.chapterEndLinks ?? [],
  }));
  // fixture 的 manifest 沒有任何已發布的故事
  return indexData(chapters, new Map([[FIXTURE_RETIRED_LEVEL, {}]]), new Set());
}

export function fixtureLevelMeta(levelId: string, locale: Locale): LevelMeta | undefined {
  for (const c of FIXTURE_CHAPTERS) {
    const l = c.levels.find((x) => x.id === levelId);
    if (l) return { title: l.title[locale], objectiveIds: l.objectiveIds };
  }
  return undefined;
}

export const fixtureSource: QuestMapSource = {
  async load(locale) {
    return fixtureData(locale);
  },
  async levelMeta(levelId, locale) {
    const m = fixtureLevelMeta(levelId, locale);
    if (!m) throw new Error(`fixture 沒有關卡 ${levelId}`);
    return m;
  },
  async resolve(levelId) {
    if (fixtureLevelMeta(levelId, 'zh-TW')) return { status: 'active', kind: 'level' };
    if (levelId === FIXTURE_RETIRED_LEVEL) return { status: 'retired', kind: 'level' };
    return { status: 'unknown' };
  },
};

export type FixtureProgressVariant = 'default' | 'ch1done' | 'ch1new' | 'none' | 'all';

/** fixture 進度：default 是第 1 章前兩關有星星（目前關卡 1-3）；ch1done 是第 1 章全部完成且徽章已寫入（目前關卡 2-1）；
 * ch1new 是第 1 章全部三星但徽章還沒寫入（地圖打開時會判定新取得「精通」並顯示 Toast）；all 是全部三星、完成與精通徽章都已寫入 */
export function fixtureProgress(variant: FixtureProgressVariant): MapProgress {
  const levels = new Map<string, { stars: 0 | 1 | 2 | 3; bestScore: number; lastPlayedAt: string }>();
  const at = (n: number) => `2026-10-${String(10 + n).padStart(2, '0')}T08:00:00.000Z`;
  const put = (id: string, stars: 0 | 1 | 2 | 3, score: number, n: number) => levels.set(id, { stars, bestScore: score, lastPlayedAt: at(n) });
  if (variant === 'default') {
    put('lv_fx010001', 3, 1, 1);
    put('lv_fx010002', 2, 0.8, 2);
  } else if (variant === 'ch1done') {
    put('lv_fx010001', 3, 1, 1);
    put('lv_fx010002', 2, 0.8, 2);
    put('lv_fx010003', 3, 1, 3);
    put('lv_fx010004', 1, 0.6, 4);
  } else if (variant === 'ch1new') {
    put('lv_fx010001', 3, 1, 1);
    put('lv_fx010002', 3, 1, 2);
    put('lv_fx010003', 3, 1, 3);
    put('lv_fx010004', 3, 1, 4);
  } else if (variant === 'all') {
    let n = 0;
    // 不計分關卡只記「讀完」：有紀錄、沒有星星
    for (const c of FIXTURE_CHAPTERS) for (const l of c.levels) put(l.id, l.unscored ? 0 : 3, l.unscored ? 0 : 1, ++n);
  }
  if (variant !== 'none') put(FIXTURE_RETIRED_LEVEL, 2, 0.8, 9);
  const badges = new Set<string>();
  if (variant === 'ch1done') badges.add('badge:ch_fx0001');
  if (variant === 'all')
    for (const c of FIXTURE_CHAPTERS) {
      badges.add(`badge:${c.id}`);
      badges.add(`badge:${c.id}:mastery`);
    }
  return { levels, badges, due: variant === 'none' ? 0 : 3, retiredChapterOf: new Map([[FIXTURE_RETIRED_LEVEL, 'ch_fx0001']]) };
}

export function fixtureVariantFrom(value: string | null): FixtureProgressVariant {
  return value === 'ch1done' || value === 'ch1new' || value === 'none' || value === 'all' ? value : 'default';
}

/** 場景展示 fixture：主線 10 章加延伸區 4 章，每章 3 關；章名用 17 第 4 節的場景題材（原創），關卡名稱是「第 N 站」 */
const FULL_TITLES: readonly L[] = [
  tx('起點碼頭', 'The starting dock'),
  tx('三座小島', 'Three islands'),
  tx('市集街道', 'Market street'),
  tx('天平廣場', 'Balance plaza'),
  tx('河流與水閘', 'River and sluice'),
  tx('燈塔', 'The lighthouse'),
  tx('齒輪工坊', 'Gear workshop'),
  tx('農田與水車', 'Fields and the waterwheel'),
  tx('麵包工坊', 'The bakery'),
  tx('山頂市場', 'Summit market'),
  tx('估價小島', 'Valuation isle'),
  tx('融資小島', 'Financing isle'),
  tx('圓桌小島', 'Round table isle'),
  tx('分錄小島', 'Journal isle'),
];
export const FULL_FIXTURE_CORE = 10;
export const FULL_FIXTURE_EXTENSION = 4;

export function fullFixtureChapterId(index: number): string {
  return `ch_fu00${String(index + 1).padStart(2, '0')}`;
}
export function fullFixtureLevelId(index: number, levelNo: number): string {
  return `lv_fu${String(index + 1).padStart(2, '0')}000${levelNo}`;
}

export function fullFixtureData(locale: Locale): QuestMapData {
  const chapters: MapChapter[] = FULL_TITLES.map((title, i) => {
    const extension = i >= FULL_FIXTURE_CORE;
    const id = fullFixtureChapterId(i);
    return {
      id,
      order: i + 1,
      chapterNo: extension ? i - FULL_FIXTURE_CORE + 1 : i + 1,
      extension,
      notInExam: extension,
      inExam: !extension,
      title: title[locale],
      badgeTitle: title[locale],
      objectives: [],
      levels: [1, 2, 3].map((n) => ({ id: fullFixtureLevelId(i, n), chapterId: id, levelNo: n, unscored: false })),
      chapterEndLinks: [],
    };
  });
  return indexData(chapters, new Map());
}

export const fullFixtureSource: QuestMapSource = {
  async load(locale) {
    return fullFixtureData(locale);
  },
  async levelMeta(levelId, locale) {
    const m = /^lv_fu(\d{2})000(\d)$/.exec(levelId);
    if (!m) throw new Error(`fixture 沒有關卡 ${levelId}`);
    const n = Number(m[2]);
    return { title: locale === 'en' ? `Stop ${n}` : `第 ${n} 站`, objectiveIds: [] };
  },
  async resolve(levelId) {
    return /^lv_fu\d{2}000\d$/.test(levelId) ? { status: 'active', kind: 'level' } : { status: 'unknown' };
  },
};

/** 場景展示 fixture 的進度：沒有任何星星 */
export const EMPTY_FIXTURE_PROGRESS: MapProgress = { levels: new Map(), badges: new Set(), due: 0 };
