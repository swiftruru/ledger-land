// 「我的」徽章摘要卡的徽章橫排（站規 2.8）：已取得的徽章在前（依章節順序），後面用未取得的空徽章補到總數，讓收集感一眼看得出來。
// 一列排幾格由 CSS 決定（me.css：手機 6 格撐滿；600 起每格 48、間距 12，寬度夠就全部排），排不下的格子落到高度 0 的列、被裁掉。
// 徽章圖來自地圖的 ChapterBadge（地圖的 chunk），所以這個元件以 lazy 載入；純裝飾，外層 NavCard 的 media 已是 aria-hidden。
import { ChapterBadge } from '@ledgerland/web-ui/map';
import type { EarnedChapterBadge } from './player-stats.ts';

/** 最多畫幾格（目前 14 章；章節變多時也不超過這個數） */
export const BADGE_ROW_MAX = 16;

export default function BadgeRow({ list, total }: { list: readonly EarnedChapterBadge[]; total: number }) {
  const cells = Math.min(BADGE_ROW_MAX, Math.max(total, list.length));
  const shown = list.slice(0, cells);
  const empty = Math.max(0, cells - shown.length);
  return (
    <span className="ll-me-badges__row">
      {shown.map((b) => (
        <ChapterBadge key={b.chapterId} state={b.state} size={48} className="ll-me-badges__badge" />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <ChapterBadge key={`empty-${i}`} state="locked" size={48} className="ll-me-badges__badge is-empty" />
      ))}
    </span>
  );
}
