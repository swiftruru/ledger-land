// 闖關地圖的頂部統計列（圖規第 4.8 節、站規 2.2.1 與 0.4 的 A2）：PageHeader 的地圖實例，平的（沒有立體底邊）。
// 左欄三個 StatChip：星星（靜態，沒有專頁）、徽章（到 /me/badges/）、錯題本（到 /review/，有到期題時加小紅點）。
// 數字一律是確定的值（維護者 2026-10-26：不可以先顯示「…」再補數字；進度沒到之前整頁由布幕擋住），只有作答回來後數字變化的那一刻滾動（減少動態時直接換）。
// 中欄 h1「闖關」；寬度不夠時只給螢幕閱讀器（頁面的 CSS 決定）。右欄是地圖工具：compact 只放第一個工具（跳到目前關卡）加「更多」選單（更窄時全部收進選單），
// medium 以上全部用 IconButton chrome 直接排開，滑過與鍵盤焦點時在下方顯示文字提示。工具的行為由頁面給（tools）。
// 內層的寬度與左緣由頁面的 CSS 對齊軌道（--qm-track-left、--qm-track-w）；底線橫跨全寬。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton.tsx';
import { StarIcon } from './icons.tsx';
import { MedalIcon, ReviewIcon } from './map-icons.tsx';
import { MenuButton, MenuItem } from './Menu.tsx';
import { PageHeader } from './PageHeader.tsx';
import { RollingNumber } from './RollingNumber.tsx';
import { StatChip } from './StatChip.tsx';

export interface MapHudTool {
  id: string;
  icon: ReactNode;
  /** 可讀名稱，也是 medium 以上的文字提示 */
  label: string;
  onClick: () => void;
  /** 切換按鈕（清單檢視）：medium 以上輸出 aria-pressed */
  pressed?: boolean;
  /** 「更多」選單裡的文字與圖示（預設同 label、icon；清單檢視在選單裡寫成「地圖檢視」） */
  menuLabel?: string;
  menuIcon?: ReactNode;
  /** 會打開疊加層：選單觸發後焦點不回到選單按鈕 */
  opensOverlay?: boolean;
  'data-testid'?: string;
}

export interface MapHudProps {
  title: ReactNode;
  /** 星星總數、徽章數、錯題本待複習題數：一律是確定的數字 */
  stars: number;
  badges: number;
  due: number;
  badgesHref: string;
  reviewHref: string;
  /** 數字變化時滾動（第一次掛載直接顯示，不算變化）；false 時一律直接換 */
  animate?: boolean;
  /** compact（< 600）：只放前面 inlineTools 個工具（預設 1，也就是「跳到目前關卡」），其他放進「更多」選單 */
  compact?: boolean;
  /** compact 時直接排開的工具數；軌道太窄（統計數字變長時放不下）時給 0，全部收進「更多」 */
  inlineTools?: number;
  /** 地圖工具，第一個是「跳到目前關卡」 */
  tools?: readonly MapHudTool[];
  className?: string;
}

export function MapHud({
  title,
  stars: starsN,
  badges: badgesN,
  due: dueN,
  badgesHref,
  reviewHref,
  animate = true,
  compact = false,
  inlineTools = 1,
  tools = [],
  className,
}: MapHudProps) {
  const { t } = useLingui();
  const inline = tools.slice(0, inlineTools);
  const rest = tools.slice(inlineTools);
  const num = (n: number) => <RollingNumber value={n} animate={animate} />;
  const stars = String(starsN);
  const badges = String(badgesN);
  const due = String(dueN);
  const start = (
    <div className="ll-hud__stats" role="group" aria-label={t({ id: 'map.hud.group', message: '進度統計', comment: '闖關地圖頂部統計區的可讀名稱' })}>
      <StatChip
        tone="star"
        icon={<StarIcon filled />}
        value={num(starsN)}
        label={t({ id: 'map.hud.starsTotal', message: `星星總數 ${stars}`, comment: '頂部的星星總數（不是連結）；stars 是總數' })}
        className="ll-hud__stat"
        data-testid="hud-stars"
      />
      <StatChip
        tone="badge"
        icon={<MedalIcon />}
        value={num(badgesN)}
        label={t({
          id: 'map.hud.badgesLink',
          message: `徽章 ${badges} 個，看我的徽章`,
          comment: '頂部徽章連結的可讀名稱；badges 是數量，連到「我的 › 徽章」',
        })}
        href={badgesHref}
        className="ll-hud__stat"
        data-testid="hud-badges"
      />
      <StatChip
        tone="review"
        icon={<ReviewIcon />}
        value={num(dueN)}
        label={t({ id: 'map.hud.due', message: `錯題本待複習 ${due} 題，到錯題本`, comment: '頂部錯題本按鈕的可讀名稱；due 是待複習題數' })}
        href={reviewHref}
        dot={dueN > 0}
        className="ll-hud__stat"
        data-testid="hud-review"
      />
    </div>
  );
  // 按下之後先收起文字提示，指標離開或之後再次取得焦點才恢復（data-tip-off，CSS 隱藏 ::after）：切換檢視後提示不會一直掛在按鈕下面。
  // 不在失去焦點時恢復：切到清單時焦點會被移到章節的 summary，那時滑鼠還停在按鈕上
  const tipOn = (e: { currentTarget: HTMLElement }) => e.currentTarget.removeAttribute('data-tip-off');
  const tool = (x: MapHudTool, tip: boolean) => {
    return (
      <span
        key={x.id}
        className={`ll-hud__tool${tip ? ' ll-hud__tool--tip' : ''}`}
        data-tip={tip ? x.label : undefined}
        onPointerLeave={tip ? tipOn : undefined}
        onFocus={tip ? tipOn : undefined}
      >
        <IconButton
          variant="chrome"
          icon={x.icon}
          label={x.label}
          pressed={x.pressed}
          onClick={(e) => {
            if (tip) e.currentTarget.closest('.ll-hud__tool')?.setAttribute('data-tip-off', '');
            x.onClick();
          }}
          noTitle={tip}
          data-testid={x['data-testid']}
        />
      </span>
    );
  };
  const end =
    tools.length === 0 ? null : compact ? (
      <div className="ll-hud__tools">
        {inline.map((x) => tool(x, false))}
        {rest.length > 0 ? (
          <MenuButton data-testid="map-more">
            {rest.map((x) => (
              <MenuItem key={x.id} icon={x.menuIcon ?? x.icon} onClick={x.onClick} returnFocus={!x.opensOverlay} data-testid={x['data-testid']}>
                {x.menuLabel ?? x.label}
              </MenuItem>
            ))}
          </MenuButton>
        ) : null}
      </div>
    ) : (
      <div className="ll-hud__tools" role="toolbar" aria-label={t({ id: 'map.hud.tools', message: '地圖工具', comment: '闖關地圖頂部工具列的可讀名稱' })}>
        {tools.map((x) => tool(x, true))}
      </div>
    );
  return <PageHeader className={`ll-hud${className ? ` ${className}` : ''}`} title={title} start={start} end={end} compact={compact} titleHiddenNarrow />;
}
