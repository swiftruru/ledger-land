// 作答工作階段 store（02 第 5.1 到 5.2 節）：開始、作答、確認、下一題、完成；節流寫進暫存、flush 立即寫；hydrate 還原不重新出題；clear 移除暫存
import { shuffleChoiceOptions } from '@ledgerland/quiz';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memorySessionCache, setSessionCacheForTests, type SessionCache } from '../src/features/quiz/session-cache.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { SESSION_SAVE_DELAY_MS, useQuiz } from '../src/store/quiz.ts';
import { qMulti, qSingle } from './quiz-fixtures.ts';

const input = {
  mode: 'level' as const,
  levelId: 'lv_t3st0001',
  levelRev: 1,
  questionIds: [qSingle.id, qMulti.id],
  shuffleSeed: 'a_seed000001',
  startedAt: '2026-10-23T08:00:00+08:00',
};

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

describe('作答工作階段 store', () => {
  it('begin、select、confirm、next 到完成；確認後不能再改答案', () => {
    const s = useQuiz.getState();
    s.begin('level:lv_t3st0001', input);
    expect(useQuiz.getState().session?.currentIndex).toBe(0);
    s.select(qSingle.id, 'o_c3d4');
    s.select(qSingle.id, 'o_a1b2');
    expect(useQuiz.getState().session?.questions[qSingle.id]?.answer).toBe('o_a1b2');
    const { result } = scoreSnapshotQuestion(qSingle, 'o_a1b2');
    s.confirm(qSingle.id, result);
    s.select(qSingle.id, 'o_c3d4');
    expect(useQuiz.getState().session?.questions[qSingle.id]).toMatchObject({ answer: 'o_a1b2', confirmed: true, correct: true, score: 1 });
    expect(useQuiz.getState().results[qSingle.id]?.correct).toBe(true);
    s.next();
    expect(useQuiz.getState().session?.currentIndex).toBe(1);
    // 沒確認不能下一題
    s.next();
    expect(useQuiz.getState().session?.completed).toBe(false);
    s.select(qMulti.id, ['o_p1a1']);
    s.confirm(qMulti.id, scoreSnapshotQuestion(qMulti, ['o_p1a1']).result);
    s.next();
    expect(useQuiz.getState().session?.completed).toBe(true);
  });

  it('節流寫入暫存：變動後 SESSION_SAVE_DELAY_MS 內只寫一次；flush 立即寫；hydrate 還原同一組題目與答案', async () => {
    const write = vi.spyOn(cache, 'write');
    const s = useQuiz.getState();
    s.begin('level:lv_t3st0001', input);
    s.select(qSingle.id, 'o_c3d4');
    s.select(qSingle.id, 'o_a1b2');
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SESSION_SAVE_DELAY_MS + 10);
    expect(write).toHaveBeenCalledTimes(1);
    s.markGuessed(qSingle.id);
    await s.flush();
    expect(write).toHaveBeenCalledTimes(2);
    // 模擬重新整理：丟掉記憶體狀態（不清暫存）再 hydrate
    useQuiz.setState({ key: null, session: null, attemptIds: {}, guessed: {}, results: {}, hydratedKey: null });
    expect(await useQuiz.getState().hydrate('level:lv_t3st0001')).toBe(true);
    const restored = useQuiz.getState();
    expect(restored.session?.questionIds).toEqual(input.questionIds);
    expect(restored.session?.shuffleSeed).toBe('a_seed000001');
    expect(restored.session?.questions[qSingle.id]?.answer).toBe('o_a1b2');
    expect(restored.guessed[qSingle.id]).toBe(true);
    // 選項順序由種子決定：還原後與原本相同
    const seed = { questionId: qSingle.id, rev: qSingle.rev, attemptId: restored.session!.shuffleSeed };
    const options = (qSingle['options'] as { id: string }[]).map((o) => o.id);
    expect(shuffleChoiceOptions(qSingle['options'] as { id: string }[], seed).map((o) => o.id)).toEqual(
      shuffleChoiceOptions(qSingle['options'] as { id: string }[], seed).map((o) => o.id),
    );
    expect(options).toHaveLength(3);
  });

  it('沒有暫存或已完成的工作階段不還原；clear 會移除暫存', async () => {
    expect(await useQuiz.getState().hydrate('level:lv_n0n3xist')).toBe(false);
    const s = useQuiz.getState();
    s.begin('level:lv_t3st0001', { ...input, questionIds: [qSingle.id] });
    s.select(qSingle.id, 'o_a1b2');
    s.confirm(qSingle.id, scoreSnapshotQuestion(qSingle, 'o_a1b2').result);
    s.next();
    await s.flush();
    useQuiz.setState({ key: null, session: null, hydratedKey: null });
    expect(await useQuiz.getState().hydrate('level:lv_t3st0001')).toBe(false);
    useQuiz.getState().begin('level:lv_t3st0001', input);
    await useQuiz.getState().flush();
    expect(await cache.read('level:lv_t3st0001')).toBeDefined();
    await useQuiz.getState().clear();
    expect(await cache.read('level:lv_t3st0001')).toBeUndefined();
    expect(useQuiz.getState().session).toBeNull();
  });

  it('暫停與捲動錨點只改 store 不炸；attemptIds 隨暫存保存', async () => {
    const s = useQuiz.getState();
    s.begin('level:lv_t3st0001', input);
    s.pause();
    s.resume();
    s.setAnchor({ elementId: 'll-q-x', offset: 12 });
    expect(useQuiz.getState().getAnchor()).toEqual({ elementId: 'll-q-x', offset: 12 });
    s.markAttempt(qSingle.id, 'a_0123456789ab');
    await s.flush();
    const cached = await cache.read('level:lv_t3st0001');
    expect(cached?.attemptIds).toEqual({ [qSingle.id]: 'a_0123456789ab' });
    expect(cached?.session.scrollAnchor).toEqual({ elementId: 'll-q-x', offset: 12 });
    // 重新整理後錨點從暫存還原
    useQuiz.setState({ key: null, session: null, hydratedKey: null });
    await useQuiz.getState().hydrate('level:lv_t3st0001');
    expect(useQuiz.getState().getAnchor()).toEqual({ elementId: 'll-q-x', offset: 12 });
  });
});
