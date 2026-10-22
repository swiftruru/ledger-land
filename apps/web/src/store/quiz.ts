// 作答狀態放在路由外的 store（05 第 7.5 節、09 第 3.1 節）：在中文網址與 /en/ 網址之間切換語言時，題目、已選選項、計時與捲動位置都保留。
// 進度寫入 IndexedDB 在 M2 加入。
import { create } from 'zustand';

interface QuizState {
  levelId: string | null;
  questionId: string | null;
  selected: string | null;
  checked: boolean;
  /** 已累計的作答毫秒數（暫停時保留） */
  elapsedMs: number;
  /** 本段計時的開始時間；null 代表暫停 */
  runningSince: number | null;
  scrollY: number;
  start(levelId: string, questionId: string): void;
  select(optionId: string): void;
  check(): void;
  pause(): void;
  resume(): void;
  setScroll(y: number): void;
  reset(): void;
  elapsedNow(): number;
}

export const useQuiz = create<QuizState>()((set, get) => ({
  levelId: null,
  questionId: null,
  selected: null,
  checked: false,
  elapsedMs: 0,
  runningSince: null,
  scrollY: 0,
  start(levelId, questionId) {
    const s = get();
    if (s.levelId === levelId && s.questionId === questionId) {
      if (s.runningSince === null && !s.checked) set({ runningSince: Date.now() });
      return;
    }
    set({ levelId, questionId, selected: null, checked: false, elapsedMs: 0, runningSince: Date.now(), scrollY: 0 });
  },
  select(optionId) {
    if (!get().checked) set({ selected: optionId });
  },
  check() {
    const s = get();
    if (!s.selected || s.checked) return;
    set({ checked: true, elapsedMs: s.elapsedNow(), runningSince: null });
  },
  pause() {
    const s = get();
    if (s.runningSince !== null) set({ elapsedMs: s.elapsedNow(), runningSince: null });
  },
  resume() {
    const s = get();
    if (s.runningSince === null && !s.checked && s.levelId) set({ runningSince: Date.now() });
  },
  setScroll(y) {
    set({ scrollY: y });
  },
  reset() {
    set({ selected: null, checked: false, elapsedMs: 0, runningSince: Date.now(), scrollY: 0 });
  },
  elapsedNow() {
    const s = get();
    return s.elapsedMs + (s.runningSince === null ? 0 : Date.now() - s.runningSince);
  },
}));
