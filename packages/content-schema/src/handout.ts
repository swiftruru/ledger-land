// 講義題庫（08 的講義題庫一節；維護者 2026-11-04 的決定，14 第 5.2 節）：老師授權、逐字收錄的講義練習題，是原創內容以外的獨立非原創區。
// 三個檔案都在 content/handout/：decks.json（講義清單、各段的投影片範圍、人工排除與請老師確認）、ids.json（投影片到 hq_ ID 的對照表，ID 永不改變）、
// midterm.json（題目本身，由 tools/handout-extract.mjs 產生，不手改）。這裡只定義形狀與交叉檢查；不經過 validateBundle、lock 與原創性檢查。
// 純 TypeScript、只用 zod，不碰 DOM 與 Node。
import { z } from 'zod';
import { RevKind, idSchema } from './common.ts';
import type { ContentIssue } from './validate.ts';

export const HANDOUT_LETTERS = ['A', 'B', 'C'] as const;
export const HandoutLetter = z.enum(HANDOUT_LETTERS);
export type HandoutLetter = z.infer<typeof HandoutLetter>;

/** 不收或請老師確認的原因：答案在兩份講義不同（不收）、解析有錯字或和公式不合（不收）、照收但請老師確認 */
export const HandoutExclusionReason = z.enum(['conflicting_answer', 'explanation_issue', 'check']);
export type HandoutExclusionReason = z.infer<typeof HandoutExclusionReason>;

const DECK_ID_RE = /^d[1-9]\d*$/;
const SECTION_ID_RE = /^d[1-9]\d*s[1-9]\d*$/;
const SLIDE_KEY_RE = /^d[1-9]\d*:[1-9]\d*$/;
const slide = z.number().int().min(1);

export const HandoutSection = z
  .object({ id: z.string().regex(SECTION_ID_RE, '段的 ID 寫成 d1s1'), title: z.string().min(1), slides: z.tuple([slide, slide]) })
  .strict();
export const HandoutDeck = z
  .object({
    id: z.string().regex(DECK_ID_RE, '講義的 ID 寫成 d1'),
    order: z.number().int().min(1),
    /** 講義在教材裡的編號，例如 0-1 */
    code: z.string().min(1),
    title: z.string().min(1),
    /** references/handouts/ 裡的檔名（永不 commit 的 pptx） */
    file: z.string().regex(/\.pptx$/, '講義檔是 pptx'),
    sections: z.array(HandoutSection).min(1),
  })
  .strict();
const SlideRef = z.object({ deck: z.string().regex(DECK_ID_RE), slide }).strict();
export const HandoutExclusionEntry = z
  .object({
    deck: z.string().regex(DECK_ID_RE),
    slide,
    reason: HandoutExclusionReason,
    /** 老師審核頁顯示的說明（台灣中文、第一人稱） */
    note: z.string().min(1),
    /** 相關的題（答案不同的另一題） */
    related: z.array(SlideRef).optional(),
  })
  .strict();
export const HandoutDecks = z
  .object({
    $comment: z.string().optional(),
    title: z.string().min(1),
    decks: z.array(HandoutDeck).min(1),
    exclusions: z.array(HandoutExclusionEntry),
  })
  .strict();
export type HandoutDecks = z.infer<typeof HandoutDecks>;

export const HandoutIds = z.record(z.string().regex(SLIDE_KEY_RE, '鍵寫成 d1:16'), idSchema('handoutQuestion'));
export type HandoutIds = z.infer<typeof HandoutIds>;

export const HandoutOption = z.object({ letter: HandoutLetter, text: z.string().min(1) }).strict();
export const HandoutExclusion = z
  .object({ reason: HandoutExclusionReason, note: z.string().min(1).optional(), related: z.array(idSchema('handoutQuestion')) })
  .strict();
export const HandoutQuestion = z
  .object({
    id: idSchema('handoutQuestion'),
    rev: z.number().int().min(1),
    revKind: RevKind,
    answerRev: z.number().int().min(1),
    deck: z.string().regex(DECK_ID_RE),
    section: z.string().regex(SECTION_ID_RE),
    slide,
    /** 投影片標題「練習題：」後面的短語 */
    topic: z.string().min(1),
    scenario: z.string().min(1),
    question: z.string().min(1),
    options: z.array(HandoutOption).length(3),
    /** 正解的字母；只有一題是兩個（B/C 都對，當成任一正確） */
    answer: z.array(HandoutLetter).min(1).max(3),
    explanation: z.string().min(1),
    status: z.enum(['included', 'excluded']),
    exclusion: HandoutExclusion.optional(),
  })
  .strict();
export type HandoutQuestion = z.infer<typeof HandoutQuestion>;

export const HandoutBank = z
  .object({
    id: z.literal('midterm'),
    rev: z.number().int().min(1),
    title: z.string().min(1),
    questions: z.array(HandoutQuestion),
  })
  .strict();
export type HandoutBank = z.infer<typeof HandoutBank>;

const FILES = { decks: 'content/handout/decks.json', ids: 'content/handout/ids.json', bank: 'content/handout/midterm.json' } as const;

function parseOrIssues<T>(schema: z.ZodType<T>, data: unknown, file: string, issues: ContentIssue[]): T | undefined {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  for (const i of r.error.issues) issues.push({ file, path: i.path.map(String).join('.') || '(root)', message: i.message });
  return undefined;
}

/**
 * 三個檔案的形狀與交叉檢查：段落範圍不重疊、每題落在所屬講義的某一段、ID 對照表與題目一致、答案都在選項裡、不收的題有原因、答案不同的題互相指向。
 * 回傳的 issues 和 validateBundle 同一種形狀（file、path、message）
 */
export function validateHandout(decksData: unknown, idsData: unknown, bankData: unknown): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const decks = parseOrIssues(HandoutDecks, decksData, FILES.decks, issues);
  const ids = parseOrIssues(HandoutIds, idsData, FILES.ids, issues);
  const bank = parseOrIssues(HandoutBank, bankData, FILES.bank, issues);
  if (!decks || !ids || !bank) return issues;
  const push = (file: string, path: string, message: string) => issues.push({ file, path, message, rule: 'handout' });

  const deckById = new Map<string, HandoutDecks['decks'][number]>();
  decks.decks.forEach((d, di) => {
    if (deckById.has(d.id)) push(FILES.decks, `decks.${di}.id`, `講義 ID 重複：${d.id}`);
    deckById.set(d.id, d);
    const sorted = [...d.sections].sort((a, b) => a.slides[0] - b.slides[0]);
    sorted.forEach((s, i) => {
      if (!s.id.startsWith(`${d.id}s`)) push(FILES.decks, `decks.${di}.sections.${i}.id`, `段的 ID ${s.id} 要以 ${d.id}s 開頭`);
      if (s.slides[0] > s.slides[1]) push(FILES.decks, `decks.${di}.sections.${i}.slides`, `段 ${s.id} 的範圍起點大於終點`);
      const prev = sorted[i - 1];
      if (prev && prev.slides[1] >= s.slides[0]) push(FILES.decks, `decks.${di}.sections.${i}.slides`, `段 ${s.id} 和 ${prev.id} 的投影片範圍重疊`);
    });
  });
  const sectionOf = (deckId: string, n: number) => deckById.get(deckId)?.sections.find((s) => n >= s.slides[0] && n <= s.slides[1]);

  const idValues = new Map<string, string>();
  for (const [key, id] of Object.entries(ids)) {
    const prev = idValues.get(id);
    if (prev !== undefined) push(FILES.ids, key, `ID ${id} 同時給了 ${prev} 與 ${key}`);
    idValues.set(id, key);
    const deckId = key.split(':')[0]!;
    if (!deckById.has(deckId)) push(FILES.ids, key, `講義 ${deckId} 不在 decks.json 裡`);
  }

  const byId = new Map<string, HandoutQuestion>();
  const slideKeys = new Set<string>();
  bank.questions.forEach((q, qi) => {
    const path = `questions.${qi}`;
    if (byId.has(q.id)) push(FILES.bank, `${path}.id`, `題目 ID 重複：${q.id}`);
    byId.set(q.id, q);
    const key = `${q.deck}:${q.slide}`;
    if (slideKeys.has(key)) push(FILES.bank, `${path}.slide`, `同一張投影片出現兩次：${key}`);
    slideKeys.add(key);
    if (ids[key] !== q.id) push(FILES.bank, `${path}.id`, `ids.json 的 ${key} 是 ${ids[key] ?? '（沒有）'}，題目卻是 ${q.id}`);
    const deck = deckById.get(q.deck);
    if (!deck) push(FILES.bank, `${path}.deck`, `講義 ${q.deck} 不在 decks.json 裡`);
    const section = sectionOf(q.deck, q.slide);
    if (deck && !section) push(FILES.bank, `${path}.slide`, `第 ${q.slide} 張不在 ${q.deck} 任何一段的範圍內`);
    else if (section && section.id !== q.section) push(FILES.bank, `${path}.section`, `第 ${q.slide} 張依範圍屬於 ${section.id}，題目寫 ${q.section}`);
    q.options.forEach((o, oi) => {
      if (o.letter !== HANDOUT_LETTERS[oi]) push(FILES.bank, `${path}.options.${oi}.letter`, `第 ${oi + 1} 個選項的字母應該是 ${HANDOUT_LETTERS[oi]}`);
    });
    if (new Set(q.answer).size !== q.answer.length) push(FILES.bank, `${path}.answer`, '正解的字母重複');
    if (q.answerRev > q.rev) push(FILES.bank, `${path}.answerRev`, 'answerRev 不能大於 rev');
    if (q.status === 'excluded' && (!q.exclusion || q.exclusion.reason === 'check'))
      push(FILES.bank, `${path}.exclusion`, '不收的題要有 conflicting_answer 或 explanation_issue 的原因');
    if (q.status === 'included' && q.exclusion && q.exclusion.reason !== 'check')
      push(FILES.bank, `${path}.status`, `原因是 ${q.exclusion.reason} 的題不能收錄`);
    if (q.exclusion?.reason === 'conflicting_answer' && q.exclusion.related.length === 0)
      push(FILES.bank, `${path}.exclusion.related`, '答案不同的題要指向另一題');
  });
  bank.questions.forEach((q, qi) => {
    for (const r of q.exclusion?.related ?? []) {
      const other = byId.get(r);
      if (!other) push(FILES.bank, `questions.${qi}.exclusion.related`, `相關題 ${r} 不存在`);
      else if (other.id === q.id) push(FILES.bank, `questions.${qi}.exclusion.related`, '相關題不能是自己');
    }
  });
  decks.exclusions.forEach((ex, i) => {
    if (!deckById.has(ex.deck)) push(FILES.decks, `exclusions.${i}.deck`, `講義 ${ex.deck} 不在 decks 裡`);
    if (!slideKeys.has(`${ex.deck}:${ex.slide}`)) push(FILES.decks, `exclusions.${i}.slide`, `${ex.deck} 第 ${ex.slide} 張不是題目（midterm.json 裡沒有）`);
    for (const r of ex.related ?? [])
      if (!slideKeys.has(`${r.deck}:${r.slide}`)) push(FILES.decks, `exclusions.${i}.related`, `${r.deck} 第 ${r.slide} 張不是題目`);
  });
  return issues;
}

/** 收錄的題（苦練區用）與需要老師看的題（審核頁用）；順序依講義 order 再投影片 */
export function splitHandout(decks: HandoutDecks, bank: HandoutBank): { included: HandoutQuestion[]; review: HandoutQuestion[] } {
  const orderOf = new Map(decks.decks.map((d) => [d.id, d.order]));
  const sorted = [...bank.questions].sort((a, b) => (orderOf.get(a.deck) ?? 0) - (orderOf.get(b.deck) ?? 0) || a.slide - b.slide);
  return { included: sorted.filter((q) => q.status === 'included'), review: sorted.filter((q) => q.exclusion !== undefined) };
}
