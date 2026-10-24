// 作答中的捲動位置（02 第 5.1 節、05 第 8.5 節第 3 與第 5 步）：記錄「目前畫面最上方的錨點元素 ID 與偏移量」，不用 scrollY
// （兩種語言的文字高度不同）。錨點是帶 data-ll-anchor 的元素（題目卡、題幹、回饋區）；切換語言後頁面重新掛載時依錨點還原。
import { useLayoutEffect } from 'react';
import type { ScrollAnchor } from '@ledgerland/progress';

const SELECTOR = '[data-ll-anchor]';

export function captureScrollAnchor(root: Document = document): ScrollAnchor | undefined {
  const top = root.querySelector('.ll-topbar')?.getBoundingClientRect().bottom ?? 0;
  const anchors = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => el.id !== '');
  let best: HTMLElement | undefined;
  for (const el of anchors) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > top) {
      best = el;
      break;
    }
  }
  if (!best) return undefined;
  return { elementId: best.id, offset: Math.round(best.getBoundingClientRect().top) };
}

export function restoreScrollAnchor(anchor: ScrollAnchor, root: Document = document): boolean {
  const el = root.getElementById(anchor.elementId);
  if (!el) return false;
  const y = el.getBoundingClientRect().top + window.scrollY - anchor.offset;
  window.scrollTo(0, Math.max(0, y));
  return true;
}

/** 掛載時依 store 的錨點還原；之後每次捲動（rAF 節流）更新錨點。
 *  掛載後 1.5 秒內頁面高度若改變（上方晚一步插入的提示：相機預覽的暫存情境提示要等 storage.estimate 才出現、Safari 分頁提示的關卡代號延後載入），
 *  就用同一個錨點再還原一次：還原是冪等的，瀏覽器的 scroll anchoring 已經補償過也不會錯位；而還原的 scrollTo 與插入落在同一個影格時瀏覽器會暫停
 *  anchoring（CI 的 WebKit 曾因此讓切換語言後的題目位置差 550px，06 第 8.2 節）。使用者一捲動就結束這個視窗，之後高度改變只重新記錄錨點。 */
export function useScrollAnchor(enabled: boolean, read: () => ScrollAnchor | undefined, write: (anchor: ScrollAnchor | undefined) => void): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const anchor = read();
    let restoring = false;
    const restore = () => {
      if (!anchor) return;
      restoring = true;
      restoreScrollAnchor(anchor);
      requestAnimationFrame(() => {
        restoring = false;
      });
    };
    restore();
    let settleUntil = performance.now() + 1500;
    let raf = 0;
    const capture = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => write(captureScrollAnchor()));
    };
    const onScroll = () => {
      if (restoring) return;
      settleUntil = 0;
      capture();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (anchor && performance.now() < settleUntil) restore();
            else capture();
          })
        : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      cancelAnimationFrame(raf);
    };
    // read 與 write 都是 store 的穩定函式
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
