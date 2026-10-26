// 首頁章節小地圖的取景（minimap-frame.ts，第 1 輪看圖驗收的 blocker）：節點不切一半、必要的節點都入鏡、新使用者從起點石開始
import { describe, expect, it } from 'vitest';
import { LAYOUT_MAX, MINI, ZOOMS, frameMiniMap, nodeBelow, type MiniFrame } from '../src/features/home/minimap-frame.ts';
import { NODE_GAP, TURN_SLOPE, layoutMap, trackGeometry, type ChapterLayout } from '../src/features/quest-map/layout.ts';

const H = 240;
const chapters = [3, 3, 4, 4, 2, 2, 3].map((n, c) => ({
  id: `ch_${c}`,
  levelIds: Array.from({ length: n }, (_, i) => `lv_${c}_${i}`),
  extension: c >= 4,
}));

/** 畫面上（px，向上）的範圍：目前關多了光暈與鈴；完成的計分關卡多了下方的星星籤 */
function extent(ch: ChapterLayout, i: number, z: number, current: boolean, stars = false) {
  const c = ch.nodes[i]!.y * z;
  const below = nodeBelow(stars);
  return current
    ? { lo: c - Math.max(below, MINI.nodeR + MINI.halo), hi: c + Math.max(MINI.nodeR + MINI.halo, MINI.bellStand + MINI.bell - MINI.bellTop) }
    : { lo: c - below, hi: c + MINI.nodeR };
}

/** 違規清單：跨過邊緣的節點、離邊緣不到 MARGIN 的必要節點 */
function problems(ch: ChapterLayout, f: MiniFrame, currentIdx: number, done: ReadonlySet<number> = new Set()): string[] {
  const z = f.zoom;
  const b = f.bottom * z;
  const t = f.top * z;
  const out: string[] = [];
  if (Math.abs(t - b - H) > 1e-6) out.push(`視窗高 ${t - b}`);
  ch.nodes.forEach((n, i) => {
    const e = extent(ch, i, z, i === currentIdx, done.has(i));
    const inside = e.lo >= b - 1e-6 && e.hi <= t + 1e-6;
    const outside = e.hi <= b + 1e-6 || e.lo >= t - 1e-6;
    // 不切一半：完整在框內或完整在框外
    if (!inside && !outside) out.push(`${n.levelId} 跨過視窗邊緣`);
    const tooClose = e.lo - b < MINI.margin - 1e-6 || t - e.hi < MINI.margin - 1e-6;
    if (f.required.includes(n.levelId) && tooClose) out.push(`${n.levelId} 離邊緣太近`);
  });
  return out;
}

describe('frameMiniMap（首頁章節小地圖的取景）', () => {
  it('縮小重排的軌道寬上限維持在 NODE_GAP ÷ tan 20° 加左右欄內縮 52 × 2 附近（和手機地圖同一種比例；要放寬時刻意一起改這裡）', () => {
    const bound = NODE_GAP / TURN_SLOPE + 2 * 52;
    expect(LAYOUT_MAX).toBeLessThanOrEqual(bound);
    expect(LAYOUT_MAX).toBeGreaterThan(bound - 16);
  });

  for (const trackW of [311, 391]) {
    const lay = layoutMap(chapters, trackGeometry(trackW));
    it(`軌道 ${trackW}：每一章的每一關當目前關，節點都不切一半，前一關與下一關都入鏡`, () => {
      for (const ch of lay.chapters) {
        ch.nodes.forEach((n, i) => {
          const f = frameMiniMap({
            nodes: ch.nodes,
            chapterHeight: ch.height,
            stoneY: ch.startStone?.y ?? null,
            currentId: n.levelId,
            fromStart: false,
            height: H,
          });
          expect(ZOOMS).toContain(f.zoom);
          // 前一關、目前關、下一關（同一章裡有的）都在必要節點裡
          const neighbours = ch.nodes.slice(Math.max(0, i - 1), i + 2).map((x) => x.levelId);
          expect(f.required).toEqual(expect.arrayContaining(neighbours));
          // 章內至少三關時，一定有三關入鏡（章首、章末往另一邊多放一關）
          expect(f.required.length).toBe(Math.min(3, ch.nodes.length));
          expect(problems(ch, f, i)).toEqual([]);
        });
      }
    });
  }

  it('新使用者：起點石、第一關與第二關入鏡，視窗下緣貼近起點石（為了不切到第三關可以再往下一點）', () => {
    const ch = layoutMap(chapters, trackGeometry(311)).chapters[0]!;
    const stone = ch.startStone!;
    const f = frameMiniMap({ nodes: ch.nodes, chapterHeight: ch.height, stoneY: stone.y, currentId: ch.nodes[0]!.levelId, fromStart: true, height: H });
    expect(f.required).toEqual([ch.nodes[0]!.levelId, ch.nodes[1]!.levelId]);
    const stoneBottom = stone.y * f.zoom - MINI.stoneR;
    expect(stoneBottom - f.bottom * f.zoom).toBeGreaterThanOrEqual(MINI.margin - 1e-6);
    expect(stoneBottom - f.bottom * f.zoom).toBeLessThanOrEqual(3 * MINI.margin);
    expect(problems(ch, f, 0)).toEqual([]);
  });

  it('完成的關卡下方有星星籤（第 2 輪看圖驗收）：星星籤也不切一半，必要的節點連星星籤都離邊緣至少 MARGIN', () => {
    for (const trackW of [311, 391]) {
      const lay = layoutMap(chapters, trackGeometry(trackW));
      for (const ch of lay.chapters) {
        ch.nodes.forEach((n, i) => {
          // 目前關之前的關卡都完成了（有星星籤）
          const done = new Set(ch.nodes.map((_, k) => k).filter((k) => k < i));
          const f = frameMiniMap({
            nodes: ch.nodes.map((x, k) => ({ levelId: x.levelId, y: x.y, stars: done.has(k) })),
            chapterHeight: ch.height,
            stoneY: ch.startStone?.y ?? null,
            currentId: n.levelId,
            fromStart: false,
            height: H,
          });
          expect(f.required).toContain(n.levelId);
          expect(problems(ch, f, i, done)).toEqual([]);
        });
      }
    }
  });

  it('沒有起點石的章（不是第 1 章）就算 fromStart 也照一般規則取景', () => {
    const ch = layoutMap(chapters, trackGeometry(311)).chapters[2]!;
    const f = frameMiniMap({ nodes: ch.nodes, chapterHeight: ch.height, stoneY: null, currentId: ch.nodes[1]!.levelId, fromStart: true, height: H });
    expect(f.required).toHaveLength(3);
    expect(problems(ch, f, 1)).toEqual([]);
  });
});
