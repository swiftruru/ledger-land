// 不帶 zod 的 ID 規則與佔位符解析（08 第 4.1 節、05 第 10.1 節）：給工具、schema（common.ts）與學習端共用。
// 學習端的闖關地圖（代號、QR）與作答頁（佔位符）只需要這些常數與純函式；放在 common.ts 會把頂層建立的 zod schema 連同 zod 一起帶進
// 它們第一次繪製的 chunk（06 第 8.2 節、14 第 5.2 節，2026-10-24 實測）。這個檔案不得 import zod。
/** Crockford Base32 小寫（不含 i、l、o、u） */
export const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const crockfordClass = `[${CROCKFORD}]`;

/** 各實體的前綴與隨機字串長度（08 第 4.1 節） */
export const ID_RULES = {
  chapter: { prefix: 'ch_', length: 6 },
  objective: { prefix: 'obj_', length: 6 },
  level: { prefix: 'lv_', length: 8 },
  question: { prefix: 'q_', length: 8 },
  term: { prefix: 'tm_', length: 8 },
  story: { prefix: 'story_', length: 6 },
  step: { prefix: 'st_', length: 6 },
  option: { prefix: 'o_', length: 4 },
  item: { prefix: 'it_', length: 4 },
  misconception: { prefix: 'mc_', length: 4 },
} as const;
export type IdKind = keyof typeof ID_RULES;

export function idPattern(kind: IdKind): RegExp {
  const r = ID_RULES[kind];
  return new RegExp(`^${r.prefix}${crockfordClass}{${r.length}}$`);
}

/** 由工具產生 ID（08 第 4.1 節：不接受手打）。random 可以注入，方便測試 */
export function generateId(kind: IdKind, random: () => number = Math.random): string {
  const r = ID_RULES[kind];
  let s = '';
  for (let i = 0; i < r.length; i++) s += CROCKFORD[Math.floor(random() * CROCKFORD.length)];
  return `${r.prefix}${s}`;
}

/** 佔位符文法（05 第 10.1 節）的最小解析：M0b 只檢查語法與跨語言一致 */
export const PLACEHOLDER_RE = /\{\{([a-z]+):([^|}]+?)(?:\|([^}]*))?\}\}/g;
export const PLACEHOLDER_TYPES = ['money', 'percent', 'number', 'date', 'term', 'option', 'ratio', 'raw'] as const;

export interface Placeholder {
  type: string;
  ref: string;
  options: string[];
}

export function parsePlaceholders(text: string): Placeholder[] {
  const out: Placeholder[] = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    out.push({ type: m[1]!, ref: m[2]!.trim(), options: m[3] ? m[3].split(',').map((o) => o.trim()) : [] });
  }
  return out;
}

/** 佔位符的集合（type、ref、選項）寫成可比對的字串 */
export function placeholderKey(p: Placeholder): string {
  return `${p.type}:${p.ref}|${[...p.options].sort().join(',')}`;
}
