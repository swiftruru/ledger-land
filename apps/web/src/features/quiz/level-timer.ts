// 作答頁的計時接線（03 第 2.10 節「計時（選用）」）：開始工作階段時的時間上限、第一次繪製前讀鏡像的 timerEnabled、每秒的 tick。
// 時間上限的算法在 timer.ts（每題秒數 × 計分題題數、關卡的 timerSeconds、寬鬆加倍），畫面在 TimerDisplay.tsx；這裡只放 Level.tsx 要用的純函式，
// 方便在 Node 環境測試。切到背景自動暫停由 store/quiz.ts 的 installQuizPersistence 負責（visibilitychange 轉 hidden），離開作答畫面（站內換頁）
// 自動暫停由 LevelSession.tsx 卸載時負責；兩者回來都不自動恢復。
import type { KeyValueStorage } from '../../lib/progress/pending.ts';
import { readMirroredSetting } from '../../lib/progress/settings-mirror.ts';
import { TIMER_ENABLED_SETTING, timerTotalMs } from './timer.ts';

export interface LevelTimerInput {
  /** 整關都是不計分的題目（延伸章的取捨題）：不計時 */
  readonly unscored?: boolean | undefined;
  /** 關卡選填的建議秒數 */
  readonly timerSeconds?: number | undefined;
  /** 計分題題數（取捨題不算） */
  readonly scoredCount: number;
  readonly enabled: boolean;
  readonly relaxed: boolean;
}

/** 開始工作階段時的計時上限（毫秒）：沒開啟計時、不計分的關卡都是 0（startSession 收到 0 就不計時） */
export function levelTimerMs({ unscored, timerSeconds, scoredCount, enabled, relaxed }: LevelTimerInput): number {
  if (!enabled || unscored === true) return 0;
  return timerTotalMs({ scoredCount, levelTimerSeconds: timerSeconds, relaxed });
}

/** 鏡像裡的 timerEnabled（第一次繪製前可讀，不開進度資料庫）；沒有鏡像或不是 true 都當作關閉 */
export function mirroredTimerEnabled(storage: Pick<KeyValueStorage, 'getItem'> | null): boolean {
  return readMirroredSetting(storage, TIMER_ENABLED_SETTING) === true;
}

/** 單次 tick 最多算幾毫秒：裝置睡眠或分頁被節流卻沒有收到 visibilitychange 時，回來不一次扣掉一大段 */
export const TICK_MAX_STEP_MS = 5000;
export const TICK_INTERVAL_MS = 1000;

export interface TickerOptions {
  readonly now?: () => number;
  readonly intervalMs?: number;
  readonly maxStepMs?: number;
}

/** 每 intervalMs 回報一次距離上一次經過的毫秒數（整數、不小於 0、不超過 maxStepMs）；回傳停止函式給 effect 的清理用。
 *  每次重新開始都從現在起算，所以暫停後繼續不會把暫停期間算進去 */
export function startTicker(onElapsed: (elapsedMs: number) => void, options: TickerOptions = {}): () => void {
  const now = options.now ?? (() => performance.now());
  const maxStep = options.maxStepMs ?? TICK_MAX_STEP_MS;
  let last = now();
  const id = setInterval(() => {
    const t = now();
    const elapsed = Math.min(maxStep, Math.max(0, Math.round(t - last)));
    last = t;
    if (elapsed > 0) onElapsed(elapsed);
  }, options.intervalMs ?? TICK_INTERVAL_MS);
  return () => clearInterval(id);
}
