// 作答工作階段 store（02 第 5.1 到 5.2 節、03 第 2.11 節、05 第 8.5 節）：放在路由樹之外，所以切換語言（/level/x/ 與 /en/level/x/）、
// 開名詞卡、跳去實驗室再回來都不遺失。狀態轉移全部用 packages/progress 的 QuizSession 純函式；判分在 packages/quiz，由頁面算好再 confirm。
// 每次變動以節流寫進暫存區（features/quiz/session-cache.ts），visibilitychange 轉 hidden 與 pagehide 時立即寫；重新整理後 hydrate 還原，不重新出題。
// 選項順序由 shuffleChoiceOptions(options, { questionId, rev, attemptId: session.shuffleSeed }) 決定，與文字無關，切換語言順序不變。
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
  /** 從暫存還原完成（或確認沒有暫存）後等於那把 key */
  hydratedKey: string | null;

  /** 從暫存還原同一把 key 的工作階段；沒有或已完成就回 false（由呼叫端 begin） */
  hydrate(key: string): Promise<boolean>;
  begin(key: string, input: StartSessionInput): void;
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
  /** 捲動錨點只放在模組變數、flush 時才併進工作階段（捲動很頻繁，不讓整頁重新繪製） */
  setAnchor(anchor: ScrollAnchor | undefined): void;
  getAnchor(): ScrollAnchor | undefined;
  /** 丟掉目前的工作階段（結果頁離開或重玩前） */
  clear(): Promise<void>;
  /** 立即寫進暫存（hidden、pagehide） */
  flush(): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let anchor: ScrollAnchor | undefined;

function snapshotOf(s: QuizState): CachedSession | null {
  if (s.key === null || s.session === null) return null;
  return { key: s.key, session: setScrollAnchor(s.session, anchor), attemptIds: s.attemptIds, guessed: s.guessed, savedAt: new Date().toISOString() };
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
    hydratedKey: null,

    async hydrate(key) {
      const s = get();
      if (s.key === key && s.session !== null) {
        set({ hydratedKey: key });
        return !s.session.completed;
      }
      const cached = await getSessionCache().read(key);
      if (get().key !== null && get().key !== key) {
        // hydrate 期間使用者已經在別的關卡開始了，不覆蓋
        return false;
      }
      if (cached === undefined || cached.session.completed) {
        set({ hydratedKey: key });
        return false;
      }
      anchor = cached.session.scrollAnchor;
      set({
        key,
        session: cached.session,
        attemptIds: cached.attemptIds,
        guessed: cached.guessed,
        results: {},
        questionShownAt: Date.now(),
        hydratedKey: key,
      });
      return true;
    },
    begin(key, input) {
      anchor = undefined;
      set({ key, session: startSession(input), attemptIds: {}, guessed: {}, results: {}, questionShownAt: Date.now(), hydratedKey: key });
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
      scheduleSave();
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
      if (q?.confirmed) return;
      update(tickTimer(s, elapsedMs));
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
      set({ key: null, session: null, attemptIds: {}, guessed: {}, results: {}, hydratedKey: null });
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
