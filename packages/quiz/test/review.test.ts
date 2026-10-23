// 錯題本（03 第 2.10 節）：Leitner 盒子的升降與 mastered、進入方式、改版規則、今天到期的清單、不經過 Date 的日期運算
import { describe, expect, it } from 'vitest';
import { LEITNER_INTERVAL_DAYS, type ReviewEntry, addDays, dueToday, enterReview, localDateOf, nextReview, onQuestionRevised } from '../src/index.ts';

const Q = 'q_5n2x8k4m';

describe('日期運算', () => {
  it('addDays 跨月、跨年、閏年都正確', () => {
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
    expect(addDays('2026-10-25', 0)).toBe('2026-10-25');
  });
  it('localDateOf 取 ISO 字串的前 10 個字，時區由呼叫端處理；格式不對是程式錯誤', () => {
    expect(localDateOf('2026-10-20T23:59:00+08:00')).toBe('2026-10-20');
    expect(localDateOf('2026-10-20')).toBe('2026-10-20');
    expect(() => localDateOf('20261020')).toThrow(TypeError);
    expect(() => localDateOf('2026-02-30')).toThrow(RangeError);
    expect(() => addDays('x', 1.5)).toThrow(TypeError);
  });
});

describe('enterReview', () => {
  it('答錯自動放進盒子 1，明天到期，wrongCount 1', () => {
    expect(enterReview(Q, 2, '2026-03-05T23:30:00+08:00', 'auto')).toEqual({
      questionId: Q,
      rev: 2,
      box: 1,
      dueAt: '2026-03-06',
      lastResult: 'wrong',
      lastAnsweredAt: '2026-03-05T23:30:00+08:00',
      wrongCount: 1,
      status: 'active',
      addedBy: 'auto',
    });
  });
  it('答對但「我是猜的」也放進盒子 1，lastResult 是 correct、wrongCount 0', () => {
    expect(enterReview(Q, 1, '2026-03-05', 'guessed')).toMatchObject({ box: 1, dueAt: '2026-03-06', lastResult: 'correct', wrongCount: 0, addedBy: 'guessed' });
  });
});

describe('nextReview', () => {
  const start = enterReview(Q, 1, '2026-03-05', 'auto');
  it('間隔是 1、3、7、14 天', () => expect(LEITNER_INTERVAL_DAYS).toEqual([1, 3, 7, 14]));
  it('連續答對：1 → 2 → 3 → 4 → mastered，到期日依新盒子的間隔', () => {
    const b2 = nextReview(start, 'correct', '2026-03-06');
    expect(b2).toMatchObject({ box: 2, dueAt: '2026-03-09', lastResult: 'correct', status: 'active', wrongCount: 1 });
    const b3 = nextReview(b2, 'correct', '2026-03-09');
    expect(b3).toMatchObject({ box: 3, dueAt: '2026-03-16' });
    const b4 = nextReview(b3, 'correct', '2026-03-16');
    expect(b4).toMatchObject({ box: 4, dueAt: '2026-03-30', status: 'active' });
    const done = nextReview(b4, 'correct', '2026-03-30T08:00:00+08:00');
    expect(done).toMatchObject({ box: 4, status: 'mastered', lastResult: 'correct', lastAnsweredAt: '2026-03-30T08:00:00+08:00' });
  });
  it('答錯回盒子 1、明天到期、wrongCount 加一；盒子 1 答錯留在盒子 1', () => {
    const b3 = nextReview(nextReview(start, 'correct', '2026-03-06'), 'correct', '2026-03-09');
    expect(nextReview(b3, 'wrong', '2026-03-16')).toMatchObject({ box: 1, dueAt: '2026-03-17', wrongCount: 2, lastResult: 'wrong', status: 'active' });
    expect(nextReview(start, 'wrong', '2026-03-06')).toMatchObject({ box: 1, dueAt: '2026-03-07', wrongCount: 2 });
  });
  it('不改變輸入（純函式）；作答後清掉改版標記', () => {
    const copy = { ...start };
    nextReview(start, 'correct', '2026-03-06');
    expect(start).toEqual(copy);
    const flagged = onQuestionRevised(start, 2, 'text');
    expect(flagged.updateKind).toBe('text');
    expect(nextReview(flagged, 'correct', '2026-03-06')).not.toHaveProperty('updateKind');
  });
});

describe('onQuestionRevised', () => {
  const b3: ReviewEntry = { ...enterReview(Q, 1, '2026-03-05', 'auto'), box: 3, dueAt: '2026-03-16' };
  it('答案改版：回盒子 1、標 question_updated、rev 更新、到期日不動', () => {
    expect(onQuestionRevised(b3, 2, 'answer')).toEqual({ ...b3, rev: 2, box: 1, status: 'question_updated', updateKind: 'answer' });
  });
  it('文字改版：保留盒子與狀態，只加小標記', () => {
    expect(onQuestionRevised(b3, 2, 'text')).toEqual({ ...b3, rev: 2, updateKind: 'text' });
  });
  it('已掌握的題目遇到答案改版會回到複習清單', () => {
    const mastered: ReviewEntry = { ...b3, box: 4, status: 'mastered' };
    const back = onQuestionRevised(mastered, 2, 'answer');
    expect(back).toMatchObject({ box: 1, status: 'question_updated' });
    expect(dueToday([back], '2026-03-16')).toHaveLength(1);
  });
  it('rev 沒有變大時原樣回傳', () => {
    expect(onQuestionRevised(b3, 1, 'answer')).toBe(b3);
    expect(onQuestionRevised(b3, 0, 'text')).toBe(b3);
  });
});

describe('dueToday', () => {
  const entry = (id: string, dueAt: string, status: ReviewEntry['status'] = 'active'): ReviewEntry => ({
    ...enterReview(id, 1, '2026-03-01', 'auto'),
    dueAt,
    status,
  });
  it('只列到期且未掌握的，依到期日再依題目 ID 排序', () => {
    const list = [
      entry('q_c3d4e5f6', '2026-03-10'),
      entry('q_a1b2c3d4', '2026-03-10'),
      entry('q_b2c3d4e5', '2026-03-08'),
      entry('q_d4e5f6g7', '2026-03-11'),
      entry('q_e5f6g7h8', '2026-03-01', 'mastered'),
      entry('q_f6g7h8j9', '2026-03-09', 'question_updated'),
    ];
    expect(dueToday(list, '2026-03-10').map((e) => e.questionId)).toEqual(['q_b2c3d4e5', 'q_f6g7h8j9', 'q_a1b2c3d4', 'q_c3d4e5f6']);
    expect(dueToday(list, '2026-03-07')).toEqual([]);
  });
  it('一次最多 10 題，可以改 limit；limit 不合法是程式錯誤', () => {
    const many = Array.from({ length: 12 }, (_, i) => entry(`q_${String(i).padStart(8, '0')}`, '2026-03-01'));
    expect(dueToday(many, '2026-03-02')).toHaveLength(10);
    expect(dueToday(many, '2026-03-02', 3)).toHaveLength(3);
    expect(dueToday(many, '2026-03-02', 0)).toHaveLength(0);
    expect(() => dueToday(many, '2026-03-02', -1)).toThrow(RangeError);
  });
});
