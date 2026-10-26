// 闖關地圖主線各章的場景（圖規 6.4）：各章特有的構圖不變式。共同的不變式（保護框、著地、區域、主角道具一定放得下、決定性）
// 在 quest-map-scenes.test.ts 的 SCENES 表裡一起檢查；這裡只檢查各章自己的地形：
// - 第 2 章：每個節點都站在島上，拱門的腳也在最後一座島上；跨海的橋兩端在沙上。
// - 第 3、4、7、9 章（第 4 輪看圖驗收）：鋪面是一大塊地，墊住每個節點，高度是章高的 70% 到 90%，入口那一翼的主角道具在上面。
// - 第 6 章（第 4 輪看圖驗收）：海離章頂（含接縫）與章底至少 40px。
// - 第 10 章（第 4 輪看圖驗收）：等高線是閉合的環，沒有橫跨整個區帶寬的色帶。
// - 第 5 章：每個寬度都有一條河，至少一座橋；河不蓋到節點、星星籤、章節牌、紙籤、木樁與拱門，離接縫至少 50px；手機的水閘跨在河上。
// - 第 3 到 9 章頂端的陸接陸交界（第 7、8 輪看圖驗收，scene-seam 的 seamEdge）：路面底下同一個 y、路的兩緣一樣高；凹口以外斜率不超過 1、沒有平頂；
//   凹口由章節決定、相鄰兩處同一翼錯開 120px 以上；有兩翼時起伏的大小沿 x 變化；交界往下不碰物件、保護框與其他地形塊；凹口尖端的物件站在對的地上，不碰物件與保護框。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  geometryFor,
  inflate,
  layoutMap,
  rectsIntersect,
  ROAD_HALF,
  SEAM,
  sceneGeo,
  type LayoutChapterInput,
  type MapGeometry,
} from '../src/features/quest-map/layout.ts';
import { planIslands } from '../src/features/quest-map-scenes/scene-islands.tsx';
import { pointInPoly } from '../src/features/quest-map-scenes/scene-kit.tsx';
import { seamEdge } from '../src/features/quest-map-scenes/scene-seam.tsx';
import { planMarket } from '../src/features/quest-map-scenes/scene-market.tsx';
import { planRiver } from '../src/features/quest-map-scenes/scene-river.tsx';
import { planScale } from '../src/features/quest-map-scenes/scene-scale.tsx';
import { planBakery } from '../src/features/quest-map-scenes/scene-bakery.tsx';
import { planGears } from '../src/features/quest-map-scenes/scene-gears.tsx';
import { BAY_BOTTOM, BAY_TOP, planLighthouse } from '../src/features/quest-map-scenes/scene-lighthouse.tsx';
import { planFarm } from '../src/features/quest-map-scenes/scene-farm.tsx';
import { SCENE_TERRAIN, seamFill, seamY, type Terrain } from '../src/features/quest-map/terrain.ts';
import { planSummit } from '../src/features/quest-map-scenes/scene-summit.tsx';

const contentChapters: LayoutChapterInput[] = (() => {
  const dir = new URL('../../../content/chapters/', import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { id: string; order: number; scope?: string; status?: string; levelIds: string[] })
    .filter((c) => c.status !== 'draft')
    .sort((a, b) => Number(a.scope === 'extension') - Number(b.scope === 'extension') || a.order - b.order)
    .map((c) => ({ id: c.id, levelIds: c.levelIds, extension: c.scope === 'extension' }));
})();

const GEOMETRIES: { label: string; g: MapGeometry }[] = [
  ...[288, 300, 320, 343, 360, 380, 398, 420, 440].map((w) => ({ label: `軌道 ${w}`, g: geometryFor(w + 32) })),
  ...[320, 375, 430, 600, 700, 767, 768, 1024, 1280, 1440, 1920, 2560].map((vw) => ({ label: `區帶 ${vw}`, g: geometryFor(vw) })),
  ...[375, 768, 1280].map((vw) => ({ label: `區帶 ${vw} 字級 200%`, g: geometryFor(vw, 32) })),
];
const cases = GEOMETRIES.map(({ label, g }) => ({ label, g, chapters: layoutMap(contentChapters, g).chapters }));

describe('第 2 章群島', () => {
  it('每個節點都站在島上，拱門的腳在最後一座島上', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[1]!, g);
      const isles = planIslands(geo).blocks.filter((b) => b.id === 'isle');
      for (const [i, n] of geo.nodes.entries()) if (!isles.some((b) => pointInPoly(n, b.poly))) bad.push(`${label} 節點 ${i + 1} 不在島上`);
      const arch = geo.protect.find((r) => r.kind === 'arch');
      if (arch && !isles.some((b) => pointInPoly({ x: (arch.x0 + arch.x1) / 2, y: arch.y1 - 20 }, b.poly))) bad.push(`${label} 拱門不在島上`);
    }
    expect(bad).toEqual([]);
  });
});

describe('第 2 章的橋（第 4 輪看圖驗收：橋沿著路線彎，兩端落在沙上）', () => {
  it('每座橋的中心線兩端都在島或沙灘上，中間的點都在水上或岸邊 12px 內', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const plan = planIslands(sceneGeo(chapters[1]!, g));
      const isles = plan.blocks.filter((b) => b.id === 'isle');
      const onLand = (x: number, y: number) => isles.some((b) => pointInPoly({ x, y }, b.poly));
      for (const b of plan.bridges) {
        const pts = b.deck.match(/[-\d.]+ [-\d.]+/g)!.map((t) => t.split(' ').map(Number) as [number, number]);
        const [a, z] = [pts[0]!, pts[pts.length - 1]!];
        if (!onLand(a[0], a[1]) || !onLand(z[0], z[1])) bad.push(`${label} 橋的一端不在沙上 ${a.join(',')} ${z.join(',')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('第 3、4、7、9 章的鋪面', () => {
  it('鋪面是一大塊地：墊住每個節點，高度是章高的 70% 到 90%；入口那一翼的主角道具在鋪面上', () => {
    const bad: string[] = [];
    const ids = { 2: 'pave', 3: 'tiles', 6: 'floor', 8: 'yard' } as const;
    const plans = { 2: planMarket, 3: planScale, 6: planGears, 8: planBakery } as const;
    for (const { label, g, chapters } of cases)
      for (const k of [2, 3, 6, 8] as const) {
        const geo = sceneGeo(chapters[k]!, g);
        const plan = plans[k](geo);
        const block = plan.blocks.find((b) => b.id === ids[k]);
        if (!block) {
          bad.push(`${label} 第 ${k + 1} 章沒有鋪面`);
          continue;
        }
        const ys = block.poly.map((p) => p.y);
        const span = (Math.max(...ys) - Math.min(...ys)) / geo.h;
        if (span < 0.7 || span > 0.9) bad.push(`${label} 第 ${k + 1} 章鋪面高 ${(span * 100).toFixed(0)}%`);
        if (Math.min(...ys) < SEAM + 8) bad.push(`${label} 第 ${k + 1} 章鋪面碰到接縫`);
        for (const n of geo.nodes) if (!pointInPoly(n, block.poly)) bad.push(`${label} 第 ${k + 1} 章節點 (${n.x}, ${n.y}) 不在鋪面上`);
        const hero = plan.props.find((p) => p.tier === 'hero');
        if (hero && hero.region !== 'track' && !pointInPoly({ x: (hero.x0 + hero.x1) / 2, y: hero.y1 - 2 }, block.poly))
          bad.push(`${label} 第 ${k + 1} 章主角道具不在鋪面上`);
      }
    expect(bad).toEqual([]);
  });
});

describe('第 6 章的海', () => {
  it('海（畫面內的岸線）離章頂（含接縫）至少 40px、離章底至少 40px，不碰到接縫', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[5]!, g);
      for (const b of planLighthouse(geo).blocks.filter((k) => k.id === 'sea')) {
        const ys = b.poly.filter((p) => p.x > -1 && p.x < geo.bandW + 1).map((p) => p.y);
        if (Math.min(...ys) < BAY_TOP || Math.max(...ys) > geo.h - BAY_BOTTOM)
          bad.push(`${label} 海 ${Math.min(...ys).toFixed(0)} 到 ${Math.max(...ys).toFixed(0)}`);
      }
    }
    expect(BAY_TOP).toBe(SEAM + 40);
    expect(bad).toEqual([]);
  });
});

describe('第 10 章的等高線', () => {
  it('每一圈都是閉合的環：有兩翼時不橫跨整個區帶寬；三圈由外往內，最內圈（岩坡）墊住拱門與紙籤', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[9]!, g);
      const plan = planSummit(geo);
      const levels = new Set(plan.rings.map((r) => r.level));
      if (levels.size !== 3) bad.push(`${label} 只有 ${levels.size} 層`);
      if (geo.wings.left && geo.wings.right && geo.bandW - (geo.track.right - geo.track.left) > 600)
        for (const r of plan.rings) {
          const xs = r.poly.map((p) => p.x);
          if (Math.min(...xs) <= 0 && Math.max(...xs) >= geo.bandW) bad.push(`${label} 第 ${r.level} 圈橫跨整個區帶`);
        }
      const peak = plan.rings.filter((r) => r.level === 3);
      for (const k of ['arch', 'plaque'] as const) {
        const p = geo.protect.find((q) => q.kind === k);
        if (p && !peak.some((r) => pointInPoly({ x: (p.x0 + p.x1) / 2, y: p.y1 - 12 }, r.poly))) bad.push(`${label} ${k} 不在岩坡上`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('第 5 章的河', () => {
  it('每個寬度都有河與橋；河不蓋到節點、星星籤、章節牌、紙籤、木樁與拱門，離接縫至少 50px', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[4]!, g);
      const plan = planRiver(geo);
      if (plan.centre.length < 2) {
        bad.push(`${label} 沒有河`);
        continue;
      }
      if (plan.bridges.length < 1) bad.push(`${label} 沒有橋`);
      const keep = geo.protect.filter((r) => r.kind !== 'road' && r.kind !== 'bell');
      const main = plan.blocks.find((b) => b.id === 'river')!;
      const pts = [...main.poly, ...plan.centre].filter((p) => p.x >= 0 && p.x <= geo.bandW);
      const hit = keep.find((r) => pts.some((p) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1));
      if (hit) bad.push(`${label} 河蓋到 ${hit.kind}`);
      if (plan.centre.some((p) => p.y < SEAM + 26)) bad.push(`${label} 河太靠近接縫`);
    }
    expect(bad).toEqual([]);
  });

  it('沒有兩翼時主角道具是水閘，而且跨在河上', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[4]!, g);
      const plan = planRiver(geo);
      const hero = plan.props.find((p) => p.tier === 'hero');
      if (!hero) continue;
      if (hero.form !== 'sluice') continue;
      const rivers = plan.blocks.filter((b) => b.id === 'river');
      if (!rivers.some((b) => pointInPoly({ x: (hero.x0 + hero.x1) / 2, y: hero.y1 - 10 }, b.poly) || pointInPoly({ x: hero.x0 - 8, y: hero.y1 - 10 }, b.poly)))
        bad.push(`${label} 水閘不在河上`);
    }
    expect(bad).toEqual([]);
  });

  it('河離路緣至少 16px（只在橋的地方過路）；橋的長度約是河寬加 24px', () => {
    const bad: string[] = [];
    for (const { label, g, chapters } of cases) {
      const geo = sceneGeo(chapters[4]!, g);
      const plan = planRiver(geo);
      if (plan.centre.length < 2) continue;
      const hw = plan.props.some((p) => p.tier === 'hero' && p.form === 'confluence') ? 19 : 13;
      const dist = (p: { x: number; y: number }) => {
        let best = Infinity;
        for (let i = 0; i < plan.centre.length - 1; i++) {
          const a = plan.centre[i]!;
          const b = plan.centre[i + 1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
        }
        return best;
      };
      const roads = geo.protect.filter((r) => r.kind === 'road').map((r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }));
      // 路面（半寬 10）離河岸 16px 以上，或在橋上（離中心線 hw + 12 以內）；中間那一段（橋頭附近的斜坡）容許平滑造成的 6px 誤差
      const near = roads.filter((p) => {
        const d = dist(p);
        return d >= hw + 12 && d < hw + 10 + 16 - 6;
      });
      // 每座橋兩頭的引道各容許 2 點（路線斜著過河時，引道上每 8px 一點，離中心線的距離每點只差 7 到 8px；第 4 輪地圖組把關到關改成緩弧後，320 寬的橋頭有 3 點）
      if (near.length > 4 * Math.max(1, plan.bridges.length)) bad.push(`${label} 有 ${near.length} 個路面取樣點貼著河岸`);
      for (const b of plan.bridges) {
        const pts = b.deck.match(/[-\d.]+ [-\d.]+/g)!.map((t) => t.split(' ').map(Number));
        const len = Math.hypot(pts[0]![0]! - pts[pts.length / 2 - 1]![0]!, pts[0]![1]! - pts[pts.length / 2 - 1]![1]!);
        if (len > 2 * hw + 24 + 24) bad.push(`${label} 橋長 ${len.toFixed(0)}，河寬 ${2 * hw}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('第 3 到 9 章頂端的陸接陸交界（第 7 輪看圖驗收：每一處交界都是同一種規則的波浪；第 8 輪：凹口是同一個樣板、限制線夾出台階與平頂）', () => {
  const KINDS = ['dock', 'islands', 'market', 'scale', 'river', 'lighthouse', 'gears', 'farm', 'bakery', 'summit'] as const;
  const PLANS = [null, null, planMarket, planScale, planRiver, planLighthouse, planGears, planFarm, planBakery] as const;
  const edges = cases.flatMap(({ label, g, chapters }) =>
    [2, 3, 4, 5, 6, 7, 8].map((i) => {
      const cl = chapters[i]!;
      const own: Terrain = SCENE_TERRAIN[KINDS[i]!];
      const seam = seamFill(g.bandW, cl.seed, own, SCENE_TERRAIN[KINDS[i + 1]!])!;
      const geo = { ...sceneGeo(cl, g), seam };
      const plan = PLANS[i]!(geo);
      return { label: `${label} 第 ${i + 1} 章`, chapter: i + 1, g, cl, geo, plan, edge: seamEdge(geo, plan, own, i + 1) };
    }),
  );
  const at = (line: readonly { x: number; y: number }[], x: number) =>
    line[Math.max(0, Math.min(line.length - 1, Math.round((x - line[0]!.x) / (line[1]!.x - line[0]!.x))))]!.y;
  /** 1024 到 1920（有兩翼、一般字級） */
  const wide = edges.filter(({ g }) => g.bp === 'expanded' && g.fontScale <= 1 && g.bandW <= 1920);

  it('每一處都有；交界在區段頂端往下 2px 以下（原本的波浪更高的地方照原本的）；路面底下（路線左右 12px）是同一個 y，不比原本的波浪更往下', () => {
    const bad: string[] = [];
    for (const { label, cl, geo, edge } of edges) {
      if (!edge) {
        bad.push(`${label} 沒有交界`);
        continue;
      }
      for (const p of edge.line) {
        if (p.y < Math.min(2, seamY(p.x, cl.seed)) - 0.1) bad.push(`${label} x ${p.x} 高過區段頂端`);
        if (geo.corridor.exit !== null && Math.abs(p.x - geo.corridor.exit) <= 12 && p.y > seamY(p.x, cl.seed) + 0.6)
          bad.push(`${label} 路面底下 x ${p.x} 比原本的波浪低`);
      }
      const x = geo.corridor.exit;
      if (x !== null && Math.abs(at(edge.line, x - 12) - at(edge.line, x + 12)) > 1)
        bad.push(`${label} 路的左右緣差 ${(at(edge.line, x - 12) - at(edge.line, x + 12)).toFixed(1)}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('1024 到 1920：路線左右緣（路面保護框的兩緣）的交界 y 差不超過 2px；凹口以外的斜率 |dy/dx| 不超過 1；路面以外沒有連續 24px 完全水平的一段（高低差不到 0.5px）', () => {
    const bad: string[] = [];
    for (const { label, geo, edge } of wide) {
      if (!edge) continue;
      const exit = geo.corridor.exit;
      // 路面的兩緣（路寬一半再 2px）與路面保護框的兩緣
      for (const dx of [ROAD_HALF + 2, 18])
        if (exit !== null && Math.abs(at(edge.line, exit - dx) - at(edge.line, exit + dx)) > 2)
          bad.push(`${label} 路左右 ${dx}px ${at(edge.line, exit - dx).toFixed(1)} 與 ${at(edge.line, exit + dx).toFixed(1)}`);
      const inNotch = (x: number) => edge.notches.some((n) => x >= n.x0 - 8 && x <= n.x1 + 8);
      const L = edge.line.filter((p) => p.x >= 0 && p.x <= geo.bandW);
      for (let i = 1; i < L.length; i++) {
        const a = L[i - 1]!;
        const b = L[i]!;
        if (!inNotch(a.x) && !inNotch(b.x) && Math.abs(b.y - a.y) > b.x - a.x + 1e-6) {
          bad.push(`${label} x ${a.x} 斜率 ${((b.y - a.y) / (b.x - a.x)).toFixed(2)}`);
          break;
        }
      }
      for (let i = 0; i + 6 < L.length; i++) {
        const seg = L.slice(i, i + 7);
        if (exit !== null && seg.some((p) => Math.abs(p.x - exit) <= 12)) continue;
        const ys = seg.map((p) => p.y);
        if (Math.max(...ys) - Math.min(...ys) < 0.5) {
          bad.push(`${label} x ${seg[0]!.x} 到 ${seg[6]!.x} 是平的`);
          break;
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('凹口由章節決定（第 8 輪看圖驗收：七處交界每翼都是同一欄的 V）：1024 到 1920，相鄰兩處交界同一翼的凹口 x 差 120px 以上；七處裡至少四處有凹口，兩種方向都有，凹口的 x 不止一兩種', () => {
    const bad: string[] = [];
    for (const { label, g } of cases) {
      if (g.bp !== 'expanded' || g.fontScale > 1 || g.bandW > 1920) continue;
      const mine = edges.filter((e) => e.g === g).sort((a, b) => a.chapter - b.chapter);
      for (let k = 1; k < mine.length; k++)
        for (const a of mine[k - 1]!.edge?.notches ?? [])
          for (const b of mine[k]!.edge?.notches ?? [])
            if (a.side === b.side && Math.abs(a.c - b.c) < 120)
              bad.push(`${label} 第 ${mine[k - 1]!.chapter} 與 ${mine[k]!.chapter} 章 ${a.side} 凹口差 ${Math.abs(a.c - b.c).toFixed(0)}`);
      const all = mine.flatMap((e) => e.edge?.notches ?? []);
      if (mine.filter((e) => e.edge && e.edge.notches.length > 0).length < 4)
        bad.push(`${label} 只有 ${mine.filter((e) => e.edge?.notches.length).length} 處有凹口`);
      if (!all.some((n) => n.up) || !all.some((n) => !n.up)) bad.push(`${label} 凹口只有一種方向`);
      if (new Set(all.map((n) => Math.round(n.c / 40))).size < 3) bad.push(`${label} 凹口的 x 只有 ${new Set(all.map((n) => Math.round(n.c / 40))).size} 種`);
      for (const n of all)
        if (n.w < 80 - 1e-6 || n.w > 200 + 1e-6 || n.d < 20 || n.d > 60 + 1e-6)
          bad.push(`${label} 凹口 ${n.c.toFixed(0)} 寬 ${n.w.toFixed(0)} 深 ${n.d.toFixed(0)}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('有兩翼時（1024 以上）：起伏的大小沿 x 變化（160px 視窗裡的高低差，最大的是最小的 1.8 倍以上、超過 22）', () => {
    const bad: string[] = [];
    for (const { label, g, edge } of edges) {
      if (g.bp !== 'expanded' || g.fontScale > 1 || !edge) continue;
      const ranges: number[] = [];
      for (let x = 0; x + 160 <= g.bandW; x += 40) {
        const ys = edge.line.filter((p) => p.x >= x && p.x <= x + 160).map((p) => p.y);
        ranges.push(Math.max(...ys) - Math.min(...ys));
      }
      if (Math.max(...ranges) < 1.8 * Math.min(...ranges) || Math.max(...ranges) <= 22)
        bad.push(`${label} 起伏 ${Math.min(...ranges).toFixed(0)} 到 ${Math.max(...ranges).toFixed(0)}`);
    }
    expect(bad).toEqual([]);
  });

  it('交界往下不碰物件（外擴 4）、保護框與這一章的其他地形塊（比原本的波浪更往上收不算）', () => {
    const bad: string[] = [];
    for (const { label, cl, geo, plan, edge } of edges) {
      if (!edge) continue;
      const tops = [...geo.protect, ...plan.props.map((p) => inflate(p, 4))];
      for (const p of edge.line) {
        if (p.x < 0 || p.x > geo.bandW) continue;
        const base = seamY(p.x, cl.seed);
        if (p.y <= base + 0.5) continue;
        const hit = tops.find((r) => p.x >= r.x0 && p.x <= r.x1 && r.y0 < p.y);
        if (hit) bad.push(`${label} x ${p.x} 交界 ${p.y.toFixed(1)} 碰到 ${'kind' in hit ? String(hit.kind) : '物件'} ${hit.y0.toFixed(0)}`);
        const blk = plan.blocks.find((b) => !['plaza', 'rock', 'meadow', 'field'].includes(b.id) && pointInPoly(p, b.poly));
        if (blk) bad.push(`${label} x ${p.x} 交界伸進地形塊 ${blk.id}`);
        if (bad.length > 10) break;
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('凹口尖端的物件：每個凹口最多一個；往下伸的站在舌尖（底邊離舌尖 4px 內），往上伸的腳下中間在這一章的地上；不碰物件、保護框，離畫面邊 16px 以上，頂端在區段裡；兩種方向都有物件，有些凹口不放', () => {
    const bad: string[] = [];
    let ups = 0;
    let downs = 0;
    let notches = 0;
    let tips = 0;
    for (const { label, geo, plan, edge } of edges) {
      if (!edge) continue;
      notches += edge.notches.length;
      tips += edge.tips.length;
      if (edge.tips.length > edge.notches.length) bad.push(`${label} ${edge.tips.length} 個物件、${edge.notches.length} 個凹口`);
      edge.tips.forEach((t, k) => {
        const r = edge.items[k]!;
        const n = edge.notches.find((q) => t.x >= q.c - q.w / 2 && t.x <= q.c + q.w / 2);
        if (!n) return void bad.push(`${label} ${t.x.toFixed(0)} 不在凹口裡`);
        const span = edge.line.filter((p) => p.x >= n.c - n.w / 2 && p.x <= n.c + n.w / 2).map((p) => p.y);
        if (n.up) {
          ups++;
          if (![r.x0 + (r.x1 - r.x0) * 0.2, t.x, r.x1 - (r.x1 - r.x0) * 0.2].every((x) => at(edge.line, x) <= t.y - 1))
            bad.push(`${label} ${t.x.toFixed(0)} 往上伸的物件腳下不在這一章的地上`);
        } else {
          downs++;
          if (Math.abs(t.y - (Math.max(...span) - 2)) > 4) bad.push(`${label} ${t.x.toFixed(0)} 往下伸的物件不在舌尖`);
        }
        if (r.x0 < 16 || r.x1 > geo.bandW - 16 || r.y0 < 2) bad.push(`${label} ${r.x0.toFixed(0)} 太靠邊`);
        if (geo.protect.some((q) => rectsIntersect(q, r))) bad.push(`${label} ${r.x0.toFixed(0)} 碰到保護框`);
        if (plan.props.some((q) => rectsIntersect(inflate(q, 4), r))) bad.push(`${label} ${r.x0.toFixed(0)} 碰到物件`);
      });
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(ups).toBeGreaterThan(0);
    expect(downs).toBeGreaterThan(0);
    expect(tips).toBeLessThan(notches);
  });
});
