// 講義題庫的組裝（08 的講義題庫一節，2026-11-08 抽出來給兩個寫入者共用）：handout-extract.mjs（pptx 講義）與 handout-import.mjs（CSV 講義）
// 各自把來源解析成「紀錄」，這裡負責配 ID、依上一版算 rev 與 answerRev、組成題目、合併回 midterm.json。純函式：不讀檔不寫檔。
//
// 一筆紀錄 Rec：{ deck（decks.json 的那一份）, slide（pptx 是投影片號、CSV 是資料列號）, question（topic、scenario、question、options、answer、explanation）,
//   idKey（ids.json 的鍵：pptx 是 d1:16、CSV 是 d4:k<雜湊>）, key?（CSV 的題才有，寫進題目的 key 欄位）, exclusion（null 或 { reason, note?, relatedKeys }）}
import { generateId } from '@ledgerland/content-schema';

/** @typedef {{ reason: string; note?: string; relatedKeys: string[] }} Exclusion */
/** @typedef {{ deck: any; slide: number; question: any; idKey: string; key?: string; exclusion: Exclusion | null; sectionId?: string }} Rec */

/** 一題的正規化文字（算 rev 用，不含答案與 rev 欄位） */
export const textKey = (q) => JSON.stringify([q.topic, q.scenario, q.question, q.options.map((o) => [o.letter, o.text]), q.explanation]);
export const answerKey = (q) => q.answer.join('/');

/**
 * 配 ID：鍵第一次出現時才產生，之後永不改變；回傳新產生的鍵。會改 ids。
 * @param {Rec[]} records
 * @param {Record<string, string>} ids
 * @param {() => number} [random]
 */
export function assignIds(records, ids, random = Math.random) {
  const newKeys = [];
  const taken = new Set(Object.values(ids));
  for (const rec of records) {
    if (ids[rec.idKey]) continue;
    let id = generateId('handoutQuestion', random);
    while (taken.has(id)) id = generateId('handoutQuestion', random);
    ids[rec.idKey] = id;
    taken.add(id);
    newKeys.push(rec.idKey);
  }
  return newKeys;
}

/**
 * 紀錄組成題目：rev 與 answerRev 依上一版（同 ID）的差異遞增；status 由 exclusion 決定；exclusion.related 經 ids 換成 hq_ ID。
 * @param {Rec[]} records 已配好 ID
 * @param {Record<string, string>} ids
 * @param {Map<string, any>} previousById 上一版 midterm.json 的題目，依 ID
 * @param {(rec: Rec) => string} sectionIdOf
 */
export function buildQuestions(records, ids, previousById, sectionIdOf) {
  return records.map((rec) => {
    const id = ids[rec.idKey];
    if (!id) throw new Error(`handout：${rec.idKey} 還沒有 ID`);
    const prev = previousById.get(id);
    const draft = rec.question;
    let rev = 1;
    let answerRev = 1;
    let revKind = 'text';
    if (prev) {
      rev = prev.rev;
      answerRev = prev.answerRev;
      revKind = prev.revKind;
      const textChanged = textKey(prev) !== textKey(draft);
      const answerChanged = answerKey(prev) !== answerKey(draft);
      if (textChanged || answerChanged) rev += 1;
      if (answerChanged) {
        answerRev += 1;
        revKind = 'answer';
      } else if (textChanged) revKind = 'text';
    }
    /** @type {Record<string, any>} */
    const out = {
      id,
      rev,
      revKind,
      answerRev,
      deck: rec.deck.id,
      section: sectionIdOf(rec),
      slide: rec.slide,
      ...(rec.key ? { key: rec.key } : {}),
      topic: draft.topic,
      scenario: draft.scenario,
      question: draft.question,
      options: draft.options,
      answer: draft.answer,
      explanation: draft.explanation,
      status: rec.exclusion && rec.exclusion.reason !== 'check' ? 'excluded' : 'included',
    };
    if (rec.exclusion) {
      out.exclusion = {
        reason: rec.exclusion.reason,
        ...(rec.exclusion.note ? { note: rec.exclusion.note } : {}),
        related: rec.exclusion.relatedKeys.map((k) => ids[k]).filter((x) => x !== undefined),
      };
    }
    return out;
  });
}

/**
 * 合併回題庫：上一版裡「不是這次重建的講義」的題原樣保留，加上這次組好的題，依講義 order 再 slide 排序；整份有變時 rev 加 1。
 * @param {any | null} previous 上一版 midterm.json
 * @param {any} decks decks.json
 * @param {Set<string>} rebuiltDecks 這次重建的講義 ID
 * @param {any[]} questions 這次組好的題
 * @returns {{ bank: any; changed: boolean }}
 */
export function mergeBank(previous, decks, rebuiltDecks, questions) {
  const orderOf = new Map(decks.decks.map((d) => [d.id, d.order]));
  const kept = (previous?.questions ?? []).filter((q) => !rebuiltDecks.has(q.deck) && orderOf.has(q.deck));
  const all = [...kept, ...questions].sort((a, b) => (orderOf.get(a.deck) ?? 0) - (orderOf.get(b.deck) ?? 0) || a.slide - b.slide);
  const bank = { id: 'midterm', rev: previous?.rev ?? 1, title: decks.title, questions: all };
  const changed = previous === null || JSON.stringify(previous) !== JSON.stringify(bank);
  if (changed && previous !== null) bank.rev = previous.rev + 1;
  return { bank, changed };
}

/**
 * 一份講義這次和上一版的差異（報告用）：新增、文字改版、答案改版、移除、無變動
 * @param {any[]} previousQuestions 上一版這份講義的題
 * @param {any[]} questions 這次這份講義的題
 */
export function diffDeck(previousQuestions, questions) {
  const prevById = new Map(previousQuestions.map((q) => [q.id, q]));
  const nowIds = new Set(questions.map((q) => q.id));
  /** @type {Record<'new' | 'text' | 'answer' | 'removed' | 'unchanged', any[]>} */
  const out = { new: [], text: [], answer: [], removed: [], unchanged: [] };
  for (const q of questions) {
    const prev = prevById.get(q.id);
    if (!prev) out.new.push(q);
    else if (q.answerRev !== prev.answerRev) out.answer.push(q);
    else if (q.rev !== prev.rev) out.text.push(q);
    else out.unchanged.push(q);
  }
  for (const q of previousQuestions) if (!nowIds.has(q.id)) out.removed.push(q);
  return out;
}
