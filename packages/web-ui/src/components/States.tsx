// 空狀態與錯誤狀態（07 第 9 節、站規 1.20、2.18）：都有標題、說明與下一步按鈕；插圖純裝飾（aria-hidden）。
// 預設插圖是鈴（MapMarker 96px：空狀態雙手交握、錯誤托腮），讓空白頁也有角色陪著。
// action 只放 Button（多顆時用陣列：最多一顆 primary 加一顆 secondary）；onRetry 有值時自動在最前面放 primary「再試一次」。
// 錯誤狀態是 role="alert"；離線或讀不到內容時整頁只用一個 ErrorState，不再同時出現 Banner。
// 兩顆以上的按鈕（ll-state__action--pair）一律等寬：窄螢幕直排、寬螢幕橫排（M3 驗收第 2 輪）；只有一顆時維持內容寬度。
// 標題是 h1、直接放在 main 裡的整頁狀態（找不到頁面、路由錯誤）在 1024 以上畫成最寬 480px 的卡片（M3 驗收第 4 輪），
// 只用 CSS 的 :has() 判斷（07-core-components.css），不加元素也不加 class：首次載入的 JS 不再增加。
// 換行用全站規則（strict 加 balance，第 7 輪）。States 在首次載入的 chunk，不在元件裡切詞（phrase.ts 會讓首次載入的 JS 多約 0.5 KB）：
// 說明要依詞換行時，頁面把切好詞的節點傳進來（apps/web 的 Phrased，CSS 是 web-ui 的 .ll-phrased），或在字串裡包 .ll-nowrap。
import type { ReactElement, ReactNode } from 'react';
import { Button, type ButtonProps } from './Button.tsx';
import { RetryIcon } from './icons.tsx';
import { MapMarker, type MarkerExpression, type MarkerPose } from './MapMarker.tsx';
import { useUiLabels } from './ui-labels.ts';

type ButtonElement = ReactElement<ButtonProps>;

export interface StateProps {
  title: ReactNode;
  description?: ReactNode;
  /** 下一步：Button，或 Button 的陣列（主要的在前） */
  action?: ButtonElement | readonly ButtonElement[];
  /** 有值時在最前面放 primary「再試一次」 */
  onRetry?: () => void;
  /** 「再試一次」的文字（預設 ui.retry） */
  retryLabel?: ReactNode;
  /** 自訂插圖（純裝飾）；false 不放插圖 */
  illustration?: ReactNode | false;
  /** 鈴的姿勢（預設：空狀態 clasp、錯誤 cheek） */
  pose?: MarkerPose;
  expression?: MarkerExpression;
  titleAs?: 'h1' | 'h2' | 'h3';
  /** 標題的 id（h1 換頁時的焦點目標） */
  titleId?: string;
  className?: string;
  'data-testid'?: string;
}

function StateBody({
  kind,
  title,
  description,
  action,
  onRetry,
  retryLabel,
  illustration,
  pose,
  expression,
  titleAs: Heading = 'h2',
  titleId,
  className,
  'data-testid': testId,
}: StateProps & { kind: 'empty' | 'error' }) {
  const labels = useUiLabels();
  const actions: ButtonElement[] = action === undefined ? [] : Array.isArray(action) ? [...(action as readonly ButtonElement[])] : [action as ButtonElement];
  const count = (onRetry ? 1 : 0) + actions.length;
  const art =
    illustration === false ? null : (illustration ?? <MapMarker pose={pose ?? (kind === 'empty' ? 'clasp' : 'cheek')} expression={expression} size={96} />);
  return (
    <div className={`ll-state ll-state--${kind}${className ? ` ${className}` : ''}`} role={kind === 'error' ? 'alert' : undefined} data-testid={testId}>
      {art && (
        <div className="ll-state__art" aria-hidden="true">
          {art}
        </div>
      )}
      <Heading id={titleId} className="ll-state__title" tabIndex={Heading === 'h1' ? -1 : undefined}>
        {title}
      </Heading>
      {description !== undefined && description !== null && <p className="ll-state__desc">{description}</p>}
      {(onRetry || actions.length > 0) && (
        <div className={`ll-state__action${count > 1 ? ' ll-state__action--pair' : ''}`}>
          {onRetry && (
            <Button variant="primary" icon={<RetryIcon />} onClick={onRetry}>
              {retryLabel ?? labels.retry}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateBody {...props} kind="empty" />;
}

export function ErrorState(props: StateProps) {
  return <StateBody {...props} kind="error" />;
}
