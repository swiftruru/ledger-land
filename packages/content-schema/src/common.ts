// 共用型別（08 第 3.1、3.2 節）與 ID 規則（08 第 4.1 節）。Zod 4 是唯一來源；JSON Schema 由 scripts/export-json-schema.ts 以 draft-07 輸出。
import { BASE_LOCALE, LOCALE_CODES, type Locale } from '@ledgerland/i18n';
import { z } from 'zod';

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

export function idSchema(kind: IdKind) {
  const r = ID_RULES[kind];
  return z.string().regex(idPattern(kind), `${kind} 的 ID 格式是 ${r.prefix} 加 ${r.length} 碼 Crockford Base32 小寫`);
}

/** 由工具產生 ID（08 第 4.1 節：不接受手打）。random 可以注入，方便測試 */
export function generateId(kind: IdKind, random: () => number = Math.random): string {
  const r = ID_RULES[kind];
  let s = '';
  for (let i = 0; i < r.length; i++) s += CROCKFORD[Math.floor(random() * CROCKFORD.length)];
  return `${r.prefix}${s}`;
}

/** LocalizedText：基準語系必填，其他 complete 語系選填（內容只有兩種語言都齊全才能 published，5.2 節） */
const localizedShape = Object.fromEntries(
  LOCALE_CODES.map((code) => [code, code === BASE_LOCALE ? z.string().min(1) : z.string().min(1).optional()]),
) as Record<Locale, z.ZodString | z.ZodOptional<z.ZodString>>;
export const LocalizedText = z.object(localizedShape).strict();
export type LocalizedText = z.infer<typeof LocalizedText>;

/** 使用受控標記的 LocalizedText（08 第 8 節）；M0b 只檢查佔位符語法，受控標記的編譯在 M1 */
export const Markup = LocalizedText;
export type Markup = LocalizedText;

export const Status = z.enum(['draft', 'published', 'retired']);
export type Status = z.infer<typeof Status>;
export const RevKind = z.enum(['text', 'answer']);
export const Difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** 所有實體共用的管理欄位（08 第 3.2 節） */
export const Managed = z.object({
  rev: z.number().int().min(1),
  revKind: RevKind,
  status: Status,
  supersededBy: z.string().optional(),
  retiredNote: LocalizedText.optional(),
  authorNotes: z.string().optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

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
