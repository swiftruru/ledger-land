// 作答頁的計時接線（03 第 2.10 節）：開始時的時間上限（不計分的關卡與關閉時是 0）、鏡像的 timerEnabled、每秒 tick、
// store 的 setTimerTotal（第一次繪製後讀到「寬鬆」補上時間）與暫停、時間到不自動送出
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { levelTimerMs, mirroredTimerEnabled, startTicker, TICK_MAX_STEP_MS } from '../src/features/quiz/level-timer.ts';
import { scoreSnapshotQuestion } from '../src/features/quiz/scoring.ts';
import { memorySessionCache, setSessionCacheForTests } from '../src/features/quiz/session-cache.ts';
import { DEFAULT_SECONDS_PER_QUESTION } from '../src/features/quiz/timer.ts';
import { SETTINGS_MIRROR_KEY, browserStorageOrNull, mirrorSetting, readMirroredSetting } from '../src/lib/progress/settings-mirror.ts';
import { useQuiz } from '../src/store/quiz.ts';
import { MemoryStorage } from './fixtures.ts';
import { qMulti, qSingle } from './quiz-fixtures.ts';

describe('readMirroredSetting 與 mirroredTimerEnabled', () => {
  it('讀得到 mirrorSetting 寫的值；沒有鏡像、內容壞掉或不是鏡像的鍵回 undefined', () => {
    const storage = new MemoryStorage();
    expect(readMirroredSetting(storage, 'timerEnabled')).toBeUndefined();
    expect(mirroredTimerEnabled(storage)).toBe(false);
    mirrorSetting(storage, 'timerEnabled', true);
    expect(readMirroredSetting(storage, 'timerEnabled')).toBe(true);
    expect(mirroredTimerEnabled(storage)).toBe(true);
    mirrorSetting(storage, 'timerEnabled', false);
    expect(mirroredTimerEnabled(storage)).toBe(false);
    // timerRelaxed 不在鏡像裡：只在進度資料庫，第一次繪製後才讀
    expect(readMirroredSetting(storage, 'timerRelaxed')).toBeUndefined();
    storage.setItem(SETTINGS_MIRROR_KEY, '{壞掉');
    expect(readMirroredSetting(storage, 'timerEnabled')).toBeUndefined();
    storage.setItem(SETTINGS_MIRROR_KEY, '[true]');
    expect(readMirroredSetting(storage, 'timerEnabled')).toBeUndefined();
    storage.setItem(SETTINGS_MIRROR_KEY, JSON.stringify({ timerEnabled: 'yes' }));
    expect(mirroredTimerEnabled(storage)).toBe(false);
    expect(mirroredTimerEnabled(null)).toBe(false);
  });

  it('localStorage 讀取丟出例外時當作關閉；browserStorageOrNull 在存取 localStorage 丟出例外時是 null', () => {
    const throwing = {
      getItem(): string | null {
        throw new Error('SecurityError');
      },
    };
    expect(readMirroredSetting(throwing, 'timerEnabled')).toBeUndefined();
    expect(mirroredTimerEnabled(throwing)).toBe(false);
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      const storage = new MemoryStorage();
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      expect(browserStorageOrNull()).toBe(storage);
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError');
        },
      });
      expect(browserStorageOrNull()).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('levelTimerMs', () => {
  it('關閉時與不計分的關卡是 0；開啟時是每題秒數乘計分題題數，寬鬆加倍；關卡的 timerSeconds 優先', () => {
    expect(levelTimerMs({ scoredCount: 5, enabled: false, relaxed: false })).toBe(0);
    expect(levelTimerMs({ scoredCount: 5, enabled: false, relaxed: true })).toBe(0);
    expect(levelTimerMs({ scoredCount: 4, unscored: true, enabled: true, relaxed: false })).toBe(0);
    expect(levelTimerMs({ scoredCount: 0, unscored: true, timerSeconds: 300, enabled: true, relaxed: true })).toBe(0);
    expect(levelTimerMs({ scoredCount: 5, enabled: true, relaxed: false })).toBe(5 * DEFAULT_SECONDS_PER_QUESTION * 1000);
    expect(levelTimerMs({ scoredCount: 5, unscored: false, enabled: true, relaxed: true })).toBe(5 * DEFAULT_SECONDS_PER_QUESTION * 2 * 1000);
    expect(levelTimerMs({ scoredCount: 5, timerSeconds: 240, enabled: true, relaxed: false })).toBe(240_000);
    expect(levelTimerMs({ scoredCount: 5, timerSeconds: 240, enabled: true, relaxed: true })).toBe(480_000);
    // 沒有計分題、也沒有建議秒數：不計時
    expect(levelTimerMs({ scoredCount: 0, enabled: true, relaxed: false })).toBe(0);
  });
});

describe('startTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('每秒回報經過的整數毫秒；停止後不再回報', () => {
    let t = 1000;
    const seen: number[] = [];
    const stop = startTicker((ms) => seen.push(ms), { now: () => t });
    t += 1000.4;
    vi.advanceTimersByTime(1000);
    t += 999.7;
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([1000, 1000]);
    stop();
    t += 1000;
    vi.advanceTimersByTime(3000);
    expect(seen).toHaveLength(2);
  });

  it('時鐘倒退不回報負數；一次跳很久（裝置睡眠）最多算 TICK_MAX_STEP_MS', () => {
    let t = 0;
    const seen: number[] = [];
    const stop = startTicker((ms) => seen.push(ms), { now: () => t });
    t -= 50;
    vi.advanceTimersByTime(1000);
    t += 60_000;
    vi.advanceTimersByTime(1000);
    stop();
    expect(seen).toEqual([TICK_MAX_STEP_MS]);
  });
});

describe('store 的計時：setTimerTotal、tick、暫停', () => {
  const key = 'level:lv_t3st0001';
  const input = {
    mode: 'level' as const,
    levelId: 'lv_t3st0001',
    levelRev: 1,
    questionIds: [qSingle.id, qMulti.id],
    shuffleSeed: 'a_seed000001',
    startedAt: '2026-10-24T08:00:00+08:00',
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    setSessionCacheForTests(memorySessionCache());
    await useQuiz.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    setSessionCacheForTests(null);
  });

  it('timerTotalMs 為 0 時不計時：tick、暫停與 setTimerTotal 都不動', () => {
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 0 });
    const before = useQuiz.getState().session!;
    expect(before.timer.enabled).toBe(false);
    s.tick(1000);
    s.pause();
    s.setTimerTotal(300_000);
    expect(useQuiz.getState().session).toBe(before);
  });

  it('讀到寬鬆後補上時間：已經用掉的時間不變；暫停中不扣、狀態保留；不是正整數或相同上限時不動', () => {
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 150_000 });
    s.tick(10_000);
    expect(useQuiz.getState().session!.timer).toMatchObject({ enabled: true, totalMs: 150_000, remainingMs: 140_000, paused: false });
    s.setTimerTotal(300_000);
    expect(useQuiz.getState().session!.timer).toMatchObject({ totalMs: 300_000, remainingMs: 290_000, expired: false });
    s.pause();
    s.tick(5000);
    expect(useQuiz.getState().session!.timer).toMatchObject({ remainingMs: 290_000, paused: true });
    const paused = useQuiz.getState().session!;
    s.setTimerTotal(300_000);
    s.setTimerTotal(0);
    s.setTimerTotal(-1);
    s.setTimerTotal(1.5);
    expect(useQuiz.getState().session).toBe(paused);
    // 補時間不會解除暫停
    s.setTimerTotal(450_000);
    expect(useQuiz.getState().session!.timer).toMatchObject({ totalMs: 450_000, remainingMs: 440_000, paused: true });
    s.resume();
    s.tick(1000);
    expect(useQuiz.getState().session!.timer.remainingMs).toBe(439_000);
  });

  it('時間到只標記 expired，不送出也不換題；已確認的題目看回饋時不扣時間', () => {
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 3000 });
    s.select(qSingle.id, 'o_a1b2');
    s.tick(TICK_MAX_STEP_MS);
    const session = useQuiz.getState().session!;
    expect(session.timer).toMatchObject({ remainingMs: 0, expired: true });
    expect(session.currentIndex).toBe(0);
    expect(session.questions[qSingle.id]).toMatchObject({ answer: 'o_a1b2', confirmed: false });
    // 上限往上補到比用掉的時間多：剩餘時間回來、expired 解除
    s.setTimerTotal(10_000);
    expect(useQuiz.getState().session!.timer).toMatchObject({ remainingMs: 7000, expired: false });
    s.confirm(qSingle.id, scoreSnapshotQuestion(qSingle, 'o_a1b2').result);
    s.tick(1000);
    expect(useQuiz.getState().session!.timer.remainingMs).toBe(7000);
  });

  it('用時（timerUsedMs）：只累計有扣時間的 tick（暫停與看回饋不算），時間到之後繼續累計', () => {
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 3000 });
    expect(useQuiz.getState().timerUsedMs).toBe(0);
    s.tick(2000);
    s.pause();
    s.tick(1000);
    expect(useQuiz.getState().timerUsedMs).toBe(2000);
    s.resume();
    s.tick(2000);
    s.tick(1500);
    expect(useQuiz.getState().session!.timer).toMatchObject({ remainingMs: 0, expired: true });
    expect(useQuiz.getState().timerUsedMs).toBe(5500);
    s.select(qSingle.id, 'o_a1b2');
    s.confirm(qSingle.id, scoreSnapshotQuestion(qSingle, 'o_a1b2').result);
    s.tick(1000);
    expect(useQuiz.getState().timerUsedMs).toBe(5500);
    s.tick(0);
    s.tick(-1);
    expect(useQuiz.getState().timerUsedMs).toBe(5500);
  });

  it('單次開啟計時（enableTimer）：沒計時的工作階段從現在起算；已經在計時、上限不是正整數或已完成時不動', () => {
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 0 });
    s.tick(1000);
    expect(useQuiz.getState().timerUsedMs).toBe(0);
    s.enableTimer(0);
    s.enableTimer(1.5);
    expect(useQuiz.getState().session!.timer.enabled).toBe(false);
    s.enableTimer(150_000);
    expect(useQuiz.getState().session!.timer).toEqual({ enabled: true, totalMs: 150_000, remainingMs: 150_000, paused: false, expired: false });
    s.tick(1000);
    const running = useQuiz.getState().session!;
    s.enableTimer(300_000);
    expect(useQuiz.getState().session).toBe(running);
    expect(useQuiz.getState().timerUsedMs).toBe(1000);
  });

  it('用時跟著暫存還原（重新整理後結果頁照樣有用時）；舊版暫存沒有時以已扣掉的時間代替', async () => {
    const cache = memorySessionCache();
    setSessionCacheForTests(cache);
    const s = useQuiz.getState();
    s.begin(key, { ...input, timerTotalMs: 10_000 });
    s.tick(3000);
    await useQuiz.getState().flush();
    expect((await cache.read(key))?.timerUsedMs).toBe(3000);
    // 換成另一個 store 狀態再還原
    useQuiz.setState({ key: null, session: null, timerUsedMs: 0, hydratedKey: null });
    expect(await useQuiz.getState().hydrate(key)).toBe(true);
    expect(useQuiz.getState().timerUsedMs).toBe(3000);
    const entry = (await cache.read(key))!;
    const { timerUsedMs: _drop, ...legacy } = entry;
    await cache.write(legacy);
    useQuiz.setState({ key: null, session: null, timerUsedMs: 0, hydratedKey: null });
    expect(await useQuiz.getState().hydrate(key)).toBe(true);
    expect(useQuiz.getState().timerUsedMs).toBe(3000);
  });
});
