// 作答頁的範圍標示（10 第 10 節第 3 項、11 第 1 節）：用代號或 QR 直接進延伸章關卡的學生也要看到「不列入期中考」與「非投資建議」。
// 「非投資建議」由章節檔的 notices 標記（2026-10-24 決定 4），前端不列章節清單。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOT_INVESTMENT_ADVICE, levelNotesOf } from '../src/features/quiz/level-notes.ts';

describe('levelNotesOf', () => {
  it('延伸章或 examScope 為 not_in_exam 時標不列入期中考；主線與資料缺漏時不標', () => {
    expect(levelNotesOf({ scope: 'extension', examScope: 'not_in_exam' })).toEqual({ notInExam: true, investment: false });
    expect(levelNotesOf({ scope: 'core', examScope: 'not_in_exam' }).notInExam).toBe(true);
    expect(levelNotesOf({ scope: 'core', examScope: 'midterm' })).toEqual({ notInExam: false, investment: false });
    expect(levelNotesOf(undefined)).toEqual({ notInExam: false, investment: false });
  });
  it('章節的 notices 含 not_investment_advice 時加非投資建議；沒有 notices 或是其他代號時不加', () => {
    expect(levelNotesOf({ scope: 'extension', examScope: 'not_in_exam', notices: [NOT_INVESTMENT_ADVICE] })).toEqual({ notInExam: true, investment: true });
    expect(levelNotesOf({ scope: 'extension', notices: ['something_else'] }).investment).toBe(false);
    expect(levelNotesOf({ scope: 'extension', examScope: 'not_in_exam' }).investment).toBe(false);
    expect(levelNotesOf({ scope: 'extension', notices: [] }).investment).toBe(false);
  });
});

describe('內容的 notices', () => {
  const chaptersDir = new URL('../../../content/chapters/', import.meta.url);
  const chapters = readdirSync(chaptersDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, chaptersDir), 'utf8')) as { id: string; scope?: string; notices?: string[] });
  it('本益比與估價、融資與資本公積兩章在章節檔標了 not_investment_advice，而且都是延伸章', () => {
    const marked = chapters.filter((c) => c.notices?.includes(NOT_INVESTMENT_ADVICE));
    expect(marked.map((c) => c.id).sort()).toEqual(['ch_155y47', 'ch_x09nq2']);
    for (const c of marked) expect({ id: c.id, scope: c.scope }).toEqual({ id: c.id, scope: 'extension' });
  });
});
