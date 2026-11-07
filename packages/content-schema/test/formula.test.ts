// 會計公式（src/formula.ts）與講義對照檔（src/handout.ts 的 FormulaLinks）：形狀、kind 與 ratioRef、category、label 的配對規則，
// validateBundle 的引用與 en 檢查，對照檔的交叉檢查與換成 hq_ ID。文字都是自己編的。
import { describe, expect, it } from 'vitest';
import { Formula, FormulaLinks, HandoutBank, HandoutDecks, HandoutIds, resolveFormulaLinks, validateBundle, validateFormulaLinks } from '../src/index.ts';

const lt = (zh: string, en = `${zh} (en)`) => ({ 'zh-TW': zh, en });
const base = {
  id: 'fm_t3st0001',
  rev: 1,
  revKind: 'text',
  status: 'published',
  kind: 'ratio',
  termRef: 'tm_t3st0001',
  ratioRef: 'roe',
  formula: lt('本期淨利 ÷ 股東權益'),
  components: [
    { term: 'tm_t3st0002', meaning: lt('最後賺到的錢') },
    { label: lt('股價'), meaning: lt('不在報表裡') },
  ],
  example: lt('{{money:240000}} ÷ {{money:1200000}} ＝ {{percent:0.2|digits=0}}'),
  reading: lt('越高越好，但要看是不是靠借錢。'),
};
const messages = (data: unknown) => {
  const r = Formula.safeParse(data);
  return r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
};

describe('Formula schema', () => {
  it('指標類：有 ratioRef、沒有 category 與 label；可列 versions', () => {
    expect(messages(base)).toBe('');
    expect(messages({ ...base, versions: [{ version: 'slides03', formula: lt('平均權益版') }] })).toBe('');
    expect(messages({ ...base, ratioRef: undefined })).toContain('ratioRef');
    expect(messages({ ...base, category: 'profitability' })).toContain('category');
    expect(messages({ ...base, label: lt('別名') })).toContain('label');
    expect(
      messages({
        ...base,
        versions: [
          { version: 'slides03', formula: lt('a') },
          { version: 'slides03', formula: lt('b') },
        ],
      }),
    ).toContain('同一個版本');
    expect(messages({ ...base, versions: [{ version: 'slides09', formula: lt('a') }] })).toContain('versions.0.version');
  });
  it('報表關係類：有 category、沒有 ratioRef；label 可選', () => {
    const rel = { ...base, kind: 'relation', ratioRef: undefined, category: 'statement', label: lt('損益表的五層利益') };
    expect(messages(rel)).toBe('');
    expect(messages({ ...rel, category: undefined })).toContain('category');
    expect(messages({ ...rel, ratioRef: 'roe' })).toContain('ratioRef');
  });
  it('strict：多餘欄位、沒有 term 也沒有 label 的項目、related 重複或指向自己都擋', () => {
    expect(messages({ ...base, slides: [3] })).not.toBe('');
    expect(messages({ ...base, components: [{ meaning: lt('x') }] })).toContain('label');
    expect(messages({ ...base, related: ['fm_t3st0002', 'fm_t3st0002'] })).toContain('related');
    expect(messages({ ...base, related: ['fm_t3st0001'] })).toContain('自己');
  });
});

describe('validateBundle 的公式規則', () => {
  const term = (id: string) => ({
    file: `content/terms/${id}.json`,
    data: {
      id,
      rev: 1,
      revKind: 'text',
      status: 'published',
      category: 'ratio',
      label: lt('名詞'),
      teacherLabel: '名詞',
      currentTwLabel: null,
      ifrsEnglish: 'Term',
      aliases: { 'zh-TW': [], en: [] },
      flags: [],
      confidence: 'high',
      pendingRefs: [],
      definition: lt('定義'),
    },
  });
  const chapters: { file: string; data: unknown }[] = [];
  it('termRef、components 的 term 與 related 都要存在；published 要有 en；全站 ID 不重複', () => {
    const ok = validateBundle({
      terms: [term('tm_t3st0001'), term('tm_t3st0002')],
      chapters,
      formulas: [{ file: 'content/formulas/fm_t3st0001.json', data: base }],
    });
    expect(ok).toEqual([]);
    const bad = validateBundle({
      terms: [term('tm_t3st0001')],
      chapters,
      formulas: [
        { file: 'content/formulas/fm_t3st0001.json', data: { ...base, related: ['fm_n0n3x1st'], example: { 'zh-TW': '只有中文' } } },
        { file: 'content/formulas/fm_t3st0001b.json', data: { ...base, id: 'tm_t3st0001', kind: 'relation', ratioRef: undefined, category: 'statement' } },
      ],
    });
    const text = bad.map((i) => `${i.path}: ${i.message}`).join('\n');
    expect(text).toContain('components.0.term: 引用不存在的名詞 tm_t3st0002');
    expect(text).toContain('related: 引用不存在的公式 fm_n0n3x1st');
    expect(text).toContain('example.en');
    expect(text).toContain('id:');
  });
});

describe('講義對照檔', () => {
  const decks = HandoutDecks.parse({
    title: '題庫',
    decks: [
      { id: 'd1', order: 1, code: '0-1', title: '第一份', file: 'one.pptx', sections: [{ id: 'd1s1', title: '段一', slides: [2, 9] }] },
      { id: 'd2', order: 2, code: '0-2', title: '第二份', file: 'two.pptx', sections: [{ id: 'd2s1', title: '段一', slides: [3, 6] }] },
    ],
    exclusions: [],
  });
  const ids = HandoutIds.parse({ 'd1:3': 'hq_aaaaaaa1', 'd1:7': 'hq_aaaaaaa2', 'd2:4': 'hq_aaaaaaa3' });
  const q = (id: string, deck: string, section: string, slide: number, status: 'included' | 'excluded') => ({
    id,
    rev: 1,
    revKind: 'text',
    answerRev: 1,
    deck,
    section,
    slide,
    topic: `主題 ${slide}`,
    scenario: '情境。',
    question: '問題？',
    options: [
      { letter: 'A', text: '甲' },
      { letter: 'B', text: '乙' },
      { letter: 'C', text: '丙' },
    ],
    answer: ['B'],
    explanation: '解析。',
    status,
    ...(status === 'excluded' ? { exclusion: { reason: 'explanation_issue', related: [] } } : {}),
  });
  const bank = HandoutBank.parse({
    id: 'midterm',
    rev: 1,
    title: '題庫',
    questions: [q('hq_aaaaaaa1', 'd1', 'd1s1', 3, 'included'), q('hq_aaaaaaa2', 'd1', 'd1s1', 7, 'excluded'), q('hq_aaaaaaa3', 'd2', 'd2s1', 4, 'included')],
  });
  const formulaIds = new Set(['fm_t3st0001', 'fm_t3st0002']);
  const good = {
    links: [
      {
        formula: 'fm_t3st0001',
        sources: [
          { deck: 'd2', slides: [2, 1] },
          { deck: 'd1', slides: [5, 1] },
          { deck: 'd1', slides: [5] },
        ],
        questions: { formula: [{ deck: 'd2', slide: 4 }], numeric: [], concept: [{ deck: 'd1', slide: 3 }] },
      },
    ],
  };
  it('一致時沒有問題；解析後出處依講義排序去重、題目換成 hq_ ID', () => {
    expect(validateFormulaLinks(good, decks, ids, bank, formulaIds)).toEqual([]);
    expect(resolveFormulaLinks(FormulaLinks.parse(good), decks, ids, bank)).toEqual([
      {
        formula: 'fm_t3st0001',
        sources: [
          { deck: 'd1', slides: [1, 5] },
          { deck: 'd2', slides: [1, 2] },
        ],
        questions: { formula: ['hq_aaaaaaa3'], numeric: [], concept: ['hq_aaaaaaa1'] },
      },
    ]);
  });
  it('公式不存在或重複、講義不存在、不是題目、不收錄的題、同一題兩種關係都要抓到', () => {
    const bad = {
      links: [
        { formula: 'fm_n0n3x1st', sources: [{ deck: 'd9', slides: [1] }], questions: { formula: [], numeric: [], concept: [] } },
        {
          formula: 'fm_t3st0001',
          sources: [{ deck: 'd1', slides: [1] }],
          questions: {
            formula: [{ deck: 'd1', slide: 3 }],
            numeric: [{ deck: 'd1', slide: 3 }],
            concept: [
              { deck: 'd1', slide: 7 },
              { deck: 'd1', slide: 8 },
            ],
          },
        },
        { formula: 'fm_t3st0001', sources: [{ deck: 'd1', slides: [1] }], questions: { formula: [], numeric: [], concept: [] } },
      ],
    };
    const text = validateFormulaLinks(bad, decks, ids, bank, formulaIds)
      .map((i) => `${i.path}: ${i.message}`)
      .join('\n');
    expect(text).toContain('links.0.formula: 公式 fm_n0n3x1st 不存在');
    expect(text).toContain('links.0.sources.0.deck: 講義 d9');
    expect(text).toContain('links.1.questions.numeric.0: d1 第 3 張已經列在 formula');
    expect(text).toContain('links.1.questions.concept.0: d1 第 7 張是不收錄的題');
    expect(text).toContain('links.1.questions.concept.1: d1 第 8 張不是題目');
    expect(text).toContain('links.2.formula: 公式 fm_t3st0001 出現兩次');
  });
});
