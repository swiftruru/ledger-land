// 講義題庫的組裝（tools/lib/handout-bank.mjs）：配 ID 只在第一次、rev 與 answerRev 的規則、合併時保留別的講義的題、差異摘要。題目文字是自己編的。
import { describe, expect, it } from 'vitest';
import { assignIds, buildQuestions, diffDeck, mergeBank, textKey } from '../lib/handout-bank.mjs';

const decks = {
  title: '題庫',
  decks: [
    { id: 'd1', order: 1, code: '0-1', title: 'pptx', file: 'a.pptx', sections: [{ id: 'd1s1', title: '段', slides: [1, 9] }] },
    { id: 'd4', order: 4, code: 'c', title: 'csv', file: 'b.csv', source: 'csv', sections: [{ id: 'd4s1', title: '全部' }] },
  ],
};
const q = (question: string, answer: string[] = ['A'], explanation = '解析。') => ({
  topic: question,
  scenario: '',
  question,
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
  ],
  answer,
  explanation,
});
const rec = (deck: (typeof decks.decks)[number], slide: number, idKey: string, question: ReturnType<typeof q>, key?: string) => ({
  deck,
  slide,
  question,
  idKey,
  ...(key ? { key } : {}),
  exclusion: null,
  sectionId: deck.sections[0]!.id,
});
let seed = 1;
const random = () => {
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
};

describe('handout-bank', () => {
  it('assignIds 只給還沒有鍵的紀錄新 ID，不重複、不改既有的', () => {
    const ids: Record<string, string> = { 'd1:3': 'hq_aaaaaaa1' };
    const records = [rec(decks.decks[0]!, 3, 'd1:3', q('甲')), rec(decks.decks[1]!, 3, 'd4:k0123456789ab', q('乙'), 'k0123456789ab')];
    const newKeys = assignIds(records, ids, random);
    expect(newKeys).toEqual(['d4:k0123456789ab']);
    expect(ids['d1:3']).toBe('hq_aaaaaaa1');
    expect(ids['d4:k0123456789ab']).toMatch(/^hq_[0-9a-hjkmnp-tv-z]{8}$/);
    expect(assignIds(records, ids, random)).toEqual([]);
  });

  it('buildQuestions：第一次 rev 1；文字改 rev 加 1；答案改 rev 與 answerRev 都加 1、revKind answer；CSV 的題帶 key', () => {
    const ids = { 'd4:kaaaaaaaaaaaa': 'hq_aaaaaaa1', 'd4:kbbbbbbbbbbbb': 'hq_aaaaaaa2', 'd4:kcccccccccccc': 'hq_aaaaaaa3' };
    const d4 = decks.decks[1]!;
    const first = buildQuestions(
      [
        rec(d4, 3, 'd4:kaaaaaaaaaaaa', q('一'), 'kaaaaaaaaaaaa'),
        rec(d4, 4, 'd4:kbbbbbbbbbbbb', q('二'), 'kbbbbbbbbbbbb'),
        rec(d4, 5, 'd4:kcccccccccccc', q('三'), 'kcccccccccccc'),
      ],
      ids,
      new Map(),
      (r) => r.sectionId ?? '',
    );
    expect(first.map((x) => [x.id, x.rev, x.answerRev, x.revKind, x.status, x.key, x.section])).toEqual([
      ['hq_aaaaaaa1', 1, 1, 'text', 'included', 'kaaaaaaaaaaaa', 'd4s1'],
      ['hq_aaaaaaa2', 1, 1, 'text', 'included', 'kbbbbbbbbbbbb', 'd4s1'],
      ['hq_aaaaaaa3', 1, 1, 'text', 'included', 'kcccccccccccc', 'd4s1'],
    ]);
    const previousById = new Map(first.map((x) => [x.id, x]));
    const second = buildQuestions(
      [
        rec(d4, 3, 'd4:kaaaaaaaaaaaa', q('一'), 'kaaaaaaaaaaaa'),
        rec(d4, 4, 'd4:kbbbbbbbbbbbb', q('二', ['A'], '解析改了。'), 'kbbbbbbbbbbbb'),
        rec(d4, 5, 'd4:kcccccccccccc', q('三', ['B']), 'kcccccccccccc'),
      ],
      ids,
      previousById,
      (r) => r.sectionId ?? '',
    );
    expect(second.map((x) => [x.rev, x.answerRev, x.revKind])).toEqual([
      [1, 1, 'text'],
      [2, 1, 'text'],
      [2, 2, 'answer'],
    ]);
    expect(textKey(first[1]!)).not.toBe(textKey(second[1]!));
    const diff = diffDeck(first, second.slice(0, 2));
    expect(Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.map((x) => x.id)]))).toEqual({
      new: [],
      text: ['hq_aaaaaaa2'],
      answer: [],
      removed: ['hq_aaaaaaa3'],
      unchanged: ['hq_aaaaaaa1'],
    });
  });

  it('mergeBank 保留不是這次重建的講義、依講義順序排、整份有變才加 rev；沒變就不加', () => {
    const pptxQ = { id: 'hq_p0000001', rev: 1, revKind: 'text', answerRev: 1, deck: 'd1', section: 'd1s1', slide: 3, ...q('舊'), status: 'included' };
    const previous = { id: 'midterm', rev: 2, title: '題庫', questions: [pptxQ] };
    const csvQ = {
      id: 'hq_c0000001',
      rev: 1,
      revKind: 'text',
      answerRev: 1,
      deck: 'd4',
      section: 'd4s1',
      slide: 3,
      key: 'kaaaaaaaaaaaa',
      ...q('新'),
      status: 'included',
    };
    const merged = mergeBank(previous, decks, new Set(['d4']), [csvQ]);
    expect(merged.changed).toBe(true);
    expect(merged.bank.rev).toBe(3);
    expect(merged.bank.questions.map((x: { id: string }) => x.id)).toEqual(['hq_p0000001', 'hq_c0000001']);
    const again = mergeBank(merged.bank, decks, new Set(['d1']), [pptxQ]);
    expect(again.changed).toBe(false);
    expect(again.bank.rev).toBe(3);
    const fresh = mergeBank(null, decks, new Set(['d1']), [pptxQ]);
    expect(fresh.bank.rev).toBe(1);
  });
});
