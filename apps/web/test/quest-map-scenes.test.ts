// 闖關地圖的場景（圖規第 6.2、11.1 節第 7 項）：scene-kit 的放置器與著地檢查，以及改寫成 SceneGeo 的場景（目前是第 1 章碼頭）的構圖不變式：
// 放下的每個物件框都不和保護框相交、底線落在宣告的地形塊內、在自己的區域裡（翼的物件離軌道 400px 以內、不在 rail 底下）；
// 軌道寬 343 以上時主角道具一定放得下（手機用 compact 尺寸）；同寬同資料結果相同。
// 掃描範圍：軌道寬 288 到 440 每 1px，區帶寬 320 到 2560 的常見寬度（含 600 到 767 這段沒有兩翼的 medium），字級 200% 與 125%。
// 第 1 章和地圖上一樣延伸到底部的地面（sceneGeo 的 below = GROUND，第 3 輪 handoff）。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  geometryFor,
  GROUND,
  layoutMap,
  rectsIntersect,
  sceneGeo,
  SEAM,
  type LayoutChapterInput,
  type MapGeometry,
  type SceneGeo,
} from '../src/features/quest-map/layout.ts';
import { seamFill, seamY, SEAM_MID, SEAM_MID_LOW } from '../src/features/quest-map/terrain.ts';
import { FIXTURE_CHAPTERS, fullFixtureData } from '../src/features/quest-map/fixtures.ts';
import { planDock } from '../src/features/quest-map-scenes/scene-dock.tsx';
import { planIslands } from '../src/features/quest-map-scenes/scene-islands.tsx';
import { planMarket } from '../src/features/quest-map-scenes/scene-market.tsx';
import { planRiver } from '../src/features/quest-map-scenes/scene-river.tsx';
import { planScale } from '../src/features/quest-map-scenes/scene-scale.tsx';
import { planLighthouse } from '../src/features/quest-map-scenes/scene-lighthouse.tsx';
import { planGears } from '../src/features/quest-map-scenes/scene-gears.tsx';
import { planFarm } from '../src/features/quest-map-scenes/scene-farm.tsx';
import { planBakery } from '../src/features/quest-map-scenes/scene-bakery.tsx';
import { planSummit } from '../src/features/quest-map-scenes/scene-summit.tsx';
import {
  grounded,
  placeProps,
  pointInPoly,
  rectPoly,
  smoothClosed,
  TRACK_MAX,
  WING_GAP,
  WING_REACH,
  WING_ROW,
  wingSpan,
  type Placed,
  type PropSpec,
  type TerrainBlock,
} from '../src/features/quest-map-scenes/scene-kit.tsx';

const contentChapters: LayoutChapterInput[] = (() => {
  const dir = new URL('../../../content/chapters/', import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { id: string; order: number; scope?: string; status?: string; levelIds: string[] })
    .filter((c) => c.status !== 'draft')
    .sort((a, b) => Number(a.scope === 'extension') - Number(b.scope === 'extension') || a.order - b.order)
    .map((c) => ({ id: c.id, levelIds: c.levelIds, extension: c.scope === 'extension' }));
})();

const COMPACT_TRACKS = Array.from({ length: 440 - 288 + 1 }, (_, i) => 288 + i);
const BANDS = [320, 360, 375, 430, 600, 640, 700, 767, 768, 900, 1023, 1024, 1100, 1280, 1366, 1440, 1600, 1920, 2560];
const GEOMETRIES: { label: string; g: MapGeometry }[] = [
  ...COMPACT_TRACKS.map((w) => ({ label: `軌道 ${w}`, g: geometryFor(w + 32) })),
  ...BANDS.map((vw) => ({ label: `區帶 ${vw}`, g: geometryFor(vw) })),
  ...[320, 375, 768, 1280, 1920].map((vw) => ({ label: `區帶 ${vw} 字級 200%`, g: geometryFor(vw, 32) })),
  { label: '區帶 375 字級 125%', g: geometryFor(375, 20) },
];

/** 改寫成 SceneGeo 的場景：正式內容的章序（0 起）與構圖函式。其他章改寫完就加一列 */
interface ScenePlan {
  readonly blocks: readonly TerrainBlock[];
  readonly props: readonly Placed[];
}
const SCENES: readonly { readonly name: string; readonly index: number; readonly plan: (geo: SceneGeo) => ScenePlan }[] = [
  { name: 'dock', index: 0, plan: planDock },
  { name: 'islands', index: 1, plan: planIslands },
  { name: 'market', index: 2, plan: planMarket },
  { name: 'scale', index: 3, plan: planScale },
  { name: 'river', index: 4, plan: planRiver },
  { name: 'lighthouse', index: 5, plan: planLighthouse },
  { name: 'gears', index: 6, plan: planGears },
  { name: 'farm', index: 7, plan: planFarm },
  { name: 'bakery', index: 8, plan: planBakery },
  { name: 'summit', index: 9, plan: planSummit },
];

const layouts = GEOMETRIES.map(({ label, g }) => ({ label, g, map: layoutMap(contentChapters, g) }));
const sceneCases = SCENES.flatMap((s) =>
  layouts.map(({ label, g, map }) => ({ scene: s, label: `${s.name} ${label}`, g, geo: sceneGeo(map.chapters[s.index]!, g, s.index === 0 ? GROUND : 0) })),
);
const dockCases = sceneCases.filter((c) => c.scene.name === 'dock');

function regionOk(p: Placed, geo: SceneGeo): boolean {
  if (p.y0 < SEAM - 0.01 || p.y1 > geo.h + 0.01) return false;
  if (p.region === 'track') return p.x0 >= geo.track.left && p.x1 <= geo.track.right;
  const span = wingSpan(p.region, geo);
  if (!span) return false;
  if (p.region === 'left') return p.x0 >= span.outer - 0.01 && p.x1 <= geo.track.left - WING_GAP + 0.01 && p.x0 >= geo.track.left - WING_REACH - 0.01;
  return p.x0 >= geo.track.right + WING_GAP - 0.01 && p.x1 <= span.outer + 0.01 && p.x1 <= geo.track.right + WING_REACH + 0.01;
}

describe('scene-kit 的放置器', () => {
  const geo: SceneGeo = {
    bp: 'expanded',
    bandW: 1280,
    h: 760,
    track: { left: 420, right: 980 },
    corridor: { entry: 476, exit: 476 },
    nodes: [{ x: 910, y: 512 }],
    protect: [{ kind: 'node', x0: 864, y0: 466, x1: 956, y1: 558 }],
    wings: { left: { x0: 120, y0: 0, x1: 420, y1: 760 }, right: { x0: 980, y0: 0, x1: 1280, y1: 760 } },
  };
  const sand: TerrainBlock = { id: 'sand', poly: rectPoly({ x0: 0, y0: SEAM, x1: 1280, y1: 760 }) };
  const sea: TerrainBlock = { id: 'sea', poly: rectPoly({ x0: 0, y0: 0, x1: 300, y1: 300 }) };

  it('依序試候選；和保護框或已放下的物件相交就換下一個，都不行就不畫', () => {
    const specs: PropSpec[] = [
      { id: 'a', tier: 'minor', ground: ['sand'], variants: [{ w: 40, h: 40, anchors: [{ wing: 'near', u: 0, v: 0.5 }] }] },
      {
        id: 'b',
        tier: 'minor',
        ground: ['sand'],
        variants: [
          {
            w: 40,
            h: 40,
            anchors: [
              { wing: 'near', u: 0, v: 0.5 },
              { wing: 'far', u: 0, v: 0.5 },
            ],
          },
        ],
      },
      // 壓在節點的保護框上，附近 32px 內也挪不開：不畫
      { id: 'c', tier: 'minor', ground: ['sand'], variants: [{ w: 60, h: 60, anchors: [{ track: true, u: (910 - 420) / 560, v: 542 / 760 }] }] },
    ];
    const out = placeProps(specs, geo, { blocks: [sand] });
    // b 的主位置被 a 佔了（附近 32px 內也挪不開），換到替代位置（另一翼）
    expect(out.map((p) => [p.id, p.region])).toEqual([
      ['a', 'left'],
      ['b', 'right'],
    ]);
    expect(rectsIntersect(out[0]!, out[1]!)).toBe(false);
    expect(placeProps(specs, geo, { blocks: [sand] })).toEqual(out);
  });

  it('著地：底線與底線往上 30% 都要在地形塊內；whole 要整個在內；! 開頭的地形塊不得碰到', () => {
    const blocks = [sand, sea];
    expect(grounded({ x0: 100, y0: 100, x1: 140, y1: 140 }, ['sea'], blocks)).toBe(true);
    expect(grounded({ x0: 100, y0: 280, x1: 140, y1: 320 }, ['sea'], blocks)).toBe(false);
    expect(grounded({ x0: 100, y0: 262, x1: 140, y1: 296 }, ['sea'], blocks, { whole: true })).toBe(true);
    expect(grounded({ x0: 280, y0: 100, x1: 320, y1: 140 }, ['sea'], blocks, { whole: true })).toBe(false);
    expect(grounded({ x0: 400, y0: 400, x1: 440, y1: 440 }, ['sand', '!sea'], blocks)).toBe(true);
    expect(grounded({ x0: 290, y0: 400, x1: 330, y1: 440 }, ['sand', '!sea'], blocks)).toBe(true);
    expect(grounded({ x0: 270, y0: 280, x1: 330, y1: 330 }, ['sand', '!sea'], blocks)).toBe(false);
    expect(grounded({ x0: 0, y0: 0, x1: 10, y1: 10 }, ['nope'], blocks)).toBe(false);
  });

  it('主角道具：候選都放不下時，在區域裡由近到遠找空位', () => {
    const hero: PropSpec = {
      id: 'h',
      tier: 'hero',
      ground: ['sand'],
      variants: [{ w: 60, h: 40, anchors: [{ track: true, u: (910 - 420) / 560, v: 532 / 760 }] }],
    };
    const [p] = placeProps([hero], geo, { blocks: [sand] });
    expect(p).toBeDefined();
    expect(geo.protect.some((r) => rectsIntersect(p!, r))).toBe(false);
    expect(regionOk(p!, geo)).toBe(true);
  });

  it('軌道裡的次要道具最多兩組；同一組（group）只佔一個名額；細節不佔名額', () => {
    const many: PropSpec[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      tier: 'minor',
      ground: ['sand'],
      variants: [{ w: 20, h: 20, anchors: [{ track: true, u: 0.1 + i * 0.15, v: 0.2 }] }],
    }));
    expect(placeProps(many, geo, { blocks: [sand] })).toHaveLength(TRACK_MAX);
    const grouped = many.map((s) => ({ ...s, group: 'g' }));
    expect(placeProps(grouped, geo, { blocks: [sand] })).toHaveLength(5);
    const details = many.map((s) => ({ ...s, tier: 'detail' as const }));
    expect(placeProps(details, geo, { blocks: [sand] })).toHaveLength(5);
  });

  it('平滑閉合曲線的取樣多邊形經過每個控制點', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const { d, poly } = smoothClosed(pts);
    expect(d.startsWith('M0 0 C')).toBe(true);
    for (const p of pts) expect(poly.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.01)).toBe(true);
    expect(pointInPoly({ x: 50, y: 50 }, poly)).toBe(true);
    expect(pointInPoly({ x: 150, y: 50 }, poly)).toBe(false);
  });
});

describe('場景的構圖不變式（圖規 11.1 第 7 項）', () => {
  it('每個物件框都不與保護框相交、底線落在宣告的地形塊內、在自己的區域裡、彼此不重疊', () => {
    const bad: string[] = [];
    for (const { scene, label, geo } of sceneCases) {
      const plan = scene.plan(geo);
      for (const p of plan.props) {
        const hit = geo.protect.find((r) => rectsIntersect(p, r));
        if (hit) bad.push(`${label} ${p.id} 碰到 ${hit.kind}`);
        if (!grounded(p, p.ground, plan.blocks, p)) bad.push(`${label} ${p.id} 沒有著地`);
        if (!regionOk(p, geo)) bad.push(`${label} ${p.id} 超出 ${p.region}`);
        for (const q of plan.props) if (q !== p && rectsIntersect(p, q)) bad.push(`${label} ${p.id} 和 ${q.id} 重疊`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('軌道寬 343 以上，每章的主角道具都放得下（手機用 compact 尺寸，不得被丟棄）', () => {
    const missing = sceneCases.filter(({ scene, g, geo }) => g.trackW >= 343 && !scene.plan(geo).props.some((p) => p.tier === 'hero')).map((c) => c.label);
    expect(missing).toEqual([]);
  });

  it('軌道裡最多兩個次要道具；每翼每 160px 章高最多一組；兩翼的物件不在 rail 底下', () => {
    const bad: string[] = [];
    for (const { scene, label, g, geo } of sceneCases) {
      const props = scene.plan(geo).props;
      const track = new Set(props.filter((p) => p.tier === 'minor' && p.region === 'track').map((p) => p.group)).size;
      if (track > TRACK_MAX) bad.push(`${label} 軌道 ${track} 組`);
      for (const side of ['left', 'right'] as const) {
        const groups = new Set(props.filter((p) => p.region === side && p.tier !== 'detail').map((p) => p.group)).size;
        if (groups > Math.max(2, Math.floor(geo.h / WING_ROW))) bad.push(`${label} ${side} ${groups} 組`);
      }
      for (const p of props) if (p.region !== 'track' && p.x0 < g.railZone) bad.push(`${label} ${p.id} 在 rail 底下`);
    }
    expect(bad).toEqual([]);
  });

  it('同寬同資料，構圖相同', () => {
    const differ = sceneCases.filter((_, i) => i % 7 === 0).filter(({ scene, geo }) => JSON.stringify(scene.plan(geo)) !== JSON.stringify(scene.plan(geo)));
    expect(differ.map((c) => c.label)).toEqual([]);
  });
});

describe('第 1 章碼頭', () => {
  it('翼夠寬時主角道具是棧橋（入口那一翼）；否則是軌道裡小海灣的木棧道（海灣放不下時是地圖）；有兩翼時兩翼頂端都是海', () => {
    const bad: string[] = [];
    for (const { label, geo } of dockCases) {
      const plan = planDock(geo);
      const hero = plan.props.find((p) => p.tier === 'hero');
      if (!hero) continue;
      const wings = !!(geo.wings.left && geo.wings.right);
      // 最小的棧橋 100 寬；翼的外側離區帶邊至少 16
      const pierFits = wings && geo.track.left - WING_GAP - Math.max(geo.wings.left?.x0 ?? 0, 16) >= 100;
      if (pierFits ? hero.form !== 'pier' || hero.region !== 'left' : !['jetty', 'map'].includes(hero.form) || hero.region !== 'track')
        bad.push(`${label} 主角道具是 ${hero.form}（${hero.region}）`);
      const sides = new Set(plan.waters.filter((w) => w.poly.some((p) => p.y < 4)).map((w) => w.side));
      if (wings && sides.size < 2) bad.push(`${label} 兩翼頂端的海只有 ${[...sides].join('、')}`);
    }
    expect(bad).toEqual([]);
  });

  it('手機（軌道寬 343 以上）：海從區帶邊伸進軌道成小海灣，木棧道與划船是主角道具（端頭一盞燈畫在裡面），攤開的地圖是次要道具', () => {
    const bad: string[] = [];
    for (const { label, g, geo } of dockCases) {
      if (g.bp !== 'compact' || g.trackW < 343) continue;
      const plan = planDock(geo);
      const hero = plan.props.find((p) => p.tier === 'hero');
      if (hero?.form !== 'jetty') bad.push(`${label} 主角道具是 ${hero?.form}`);
      const cove = plan.waters.find(
        (w) => w.poly.some((p) => p.x <= 0 || p.x >= geo.bandW) && w.poly.some((p) => p.x > geo.track.left + 40 && p.x < geo.track.right - 40),
      );
      if (!cove) bad.push(`${label} 沒有伸進軌道的海灣`);
      if (!plan.props.some((p) => p.id === 'map')) bad.push(`${label} 沒有攤開的地圖`);
    }
    expect(bad).toEqual([]);
  });

  it('地圖底部的地面（第 3 輪 handoff）：場景延伸到區段底下 GROUND，地面上至少有兩個物件，底線都在區段底下 160px 以內（手機的 Tab bar 擋不到）', () => {
    const bad: string[] = [];
    for (const { label, geo } of dockCases) {
      expect(geo.ground).toBe(GROUND);
      const sh = geo.h - GROUND;
      const below = planDock(geo).props.filter((p) => p.y0 >= sh);
      if (below.length < 2) bad.push(`${label} 地面上只有 ${below.length} 個`);
      for (const p of below) if (p.y1 > sh + 160) bad.push(`${label} ${p.id} 底線在區段底下 ${Math.round(p.y1 - sh)}`);
    }
    expect(bad).toEqual([]);
  });

  it('所有物件框都在區帶左右各 16px 以內（不被視窗裁掉）', () => {
    const bad: string[] = [];
    for (const { label, geo, scene } of sceneCases) for (const p of scene.plan(geo).props) if (p.x0 < 16 || p.x1 > geo.bandW - 16) bad.push(`${label} ${p.id}`);
    expect(bad).toEqual([]);
  });

  it('桌面的棧橋跨在岸線上：靠海那一端在水裡、靠沙灘那一端在沙上', () => {
    const bad: string[] = [];
    let piers = 0;
    for (const { label, geo } of dockCases) {
      const plan = planDock(geo);
      const pier = plan.props.find((p) => p.form === 'pier');
      if (!pier) continue;
      piers++;
      const sea = plan.blocks.filter((b) => b.id === 'sea');
      const y = (pier.y0 + pier.y1) / 2;
      if (!sea.some((b) => pointInPoly({ x: pier.x0 + 6, y }, b.poly))) bad.push(`${label} 棧橋端頭不在水裡`);
      if (sea.some((b) => pointInPoly({ x: pier.x1 - 6, y }, b.poly))) bad.push(`${label} 棧橋靠沙灘那一端在水裡`);
    }
    expect(piers).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe('第 1、2 章的交界（第 2 輪看圖驗收：海岸接得起來、沒有直的海岸線）', () => {
  const pairs = layouts.map(({ label, g, map }) => ({ label, g, c1: sceneGeo(map.chapters[0]!, g, GROUND), c2: sceneGeo(map.chapters[1]!, g) }));

  it('第 1 章頂端與第 2 章底端在交界上的陸地範圍一致（每 4px 取樣，過渡點兩側 4px 以外沒有不一致）', () => {
    const bad: string[] = [];
    for (const { label, c1, c2 } of pairs) {
      const dock = planDock(c1);
      const isles = planIslands(c2).blocks.filter((b) => b.id === 'isle');
      const low = (x: number) => !dock.waters.some((w) => pointInPoly({ x, y: 0.5 }, w.poly));
      const up = (x: number) => isles.some((b) => pointInPoly({ x, y: c2.h - 0.5 }, b.poly));
      for (let x = 2; x < c1.bandW - 2; x += 4) {
        if (low(x) === up(x) || low(x - 4) !== low(x + 4) || up(x - 4) !== up(x + 4)) continue;
        bad.push(`${label} x ${x}（第 1 章${low(x) ? '陸' : '海'}、第 2 章${up(x) ? '陸' : '海'}）`);
        break;
      }
    }
    expect(bad).toEqual([]);
  });

  it('第 2 章章節牌沙灘與第 1 章的海岸沒有直的垂直段：畫面內取樣後，x 不變（差 1px 以內）的連續一段不到 48px', () => {
    const bad: string[] = [];
    const check = (label: string, poly: readonly { x: number; y: number }[], w: number, h: number) => {
      const pts = poly.filter((p) => p.x > 1 && p.x < w - 1 && p.y > 0 && p.y < h);
      for (let i = 0; i < pts.length; i++) {
        let j = i;
        while (j + 1 < pts.length && Math.abs(pts[j + 1]!.x - pts[i]!.x) < 1 && Math.abs(pts[j + 1]!.y - pts[j]!.y) < 24) j++;
        if (Math.abs(pts[j]!.y - pts[i]!.y) >= 48) {
          bad.push(`${label} x ${pts[i]!.x.toFixed(0)} y ${pts[i]!.y.toFixed(0)} 到 ${pts[j]!.y.toFixed(0)}`);
          return;
        }
      }
    };
    for (const { label, c1, c2 } of pairs) {
      // 第 2 章沙灘只看露在外面的岸（被節點小島蓋住的那一段看不到）
      const plan2 = planIslands(c2);
      const others = plan2.isles.map((i) => i.poly);
      if (plan2.beach)
        check(
          `${label} 第 2 章沙灘`,
          plan2.beach.poly.filter((p) => !others.some((o) => pointInPoly(p, o))),
          c2.bandW,
          c2.h,
        );
      for (const wtr of planDock(c1).waters) check(`${label} 第 1 章 ${wtr.side} 的海`, wtr.poly, c1.bandW, c1.h);
    }
    expect(bad).toEqual([]);
  });
});

describe('第 2 章最後一座島的島頂（第 6 輪 handoff）', () => {
  /** 島（最後一座）在 y 這一列的左右界（多邊形每段和水平線的交點取極值） */
  const span = (poly: readonly { x: number; y: number }[], y: number): [number, number] => {
    let l = Infinity;
    let r = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
      const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
      l = Math.min(l, x);
      r = Math.max(r, x);
    }
    return [l, r];
  };
  /** 兩組 fixture（開發用 3 章、場景展示 14 章）：第 2 章頂端是海峽（blend） */
  const fixtureLayouts = [
    { name: 'fixture', chapters: FIXTURE_CHAPTERS.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension })) },
    {
      name: 'fixture full',
      chapters: fullFixtureData('zh-TW').chapters.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension })),
    },
  ].flatMap((d) =>
    GEOMETRIES.filter((x) => !x.label.startsWith('軌道') || x.label.endsWith('0')).map(({ label, g }) => ({
      label: `${d.name} ${label}`,
      g,
      map: layoutMap(d.chapters, g),
    })),
  );
  type P = { x: number; y: number };
  /** 多邊形上每一點前後 win（弧長）的兩點連成的方向差，取 shown 的點裡最大的（度） */
  const maxTurn = (poly: readonly P[], shown: (p: P) => boolean, win = 8) => {
    const n = poly.length;
    const cum = [0];
    for (let i = 1; i <= n; i++) cum.push(cum[i - 1]! + Math.hypot(poly[i % n]!.x - poly[i - 1]!.x, poly[i % n]!.y - poly[i - 1]!.y));
    const total = cum[n]!;
    const at = (s0: number): P => {
      const s = ((s0 % total) + total) % total;
      let i = 0;
      while (cum[i + 1]! < s) i++;
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      const t = (s - cum[i]!) / Math.max(1e-9, cum[i + 1]! - cum[i]!);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    let worst = 0;
    let where: P = { x: 0, y: 0 };
    for (let i = 0; i < n; i++) {
      const p = poly[i]!;
      if (!shown(p)) continue;
      const a = at(cum[i]! - win);
      const b = at(cum[i]! + win);
      let d = Math.abs(Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x)) * (180 / Math.PI);
      if (d > 180) d = 360 - d;
      if (d > worst) [worst, where] = [d, p];
    }
    return { worst, where };
  };
  /** 多邊形不相鄰的兩段在 shown 的範圍裡相交的第一個交點 */
  const selfCross = (poly: readonly P[], shown: (p: P) => boolean): P | null => {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const c = poly[j]!;
        const d = poly[(j + 1) % n]!;
        if (
          Math.max(a.x, b.x) < Math.min(c.x, d.x) ||
          Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
          Math.max(a.y, b.y) < Math.min(c.y, d.y) ||
          Math.max(c.y, d.y) < Math.min(a.y, b.y)
        )
          continue;
        const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
        const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
        if (t > 0 && t < 1 && u > 0 && u < 1) {
          const p = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
          if (shown(p)) return p;
        }
      }
    }
    return null;
  };

  it('上一章是陸地（第 3 章廣場）：該側離畫面邊有空間時，島側在接縫下方彎成圓角，該側波浪往下 4px 比往下 60px 寬 16px 以上（半徑 48 的圓角在往下 4px 時寬 29，起伏會吃掉一些）', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { label, g, map } of layouts) {
      const cl = map.chapters[1]!;
      const geo = { ...sceneGeo(cl, g), seam: seamFill(g.bandW, cl.seed, 'sea', 'plaza') };
      const plan = planIslands(geo);
      const isle = plan.isles[geo.nodes.length - 1]!.poly;
      // 圓角上端落在該側的波浪上（圓角外緣那一點的波浪高度）
      const [lRef, rRef] = span(isle, 80);
      const ywl = seamY(lRef - 48, cl.seed, SEAM_MID);
      const ywr = seamY(rRef + 48, cl.seed, SEAM_MID);
      const l0 = span(isle, ywl + 4)[0];
      const l1 = span(isle, ywl + 60)[0];
      const r0 = span(isle, ywr + 4)[1];
      const r1 = span(isle, ywr + 60)[1];
      if (l1 > 48 + 56 + 24 && l0 > 0) {
        checked++;
        if (l1 - l0 < 16) bad.push(`${label} 左側只寬 ${(l1 - l0).toFixed(0)}`);
      }
      if (g.bandW - r1 > 48 + 56 + 24 && r0 < g.bandW) {
        checked++;
        if (r0 - r1 < 16) bad.push(`${label} 右側只寬 ${(r0 - r1).toFixed(0)}`);
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });

  it('上方是另一種深淺的海（blend，fixture 的海峽，第 7 輪看圖驗收）：島頂兩角是往外凸的圓角，島頂比島身窄：該側（離畫面邊與島頂寬度都有空間時）「圓角那一段波浪最低點往下 4px」那一列再往下 4px，比往下 60px 窄 8px 以上', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { label, g, map } of [...layouts, ...fixtureLayouts]) {
      const cl = map.chapters[1]!;
      const geo = { ...sceneGeo(cl, g), seam: seamFill(g.bandW, cl.seed, 'sea', 'sea-deep') };
      const isle = planIslands(geo).isles[geo.nodes.length - 1]!.poly;
      const [lRef, rRef] = span(isle, 80);
      // 圓角與緩和段（島側往內 48 + 40）那一段的波浪最低點往下 4px
      const low = (x0: number, x1: number) => {
        let y = -Infinity;
        for (let x = x0; x <= x1; x += 2) y = Math.max(y, seamY(x, cl.seed, SEAM_MID_LOW));
        return y + 4;
      };
      const ywl = low(lRef, lRef + 88);
      const ywr = low(rRef - 88, rRef);
      const l0 = span(isle, ywl + 4)[0];
      const l1 = span(isle, ywl + 60)[0];
      const r0 = span(isle, ywr + 4)[1];
      const r1 = span(isle, ywr + 60)[1];
      const roomy = rRef - lRef > 160 + 32;
      if (roomy && l1 > 48 + 8) {
        checked++;
        if (l0 - l1 < 8) bad.push(`${label} 左側只收 ${(l0 - l1).toFixed(1)}`);
      }
      if (roomy && g.bandW - r1 > 48 + 8) {
        checked++;
        if (r1 - r0 < 8) bad.push(`${label} 右側只收 ${(r1 - r0).toFixed(1)}`);
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });

  it('岸線沒有尖岬、沒有交叉的小圈（第 7 輪看圖驗收：blend 的島頂兩端收成尖岬、小灣上緣是尖角，1024 的 fixture 在沙地上露出一道浪花細線）：畫面內每一點前後 8px 的轉向不超過 60 度，島的多邊形不自交', () => {
    const bad: string[] = [];
    const cases = [
      ...layouts.map((l) => ({ ...l, above: 'plaza' as const })),
      ...layouts.map((l) => ({ ...l, above: 'sea-deep' as const })),
      ...fixtureLayouts.map((l) => ({ ...l, above: 'sea-deep' as const })),
    ];
    for (const { label, g, map, above } of cases) {
      const cl = map.chapters[1]!;
      const seam = seamFill(g.bandW, cl.seed, 'sea', above)!;
      const geo = { ...sceneGeo(cl, g), seam };
      const plan = planIslands(geo);
      const mid = seam.blend ? SEAM_MID_LOW : SEAM_MID;
      // 上一章是陸地時，波浪以上被接縫蓋回（往外彎的圓角上端在波浪上轉成垂直，看不到）：只看波浪往下 8px 以下
      const shown = (p: { x: number; y: number }) => p.x > 2 && p.x < g.bandW - 2 && p.y < geo.h && p.y > seamY(p.x, cl.seed, mid) + (seam.blend ? -1 : 8);
      const end = plan.isles[geo.nodes.length - 1]!.poly;
      const t = maxTurn(end, shown);
      if (t.worst > 60) bad.push(`${label}（上方 ${above}）x ${t.where.x.toFixed(0)} y ${t.where.y.toFixed(0)} 轉 ${t.worst.toFixed(0)} 度`);
      plan.isles.forEach((isle, k) => {
        const x = selfCross(isle.poly, (p) => p.x > 0 && p.x < g.bandW && p.y > 0 && p.y < geo.h);
        if (x) bad.push(`${label}（上方 ${above}）第 ${k} 座島在 ${x.x.toFixed(0)}, ${x.y.toFixed(0)} 自交`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('小灣上緣的圓弧兩端接得順（第 8 輪看圖驗收：fixture 375 的圓弧往下接回島側時折出一個小肩，8px 內 60 度擋不住）：閉運算補上陸地的每一段圓弧，兩端在多邊形上前後 4px 的方向差不超過 15 度', () => {
    const bad: string[] = [];
    let joints = 0;
    const cases = [
      ...layouts.map((l) => ({ ...l, above: 'plaza' as const })),
      ...layouts.map((l) => ({ ...l, above: 'sea-deep' as const })),
      ...fixtureLayouts.map((l) => ({ ...l, above: 'sea-deep' as const })),
    ];
    for (const { label, g, map, above } of cases) {
      const cl = map.chapters[1]!;
      const seam = seamFill(g.bandW, cl.seed, 'sea', above)!;
      const geo = { ...sceneGeo(cl, g), seam };
      const end = planIslands(geo).isles[geo.nodes.length - 1]!;
      const mid = seam.blend ? SEAM_MID_LOW : SEAM_MID;
      const shown = (p: P) => p.x > 2 && p.x < g.bandW - 2 && p.y < geo.h && p.y > seamY(p.x, cl.seed, mid) + (seam.blend ? -1 : 8);
      // 圓弧：相鄰兩點在 8px 內的一串；兩端各找多邊形上最近的點
      const runs: P[][] = [];
      for (const b of end.bays ?? []) {
        const r = runs.find((q) => Math.hypot(q.at(-1)!.x - b.x, q.at(-1)!.y - b.y) < 8);
        if (r) r.push(b);
        else runs.push([b]);
      }
      const near = (b: P) => end.poly.reduce((q, p) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(q.x - b.x, q.y - b.y) ? p : q));
      for (const j of runs.filter((r) => r.length > 3).flatMap((r) => [near(r[0]!), near(r.at(-1)!)])) {
        if (!shown(j)) continue;
        joints++;
        const t = maxTurn(end.poly, (p) => shown(p) && Math.hypot(p.x - j.x, p.y - j.y) < 6, 4);
        if (t.worst > 15) bad.push(`${label}（上方 ${above}）x ${t.where.x.toFixed(0)} y ${t.where.y.toFixed(0)} 轉 ${t.worst.toFixed(0)} 度`);
      }
    }
    expect(joints).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('上方是另一種深淺的海（blend，fixture 的海峽）：島不越過接縫，島頂沿波浪（畫面內每一點都在波浪往下 0 到 8px 以下）', () => {
    const bad: string[] = [];
    for (const { label, g, map } of layouts) {
      const cl = map.chapters[1]!;
      const seam = seamFill(g.bandW, cl.seed, 'sea', 'sea-deep')!;
      expect(seam.blend).toBe(true);
      const geo = { ...sceneGeo(cl, g), seam };
      const isle = planIslands(geo).isles[geo.nodes.length - 1]!.poly;
      const hi = isle.filter((p) => p.x > 0 && p.x < g.bandW).find((p) => p.y < seamY(p.x, cl.seed, SEAM_MID_LOW) - 0.5);
      if (hi) bad.push(`${label} x ${hi.x.toFixed(0)} y ${hi.y.toFixed(1)}`);
      // 海峽的棧橋伸過波浪 8px（QuestMap 的 PierStub）：島頂在走廊的 x 不低於波浪往下 8px
      const x = geo.corridor.exit;
      if (x !== null) {
        const [l, r] = span(isle, seamY(x, cl.seed, SEAM_MID_LOW) + 6);
        if (!(l < x && x < r)) bad.push(`${label} 走廊 x ${x} 的棧橋端沒有落在島上`);
      }
    }
    expect(bad).toEqual([]);
  });
});
