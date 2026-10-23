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
export const LocalizedText = z.object(localizedShape).strict().meta({ id: 'LocalizedText' });
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

/** 核心詞彙的語意 ID（04 第 16.1 節）：小寫 snake_case，科目、線、指標都用這一種 */
export const SEMANTIC_ID_RE = /^[a-z][a-z0-9_]*$/;
export const SemanticId = z.string().regex(SEMANTIC_ID_RE, '語意 ID 是小寫 snake_case，例如 inventory').meta({ id: 'SemanticId' });

/** 交易範本 ID：tpl. 前綴加語意 ID（08 第 4.1 節） */
export const TEMPLATE_ID_RE = /^tpl\.[a-z][a-z0-9_]*$/;
export const TemplateId = z.string().regex(TEMPLATE_ID_RE, '範本 ID 是 tpl. 加小寫 snake_case，例如 tpl.sell_all_inventory_cash').meta({ id: 'TemplateId' });

/** 事件 ID：e 加流水號，在題目或步驟內唯一（08 第 4.1 節） */
export const EVENT_ID_RE = /^e[1-9]\d*$/;
export const EventId = z.string().regex(EVENT_ID_RE, '事件 ID 寫成 e1、e2').meta({ id: 'EventId' });

/** target ID：t 加流水號，在題目內唯一（08 第 4.1 節） */
export const TARGET_ID_RE = /^t[1-9]\d*$/;
export const TargetId = z.string().regex(TARGET_ID_RE, 'target ID 寫成 t1、t2').meta({ id: 'TargetId' });

/** 版面列的線 ID：is_、bs_、cf_（間接法）、dc_（直接法）加小寫 snake_case（04 第 11 節） */
export const LINE_ID_RE = /^(is|bs|cf|dc)_[a-z0-9_]+$/;
export const LineId = z.string().regex(LINE_ID_RE, '線 ID 是 is_、bs_、cf_ 或 dc_ 加小寫 snake_case').meta({ id: 'LineId' });

/** 認列政策與版面的 ID：名稱加 @ 加版號，例如 teacher@1（04 第 16.1 節） */
export const VERSIONED_ID_RE = /^[a-z]+@\d+$/;
export const VersionedId = z.string().regex(VERSIONED_ID_RE, '政策與版面的 ID 寫成名稱加 @ 加版號，例如 teacher@1');

/** 指標版本參照：指標 ID 加 @ 加版本名稱，例如 roa@excel（04 第 12.1 節） */
export const RATIO_VERSIONS = ['excel', 'slides03', 'slides02', 'dupont', 'slides01'] as const;
export const RATIO_REF_RE = /^[a-z][a-z0-9_]*@(excel|slides03|slides02|dupont|slides01)$/;
export const RatioRef = z.string().regex(RATIO_REF_RE, '指標參照寫成指標 ID 加 @ 加版本，例如 roa@excel').meta({ id: 'RatioRef' });

/** 待確認編號（14 的 T 系列） */
export const PendingRef = z
  .string()
  .regex(/^T\d{2}$/, '待確認編號是 T 加兩位數字，例如 T04')
  .meta({ id: 'PendingRef' });

/** 名稱類識別字：參數、推導值、vars 的鍵（04 第 8.1 節：最長 64 字元，可用 camelCase） */
export const NAME_RE = /^[a-z][A-Za-z0-9_]{0,63}$/;
export const Name = z.string().regex(NAME_RE, '名稱以小寫字母開頭，只能用英數與底線，最長 64 字元').meta({ id: 'Name' });

/** 金額：非負整數（04 第 3 節，TWD 的 scale 為 0） */
export const Money = z.number().int().min(0).meta({ id: 'Money' });
