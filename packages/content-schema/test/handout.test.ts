// 講義題庫的 schema 與交叉檢查（src/handout.ts）：三個檔案一致時沒有 issue；段落重疊、題目不在範圍、ID 對照不一致、不收的題沒原因、答案不同的題沒指向另一題都要抓到。
// 題目文字是自己編的。
import { describe, expect, it } from 'vitest';
import { splitHandout, validateHandout } from '../src/index.ts';

const decks = {
  title: '題庫',
  decks: [
    {
      id: 'd1',
      order: 1,
      code: '0-1',
      title: '第一份',
      file: 'one.pptx',
      sections: [
        { id: 'd1s1', title: '段一', slides: [2, 5] },
        { id: 'd1s2', title: '段二', slides: [6, 9] },
      ],
    },
  ],
  exclusions: [{ deck: 'd1', slide: 7, reason: 'check', note: '請老師看一眼。' }],
};
const ids = { 'd1:3': 'hq_aaaaaaa1', 'd1:7': 'hq_aaaaaaa2', 'd1:8': 'hq_aaaaaaa3' };
const base = {
  rev: 1,
  revKind: 'text',
  answerRev: 1,
  deck: 'd1',
  topic: '主題',
  scenario: '情境。',
  question: '問題？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
    { letter: 'C', text: '丙' },
  ],
  explanation: '解析。',
};
const bank = {
  id: 'midterm',
  rev: 1,
  title: '題庫',
  questions: [
    { ...base, id: 'hq_aaaaaaa1', section: 'd1s1', slide: 3, answer: ['A'], status: 'included' },
    {
      ...base,
      id: 'hq_aaaaaaa2',
      section: 'd1s2',
      slide: 7,
      answer: ['B', 'C'],
      status: 'included',
      exclusion: { reason: 'check', note: '請老師看一眼。', related: [] },
    },
    {
      ...base,
      id: 'hq_aaaaaaa3',
      section: 'd1s2',
      slide: 8,
      answer: ['B'],
      status: 'excluded',
      exclusion: { reason: 'explanation_issue', note: '解析有錯字。', related: [] },
    },
  ],
};
const messages = (issues: { message: string }[]) => issues.map((i) => i.message);

describe('validateHandout', () => {
  it('一致的三個檔案沒有 issue；splitHandout 分出收錄與審核', () => {
    expect(validateHandout(decks, ids, bank)).toEqual([]);
    const { included, review } = splitHandout(decks as never, bank as never);
    expect(included.map((q) => q.id)).toEqual(['hq_aaaaaaa1', 'hq_aaaaaaa2']);
    expect(review.map((q) => q.id)).toEqual(['hq_aaaaaaa2', 'hq_aaaaaaa3']);
  });

  it('形狀錯誤：少欄位、字母不對、ID 格式', () => {
    const bad = { ...bank, questions: [{ ...bank.questions[0], id: 'q_aaaaaaa1', options: bank.questions[0]!.options.slice(0, 2) }] };
    const issues = validateHandout(decks, ids, bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.file === 'content/handout/midterm.json')).toBe(true);
  });

  it('交叉檢查：段落重疊、不在範圍、ID 對照不一致、不收沒原因、答案不同沒相關題、exclusions 指到不是題目的投影片', () => {
    const overlapping = { ...decks, decks: [{ ...decks.decks[0], sections: [decks.decks[0]!.sections[0], { id: 'd1s2', title: '段二', slides: [5, 9] }] }] };
    expect(messages(validateHandout(overlapping, ids, bank))).toContainEqual(expect.stringContaining('重疊'));
    const outside = { ...bank, questions: [{ ...bank.questions[0], slide: 1 }, ...bank.questions.slice(1)] };
    expect(messages(validateHandout(decks, { ...ids, 'd1:1': 'hq_aaaaaaa1' }, outside))).toContainEqual(expect.stringContaining('不在 d1 任何一段'));
    expect(messages(validateHandout(decks, { ...ids, 'd1:3': 'hq_zzzzzzz9' }, bank))).toContainEqual(expect.stringContaining('ids.json 的 d1:3'));
    const noReason = { ...bank, questions: [{ ...bank.questions[2], exclusion: undefined }] };
    expect(messages(validateHandout(decks, ids, { ...noReason, questions: [...bank.questions.slice(0, 2), noReason.questions[0]] }))).toContainEqual(
      expect.stringContaining('不收的題要有'),
    );
    const conflict = { ...bank.questions[2], exclusion: { reason: 'conflicting_answer', note: 'x', related: [] } };
    expect(messages(validateHandout(decks, ids, { ...bank, questions: [...bank.questions.slice(0, 2), conflict] }))).toContainEqual(
      expect.stringContaining('指向另一題'),
    );
    const badEx = { ...decks, exclusions: [{ deck: 'd1', slide: 4, reason: 'check', note: 'x' }] };
    expect(messages(validateHandout(badEx, ids, bank))).toContainEqual(expect.stringContaining('不是題目'));
    const includedButIssue = { ...bank.questions[2], status: 'included' };
    expect(messages(validateHandout(decks, ids, { ...bank, questions: [...bank.questions.slice(0, 2), includedButIssue] }))).toContainEqual(
      expect.stringContaining('不能收錄'),
    );
  });
});

describe('CSV 講義（2026-11-08）', () => {
  const csvDeck = {
    id: 'd4',
    order: 4,
    code: 'c',
    title: '老師的 CSV',
    file: 'teacher.csv',
    source: 'csv',
    sections: [
      { id: 'd4s1', title: '財務結構' },
      { id: 'd4s2', title: '償債能力' },
    ],
  };
  const both = { ...decks, decks: [...decks.decks, csvDeck] };
  const csvIds = { ...ids, 'd4:kaaaaaaaaaaaa': 'hq_aaaaaaa4', 'd4:kbbbbbbbbbbbb': 'hq_aaaaaaa5' };
  const five = ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `選項 ${letter}` }));
  const csvQ = {
    ...base,
    id: 'hq_aaaaaaa4',
    deck: 'd4',
    section: 'd4s1',
    slide: 3,
    key: 'kaaaaaaaaaaaa',
    scenario: '',
    options: five,
    answer: ['E'],
    status: 'included',
  };
  const tf = {
    ...base,
    id: 'hq_aaaaaaa5',
    deck: 'd4',
    section: 'd4s2',
    slide: 4,
    key: 'kbbbbbbbbbbbb',
    options: [
      { letter: 'A', text: '是' },
      { letter: 'B', text: '否' },
    ],
    answer: ['B'],
    status: 'included',
  };
  const csvBank = { ...bank, questions: [...bank.questions, csvQ, tf] };

  it('五個選項、兩個選項、空情境、雜湊鍵都通過；splitHandout 依講義順序再列號', () => {
    expect(validateHandout(both, csvIds, csvBank)).toEqual([]);
    const { included } = splitHandout(both as never, csvBank as never);
    expect(included.map((q) => q.id)).toEqual(['hq_aaaaaaa1', 'hq_aaaaaaa2', 'hq_aaaaaaa4', 'hq_aaaaaaa5']);
  });

  it('CSV 講義的段不能有投影片範圍、title 不能重複；pptx 講義的段一定要有範圍；檔名要對上來源', () => {
    const withSlides = { ...both, decks: [decks.decks[0], { ...csvDeck, sections: [{ id: 'd4s1', title: '財務結構', slides: [1, 2] }, csvDeck.sections[1]] }] };
    expect(messages(validateHandout(withSlides, csvIds, csvBank))).toContainEqual(expect.stringContaining('沒有投影片範圍'));
    const dupTitle = { ...both, decks: [decks.decks[0], { ...csvDeck, sections: [csvDeck.sections[0], { id: 'd4s2', title: '財務結構' }] }] };
    expect(messages(validateHandout(dupTitle, csvIds, csvBank))).toContainEqual(expect.stringContaining('重複'));
    const pptxNoSlides = { ...decks, decks: [{ ...decks.decks[0], sections: [{ id: 'd1s1', title: '段一' }] }] };
    expect(messages(validateHandout(pptxNoSlides, ids, bank))).toContainEqual(expect.stringContaining('要有投影片範圍'));
    const wrongFile = { ...both, decks: [decks.decks[0], { ...csvDeck, file: 'teacher.pptx' }] };
    expect(messages(validateHandout(wrongFile, csvIds, csvBank))).toContainEqual(expect.stringContaining('.csv 結尾'));
  });

  it('CSV 的題要有 key 且對得上 ids.json；段要存在；pptx 的題不能有 key、情境不能空；ids 的鍵形式要對來源', () => {
    const noKey = { ...csvBank, questions: [...bank.questions, { ...csvQ, key: undefined }, tf] };
    expect(messages(validateHandout(both, csvIds, noKey))).toContainEqual(expect.stringContaining('要有 key'));
    expect(messages(validateHandout(both, { ...csvIds, 'd4:kaaaaaaaaaaaa': 'hq_zzzzzzz9' }, csvBank))).toContainEqual(
      expect.stringContaining('ids.json 的 d4:kaaaaaaaaaaaa'),
    );
    const badSection = { ...csvBank, questions: [...bank.questions, { ...csvQ, section: 'd4s9' }, tf] };
    expect(messages(validateHandout(both, csvIds, badSection))).toContainEqual(expect.stringContaining('段 d4s9 不在'));
    const pptxWithKey = { ...bank, questions: [{ ...bank.questions[0], key: 'kaaaaaaaaaaaa' }, ...bank.questions.slice(1)] };
    expect(messages(validateHandout(decks, ids, pptxWithKey))).toContainEqual(expect.stringContaining('沒有 key'));
    const emptyScenario = { ...bank, questions: [{ ...bank.questions[0], scenario: '' }, ...bank.questions.slice(1)] };
    expect(messages(validateHandout(decks, ids, emptyScenario))).toContainEqual(expect.stringContaining('一定有情境'));
    expect(messages(validateHandout(both, { ...csvIds, 'd4:9': 'hq_aaaaaaa6' }, csvBank))).toContainEqual(expect.stringContaining('d4:k<雜湊>'));
    expect(messages(validateHandout(both, { ...csvIds, 'd1:kaaaaaaaaaaaa': 'hq_aaaaaaa7' }, csvBank))).toContainEqual(expect.stringContaining('<投影片號>'));
  });

  it('exclusions 不能指到 CSV 講義；選項超過五個或字母不對被擋', () => {
    const ex = { ...both, exclusions: [...decks.exclusions, { deck: 'd4', slide: 3, reason: 'check', note: 'x' }] };
    expect(messages(validateHandout(ex, csvIds, csvBank))).toContainEqual(expect.stringContaining('不支援 exclusions'));
    const six = { ...csvBank, questions: [...bank.questions, { ...csvQ, options: [...five, { letter: 'F', text: '六' }] }, tf] };
    expect(validateHandout(both, csvIds, six).some((i) => i.path.includes('options'))).toBe(true);
    const wrongLetter = { ...csvBank, questions: [...bank.questions, { ...csvQ, options: [five[0], five[2]], answer: ['A'] }, tf] };
    expect(messages(validateHandout(both, csvIds, wrongLetter))).toContainEqual(expect.stringContaining('應該是 B'));
  });
});
