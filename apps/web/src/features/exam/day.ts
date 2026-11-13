// 苦練的「哪一天」（錯題複習，2026-11-13）：作答時間存的是 UTC 的 ISO 字串（備份裡是 Unix 秒），「隔天」要照裝置的本地日期算，
// 所以每次都從那個時間點換算，不取字串的前十碼（台灣凌晨 0 點到 8 點的作答，UTC 還在前一天）。
// stats.ts 的函式都收一個 Clock，測試傳固定的；頁面用 deviceClock()。
import { todayLocal } from '../../lib/progress/app-info.ts';

/** ISO 時間換成本地日期 YYYY-MM-DD；不是合法的時間回空字串 */
export type DayOf = (iso: string) => string;

export interface Clock {
  /** 今天的本地日期 YYYY-MM-DD */
  today: string;
  dayOf: DayOf;
}

export const localDayOf: DayOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayLocal(d);
};

export const deviceClock = (): Clock => ({ today: todayLocal(), dayOf: localDayOf });
