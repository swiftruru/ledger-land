// 關卡的短編號（「1-2」、延伸章「E1-1」，地圖規格 4.1）：和地圖的 buildChapters 同一套算法，主線章依 order 編 1、2、3…，
// 延伸章另外從 E1 編起，關序是章節 levelIds 裡的位置。錯題本入口的關卡 Badge 用；查不到（下架、草稿）時回 undefined。
import type { ContentManifest } from '../../lib/content.ts';

export function levelCodeLabel(manifest: Pick<ContentManifest, 'chapters'>, levelId: string): string | undefined {
  const sorted = [...manifest.chapters].sort((a, b) => a.order - b.order);
  const groups: [readonly (typeof sorted)[number][], string][] = [
    [sorted.filter((c) => c.scope !== 'extension'), ''],
    [sorted.filter((c) => c.scope === 'extension'), 'E'],
  ];
  for (const [chapters, prefix] of groups) {
    for (let i = 0; i < chapters.length; i++) {
      const j = (chapters[i]!.levelIds ?? []).indexOf(levelId);
      if (j >= 0) return `${prefix}${i + 1}-${j + 1}`;
    }
  }
  return undefined;
}
