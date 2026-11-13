// 苦練區的進度統計（M4c）：由 questionState 算某一組題練過幾題、答對率、熟練幾題，以及錯題複習的階段；純函式
// 熟練（M4c 第二批，2026-11-05）：同一題連續答對 MASTERY_STREAK 次；答錯歸零。不熟 = 練過但還沒熟練（含最近答錯的）；沒練過的不算不熟。
// 錯題複習（2026-11-13，維護者決定的「混合」門檻）：答錯過的題分三個階段，待訂正（最近一次答錯）、複習中（答對了但還沒熟練）、已熟練。
// 答錯過 1 次的題照舊連對 MASTERY_STREAK 次就熟練；反覆答錯（累計 REPEAT_WRONG 次以上）的題要連對 REPEAT_STREAK 次，
// 而且最後一次答對要在最近一次答錯的隔天以後（本地日期）。再答錯就回到待訂正。
// 之前存的紀錄沒有「最近一次答錯的時間」：照舊的門檻算，已經熟練的不收回。
import type { QuestionState } from './db.ts';
import { deviceClock, type Clock } from './day.ts';

export const MASTERY_STREAK = 2;
/** 累計答錯幾次算反覆答錯 */
export const REPEAT_WRONG = 2;
/** 反覆答錯的題要連對幾次 */
export const REPEAT_STREAK = 3;
/** 錯題複習一輪最多幾題 */
export const WRONG_ROUND_SIZE = 20;

export interface SetStats {
  total: number;
  practised: number;
  /** 最近一次答錯的題數（待訂正；「錯題歸零」徽章看這個） */
  wrong: number;
  /** 熟練的題數 */
  mastered: number;
  /** 0 到 1；沒練過時 null */
  accuracy: number | null;
}

/** 最近一次答錯的時間；之前存的紀錄可能沒有（最近一次是答錯的就是 lastAt） */
const lastWrongOf = (s: QuestionState): string | undefined => s.lastWrongAt ?? (s.lastCorrect ? undefined : s.lastAt);

/** 反覆答錯：累計答錯 REPEAT_WRONG 次以上，而且知道最近一次是什麼時候錯的（不知道的是舊紀錄，照舊的門檻） */
export const isRepeatWrong = (s: QuestionState): boolean => s.wrong >= REPEAT_WRONG && lastWrongOf(s) !== undefined;

/** 這一題要連對幾次才算熟練 */
export const needOf = (s: QuestionState): number => (isRepeatWrong(s) ? REPEAT_STREAK : MASTERY_STREAK);

export function isMastered(s: QuestionState | undefined, clock: Clock = deviceClock()): boolean {
  if (!s || s.seen === 0 || !s.lastCorrect || s.streak < needOf(s)) return false;
  if (!isRepeatWrong(s)) return true;
  return clock.dayOf(s.lastAt) > clock.dayOf(lastWrongOf(s)!);
}

/** 錯題複習的階段：fix 待訂正、review 複習中、mastered 已熟練；沒答錯過的題不在錯題複習裡（null） */
export type WrongStage = 'fix' | 'review' | 'mastered';

export function stageOf(s: QuestionState | undefined, clock: Clock = deviceClock()): WrongStage | null {
  if (!s || s.seen === 0 || s.wrong === 0) return null;
  if (!s.lastCorrect) return 'fix';
  return isMastered(s, clock) ? 'mastered' : 'review';
}

/** 複習中、今天已經升不上去的題（明天再練）：反覆答錯的題在答錯的當天連對到只差「隔天」這個條件 */
export function isWaiting(s: QuestionState | undefined, clock: Clock = deviceClock()): boolean {
  if (!s || stageOf(s, clock) !== 'review' || !isRepeatWrong(s)) return false;
  return s.streak >= REPEAT_STREAK - 1 && clock.today <= clock.dayOf(lastWrongOf(s)!);
}

/** 複習中的題離熟練還差什麼：再連對 more 次；tomorrow 是今天到這裡、明天再答對一次。不是複習中回 null */
export function nextStepOf(s: QuestionState | undefined, clock: Clock = deviceClock()): { more: number; tomorrow: boolean } | null {
  if (!s || stageOf(s, clock) !== 'review') return null;
  const tomorrow = isWaiting(s, clock);
  return { more: tomorrow ? 1 : Math.max(1, needOf(s) - s.streak), tomorrow };
}

export function statsOf(questionIds: readonly string[], states: ReadonlyMap<string, QuestionState>, clock: Clock = deviceClock()): SetStats {
  let practised = 0;
  let wrong = 0;
  let mastered = 0;
  let seen = 0;
  let correct = 0;
  for (const id of questionIds) {
    const s = states.get(id);
    if (!s || s.seen === 0) continue;
    practised++;
    seen += s.seen;
    correct += s.correct;
    if (!s.lastCorrect) wrong++;
    if (isMastered(s, clock)) mastered++;
  }
  return { total: questionIds.length, practised, wrong, mastered, accuracy: seen === 0 ? null : correct / seen };
}

/** 最近一次答錯的題（待訂正） */
export const wrongIdsOf = (states: ReadonlyMap<string, QuestionState>): Set<string> =>
  new Set([...states.values()].filter((s) => s.seen > 0 && !s.lastCorrect).map((s) => s.questionId));

/** 練過但還沒熟練的題（含最近答錯的） */
export const unsureIdsOf = (states: ReadonlyMap<string, QuestionState>, clock: Clock = deviceClock()): Set<string> =>
  new Set([...states.values()].filter((s) => s.seen > 0 && !isMastered(s, clock)).map((s) => s.questionId));

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 錯題複習要練的題，依優先順序：待訂正在前（答錯次數多的先，同次數的先錯的先，所以同一輪答錯的題照當時的順序），再來是複習中（等最久的先）。
 *  due 是今天要練的；waiting 是明天再練的；open 是全部還沒熟練的錯題（今天要練的在前，明天再練的排最後） */
export function wrongQueueOf(states: ReadonlyMap<string, QuestionState>, clock: Clock = deviceClock()): { open: string[]; due: string[]; waiting: string[] } {
  const fix: QuestionState[] = [];
  const review: QuestionState[] = [];
  for (const s of states.values()) {
    const stage = stageOf(s, clock);
    if (stage === 'fix') fix.push(s);
    else if (stage === 'review') review.push(s);
  }
  fix.sort((a, b) => b.wrong - a.wrong || byText(a.lastAt, b.lastAt) || byText(a.questionId, b.questionId));
  review.sort((a, b) => byText(a.lastAt, b.lastAt) || byText(a.questionId, b.questionId));
  const waiting = review.filter((s) => isWaiting(s, clock)).map((s) => s.questionId);
  const due = [...fix, ...review].map((s) => s.questionId).filter((id) => !waiting.includes(id));
  return { open: [...due, ...waiting], due, waiting };
}

export interface WrongStats {
  /** 答錯過的題數（三個階段的合計） */
  everWrong: number;
  fix: number;
  review: number;
  mastered: number;
  /** 今天要練的（待訂正加上複習中、今天還能往上的） */
  due: number;
  /** 明天再練的 */
  waiting: number;
}

/** 某一組題在錯題複習裡各階段的題數 */
export function wrongStatsOf(questionIds: readonly string[], states: ReadonlyMap<string, QuestionState>, clock: Clock = deviceClock()): WrongStats {
  const out: WrongStats = { everWrong: 0, fix: 0, review: 0, mastered: 0, due: 0, waiting: 0 };
  for (const id of questionIds) {
    const s = states.get(id);
    const stage = stageOf(s, clock);
    if (stage === null) continue;
    out.everWrong++;
    out[stage]++;
    if (stage === 'review' && isWaiting(s, clock)) out.waiting++;
    else if (stage !== 'mastered') out.due++;
  }
  return out;
}

/** 題組用的挑選（sets.ts 的 resolveSet）：wrong 是錯題複習今天要練的題（all 為真時連明天再練的也算，純練習用），依優先順序排在 wrongOrder；
 *  unsure 是練過但還沒熟練的 */
export function picksOf(
  states: ReadonlyMap<string, QuestionState>,
  clock: Clock = deviceClock(),
  opts: { all?: boolean } = {},
): { wrongIds: Set<string>; unsureIds: Set<string>; wrongOrder: string[] } {
  const queue = wrongQueueOf(states, clock);
  const wrongOrder = opts.all ? queue.open : queue.due;
  return { wrongIds: new Set(wrongOrder), unsureIds: unsureIdsOf(states, clock), wrongOrder };
}
