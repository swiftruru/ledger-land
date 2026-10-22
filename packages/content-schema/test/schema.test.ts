import { describe, expect, it } from 'vitest';
import { Chapter, ID_RULES, Term, generateId, idPattern, parsePlaceholders, validateBundle } from '../src/index.ts';

const term = {
  id: 'tm_r4w8n2qe',
  rev: 1,
  revKind: 'text',
  status: 'published',
  category: 'concept',
  label: { 'zh-TW': '資產', en: 'Asset' },
  teacherLabel: '資產',
  currentTwLabel: '資產',
  ifrsEnglish: 'Asset',
  aliases: { 'zh-TW': [], en: ['Assets'] },
  flags: [],
  confidence: 'high',
  pendingRefs: [],
  definition: {
    'zh-TW': '公司擁有或控制、預期在未來會帶來經濟效益的資源。',
    en: 'A resource the business owns or controls and expects to bring future economic benefits.',
  },
};
const chapter = {
  id: 'ch_c5f8w2',
  rev: 1,
  revKind: 'text',
  status: 'published',
  order: 1,
  scope: 'core',
  examScope: 'unconfirmed',
  title: { 'zh-TW': '會計是什麼', en: 'What accounting is' },
  summary: { 'zh-TW': '從一家小店開始。', en: 'Start from a small shop.' },
  objectiveIds: [],
  levelIds: [],
  termRefs: ['tm_r4w8n2qe'],
};

describe('ID 規則（08 第 4.1 節）', () => {
  it('前綴與長度', () => {
    for (const kind of Object.keys(ID_RULES) as (keyof typeof ID_RULES)[]) {
      const id = generateId(kind, () => 0.5);
      expect(idPattern(kind).test(id)).toBe(true);
      expect(id.length).toBe(ID_RULES[kind].prefix.length + ID_RULES[kind].length);
    }
    expect(idPattern('term').test('tm_r4w8n2qi')).toBe(false);
    expect(idPattern('term').test('TM_R4W8N2QE')).toBe(false);
  });
});

describe('Term 與 Chapter', () => {
  it('範例通過', () => {
    expect(Term.safeParse(term).success).toBe(true);
    expect(Chapter.safeParse(chapter).success).toBe(true);
  });
  it('pending 沒有 T 編號、ifrsEnglish 為 null 沒有 ifrsNote 都失敗', () => {
    expect(Term.safeParse({ ...term, confidence: 'pending' }).success).toBe(false);
    expect(Term.safeParse({ ...term, ifrsEnglish: null }).success).toBe(false);
    expect(Term.safeParse({ ...term, ifrsEnglish: null, ifrsNote: { 'zh-TW': 'IFRS 沒有對應。', en: 'No IFRS equivalent.' } }).success).toBe(true);
  });
  it('未知欄位與錯誤的 ID 都失敗', () => {
    expect(Term.safeParse({ ...term, extra: 1 }).success).toBe(false);
    expect(Chapter.safeParse({ ...chapter, id: 'ch_abc' }).success).toBe(false);
  });
});

describe('validateBundle', () => {
  it('乾淨的內容沒有問題', () => {
    expect(validateBundle({ terms: [{ file: 't', data: term }], chapters: [{ file: 'c', data: chapter }] })).toEqual([]);
  });
  it('引用不存在的名詞', () => {
    const issues = validateBundle({ terms: [{ file: 't', data: term }], chapters: [{ file: 'c', data: { ...chapter, termRefs: ['tm_00000000'] } }] });
    expect(issues.some((i) => i.message.includes('不存在的名詞'))).toBe(true);
  });
  it('published 缺 en', () => {
    const issues = validateBundle({ terms: [{ file: 't', data: { ...term, label: { 'zh-TW': '資產' } } }], chapters: [] });
    expect(issues.some((i) => i.path === 'label.en')).toBe(true);
  });
  it('佔位符跨語言不一致', () => {
    const bad = { ...term, definition: { 'zh-TW': '金額 {{money:vars.x}}', en: 'Amount {{money:vars.y}}' } };
    const issues = validateBundle({ terms: [{ file: 't', data: bad }], chapters: [] });
    expect(issues.some((i) => i.message.includes('佔位符集合'))).toBe(true);
    expect(parsePlaceholders('{{money:vars.x|compact}} {{term:tm_a}}')).toEqual([
      { type: 'money', ref: 'vars.x', options: ['compact'] },
      { type: 'term', ref: 'tm_a', options: [] },
    ]);
  });
});
