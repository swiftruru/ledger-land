// 頂部統計（17 第 3.4 節）：星星總數、徽章數、錯題本待複習數，三個都是按鈕（星星與徽章到「我的」進度，錯題本到 /review/）。
// 中間是頁面標題（h1，換頁後焦點移到這裡）。沒有生命值、金幣、票券、倒數、商店。
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { StarIcon } from './icons.tsx';
import { MedalIcon, ReviewIcon } from './map-icons.tsx';

export interface MapHudProps {
  title: ReactNode;
  stars: number;
  badges: number;
  due: number;
  starsHref: string;
  badgesHref: string;
  reviewHref: string;
  onNavigate: (href: string) => void;
  className?: string;
}

export function MapHud({ title, stars, badges, due, starsHref, badgesHref, reviewHref, onNavigate, className }: MapHudProps) {
  const { t } = useLingui();
  const link = (href: string, label: string, icon: ReactNode, value: number, dot?: boolean) => (
    <a
      className="ll-hud__stat"
      href={href}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
    >
      {icon}
      <span className="ll-hud__value ll-num" aria-hidden="true">
        {value}
      </span>
      {dot && <span className="ll-hud__dot" aria-hidden="true" />}
    </a>
  );
  return (
    <div
      className={`ll-hud${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t({ id: 'map.hud.group', message: '進度統計', comment: '闖關地圖頂部統計區的可讀名稱' })}
    >
      {link(
        starsHref,
        t({ id: 'map.hud.stars', message: `星星總數 ${stars}，看我的進度`, comment: '頂部星星按鈕的可讀名稱；stars 是總數' }),
        <StarIcon size={18} filled className="ll-hud__star" />,
        stars,
      )}
      <h1 className="ll-hud__title">{title}</h1>
      <div className="ll-hud__right">
        {link(
          badgesHref,
          t({ id: 'map.hud.badges', message: `徽章 ${badges} 個，看我的進度`, comment: '頂部徽章按鈕的可讀名稱；badges 是數量' }),
          <MedalIcon size={18} />,
          badges,
        )}
        {link(
          reviewHref,
          t({ id: 'map.hud.due', message: `錯題本待複習 ${due} 題，到錯題本`, comment: '頂部錯題本按鈕的可讀名稱；due 是待複習題數' }),
          <ReviewIcon size={18} />,
          due,
          due > 0,
        )}
      </div>
    </div>
  );
}
