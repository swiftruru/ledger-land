// 從實驗室的「回到題目」回來時的還原（M5，02 第 5.3 節、03 第 4.6 節）：關卡頁與錯題複習頁共用。
// store 裡最近一筆返回目標符合這一頁（matches）、而且目前這題就是那一題時：捲動位置依離開時記下的錨點還原（先寫進工作階段的錨點，
// 呼叫端接著用 useScrollAnchor 在同一次排版讀它），焦點放回「看動畫」按鈕，用過就清掉；別頁的那一筆不動。
// 換頁後移焦點到頁面標題的全站規則（lib/page-ready.tsx）這一次跳過，由這裡接手焦點。
import { useLayoutEffect } from 'react';
import { suppressHeadingFocusOnce } from '../../lib/page-ready.tsx';
import { useQuiz } from '../../store/quiz.ts';
import { clearReturnTarget, readReturnTarget, type ReturnTarget } from './return-target.ts';

/**
 * @param enabled 這一頁的內容齊了、作答中（不是結果或完成畫面）那一次排版才做：太早做頁面還太短、捲不到
 * @param matches 最近一筆返回目標是不是這一頁的（關卡頁比 levelId，複習頁比 kind）
 */
export function useReturnRestore(enabled: boolean, matches: (target: ReturnTarget) => boolean): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const target = readReturnTarget();
    if (target === undefined || !matches(target)) return;
    clearReturnTarget();
    const current = useQuiz.getState().session;
    if (current === null || current.questionIds[current.currentIndex] !== target.questionId) return;
    if (target.anchor) useQuiz.getState().setAnchor(target.anchor);
    suppressHeadingFocusOnce();
    let frame = 0;
    let tries = 0;
    const tryFocus = () => {
      const btn = document.querySelector<HTMLElement>(`#ll-fb-${CSS.escape(target.questionId)} [data-testid="feedback-animation"]`);
      if (!btn) return;
      btn.focus({ preventScroll: true });
      // 整頁的布幕還沒掀開時不能取得焦點：下一個影格再試，最多等約一秒（和換題後移焦點到題幹的作法相同）
      if (document.activeElement !== btn && tries++ < 60) frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(frame);
    // matches 只在 enabled 翻成 true 的那一次用；呼叫端換了關卡會整個重新掛載
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
