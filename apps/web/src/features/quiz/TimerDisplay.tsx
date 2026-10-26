// 作答頁的倒數與暫停（03 第 2.10 節）：畫面元件在 @ledgerland/web-ui（字串在 web-ui 的 catalog，元件測試在 Browser Mode）；
// 這裡只把 QuizSession 的 timer 狀態換成元件要的 props。Level.tsx 的接法：
//   const timer = timerDisplayProps(session.timer, () => (session.timer.paused ? useQuiz.getState().resume() : useQuiz.getState().pause()));
//   {timer && <TimerDisplay {...timer} />}
// 每秒的 tick、切到背景自動暫停（visibilitychange）與時間上限（timerTotalMs）由 Level.tsx 負責。
import type { QuizSession } from '@ledgerland/progress';
import { TimerDisplay, type TimerDisplayProps } from '@ledgerland/web-ui';
import { timerDisplayValues } from './timer.ts';

export { TimerDisplay };
export type { TimerDisplayProps };

/** 沒有開啟計時時回 null；其他情況回 TimerDisplay 的 props */
export function timerDisplayProps(timer: QuizSession['timer'], onToggle: () => void): TimerDisplayProps | null {
  const v = timerDisplayValues(timer);
  return v === null ? null : { ...v, onToggle };
}
