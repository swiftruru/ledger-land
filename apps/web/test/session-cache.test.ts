// 作答工作階段暫存區（02 第 5.1 到 5.2 節）：讀出來的形狀不是現在的 QuizSession 就當作沒有；結構檢查不帶 zod（06 第 8.2 節的 LCP 預算）。
// IndexedDB 由 fake-indexeddb 提供（test/setup.ts）。
import { startSession } from '@ledgerland/progress';
import { describe, expect, it } from 'vitest';
import { indexedDbSessionCache, isCachedQuizSession, type CachedSession } from '../src/features/quiz/session-cache.ts';

const session = startSession({
  mode: 'level',
  levelId: 'lv_t3st0001',
  levelRev: 1,
  questionIds: ['q_s1ng1e01', 'q_mu1t1001'],
  shuffleSeed: 'a_seed000001',
  startedAt: '2026-10-23T08:00:00+08:00',
});

describe('isCachedQuizSession', () => {
  it('startSession 的輸出與作答中的狀態都通過', () => {
    expect(isCachedQuizSession(session)).toBe(true);
    const answered = {
      ...session,
      currentIndex: 1,
      questions: { q_s1ng1e01: { answer: 'o_a1b2', confirmed: true, correct: true, score: 1, explanationOpen: false } },
      scrollAnchor: { elementId: 'll-q-q_mu1t1001', offset: 12 },
      returnTo: '/terms/tm_t3st0001/',
    };
    expect(isCachedQuizSession(answered)).toBe(true);
    expect(isCachedQuizSession({ ...session, mode: 'review', levelId: undefined, levelRev: undefined })).toBe(true);
  });

  it('形狀不對就不通過：缺欄位、型別錯、currentIndex 超出題目範圍、關卡模式沒有 levelId', () => {
    expect(isCachedQuizSession(undefined)).toBe(false);
    expect(isCachedQuizSession('level:lv_t3st0001')).toBe(false);
    expect(isCachedQuizSession({})).toBe(false);
    expect(isCachedQuizSession({ ...session, mode: 'lab' })).toBe(false);
    expect(isCachedQuizSession({ ...session, questionIds: [] })).toBe(false);
    expect(isCachedQuizSession({ ...session, questionIds: ['q_s1ng1e01', 7] })).toBe(false);
    expect(isCachedQuizSession({ ...session, currentIndex: 2 })).toBe(false);
    expect(isCachedQuizSession({ ...session, currentIndex: 0.5 })).toBe(false);
    expect(isCachedQuizSession({ ...session, shuffleSeed: '' })).toBe(false);
    expect(isCachedQuizSession({ ...session, completed: 'no' })).toBe(false);
    expect(isCachedQuizSession({ ...session, levelId: undefined })).toBe(false);
    expect(isCachedQuizSession({ ...session, levelRev: 0 })).toBe(false);
    expect(isCachedQuizSession({ ...session, questions: { q_s1ng1e01: { confirmed: 'yes', explanationOpen: false } } })).toBe(false);
    expect(isCachedQuizSession({ ...session, questions: { q_s1ng1e01: { confirmed: true, explanationOpen: false, score: 2 } } })).toBe(false);
    expect(isCachedQuizSession({ ...session, timer: { ...session.timer, remainingMs: -1 } })).toBe(false);
    expect(isCachedQuizSession({ ...session, timer: undefined })).toBe(false);
    expect(isCachedQuizSession({ ...session, scrollAnchor: { elementId: 3 } })).toBe(false);
  });
});

describe('indexedDbSessionCache', () => {
  it('寫入後讀得回來；舊版形狀的暫存讀出來是 undefined', async () => {
    const cache = indexedDbSessionCache('ledgerland-session-test');
    const entry: CachedSession = {
      key: 'level:lv_t3st0001',
      session,
      attemptIds: { q_s1ng1e01: 'a_0000000001' },
      guessed: {},
      savedAt: '2026-10-23T08:01:00.000Z',
    };
    await cache.write(entry);
    expect(await cache.read('level:lv_t3st0001')).toEqual(entry);
    // 舊版暫存：沒有 timer 與 completed
    await cache.write({
      key: 'level:lv_0ld00001',
      session: { mode: 'level', questionIds: ['q_s1ng1e01'], currentIndex: 0 } as unknown as typeof session,
      attemptIds: {},
      guessed: {},
      savedAt: '',
    });
    expect(await cache.read('level:lv_0ld00001')).toBeUndefined();
    expect(await cache.read('level:lv_n0n3xist')).toBeUndefined();
    await cache.remove('level:lv_t3st0001');
    expect(await cache.read('level:lv_t3st0001')).toBeUndefined();
  });
});
