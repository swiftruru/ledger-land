// 名詞圖鑑與徽章要用的章節索引：manifest 的章節順序與關卡清單，加上章節索引檔（chapterIndex）裡的章節名、徽章名與關卡名。
// 全部來自已 precache 的快照，沒有新的網路請求；某一章讀不到時只缺名稱，不影響其他章。
import { useEffect, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import { loadChapterIndex, loadManifest, type ChapterSummary } from '../../lib/content.ts';
import { numberChapters, type ChapterIndexEntry } from './unlocks.ts';

export interface ChapterInfo {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly badgeTitle?: string;
  readonly levelTitles: ReadonlyMap<string, string>;
}

export interface GlossaryIndex {
  readonly chapters: readonly ChapterIndexEntry[];
  readonly info: ReadonlyMap<string, ChapterInfo>;
}

export async function loadGlossaryIndex(locale: Locale): Promise<GlossaryIndex> {
  const m = await loadManifest();
  // 章節索引一檔就有全部章節的名稱、徽章名與關卡名（08 第 7.3 節）；讀不到時只缺名稱
  const summaries = await loadChapterIndex(locale).catch((): ChapterSummary[] => []);
  const byId = new Map(summaries.map((s) => [s.id, s] as const));
  // 章序和地圖一樣主線與延伸區分開編（manifest 的 scope；舊 manifest 沒有時看章節索引）
  const chapters: ChapterIndexEntry[] = numberChapters(m.chapters.map((c) => ({ ...c, scope: c.scope ?? byId.get(c.id)?.scope })));
  const info = new Map<string, ChapterInfo>();
  for (const c of chapters) {
    const s = byId.get(c.id);
    if (!s) continue;
    const entry: ChapterInfo = {
      id: c.id,
      order: c.order,
      title: s.title,
      levelTitles: new Map((s.levels ?? []).map((l) => [l.id, l.title])),
      ...(s.badge?.title === undefined ? {} : { badgeTitle: s.badge.title }),
    };
    info.set(c.id, entry);
  }
  return { chapters, info };
}

/** null 代表還在讀；manifest 讀不到時回空索引（頁面另外顯示離線提示）。一掛載就讀（維護者 2026-10-26：資料齊了才一次出現，不再延到第一次繪製之後），
 *  頁面把「不是 null」算進 usePageReady 的條件 */
export function useGlossaryIndex(locale: Locale): GlossaryIndex | null {
  const [value, setValue] = useState<GlossaryIndex | null>(null);
  useEffect(() => {
    let alive = true;
    setValue(null);
    loadGlossaryIndex(locale).then(
      (v) => alive && setValue(v),
      () => alive && setValue({ chapters: [], info: new Map() }),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return value;
}
