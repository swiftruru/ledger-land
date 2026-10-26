// 作答中的捲動位置（02 第 5.1 節、05 第 8.5 節第 3 與第 5 步）：記錄「目前畫面最上方的錨點元素 ID 與偏移量」，不用 scrollY
// （兩種語言的文字高度不同）。錨點是帶 data-ll-anchor 的元素（題目卡、題幹、回饋區）；切換語言後頁面重新掛載時依錨點還原。
import { useLayoutEffect } from 'react';
import type { ScrollAnchor } from '@ledgerland/progress';

const SELECTOR = '[data-ll-anchor]';

/**
 * 畫面最上方的錨點：下緣在 TopBar 之下（TopBar 捲出畫面時是視窗上緣之下）的第一個錨點。
 * 包著 TopBar 的整組頁首（#ll-level-head）只有完整在畫面裡時才算：上方的提示插在整組頁首之後（Banners 的 data-ll-banner-after），
 * 頁首已經捲出畫面一部分時要錨定下面的題目，提示晚一步插入時題目才會留在原位（以頁首當錨點，題目會被推下去）。
 */
export function captureScrollAnchor(root: Document = document): ScrollAnchor | undefined {
  const bar = root.querySelector('.ll-topbar');
  const top = Math.max(0, bar?.getBoundingClientRect().bottom ?? 0);
  const anchors = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => el.id !== '');
  let best: HTMLElement | undefined;
  for (const el of anchors) {
    const rect = el.getBoundingClientRect();
    if (bar && el.contains(bar) && rect.top < 0) continue;
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
 *  使用者還沒自己捲動之前，頁面高度若改變（上方晚一步插入的提示：相機預覽的暫存情境提示要等 storage.estimate 才出現、Safari 分頁提示的關卡代號延後載入），
 *  就在接下來幾個影格裡檢查同一個錨點有沒有偏掉，偏了才還原、回到 1px 內就停（06 第 8.2 節）。使用者一捲動就只重新記錄錨點。 */
export function useScrollAnchor(enabled: boolean, read: () => ScrollAnchor | undefined, write: (anchor: ScrollAnchor | undefined) => void): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const anchor = read();
    let userScrolled = false;
    // 我們自己 scrollTo 之後的 scroll 事件可能晚一個影格才到（慢的機器），不能用旗標加 rAF 判斷；改記下設定的位置，位置相同的 scroll 事件就是我們自己的
    let lastSetY = -1;
    const restore = () => {
      if (!anchor || !restoreScrollAnchor(anchor)) return;
      lastSetY = window.scrollY;
    };
    const offBy = () => {
      if (!anchor) return 0;
      const el = document.getElementById(anchor.elementId);
      return el ? el.getBoundingClientRect().top - anchor.offset : 0;
    };
    // 版面改變後連續幾個影格檢查：瀏覽器自己的 scroll anchoring（Chromium、WebKit）會不會補償、什麼時候補償，各環境不一樣
    // （CI 的 Linux WebKit 同一個測試一次多捲一個提示的高度、一次完全沒補償）；只在錨點真的偏了才還原，偏差回到 1px 內就停，
    // 所以不論補償幾次、順序如何都會收斂到同一個位置
    let settleRaf = 0;
    const settle = (frames: number) => {
      cancelAnimationFrame(settleRaf);
      settleRaf = requestAnimationFrame(() => {
        if (!anchor || userScrolled) return;
        if (Math.abs(offBy()) > 1) {
          restore();
          if (frames > 0) settle(frames - 1);
        }
      });
    };
    restore();
    settle(10);
    let raf = 0;
    const capture = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => write(captureScrollAnchor()));
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastSetY) <= 1) return;
      userScrolled = true;
      capture();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (anchor && !userScrolled) settle(10);
            else capture();
          })
        : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(settleRaf);
    };
    // read 與 write 都是 store 的穩定函式
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
