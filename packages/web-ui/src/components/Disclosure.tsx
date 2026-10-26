// 展開列（站規 1.8）：取代所有 <details> 的瀏覽器預設樣式（參考名詞、備份進階、安裝教學的 iPhone 步驟、回饋的「其他選項為什麼不對」、
// 指標題的說明、地圖清單的章節）。原生 <details> 與 <summary>：Enter、空白鍵切換由瀏覽器處理，螢幕閱讀器讀得到展開狀態。
// summary 是 48px 的列：前置圖示、標題、右側 Badge、20px 的向下箭頭（展開時轉 180 度，減少動態時直接換角度）。
// 受控（open 有值）時，使用者點了只回呼 onToggle，畫面上的開合以父層的 open 為準（例如搜尋命中時強制展開）。
// 受控時直接攔 summary 的點按（Enter、空白鍵也會觸發 click），不靠 toggle 事件：父層剛把 open 改成 true、toggle 事件還沒送出前使用者就點了收合，
// 瀏覽器會把兩次切換合併成一個「關到關」的事件甚至不送，onToggle 就漏掉，下一次重繪又被強制展開（E2E 量到過）。
import { useLayoutEffect, useReducer, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';
import { CaretDownIcon } from './icons.tsx';

export interface DisclosureProps {
  /** 標題（summary 裡的文字） */
  summary: ReactNode;
  /** 前置圖示（20px） */
  icon?: ReactNode;
  /** 右側 Badge（例如「64」） */
  trailing?: ReactNode;
  /** 受控：有值時以它為準 */
  open?: boolean;
  /** 不受控時的初始狀態 */
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** card：整個展開列是一張卡片；plain：上下各一條髮絲線（放在卡片或回饋面板裡） */
  variant?: 'card' | 'plain';
  className?: string;
  /** summary 額外的 class（地圖清單用 .qm-list__chapter summary 覆寫成自己的 grid，只改欄位排列） */
  summaryClassName?: string;
  /** 內容區的 class */
  bodyClassName?: string;
  id?: string;
  /** 內容的語言 */
  lang?: string;
  'data-testid'?: string;
  children: ReactNode;
}

export function Disclosure({
  summary,
  icon,
  trailing,
  open,
  defaultOpen,
  onToggle,
  variant = 'card',
  className,
  summaryClassName,
  bodyClassName,
  id,
  lang,
  'data-testid': testId,
  children,
}: DisclosureProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  // 受控時使用者點了：先回呼 onToggle，再重繪一次，讓下面的 layout effect 把 DOM 對回父層（可能已經更新）的 open
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // 受控：每次繪製後把 DOM 的開合對回 open（使用者點了但父層沒有改 open 時，維持父層的狀態）
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && open !== undefined && el.open !== open) el.open = open;
  });
  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const now = e.currentTarget.open;
    if (open !== undefined && now === open) return;
    onToggle?.(now);
    if (open !== undefined) rerender();
  };
  // 受控：點 summary 不讓瀏覽器自己切換，直接回呼父層；父層沒有改 open 時，重繪後維持原狀
  const handleSummaryClick = (e: MouseEvent<HTMLElement>) => {
    if (open === undefined) return;
    e.preventDefault();
    onToggle?.(!open);
    rerender();
  };
  const cls = ['ll-disclosure', `ll-disclosure--${variant}`, className].filter(Boolean).join(' ');
  const summaryCls = ['ll-disclosure__summary', summaryClassName].filter(Boolean).join(' ');
  return (
    <details ref={ref} className={cls} open={open ?? defaultOpen} onToggle={handleToggle} id={id} lang={lang} data-testid={testId}>
      <summary className={summaryCls} onClick={handleSummaryClick}>
        {icon && (
          <span className="ll-disclosure__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ll-disclosure__title">{summary}</span>
        {trailing !== undefined && trailing !== null && <span className="ll-disclosure__trail">{trailing}</span>}
        <span className="ll-disclosure__chev" aria-hidden="true">
          <CaretDownIcon />
        </span>
      </summary>
      <div className={`ll-disclosure__body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
    </details>
  );
}
