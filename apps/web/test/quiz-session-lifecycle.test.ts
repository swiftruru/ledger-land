// 作答工作階段的生命週期（02 第 5 節、03 第 2.10 節）：完成只記一次（依工作階段種子）、從地圖再進已完成的關卡開新的一輪、切換語言留在結果頁；
// 換到別把 key 時先把舊工作階段寫進暫存，回來還原原本的進度；hydrate 互相競速時以最後一次為準；題目答案改版時作廢暫存裡的已確認作答。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memorySessionCache, setSessionCacheForTests, type SessionCache } from '../src/features/quiz/session-cache.ts';
import { isLevelPath, levelEntryAction, noteSessionExit, reviewSessionMatches, revisedQuestionIds, stayedOnPage } from '../src/features/quiz/session-entry.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { SESSION_SAVE_DELAY_MS, useQuiz } from '../src/store/quiz.ts';
import { qMulti, qSingle } from './quiz-fixtures.ts';

const levelA = {
  mode: 'level' as const,
  levelId: 'lv_t3st000a',
  levelRev: 1,
  questionIds: [qSingle.id, qMulti.id],
  shuffleSeed: 'a_seed00000a',
  startedAt: '2026-10-23T08:00:00+08:00',
};
const levelB = { ...levelA, levelId: 'lv_t3st000b', shuffleSeed: 'a_seed00000b' };
const review = { mode: 'review' as const, questionIds: [qSingle.id], shuffleSeed: 'a_seed0000rv', startedAt: '2026-10-23T08:00:00+08:00' };
const KEY_A = 'level:lv_t3st000a';
const KEY_B = 'level:lv_t3st000b';

let cache: SessionCache;

beforeEach(async () => {
  vi.useFakeTimers();
  cache = memorySessionCache();
  setSessionCacheForTests(cache);
  await useQuiz.getState().clear();
});
afterEach(() => {
  vi.useRealTimers();
  setSessionCacheForTests(null);
});

function finish(seed = levelA.shuffleSeed) {
  const s = useQuiz.getState();
  s.begin(KEY_A, { ...levelA, questionIds: [qSingle.id], shuffleSeed: seed });
  s.select(qSingle.id, 'o_a1b2');
  s.confirm(qSingle.id, scoreSnapshotQuestion(qSingle, 'o_a1b2').result);
  s.next();
  expect(useQuiz.getState().session?.completed).toBe(true);
}

describe('完成只記一次（quiz-1）', () => {
  it('claimCompletion：同一個工作階段種子只回 true 一次；begin 與 clear 會重設', async () => {
    finish();
    const s = useQuiz.getState();
    expect(s.claimCompletion(levelA.shuffleSeed)).toBe(true);
    expect(useQuiz.getState().claimCompletion(levelA.shuffleSeed)).toBe(false);
    // 重玩：clear 之後新的工作階段要能再記一次
    await useQuiz.getState().clear();
    expect(useQuiz.getState().recordedSeed).toBeNull();
    finish('a_seed0000a2');
    expect(useQuiz.getState().claimCompletion('a_seed0000a2')).toBe(true);
    useQuiz.getState().begin(KEY_B, levelB);
    expect(useQuiz.getState().recordedSeed).toBeNull();
  });

  it('先前最佳星數跟著工作階段種子存在 store：切換語言重新掛載後仍顯示「保留之前的最佳成績」', () => {
    finish();
    useQuiz.getState().claimCompletion(levelA.shuffleSeed);
    useQuiz.getState().setPreviousBest(levelA.shuffleSeed, 3);
    expect(useQuiz.getState().previousBest).toEqual({ seed: levelA.shuffleSeed, stars: 3 });
    // 別的工作階段的種子不覆蓋
    useQuiz.getState().setPreviousBest('a_seed0other', 1);
    expect(useQuiz.getState().previousBest).toEqual({ seed: levelA.shuffleSeed, stars: 3 });
  });

  it('levelEntryAction：已完成的同一關，沒離開過（切換語言）留在結果頁；離開過（地圖、Tab bar、返回）開新的一輪', () => {
    finish();
    const s = useQuiz.getState();
    expect(levelEntryAction(s, KEY_A, true)).toBe('keep');
    expect(levelEntryAction(s, KEY_A, false)).toBe('restart');
    // 進行中的同一關：不管離開過沒有都接著做
    s.begin(KEY_A, levelA);
    expect(levelEntryAction(useQuiz.getState(), KEY_A, false)).toBe('keep');
    // store 裡是別把 key：從暫存還原
    expect(levelEntryAction(useQuiz.getState(), KEY_B, false)).toBe('restore');
  });

  it('noteSessionExit 與 stayedOnPage：卸載時網址還在同一關（切換語言）才算沒離開；去過別頁就不是', () => {
    noteSessionExit(KEY_A, isLevelPath('/en/level/lv_t3st000a/', 'lv_t3st000a'));
    expect(stayedOnPage(KEY_A)).toBe(true);
    expect(stayedOnPage(KEY_B)).toBe(false);
    noteSessionExit(KEY_A, isLevelPath('/play/', 'lv_t3st000a'));
    expect(stayedOnPage(KEY_A)).toBe(false);
  });

  it('isLevelPath：兩種語言、有沒有結尾斜線都認得；別關或別頁不算', () => {
    expect(isLevelPath('/level/lv_t3st000a/', 'lv_t3st000a')).toBe(true);
    expect(isLevelPath('/en/level/lv_t3st000a', 'lv_t3st000a')).toBe(true);
    expect(isLevelPath('/level/lv_t3st000b/', 'lv_t3st000a')).toBe(false);
    expect(isLevelPath('/me/', 'lv_t3st000a')).toBe(false);
    expect(isLevelPath('/terms/tm_t3st0001/', 'lv_t3st000a')).toBe(false);
  });
});

describe('換到別把 key 再回來（quiz-2）', () => {
  it('關卡 A 作答到一半去錯題本，再 hydrate A：還原原本的答案與種子，不重新開始', async () => {
    const s = useQuiz.getState();
    s.begin(KEY_A, levelA);
    s.select(qSingle.id, 'o_a1b2');
    await useQuiz.getState().flush();
    useQuiz.getState().begin('review', review);
    expect(await useQuiz.getState().hydrate(KEY_A)).toBe(true);
    const restored = useQuiz.getState();
    expect(restored.key).toBe(KEY_A);
    expect(restored.session?.shuffleSeed).toBe(levelA.shuffleSeed);
    expect(restored.session?.questions[qSingle.id]?.answer).toBe('o_a1b2');
    expect(restored.hydratedKey).toBe(KEY_A);
  });

  it('select 之後 400 ms 內 begin 別把 key：舊工作階段還沒寫出的變動先寫進暫存', async () => {
    const s = useQuiz.getState();
    s.begin(KEY_A, levelA);
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DELAY_MS + 10);
    useQuiz.getState().select(qSingle.id, 'o_c3d4');
    useQuiz.getState().begin('review', review);
    await vi.advanceTimersByTimeAsync(0);
    expect((await cache.read(KEY_A))?.session.questions[qSingle.id]?.answer).toBe('o_c3d4');
  });

  it('hydrate 別把 key 時先寫出 store 裡的工作階段（錯題本的暫存不被丟掉）', async () => {
    useQuiz.getState().begin(KEY_A, levelA);
    await useQuiz.getState().flush();
    useQuiz.getState().begin('review', review);
    useQuiz.getState().select(qSingle.id, 'o_a1b2');
    expect(await useQuiz.getState().hydrate(KEY_A)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect((await cache.read('review'))?.session.questions[qSingle.id]?.answer).toBe('o_a1b2');
  });

  it('同時 hydrate A 與 B：先 resolve 的 A 不覆蓋 store，B 正確還原', async () => {
    useQuiz.getState().begin(KEY_A, levelA);
    await useQuiz.getState().flush();
    useQuiz.getState().begin(KEY_B, levelB);
    await useQuiz.getState().flush();
    await useQuiz.getState().clear();
    // clear 會刪掉 B 的暫存，重新寫回
    useQuiz.getState().begin(KEY_B, levelB);
    await useQuiz.getState().flush();
    useQuiz.setState({ key: null, session: null, hydratedKey: null });
    // A 的讀取比較慢
    const read = cache.read.bind(cache);
    vi.spyOn(cache, 'read').mockImplementation(async (key) => {
      if (key === KEY_A) await new Promise((r) => setTimeout(r, 50));
      return read(key);
    });
    const a = useQuiz.getState().hydrate(KEY_A);
    const b = useQuiz.getState().hydrate(KEY_B);
    expect(await b).toBe(true);
    await vi.advanceTimersByTimeAsync(60);
    expect(await a).toBe(false);
    expect(useQuiz.getState().key).toBe(KEY_B);
    expect(useQuiz.getState().session?.shuffleSeed).toBe(levelB.shuffleSeed);
  });
});

describe('題目答案改版時作廢暫存裡的已確認作答（quiz-6）', () => {
  it('begin 記下每題的 answerRev，隨暫存寫入與還原', async () => {
    useQuiz.getState().begin(KEY_A, levelA, { answerRevs: { [qSingle.id]: 1, [qMulti.id]: 2 } });
    await useQuiz.getState().flush();
    expect((await cache.read(KEY_A))?.answerRevs).toEqual({ [qSingle.id]: 1, [qMulti.id]: 2 });
    useQuiz.setState({ key: null, session: null, hydratedKey: null, answerRevs: {} });
    await useQuiz.getState().hydrate(KEY_A);
    expect(useQuiz.getState().answerRevs).toEqual({ [qSingle.id]: 1, [qMulti.id]: 2 });
  });

  it('revisedQuestionIds：只算暫存有記錄、而且和現在的快照不同的題目（舊暫存沒有記錄的不動）', () => {
    const now = new Map([
      [qSingle.id, 2],
      [qMulti.id, 1],
    ]);
    expect(revisedQuestionIds([qSingle.id, qMulti.id], { [qSingle.id]: 1, [qMulti.id]: 1 }, (id) => now.get(id))).toEqual([qSingle.id]);
    expect(revisedQuestionIds([qSingle.id, qMulti.id], {}, (id) => now.get(id))).toEqual([]);
  });

  it('invalidate：改版的題目變回未作答、currentIndex 退回它、attemptIds 與結果都移除；後面已確認的題目照舊', () => {
    const s = useQuiz.getState();
    s.begin(KEY_A, levelA, { answerRevs: { [qSingle.id]: 1, [qMulti.id]: 1 } });
    s.select(qSingle.id, 'o_a1b2');
    s.confirm(qSingle.id, scoreSnapshotQuestion(qSingle, 'o_a1b2').result);
    s.markAttempt(qSingle.id, 'a_0123456789ab');
    s.next();
    s.select(qMulti.id, ['o_p1a1']);
    s.confirm(qMulti.id, scoreSnapshotQuestion(qMulti, ['o_p1a1']).result);
    expect(useQuiz.getState().session?.currentIndex).toBe(1);
    useQuiz.getState().invalidate([qSingle.id], { [qSingle.id]: 2, [qMulti.id]: 1 });
    const after = useQuiz.getState();
    expect(after.session?.currentIndex).toBe(0);
    expect(after.session?.questions[qSingle.id]).toEqual({ confirmed: false, explanationOpen: false });
    expect(after.attemptIds[qSingle.id]).toBeUndefined();
    expect(after.results[qSingle.id]).toBeUndefined();
    expect(after.session?.questions[qMulti.id]?.confirmed).toBe(true);
    expect(after.answerRevs).toEqual({ [qSingle.id]: 2, [qMulti.id]: 1 });
  });
});

describe('錯題本的工作階段比對（quiz-3）', () => {
  it('題目與順序相同、而且是今天開始的才沿用；昨天的工作階段重新開始', () => {
    const session = { questionIds: ['q_aaaaaaaa', 'q_bbbbbbbb'], startedAt: '2026-10-23T22:00:00+08:00' };
    expect(reviewSessionMatches(session, ['q_aaaaaaaa', 'q_bbbbbbbb'], '2026-10-23')).toBe(true);
    expect(reviewSessionMatches(session, ['q_aaaaaaaa', 'q_bbbbbbbb'], '2026-10-24')).toBe(false);
    expect(reviewSessionMatches(session, ['q_bbbbbbbb'], '2026-10-23')).toBe(false);
    expect(reviewSessionMatches(session, ['q_bbbbbbbb', 'q_aaaaaaaa'], '2026-10-23')).toBe(false);
  });
});
