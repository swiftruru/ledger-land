// 頁面布幕（維護者 2026-10-26 的要求：點進任何一頁都要直接看到完整的資訊，不可以先畫版面、數字「…」或灰色長條，資料到了再補上）。
// Root 把每一頁的內容包在 PageReveal 裡：頁面用 usePageReady(ready) 回報「這一頁第一次繪製要的資料（內容快照、進度、懶載入的作答區）齊了沒」，
// 沒齊之前整頁 visibility: hidden（版面照常排、不跳動，Lighthouse 也不會把看不見的內容算成 LCP），齊了之後整頁一次淡入 180ms（減少動態時直接出現）。
// 等超過 WAIT_MS 還沒齊（冷啟動、慢網路）才顯示一個小小的載入圈，從頭到尾沒有骨架畫面。沒有呼叫 usePageReady 的頁面（說明頁）一掛載就是齊的。
// 換頁（路徑改變）時重新計算並重新掛載這一層：上一頁的回報全部作廢、淡入重播。同一路徑只換 search 或 history state 的導覽（地圖的關卡面板、
// 關卡代號疊加層、?from 移除）不算換頁，頁面不重新掛載，捲動位置才不會跑掉（2026-10-26 維護者發現關閉面板後地圖捲回頂端）。樣式在 base.css 的 .ll-page。
import { useUiLabels } from '@ledgerland/web-ui';
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

const WAIT_MS = 700;

type Registry = {
  /** 回報某個 id 目前齊了沒；unregister 時傳 null */
  report: (id: string, ready: boolean | null) => void;
};
const Ctx = createContext<Registry | null>(null);
/** 這一頁的布幕掀開了沒（掀開後閂住）；要在掀開之後才做的事（例如把焦點移到某個欄位）用它當 effect 的條件 */
const RevealedCtx = createContext(false);

export function useRevealed(): boolean {
  return useContext(RevealedCtx);
}

/** 回報這一頁第一次繪製要的資料齊了沒。每一頁最多呼叫一次，條件要包含：內容快照、進度（getProgressStore 之後讀到的值）、第一屏就看得到的懶載入元件。
 *  取不到進度（儲存壞掉）時也要回報 true，畫面照樣要出來。 */
export function usePageReady(ready: boolean): void {
  const reg = useContext(Ctx);
  const id = useId();
  // useLayoutEffect：在瀏覽器繪製之前就把「還沒齊」報上去，新頁面不會先閃一格不完整的畫面（useEffect 在繪製之後才跑）
  useLayoutEffect(() => {
    reg?.report(id, ready);
  }, [reg, id, ready]);
  useLayoutEffect(() => () => reg?.report(id, null), [reg, id]);
}

export function PageReveal({ children }: { children: ReactNode }) {
  const ui = useUiLabels();
  const location = useLocation();
  // key：路徑，換頁重算。pending：還沒齊的頁面 id（同一頁可能有一個以上的元件回報，例如地圖頁本體與 HUD）。
  // revealed：這一頁掀開過就閂住，之後頁面再回報沒齊（搜尋、算結果、換題）也不再放下布幕，焦點與捲動位置才不會被打斷
  const [state, setState] = useState<{ key: string; pending: ReadonlySet<string>; revealed: boolean }>(() => ({
    key: location.pathname,
    pending: new Set(),
    revealed: false,
  }));
  const [waiting, setWaiting] = useState(false);
  const [registry] = useState<Registry>(() => ({
    report(id, ready) {
      setState((s) => {
        const has = s.pending.has(id);
        if (ready === false && !has) return { ...s, pending: new Set([...s.pending, id]) };
        if (ready !== false && has) {
          const next = new Set(s.pending);
          next.delete(id);
          return { ...s, pending: next };
        }
        return s;
      });
    },
  }));
  if (state.key !== location.pathname) setState({ key: location.pathname, pending: new Set(), revealed: false });
  const ready = state.revealed || state.pending.size === 0;
  // 閂住要用最新的 state 判斷（函式型更新）：新頁面第一次 commit 時 pending 還是空的、ready 看起來是 true，頁面在 layout effect 才回報沒齊；
  // 這個 effect 的更新排在那些回報之後處理，所以用更新函式當下的 pending 判斷，不會在第一次 commit 就把布幕閂在掀開的狀態
  useEffect(() => {
    if (ready && !state.revealed) setState((s) => (s.revealed || s.pending.size > 0 ? s : { ...s, revealed: true }));
  }, [ready, state.revealed]);
  // 還沒齊的那一頁的 key（齊了是 null）：換頁重新計時，超過 WAIT_MS 才顯示載入圈
  const waitingFor = ready ? null : state.key;
  useEffect(() => {
    if (waitingFor === null) {
      setWaiting(false);
      return;
    }
    const id = setTimeout(() => setWaiting(true), WAIT_MS);
    return () => clearTimeout(id);
  }, [waitingFor]);
  // 換頁後焦點移到頁面標題（07 第 8.2 節）：路徑一變就記下「要移焦點」，等布幕真的掀開（下一個影格量到 .ll-page 看得見）才移。
  // 不能在 ready 變 true 的那一次 effect 直接移：新頁面第一次 commit 時 pending 還是空的（頁面在 layout effect 才回報），那一刻 ready 是 true、
  // 下一個 commit 又變 false，隱形的元素一拿到焦點就會被瀏覽器丟掉。首次載入與同一路徑的重新繪製（語系切換後的 re-render）都不搶焦點
  const lastPath = useRef<string | null>(null);
  const needFocus = useRef(false);
  const pageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (lastPath.current === null) {
      lastPath.current = location.pathname;
      return;
    }
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    needFocus.current = true;
  }, [location.pathname]);
  // 掀開的那一頁（沒掀開是 null）：同一頁掀開一次跑一次，換頁後再掀開再跑一次
  const revealed = ready ? state.key : null;
  useEffect(() => {
    if (revealed === null || !needFocus.current || typeof requestAnimationFrame !== 'function') return;
    const id = requestAnimationFrame(() => {
      const page = pageRef.current;
      if (!page || page.dataset.ready !== 'true') return;
      const h1 = page.querySelector<HTMLElement>('h1') ?? document.querySelector<HTMLElement>('main h1');
      if (!h1 || getComputedStyle(h1).visibility === 'hidden') return;
      needFocus.current = false;
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [revealed]);
  return (
    <Ctx.Provider value={registry}>
      <RevealedCtx.Provider value={state.revealed}>
        {/* key 是路徑：換頁才重新掛載這一層並重播淡入 */}
        <div key={state.key} ref={pageRef} className="ll-page" data-ready={ready ? 'true' : 'false'}>
          {children}
        </div>
        {waiting && !ready && (
          <div className="ll-page__wait" role="status">
            <span className="ll-page__spinner" aria-hidden="true" />
            <span className="ll-sr-only">{ui.loading}</span>
          </div>
        )}
      </RevealedCtx.Provider>
    </Ctx.Provider>
  );
}
