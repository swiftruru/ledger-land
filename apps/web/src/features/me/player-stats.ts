// 玩家的統計（站規 1.15 的玩家卡、2.1 首頁捷徑、2.8「我的」的選單列）：星星總數、徽章 n／m、圖鑑 n／m、上次匯出時間。
// 只在第一次繪製之後以 import() 載入（usePlayerStats）：徽章的判定沿用地圖的 progress.ts（星星算出的等級與已存的 unlock 取較高者，
// 和「我的 › 徽章」補寫之後看到的一致），圖鑑的分子分母沿用名詞圖鑑的 collectionCounts（參考名詞不算）。沒有 DOM、沒有 React。
import type { Locale } from '@ledgerland/i18n';
import type { BackupReminderState } from '@ledgerland/progress';
import { loadTermIndex } from '../../lib/content.ts';
import { getProgressStore } from '../../lib/progress/index.ts';
import { collectionCounts, unlockedTermMap } from '../glossary/unlocks.ts';
import { contentSource, type QuestMapData } from '../quest-map/data.ts';
import { badgeStateFor, loadMapProgress, totalStars, type BadgeState, type MapProgress } from '../quest-map/progress.ts';

export interface EarnedChapterBadge {
  readonly chapterId: string;
  readonly state: Exclude<BadgeState, 'locked'>;
}

export interface PlayerStats {
  readonly stars: number;
  readonly badges: { readonly earned: number; readonly total: number; readonly list: readonly EarnedChapterBadge[] };
  /** 讀不到名詞索引時是 null（只少一個數字，不影響其他） */
  readonly terms: { readonly done: number; readonly total: number } | null;
  /** 上次匯出備份的時間（ISO）；沒有匯出過是 null */
  readonly lastExportedAt: string | null;
}

/** 已取得的徽章（依章節順序）：精通是同一枚徽章的進階外觀，不另外計數 */
export function earnedChapterBadges(data: QuestMapData, progress: MapProgress): EarnedChapterBadge[] {
  const out: EarnedChapterBadge[] = [];
  for (const c of data.chapters) {
    const state = badgeStateFor(data, progress, c.id);
    if (state !== 'locked') out.push({ chapterId: c.id, state });
  }
  return out;
}

export async function loadPlayerStats(locale: Locale, loaded?: { data: QuestMapData; progress: MapProgress }): Promise<PlayerStats> {
  const [data, progress] = loaded ? [loaded.data, loaded.progress] : await Promise.all([contentSource.load(locale), loadMapProgress()]);
  const list = earnedChapterBadges(data, progress);
  const [terms, extra] = await Promise.all([
    Promise.all([loadTermIndex(locale), getProgressStore().then((s) => s.listUnlocks('term'))])
      .then(([index, unlocks]) => {
        const c = collectionCounts(index, unlockedTermMap(unlocks));
        return { done: c.done ?? 0, total: c.total };
      })
      .catch(() => null),
    getProgressStore()
      .then((s) => s.getSetting('backupReminder'))
      .then((r) => (r?.value as BackupReminderState | undefined)?.lastExportedAt ?? null)
      .catch(() => null),
  ]);
  return {
    stars: totalStars(progress),
    badges: { earned: list.length, total: data.chapters.length, list },
    terms,
    lastExportedAt: extra,
  };
}
