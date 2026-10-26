// 計時（03 第 2.10 節「計時（選用）」）：預設關閉；時間上限＝全站每題秒數 × 計分題題數，關卡可用 timerSeconds 另給建議秒數；「寬鬆」加倍。
// 設定存在 ProgressStore 的 settings：timerEnabled（已是 boot 腳本的鏡像設定）與 timerRelaxed。純函式在這裡，畫面在 TimerDisplay。
import type { JsonValue } from '@ledgerland/progress';

export const TIMER_ENABLED_SETTING = 'timerEnabled';
export const TIMER_RELAXED_SETTING = 'timerRelaxed';
/** 剩 1 分鐘與時間到的螢幕閱讀器提醒（03 第 2.10 節「設定裡可以關閉」）：預設開啟，只有存成 false 才關閉 */
export const TIMER_ANNOUNCE_SETTING = 'timerAnnounce';
/** 全站設定的每題秒數（建議初稿 75 秒，08 第 3.5 節；之後可改成從快照讀） */
export const DEFAULT_SECONDS_PER_QUESTION = 75;
/** 剩 1 分鐘時用 aria-live 提醒一次（03 第 2.10 節） */
export const TIMER_WARN_SECONDS = 60;

export interface TimerSettings {
  readonly enabled: boolean;
  readonly relaxed: boolean;
  /** 剩 1 分鐘與時間到時用 aria-live 提醒 */
  readonly announce: boolean;
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = { enabled: false, relaxed: false, announce: true };

export function parseTimerSettings(enabled: JsonValue | undefined, relaxed: JsonValue | undefined, announce?: JsonValue): TimerSettings {
  return { enabled: enabled === true, relaxed: relaxed === true, announce: announce !== false };
}

/** 結果頁的用時（03 第 2.10 節「結果頁另外記錄用時」）：無條件捨去到整秒；沒有用掉任何時間時是 0 */
export function usedSecondsOf(usedMs: number): number {
  return Math.max(0, Math.floor(usedMs / 1000));
}

export interface TimerTotalInput {
  /** 計分題題數（取捨題不算） */
  readonly scoredCount: number;
  /** 關卡選填的建議秒數（level.timerSeconds），有就取代「每題秒數 × 題數」 */
  readonly levelTimerSeconds?: number | undefined;
  readonly relaxed: boolean;
  readonly secondsPerQuestion?: number;
}

/** 這一關的計時上限（毫秒）；沒有計分題且沒有建議秒數時是 0（等於不計時） */
export function timerTotalMs({ scoredCount, levelTimerSeconds, relaxed, secondsPerQuestion = DEFAULT_SECONDS_PER_QUESTION }: TimerTotalInput): number {
  const base = levelTimerSeconds !== undefined && levelTimerSeconds > 0 ? levelTimerSeconds : Math.max(0, scoredCount) * secondsPerQuestion;
  return base * (relaxed ? 2 : 1) * 1000;
}

/** 剩餘毫秒換成顯示用的整秒（無條件進位，倒數到 0 才顯示 0） */
export function remainingSecondsOf(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function splitSeconds(totalSeconds: number): { minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(totalSeconds));
  return { minutes: Math.floor(s / 60), seconds: s % 60 };
}

export interface TimerDisplayInput {
  readonly enabled: boolean;
  readonly remainingMs: number;
  readonly paused: boolean;
}

export interface TimerDisplayValues {
  readonly remainingSeconds: number;
  readonly paused: boolean;
}

/** QuizSession.timer 換成 TimerDisplay 要的值；沒有開啟計時時回 null */
export function timerDisplayValues(timer: TimerDisplayInput): TimerDisplayValues | null {
  if (!timer.enabled) return null;
  return { remainingSeconds: remainingSecondsOf(timer.remainingMs), paused: timer.paused };
}
