// 玩家卡（站規 1.15）：左邊托腮的鈴（aria-hidden），右邊一行問候與三個統計膠囊（StatChip 連結）：
// 徽章 n／m（徽章頁）、圖鑑 n／m（名詞圖鑑）、收藏 n（捲到同一頁的收藏區；實心愛心，和收藏卡、作答頁按下「收藏」後的圖示相同，書籤是錯題本）。星星總數只放在頁首（第 1 輪看圖驗收：
// 頁首與玩家卡的星星只隔約 100px，是重複的資訊）。每個膠囊下面有一行短標籤（第 2 輪看圖驗收：只有圖示與數字時，收藏的「4」會被當成星星數）。
// 第 4 輪看圖驗收：膠囊靠左排、右側留不對稱的空位，問候右邊也空了一大塊；鈴的圖只佔外框約八成，72px 的外框畫出來約 60px。
// 改成：問候是鈴說的話（對話框撐滿鈴右邊的寬度，尾巴指向鈴），三個膠囊平分整列（me.css 的 .ll-player__chip），鈴的外框 375 時 92px（圖約 72px）。
// 第 7 輪看圖驗收：文字放大 200% 時鈴仍佔左側約 40%，對話框只剩四個中文字寬，問候斷成「今天也一／起闖關吧」、英文一行一個字。
// 問候改用 Phrased（依詞換行，兩行時是「今天也一起／闖關吧」）；卡片是容器（me.css 的 .ll-player，container-type），容器窄時鈴放在對話框上方置中、
// 對話框占滿整張卡、尾巴朝上（格線在 .ll-player__body，容器查詢不能改容器自己的版面，所以鈴也放進 body）。
// 只組合 web-ui 元件；數字由「我的」頁讀齊後才連同整頁一起出現（usePageReady），這裡沒有「…」這類占位（維護者 2026-10-26）。
import { useLingui } from '@lingui/react/macro';
import type { MouseEventHandler } from 'react';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { CardsIcon, HeartIcon, StatChip } from '@ledgerland/web-ui';
import { MapMarker, MedalIcon } from '@ledgerland/web-ui/map';
import { useLocale } from '../../lib/useLocale.ts';
import { Phrased } from './Phrased.tsx';
import type { PlayerStats } from './player-stats.ts';

export interface PlayerCardFavourites {
  /** 收藏的題數 */
  readonly count: number;
  /** 收藏區的網址（同一頁加錨點；onClick 會 preventDefault 並自己捲動與移焦點） */
  readonly href: string;
  readonly onClick: MouseEventHandler<HTMLAnchorElement>;
}

export function PlayerCard({ stats, favourites }: { stats: PlayerStats; favourites: PlayerCardFavourites }) {
  const { t } = useLingui();
  const locale = useLocale();
  const fmt = (n: number) => formatNumber(n, locale);
  const earned = fmt(stats.badges.earned);
  const badgeTotal = fmt(stats.badges.total);
  // 名詞索引讀不到時圖鑑是 0／0（player-stats.ts：只少一個數字，不影響其他）
  const termsDone = fmt(stats.terms?.done ?? 0);
  const termsTotal = fmt(stats.terms?.total ?? 0);
  const favCount = fmt(favourites.count);
  const ratio = (a: string, b: string) => t({ id: 'me.stat.ratio', message: `${a}／${b}`, comment: '統計膠囊上的「已取得／總數」；a、b 已格式化' });
  return (
    <section className="ll-player" aria-label={t({ id: 'me.player.label', message: '我的進度', comment: '玩家卡（「我的」頁最上面那張卡）的可讀名稱' })}>
      <div className="ll-player__body">
        <MapMarker pose="cheek" size={96} className="ll-player__bell" />
        <p className="ll-player__greet">
          <Phrased text={t({ id: 'me.player.greet', message: '今天也一起闖關吧', comment: '玩家卡的問候' })} />
        </p>
        <ul className="ll-player__stats">
          <li className="ll-player__stat">
            <StatChip
              className="ll-player__chip"
              icon={<MedalIcon />}
              tone="badge"
              value={ratio(earned, badgeTotal)}
              label={t({ id: 'me.stat.badges', message: `徽章 ${earned}／${badgeTotal} 枚`, comment: '玩家卡的徽章數；數字已格式化' })}
              href={localePath(locale, '/me/badges/')}
              data-testid="player-badges"
            />
            <span className="ll-player__cap" aria-hidden="true">
              {t({ id: 'me.stat.badges.cap', message: '徽章', comment: '玩家卡徽章膠囊下面的短標籤' })}
            </span>
          </li>
          <li className="ll-player__stat">
            <StatChip
              className="ll-player__chip"
              icon={<CardsIcon />}
              tone="terms"
              value={ratio(termsDone, termsTotal)}
              label={t({
                id: 'me.stat.terms',
                message: `圖鑑 ${termsDone}／${termsTotal}`,
                comment: '玩家卡的名詞圖鑑收集數；數字已格式化',
              })}
              href={localePath(locale, '/terms/')}
              data-testid="player-terms"
            />
            <span className="ll-player__cap" aria-hidden="true">
              {t({ id: 'me.stat.terms.cap', message: '圖鑑', comment: '玩家卡名詞圖鑑膠囊下面的短標籤' })}
            </span>
          </li>
          <li className="ll-player__stat">
            <StatChip
              className="ll-player__chip"
              icon={<HeartIcon filled />}
              tone="neutral"
              value={favCount}
              label={t({
                id: 'me.stat.favourites',
                message: `收藏的題目 ${favCount} 題`,
                comment: '玩家卡的收藏題數（點了捲到同一頁的收藏區）；favCount 已格式化',
              })}
              href={favourites.href}
              onClick={favourites.onClick}
              data-testid="player-favourites"
            />
            <span className="ll-player__cap" aria-hidden="true">
              {t({ id: 'me.stat.favourites.cap', message: '收藏', comment: '玩家卡收藏膠囊下面的短標籤' })}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
