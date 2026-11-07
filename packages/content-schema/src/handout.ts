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

/**
 * 講義對照檔 content/handout/formula-links.json（08 的講義題庫一節，2026-11-07）：每一條會計公式在講義裡的出處（講義與投影片）和相關的講義題，
 * 分成三種關係：formula 考這條公式的組成或關係、numeric 情境裡有數字可以拿公式驗算、concept 只考相關概念。
 * 題目用 deck 與 slide 寫（和 decks.json、ids.json 同一套），建置時經 ids.json 換成 hq_ ID。這是講義題庫那一側的檔案，所以可以有投影片號；
 * 原創的 content/formulas/ 不得記錄任何教材頁碼（08 第 1.4 節）。
 */
export const FORMULA_LINK_RELATIONS = ['formula', 'numeric', 'concept'] as const;
export type FormulaLinkRelation = (typeof FORMULA_LINK_RELATIONS)[number];
const FormulaSource = z.object({ deck: z.string().regex(DECK_ID_RE), slides: z.array(slide).min(1) }).strict();
export const FormulaLink = z
  .object({
    formula: idSchema('formula'),
    sources: z.array(FormulaSource).min(1),
    questions: z.object({ formula: z.array(SlideRef), numeric: z.array(SlideRef), concept: z.array(SlideRef) }).strict(),
  })
  .strict();
export type FormulaLink = z.infer<typeof FormulaLink>;
export const FormulaLinks = z.object({ $comment: z.string().optional(), links: z.array(FormulaLink) }).strict();
export type FormulaLinks = z.infer<typeof FormulaLinks>;
const LINKS_FILE = 'content/handout/formula-links.json';

/** 一條公式解析後的對照：出處依講義排序去重，題目換成 hq_ ID（只收錄的題） */
export interface ResolvedFormulaLink {
  formula: string;
  sources: { deck: string; slides: number[] }[];
  questions: Record<FormulaLinkRelation, string[]>;
}

/**
 * 對照檔的形狀與交叉檢查：公式存在且只出現一次、講義存在、題目的投影片在 ids.json 與 midterm.json 都有而且是收錄的題（指到不收的題報錯，不悄悄略過）、
 * 同一題不在兩種關係裡、出處的投影片不重複。decks、ids、bank 要先通過 validateHandout。
 */
export function validateFormulaLinks(
  linksData: unknown,
  decks: HandoutDecks,
  ids: HandoutIds,
  bank: HandoutBank,
  formulaIds: ReadonlySet<string>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const links = parseOrIssues(FormulaLinks, linksData, LINKS_FILE, issues);
  if (!links) return issues;
  const push = (path: string, message: string) => issues.push({ file: LINKS_FILE, path, message, rule: 'handout.formulaLinks' });
  const deckIds = new Set(decks.decks.map((d) => d.id));
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const seenFormula = new Set<string>();
  links.links.forEach((link, li) => {
    const path = `links.${li}`;
    if (!formulaIds.has(link.formula)) push(`${path}.formula`, `公式 ${link.formula} 不存在`);
    if (seenFormula.has(link.formula)) push(`${path}.formula`, `公式 ${link.formula} 出現兩次`);
    seenFormula.add(link.formula);
    link.sources.forEach((s, si) => {
      if (!deckIds.has(s.deck)) push(`${path}.sources.${si}.deck`, `講義 ${s.deck} 不在 decks.json 裡`);
      if (new Set(s.slides).size !== s.slides.length) push(`${path}.sources.${si}.slides`, '出處的投影片重複');
    });
    const seenQuestion = new Map<string, FormulaLinkRelation>();
    for (const relation of FORMULA_LINK_RELATIONS) {
      link.questions[relation].forEach((r, qi) => {
        const qPath = `${path}.questions.${relation}.${qi}`;
        const key = `${r.deck}:${r.slide}`;
        if (!deckIds.has(r.deck)) {
          push(qPath, `講義 ${r.deck} 不在 decks.json 裡`);
          return;
        }
        const id = ids[key];
        const q = id === undefined ? undefined : byId.get(id);
        if (!q) {
          push(qPath, `${r.deck} 第 ${r.slide} 張不是題目（ids.json 或 midterm.json 裡沒有）`);
          return;
        }
        if (q.status !== 'included') push(qPath, `${r.deck} 第 ${r.slide} 張是不收錄的題（${q.exclusion?.reason ?? 'excluded'}），不能列為相關題`);
        const prev = seenQuestion.get(key);
        if (prev !== undefined) push(qPath, `${r.deck} 第 ${r.slide} 張已經列在 ${prev}，同一題只能有一種關係`);
        seenQuestion.set(key, relation);
      });
    }
  });
  return issues;
}

/** 對照檔換成 hq_ ID：出處依講義 order 排、投影片升冪去重；題目依講義順序再投影片，只留收錄的題（驗證過就不會有別的） */
export function resolveFormulaLinks(links: FormulaLinks, decks: HandoutDecks, ids: HandoutIds, bank: HandoutBank): ResolvedFormulaLink[] {
  const orderOf = new Map(decks.decks.map((d) => [d.id, d.order]));
  const included = new Set(bank.questions.filter((q) => q.status === 'included').map((q) => q.id));
  const sortRefs = (refs: readonly { deck: string; slide: number }[]) =>
    [...refs].sort((a, b) => (orderOf.get(a.deck) ?? 0) - (orderOf.get(b.deck) ?? 0) || a.slide - b.slide);
  return links.links.map((link) => {
    const byDeck = new Map<string, Set<number>>();
    for (const s of link.sources) {
      if (!byDeck.has(s.deck)) byDeck.set(s.deck, new Set());
      for (const n of s.slides) byDeck.get(s.deck)!.add(n);
    }
    const sources = [...byDeck.entries()]
      .sort((a, b) => (orderOf.get(a[0]) ?? 0) - (orderOf.get(b[0]) ?? 0))
      .map(([deck, set]) => ({ deck, slides: [...set].sort((a, b) => a - b) }));
    const questions = Object.fromEntries(
      FORMULA_LINK_RELATIONS.map((relation) => [
        relation,
        sortRefs(link.questions[relation])
          .map((r) => ids[`${r.deck}:${r.slide}`])
          .filter((id): id is string => id !== undefined && included.has(id)),
      ]),
    ) as Record<FormulaLinkRelation, string[]>;
    return { formula: link.formula, sources, questions };
  });
}

/** 收錄的題（苦練區用）與需要老師看的題（審核頁用）；順序依講義 order 再投影片 */
export function splitHandout(decks: HandoutDecks, bank: HandoutBank): { included: HandoutQuestion[]; review: HandoutQuestion[] } {
  const orderOf = new Map(decks.decks.map((d) => [d.id, d.order]));
  const sorted = [...bank.questions].sort((a, b) => (orderOf.get(a.deck) ?? 0) - (orderOf.get(b.deck) ?? 0) || a.slide - b.slide);
  return { included: sorted.filter((q) => q.status === 'included'), review: sorted.filter((q) => q.exclusion !== undefined) };
}
