// 作答工作階段 store（02 第 5.1 到 5.2 節、03 第 2.11 節、05 第 8.5 節）：放在路由樹之外，所以切換語言（/level/x/ 與 /en/level/x/）、
// 開名詞卡、跳去實驗室再回來都不遺失。狀態轉移全部用 packages/progress 的 QuizSession 純函式；判分在 packages/quiz，由頁面算好再 confirm。
// 每次變動以節流寫進暫存區（features/quiz/session-cache.ts），visibilitychange 轉 hidden 與 pagehide 時立即寫；重新整理後 hydrate 還原，不重新出題。
// 選項順序由 shuffleChoiceOptions(options, { questionId, rev, attemptId: session.shuffleSeed }) 決定，與文字無關，切換語言順序不變。
// store 一次只放一個工作階段：換到別把 key（別關、錯題本）之前先把舊的寫進暫存，回來時 hydrate 還原（02 第 5 節「可隨時回來繼續」）；
// hydrate 與 begin 各有一個世代編號，比較慢的 hydrate 不會蓋掉之後才開始的工作階段。
// 完成關卡只記一次：recordedSeed 是已經寫入完成紀錄的工作階段種子（切換語言重新掛載結果頁時不重記），previousBest 是那次讀到的先前最佳星數。
import {
  confirmAnswer,
  currentQuestionId,
  nextQuestion,
  pauseTimer,
  resumeTimer,
  selectAnswer,
  setScrollAnchor,
  startSession,
  tickTimer,
  type JsonValue,
  type QuizSession,
  type ScrollAnchor,
  type StartSessionInput,
} from '@ledgerland/progress';
import type { ScoreResult } from '@ledgerland/quiz';
import { create } from 'zustand';
import { getSessionCache, type CachedSession } from '../features/quiz/session-cache.ts';

export const SESSION_SAVE_DELAY_MS = 400;

export interface QuizState {
  /** 'level:<levelId>' 或 'review'；null 代表沒有進行中的工作階段 */
  key: string | null;
  session: QuizSession | null;
  /** 已寫入作答紀錄的題目與各自的 attemptId（避免重新整理後重複寫） */
  attemptIds: Record<string, string>;
  guessed: Record<string, true>;
  /** 判分結果，不進暫存（重新整理後由頁面依存下的答案重算） */
  results: Record<string, ScoreResult>;
  /** 目前這題開始作答的時刻（durationMs 用；不進暫存） */
  questionShownAt: number;
  /** 計時開啟後實際作答的毫秒數（tick 有扣時間時才累計：不含暫停與看回饋；時間到之後繼續累計），結果頁顯示用時（03 第 2.10 節） */
  timerUsedMs: number;
  /** 從暫存還原完成（或確認沒有暫存）後等於那把 key */
  hydratedKey: string | null;
  /** 開始時每題的 answerRev（題目 ID 對版本）：還原時和現在的快照比對，答案改版的題目作廢（02 第 3 節第 7 點）；舊暫存沒有時是 {} */
  answerRevs: Record<string, number>;
  /** 已經寫入完成紀錄的工作階段種子（shuffleSeed）；null 代表目前的工作階段還沒記 */
  recordedSeed: string | null;
  /** 完成紀錄寫入時讀到的先前最佳星數（結果頁「保留之前的最佳成績」），跟著工作階段種子 */
  previousBest: { seed: string; stars: 0 | 1 | 2 | 3 } | null;

  /** 從暫存還原同一把 key 的工作階段；沒有或已完成就回 false（由呼叫端 begin）；被之後的 hydrate 或 begin 取代時也回 false */
  hydrate(key: string): Promise<boolean>;
  begin(key: string, input: StartSessionInput, extras?: { answerRevs?: Record<string, number> }): void;
  select(questionId: string, answer: JsonValue, rawInput?: string): void;
  /** 「確認答案」：頁面先用 packages/quiz 判分，這裡只記錄 */
  confirm(questionId: string, result: ScoreResult): void;
  setResult(questionId: string, result: ScoreResult): void;
  markAttempt(questionId: string, attemptId: string): void;
  markGuessed(questionId: string): void;
  next(): void;
  pause(): void;
  resume(): void;
  tick(elapsedMs: number): void;
  /** 改計時上限（開始時先用鏡像的 timerEnabled 起算，第一次繪製後讀到「寬鬆」再補上時間）：已經用掉的時間不變，剩餘時間跟著加減差額；
   *  只調整已開啟的計時；不是正整數時不動 */
  setTimerTotal(totalMs: number): void;
  /** 這一關單次開啟計時（03 第 2.10 節「關卡開始畫面單次開啟」）：不改全站設定；只在還沒計時、還沒完成時有效 */
  enableTimer(totalMs: number): void;
  /** 捲動錨點只放在模組變數、flush 時才併進工作階段（捲動很頻繁，不讓整頁重新繪製） */
  setAnchor(anchor: ScrollAnchor | undefined): void;
  getAnchor(): ScrollAnchor | undefined;
  /** 這個工作階段的完成由呼叫端寫入：第一次回 true（同步記下種子），之後回 false（切換語言重新掛載時不重記） */
  claimCompletion(seed: string): boolean;
  setPreviousBest(seed: string, stars: 0 | 1 | 2 | 3 | undefined): void;
  /** 答案改版的題目變回未作答：移除作答紀錄 ID、猜的標記與判分結果，currentIndex 退回第一題被作廢的題目（下一題只能往前） */
  invalidate(questionIds: readonly string[], answerRevs: Record<string, number>): void;
  /** 丟掉目前的工作階段（結果頁離開或重玩前） */
  clear(): Promise<void>;
  /** 立即寫進暫存（hidden、pagehide） */
  flush(): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let anchor: ScrollAnchor | undefined;
/** hydrate 與 begin 的世代編號：hydrate 讀完暫存時編號變了，代表期間又開始或還原了別的工作階段 */
let generation = 0;

function snapshotOf(s: QuizState): CachedSession | null {
  if (s.key === null || s.session === null) return null;
  return {
    key: s.key,
    session: setScrollAnchor(s.session, anchor),
    attemptIds: s.attemptIds,
    guessed: s.guessed,
    answerRevs: s.answerRevs,
    ...(s.session.timer.enabled ? { timerUsedMs: s.timerUsedMs } : {}),
    savedAt: new Date().toISOString(),
  };
}

export const useQuiz = create<QuizState>()((set, get) => {
  const scheduleSave = () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void get().flush();
    }, SESSION_SAVE_DELAY_MS);
  };
  const update = (next: QuizSession) => {
    set({ session: next });
    scheduleSave();
  };
  return {
    key: null,
    session: null,
    attemptIds: {},
    guessed: {},
    results: {},
    questionShownAt: 0,
    timerUsedMs: 0,
    hydratedKey: null,
    answerRevs: {},
    recordedSeed: null,
    previousBest: null,

    async hydrate(key) {
      const s = get();
      if (s.key === key && s.session !== null) {
        set({ hydratedKey: key });
        return !s.session.completed;
      }
      const gen = ++generation;
      const before = s.key;
      const cached = await getSessionCache().read(key);
      // hydrate 期間又 begin 或又 hydrate 了（使用者已經在別的關卡開始，或兩次 hydrate 競速）：以之後的為準，不覆蓋
      if (gen !== generation || get().key !== before) return false;
      if (cached === undefined || cached.session.completed) {
        set({ hydratedKey: key });
        return false;
      }
      // store 裡是別把 key 的工作階段：先把它還沒寫出的變動寫進暫存（flush 在第一個 await 之前就同步取好快照，連同目前的錨點）
      if (before !== null && before !== key) void get().flush();
      anchor = cached.session.scrollAnchor;
      set({
        key,
        session: cached.session,
        attemptIds: cached.attemptIds,
        guessed: cached.guessed,
        answerRevs: cached.answerRevs ?? {},
        recordedSeed: null,
        previousBest: null,
        results: {},
        questionShownAt: Date.now(),
        // 舊版暫存沒有 timerUsedMs：以已經扣掉的時間代替
        timerUsedMs: cached.timerUsedMs ?? Math.max(0, cached.session.timer.totalMs - cached.session.timer.remainingMs),
        hydratedKey: key,
      });
      return true;
    },
    begin(key, input, extras) {
      ++generation;
      // 換把 key 時，舊工作階段還在節流等待的存檔先寫出（不然下面的 scheduleSave 會把它取消）
      const prevKey = get().key;
      if (prevKey !== null && prevKey !== key && saveTimer !== null) void get().flush();
      anchor = undefined;
      set({
        key,
        session: startSession(input),
        attemptIds: {},
        guessed: {},
        results: {},
        questionShownAt: Date.now(),
        timerUsedMs: 0,
        hydratedKey: key,
        answerRevs: extras?.answerRevs ?? {},
        recordedSeed: null,
        previousBest: null,
      });
      scheduleSave();
    },
    select(questionId, answer, rawInput) {
      const s = get().session;
      if (s === null) return;
      update(selectAnswer(s, questionId, answer, rawInput));
    },
    confirm(questionId, result) {
      const s = get().session;
      if (s === null) return;
      const next = confirmAnswer(s, questionId, { correct: result.correct, score: result.score });
      if (next === s) return;
      set({ session: next, results: { ...get().results, [questionId]: result } });
      scheduleSave();
    },
    setResult(questionId, result) {
      set({ results: { ...get().results, [questionId]: result } });
    },
    markAttempt(questionId, attemptId) {
      set({ attemptIds: { ...get().attemptIds, [questionId]: attemptId } });
      scheduleSave();
    },
    markGuessed(questionId) {
      set({ guessed: { ...get().guessed, [questionId]: true } });
      scheduleSave();
    },
    next() {
      const s = get().session;
      if (s === null) return;
      const next = nextQuestion(s);
      if (next === s) return;
      set({ session: next, questionShownAt: Date.now() });
      // 走到結果頁（completed）就立刻寫暫存，不等 400ms 的節流：結果頁一出現使用者就可能離開，慢的裝置（CI 的 Linux WebKit）在 pagehide 時
      // 來不及寫完，下次進這一關會還原到最後一題的回饋畫面而不是從頭開始（2026-10-26）
      if (next.completed) void get().flush();
      else scheduleSave();
    },
    pause() {
      const s = get().session;
      if (s !== null) update(pauseTimer(s));
    },
    resume() {
      const s = get().session;
      if (s !== null) update(resumeTimer(s));
    },
    tick(elapsedMs) {
      const s = get().session;
      if (s === null || !s.timer.enabled || s.timer.paused || s.completed) return;
      const q = s.questions[currentQuestionId(s)];
      if (q?.confirmed || !Number.isInteger(elapsedMs) || elapsedMs <= 0) return;
      // 時間到之後 remainingMs 停在 0，用時照樣累計（時間到不會自動送出，03 第 2.10 節）
      set({ session: tickTimer(s, elapsedMs), timerUsedMs: get().timerUsedMs + elapsedMs });
      scheduleSave();
    },
    setTimerTotal(totalMs) {
      const s = get().session;
      if (s === null || !s.timer.enabled || !Number.isInteger(totalMs) || totalMs <= 0 || totalMs === s.timer.totalMs) return;
      const used = Math.max(0, s.timer.totalMs - s.timer.remainingMs);
      const remainingMs = Math.max(0, totalMs - used);
      update({ ...s, timer: { ...s.timer, totalMs, remainingMs, expired: remainingMs === 0 } });
    },
    enableTimer(totalMs) {
      const s = get().session;
      if (s === null || s.completed || s.timer.enabled || !Number.isInteger(totalMs) || totalMs <= 0) return;
      set({ session: { ...s, timer: { enabled: true, totalMs, remainingMs: totalMs, paused: false, expired: false } }, timerUsedMs: 0 });
      scheduleSave();
    },
    claimCompletion(seed) {
      if (get().recordedSeed === seed) return false;
      set({ recordedSeed: seed });
      return true;
    },
    setPreviousBest(seed, stars) {
      if (get().recordedSeed !== seed) return;
      set({ previousBest: stars === undefined ? null : { seed, stars } });
    },
    invalidate(questionIds, answerRevs) {
      const s = get().session;
      if (s === null) return;
      const ids = questionIds.filter((id) => s.questions[id] !== undefined);
      if (ids.length === 0) {
        set({ answerRevs });
        scheduleSave();
        return;
      }
      const questions = { ...s.questions };
      const attemptIds = { ...get().attemptIds };
      const guessed = { ...get().guessed };
      const results = { ...get().results };
      for (const id of ids) {
        questions[id] = { confirmed: false, explanationOpen: false };
        delete attemptIds[id];
        delete guessed[id];
        delete results[id];
      }
      const first = Math.min(...ids.map((id) => s.questionIds.indexOf(id)).filter((i) => i >= 0));
      const currentIndex = Math.min(s.currentIndex, first);
      set({ session: { ...s, questions, currentIndex, completed: false }, attemptIds, guessed, results, answerRevs, questionShownAt: Date.now() });
      scheduleSave();
    },
    setAnchor(next) {
      anchor = next;
    },
    getAnchor() {
      return anchor;
    },
    async clear() {
      const key = get().key;
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      anchor = undefined;
      set({
        key: null,
        session: null,
        attemptIds: {},
        guessed: {},
        results: {},
        timerUsedMs: 0,
        hydratedKey: null,
        answerRevs: {},
        recordedSeed: null,
        previousBest: null,
      });
      if (key !== null) await getSessionCache().remove(key);
    },
    async flush() {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const snapshot = snapshotOf(get());
      if (snapshot !== null) await getSessionCache().write(snapshot);
    },
  };
});

let listenersInstalled = false;

/** 頁面隱藏或卸載時立即寫入暫存，計時也跟著暫停（02 第 5.2 節） */
export function installQuizPersistence(): void {
  if (listenersInstalled || typeof document === 'undefined') return;
  listenersInstalled = true;
  const onHidden = () => {
    const s = useQuiz.getState();
    if (s.session === null) return;
    s.pause();
    void s.flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden();
  });
  window.addEventListener('pagehide', onHidden);
}
