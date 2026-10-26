// 延伸區四章（外海小島）與海峽的場景（圖規 6.4、11.1 第 7 項）：構圖的不變式。
// 每個物件框不和保護框相交、底線落在宣告的地形塊內、在自己的區域裡、彼此不重疊；軌道寬 343 以上主角道具一定放得下；
// 島把節點、星星籤、拱門腳、紙籤木樁與主角道具墊住；章節牌與立柱站在沙灘上；草地在沙地裡；路線在沙地或橋上；
// 上下兩章（與海峽頂端）在交界處的沙地一致、橋接得起來；兩島之間岸到岸至少 48px、看得到的岸線沒有超過 200px 的水平直岸（第 5 輪看圖驗收）；同寬同資料結果相同。
// 第 6 輪看圖驗收：最上面那一章的紙籤整張在島上、跨過交界的橋上下兩截欄杆同一個 x 且重疊、手機水道的岸線與淺水外緣沒有 20px 以上的水平段。
// 掃描範圍和 quest-map-scenes.test.ts 相同（軌道寬 288 到 440 每 1px，區帶寬 320 到 2560 的常見寬度，字級 200% 與 125%），另外加上兩組 fixture。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  geometryFor,
  layoutMap,
  rectsIntersect,
  sceneGeo,
  SEAM,
  type LayoutChapterInput,
  type MapGeometry,
  type SceneGeo,
} from '../src/features/quest-map/layout.ts';
import { planFinance } from '../src/features/quest-map-scenes/scene-isle-finance.tsx';
import { bannerSpan, footPoly, northShore, southShore, type IslePlan } from '../src/features/quest-map-scenes/scene-isle-kit.tsx';
import { planLedger } from '../src/features/quest-map-scenes/scene-isle-ledger.tsx';
import { planStakeholders } from '../src/features/quest-map-scenes/scene-isle-stakeholders.tsx';
import { planValuation } from '../src/features/quest-map-scenes/scene-isle-valuation.tsx';
import { planStrait } from '../src/features/quest-map-scenes/scene-strait.tsx';
import { FIXTURE_CHAPTERS, fullFixtureData } from '../src/features/quest-map/fixtures.ts';
import { seamFill, seamY } from '../src/features/quest-map/terrain.ts';
import {
  grounded,
  pointInPoly,
  TRACK_MAX,
  WING_GAP,
  WING_REACH,
  WING_ROW,
  wingSpan,
  type Placed,
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
/** 正式內容、開發用的 3 章 fixture（?ll-fixture=quest）與 14 章的場景展示 fixture（?ll-fixture=quest-full） */
const DATASETS: readonly { readonly name: string; readonly chapters: readonly LayoutChapterInput[] }[] = [
  { name: '正式內容', chapters: contentChapters },
  { name: 'fixture', chapters: FIXTURE_CHAPTERS.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension })) },
  { name: 'fixture full', chapters: fullFixtureData('zh-TW').chapters.map((c) => ({ id: c.id, levelIds: c.levels.map((l) => l.id), extension: c.extension })) },
];

const COMPACT_TRACKS = Array.from({ length: 440 - 288 + 1 }, (_, i) => 288 + i);
const BANDS = [320, 360, 375, 430, 600, 640, 700, 767, 768, 900, 1023, 1024, 1100, 1280, 1366, 1440, 1600, 1920, 2560];
const GEOMETRIES: { label: string; g: MapGeometry }[] = [
  ...COMPACT_TRACKS.map((w) => ({ label: `軌道 ${w}`, g: geometryFor(w + 32) })),
  ...BANDS.map((vw) => ({ label: `區帶 ${vw}`, g: geometryFor(vw) })),
  ...[320, 375, 768, 1280, 1920].map((vw) => ({ label: `區帶 ${vw} 字級 200%`, g: geometryFor(vw, 32) })),
  { label: '區帶 375 字級 125%', g: geometryFor(375, 20) },
];

interface ScenePlan {
  readonly blocks: readonly TerrainBlock[];
  readonly props: readonly Placed[];
}
const ISLES: readonly { readonly name: string; readonly plan: (geo: SceneGeo) => ScenePlan }[] = [
  { name: 'isle-valuation', plan: planValuation },
  { name: 'isle-finance', plan: planFinance },
  { name: 'isle-stakeholders', plan: planStakeholders },
  { name: 'isle-ledger', plan: planLedger },
];

const layouts = DATASETS.flatMap((d) =>
  GEOMETRIES.map(({ label, g }) => ({ label: `${d.name} ${label}`, g, map: layoutMap(d.chapters, g), firstExt: d.chapters.findIndex((c) => c.extension) })),
);
/** 每個案例的構圖只算一次（各項檢查共用；決定性的檢查另外用 raw 重算） */
function memo(f: (geo: SceneGeo) => ScenePlan): (geo: SceneGeo) => ScenePlan {
  const cache = new WeakMap<SceneGeo, ScenePlan>();
  return (geo) => {
    let p = cache.get(geo);
    if (!p) cache.set(geo, (p = f(geo)));
    return p;
  };
}
const cases = layouts.flatMap(({ label, g, map, firstExt }) => [
  ...ISLES.flatMap((s, i) => {
    const cl = map.chapters[firstExt + i];
    // 和地圖上一樣帶入頂端接縫：延伸各章之間同是深海（沒有接縫），最上面那一章的波浪填 --ll-bg（島頂要離它的波谷 10px 以上）
    const top = firstExt + i === map.chapters.length - 1;
    return cl
      ? [
          {
            name: s.name,
            plan: memo(s.plan),
            raw: s.plan,
            label: `${s.name} ${label}`,
            g,
            seed: cl.seed,
            geo: { ...sceneGeo(cl, g), seam: seamFill(g.bandW, cl.seed, 'sea-deep', top ? null : 'sea-deep') },
          },
        ]
      : [];
  }),
  {
    name: 'strait',
    plan: memo(planStrait as (geo: SceneGeo) => ScenePlan),
    raw: planStrait as (geo: SceneGeo) => ScenePlan,
    label: `strait ${label}`,
    g,
    seed: 0,
    geo: sceneGeo(map.strait!, g),
  },
]);
const isleCases = cases.filter((c) => c.name !== 'strait');

function regionOk(p: Placed, geo: SceneGeo): boolean {
  if (p.y0 < SEAM - 0.01 || p.y1 > geo.h + 0.01) return false;
  if (p.region === 'track') return p.x0 >= geo.track.left && p.x1 <= geo.track.right;
  const span = wingSpan(p.region, geo);
  if (!span) return false;
  if (p.region === 'left') return p.x0 >= span.outer - 0.01 && p.x1 <= geo.track.left - WING_GAP + 0.01 && p.x0 >= geo.track.left - WING_REACH - 0.01;
  return p.x0 >= geo.track.right + WING_GAP - 0.01 && p.x1 <= span.outer + 0.01 && p.x1 <= geo.track.right + WING_REACH + 0.01;
}

const inAny = (blocks: readonly TerrainBlock[], id: string, x: number, y: number) => blocks.some((b) => b.id === id && pointInPoly({ x, y }, b.poly));

describe('延伸區與海峽的構圖不變式（圖規 11.1 第 7 項）', () => {
  it('每個物件框都不與保護框相交、底線落在宣告的地形塊內、在自己的區域裡、彼此不重疊', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of cases) {
      const { blocks, props } = plan(geo);
      for (const p of props) {
        const hit = geo.protect.find((r) => rectsIntersect(p, r));
        if (hit) bad.push(`${label} ${p.id} 碰到 ${hit.kind}`);
        if (!grounded(p, p.ground, blocks, p)) bad.push(`${label} ${p.id} 沒有著地`);
        if (!regionOk(p, geo)) bad.push(`${label} ${p.id} 超出 ${p.region}`);
        for (const q of props) if (q !== p && rectsIntersect(p, q)) bad.push(`${label} ${p.id} 和 ${q.id} 重疊`);
      }
    }
    expect(bad).toEqual([]);
    // 第一項檢查替所有案例算好構圖（memo），之後的檢查共用
  }, 60_000);

  it('紙籤與章節牌正下方 16px 也不放東西（G9 的量法）', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const under = geo.protect.filter((p) => p.kind === 'plaque' || p.kind === 'banner').map((p) => ({ ...p, y0: p.y1, y1: p.y1 + 16 }));
      for (const p of plan(geo).props) if (under.some((r) => rectsIntersect(p, r))) bad.push(`${label} ${p.id}`);
    }
    expect(bad).toEqual([]);
  });

  it('軌道寬 343 以上，每章的主角道具都放得下（手機用小一號，放在節點的空側）', () => {
    const missing = isleCases.filter(({ g, geo, plan }) => g.trackW >= 343 && !plan(geo).props.some((p) => p.tier === 'hero')).map((c) => c.label);
    expect(missing).toEqual([]);
  });

  it('入口那一翼深 112px 以上時主角道具在那一翼（四章最小的翼上尺寸都放得下）；在翼上時一定是入口那一翼', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const hero = plan(geo).props.find((p) => p.tier === 'hero');
      if (!hero) continue;
      const near = geo.corridor.entry < (geo.track.left + geo.track.right) / 2 ? 'left' : 'right';
      const span = wingSpan(near, geo);
      if (span && Math.abs(span.inner - span.outer) >= 112 && hero.region !== near) bad.push(`${label} 主角道具在 ${hero.region}，應該在 ${near}`);
      if (hero.region !== 'track' && hero.region !== near) bad.push(`${label} 主角道具在另一翼`);
    }
    expect(bad).toEqual([]);
  });

  it('軌道裡最多兩個次要道具；每翼每 160px 章高最多一組；兩翼的物件不在 rail 底下', () => {
    const bad: string[] = [];
    for (const { label, g, geo, plan } of cases) {
      const props = plan(geo).props;
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

  it('手機（軌道寬 343 以上）的夜景：海峽有三顆海面燈光，延伸第 1 章的島上有一盞燈', () => {
    const bad: string[] = [];
    for (const { name, label, g, geo, plan } of cases) {
      if (g.bp !== 'compact' || g.trackW < 343) continue;
      const props = plan(geo).props;
      if (name === 'strait' && props.filter((p) => p.form === 'light').length < 3) bad.push(`${label} 海面燈光不到三顆`);
      if (name === 'isle-valuation' && !props.some((p) => p.form === 'lamp')) bad.push(`${label} 島上沒有燈`);
    }
    expect(bad).toEqual([]);
  });

  it('同寬同資料，構圖相同', () => {
    const differ = cases.filter((_, i) => i % 9 === 0).filter(({ geo, raw }) => JSON.stringify(raw(geo)) !== JSON.stringify(raw(geo)));
    expect(differ.map((c) => c.label)).toEqual([]);
  });
});

describe('外海小島的地形', () => {
  it('島墊住節點外圈、星星籤、拱門腳、紙籤木樁與主角道具；草地在沙地裡', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const { blocks, props } = plan(geo);
      const need = [
        ...geo.protect.filter((p) => p.kind === 'node' || p.kind === 'stars'),
        // 木樁只看插進地裡的那一截（字級放大時是紙籤後面的一根長柱）
        ...geo.protect.filter((p) => p.kind === 'stake').map((p) => ({ ...p, y0: Math.max(p.y0, p.y1 - 40) })),
        ...geo.protect.filter((p) => p.kind === 'arch').map((p) => ({ ...p, y0: p.y1 - 0.45 * (p.y1 - p.y0) })),
        ...props.filter((p) => p.tier === 'hero'),
      ];
      for (const r of need)
        for (const [x, y] of [
          [r.x0, r.y0],
          [r.x1, r.y0],
          [r.x0, r.y1],
          [r.x1, r.y1],
        ] as const)
          if (!inAny(blocks, 'isle', x, y)) bad.push(`${label} (${x.toFixed(0)}, ${y.toFixed(0)}) 不在島上`);
      const meadow = blocks.find((b) => b.id === 'meadow')!;
      const out = meadow.poly.filter((p, i) => i % 4 === 0 && p.x > 0 && p.x < geo.bandW && !inAny(blocks, 'isle', p.x, p.y));
      if (out.length) bad.push(`${label} 草地有 ${out.length} 點在沙地外`);
    }
    expect(bad).toEqual([]);
  });

  it('路線經過的地方都在沙地或棧橋上，路面不會浮在海上', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const { blocks } = plan(geo);
      for (const r of geo.protect.filter((p) => p.kind === 'road')) {
        const x = (r.x0 + r.x1) / 2;
        const y = (r.y0 + r.y1) / 2;
        if (y > 1 && y < geo.h - 1 && !inAny(blocks, 'isle', x, y) && !inAny(blocks, 'pier', x, y))
          bad.push(`${label} 路面 (${x.toFixed(0)}, ${y.toFixed(0)})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('章節牌立在地上（圖規 4.4）：延伸第 1 章的卡片與立柱外擴 24 都在南岸的沙灘上；其他章的兩根立柱站在下方那座島的北岸沙岬上，腳下與左右 12px 都是沙地', () => {
    const bad: string[] = [];
    for (const { label, g, map, firstExt } of layouts) {
      const geos = ISLES.map((_, i) => map.chapters[firstExt + i]).map((cl) => (cl ? sceneGeo(cl, g) : null));
      ISLES.forEach((s, i) => {
        const geo = geos[i];
        if (!geo) return;
        const { blocks } = s.plan(geo);
        const ban = geo.protect.find((p) => p.kind === 'banner')!;
        if (i === 0) {
          // 保護框（卡片加立柱外擴 12）的四角與上下緣中點；沙灘的邊比它再多 12 到 24（圓角處少一點）
          const r = { x0: ban.x0, y0: ban.y0, x1: ban.x1, y1: geo.h - 4 + 8 };
          for (const x of [r.x0, (r.x0 + r.x1) / 2, r.x1])
            for (const y of [r.y0, r.y1])
              if (x > 0 && x < geo.bandW && !inAny(blocks, 'isle', x, Math.min(y, geo.h - 0.5)))
                bad.push(`${label} ${s.name} (${x.toFixed(0)}, ${y.toFixed(0)})`);
          return;
        }
        const lower = geos[i - 1]!;
        const below = ISLES[i - 1]!.plan(lower).blocks;
        // 立柱 6 × 12：卡片左右緣往內 24，腳在章底往上 4
        const c0 = ban.x0 + 12;
        const c1 = ban.x1 - 12;
        for (const [p0, p1] of [
          [c0 + 24, c0 + 30],
          [c1 - 30, c1 - 24],
        ] as const)
          for (const x of [p0 - 12, (p0 + p1) / 2, p1 + 12]) {
            if (x <= 0 || x >= geo.bandW) continue;
            for (const y of [geo.h - 16, geo.h - 4, geo.h - 0.5])
              if (!inAny(blocks, 'isle', x, y)) bad.push(`${label} ${s.name} 立柱 (${x.toFixed(0)}, ${y - geo.h})`);
            for (const y of [0.5, 8]) if (!inAny(below, 'isle', x, y)) bad.push(`${label} ${ISLES[i - 1]!.name} 立柱下方 (${x.toFixed(0)}, ${y})`);
          }
      });
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('跨海的橋（和第 2 章同一種，沿路線）：路線離開沙地的每一段都在橋上，岸上那一端再伸進沙地至少 5px；碰到交界的那一截一路接到交界', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const { blocks } = plan(geo);
      // 路線的中心線（保護框中心依路線順序），每 2px 取一點
      const road = geo.protect.filter((p) => p.kind === 'road').map((r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }));
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < road.length - 1; i++) {
        const a = road[i]!;
        const b = road[i + 1]!;
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
        for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
      }
      const kind = pts.map((p) => (inAny(blocks, 'isle', p.x, p.y) ? 'isle' : inAny(blocks, 'pier', p.x, p.y) ? 'pier' : 'sea'));
      kind.forEach((k, i) => {
        // 正好在區段上下緣的點不算（橋的那一截剛好收在交界上）
        if (k === 'sea' && pts[i]!.y > 0.5 && pts[i]!.y < geo.h - 0.5) bad.push(`${label} 路線 (${pts[i]!.x.toFixed(0)}, ${pts[i]!.y.toFixed(0)}) 在水裡`);
        // 從橋上岸（往前或往後）的那一點，再走 5px 仍在橋上
        for (const d of [1, -1]) {
          const prev = kind[i - d];
          const q = pts[i + 3 * d];
          if (k === 'isle' && prev === 'pier' && q && !inAny(blocks, 'pier', q.x, q.y))
            bad.push(`${label} 橋在 (${pts[i]!.x.toFixed(0)}, ${pts[i]!.y.toFixed(0)}) 沒有伸進沙地`);
        }
      });
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('有出口的章：拱門（含拱心石）與紙籤整塊在島上，北岸離拱心石頂與拱頂外緣至少 16px；橋不碰拱心石', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      if (geo.corridor.exit === null) continue;
      const { blocks } = plan(geo);
      const arch = geo.protect.find((p) => p.kind === 'arch')!;
      const plaque = geo.protect.find((p) => p.kind === 'plaque')!;
      // 拱心石頂在拱門外框頂往上 6（保護框外擴 8）
      const top = arch.y0 + 2;
      // 拱門的外形（web-ui ChapterEnd 的 96 × 104：拱心石 x 35 到 61、外拱半徑 41 圓心 (48, 44)、柱子 x 7 到 89、台座 x 2 到 94 頂在 92）：
      // 每一個 x 從外形頂端往上 16px 到台座底都在島上（手機的北岸在橋頭以外往畫面邊彎下去，拱頂外側不必是一整個矩形）
      const ax = arch.x0 + 8;
      const ay = arch.y0 + 8;
      const outline = (u: number) => (u >= 35 && u <= 61 ? top - ay : u >= 7 && u <= 89 ? 44 - Math.sqrt(Math.max(0, 41 * 41 - (u - 48) ** 2)) : 92);
      for (let x = Math.max(2, ax + 2); x <= Math.min(geo.bandW - 2, ax + 94); x += 4)
        for (let y = ay + outline(x - ax) - 16; y <= ay + 102; y += 4)
          if (!inAny(blocks, 'isle', x, y)) {
            bad.push(`${label} 拱門 (${x}, ${y.toFixed(0)}) 不在島上`);
            break;
          }
      // 紙籤的保護框是最大的那一張（字多、字級放大時才這麼高），整張與上方 16px 都在島上
      for (let x = Math.max(2, plaque.x0 + 12); x <= Math.min(geo.bandW - 2, plaque.x1 - 12); x += 8)
        for (let y = Math.max(0.5, plaque.y0 + 12 - 16); y <= plaque.y1 - 12; y += 4)
          if (!inAny(blocks, 'isle', x, y)) {
            bad.push(`${label} 紙籤 (${x}, ${y.toFixed(0)}) 不在島上`);
            break;
          }
      for (const b of blocks.filter((k) => k.id === 'pier' && Math.min(...k.poly.map((p) => p.y)) < 1))
        if (Math.max(...b.poly.map((p) => p.y)) > top - 4) bad.push(`${label} 橋碰到拱心石`);
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('最上面那一章（沒有出口）的紙籤整張在島上（第 6 輪看圖驗收：紙籤左側一截懸在海上）：手機與字級放大時整個保護框，桌面與平板（字級 100%）是保護框下緣往上 104（卡片最高約 80 加外擴 12 再多 12）；左右再多 12（卡片外 24）', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { label, g, geo, plan } of isleCases) {
      if (geo.corridor.exit !== null) continue;
      checked++;
      const { blocks } = plan(geo);
      const p = geo.protect.find((r) => r.kind === 'plaque')!;
      const full = g.bp === 'compact' || g.fontScale > 1;
      const y0 = full ? p.y0 : Math.max(p.y0, p.y1 - 104);
      const xs = [...Array.from({ length: Math.floor((p.x1 - p.x0 + 24) / 8) + 1 }, (_, i) => p.x0 - 12 + 8 * i), p.x1 + 12];
      for (const x of xs) {
        if (x <= 0 || x >= geo.bandW) continue;
        let miss = false;
        for (let y = y0; y <= p.y1 && !miss; y += 4)
          if (!inAny(blocks, 'isle', x, y)) {
            bad.push(`${label} 紙籤 (${x.toFixed(0)}, ${y.toFixed(0)}) 不在島上`);
            miss = true;
          }
        if (miss) break;
      }
      if (bad.length > 20) break;
    }
    expect(checked).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  it('最上面那一章（沒有出口）的淺水外緣離地圖上緣接縫的波浪（含波谷）至少 10px（第 7 輪看圖驗收：1024 到 1920 有幾段只剩 1 到 3px，深水帶斷掉）：區帶寬 1024 到 2560 與 768，每 10px 取樣', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { label, geo, plan, seed } of isleCases) {
      if (geo.corridor.exit !== null || !/區帶 (768|1024|1100|1280|1366|1440|1600|1920|2560)$/.test(label)) continue;
      checked++;
      const reefs = plan(geo).blocks.filter((b) => b.id === 'reef');
      for (let x = 0; x <= geo.bandW; x += 10) {
        let top = Infinity;
        for (const r of reefs)
          for (let i = 0; i < r.poly.length; i++) {
            const a = r.poly[i]!;
            const b = r.poly[(i + 1) % r.poly.length]!;
            if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) top = Math.min(top, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
          }
        if (top > 140) continue;
        // 淺水外緣的浪花線 3px（外半 1.5）
        const gap = top - 1.5 - seamY(x, seed);
        if (gap < 10) {
          bad.push(`${label} x ${x} 只離 ${gap.toFixed(1)}px`);
          break;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });

  it('延伸章之間跨過交界的橋（第 6 輪看圖驗收：上下兩截之間有一道 1px 的縫、欄杆錯開約 1px）：上下兩章的欄杆在交界上同一個 x（差 0.3px 以內），兩截都越過交界 2px，交界上下 3px 內橋面兩側（離中線 14）都在橋面上', () => {
    const bad: string[] = [];
    type Pt = { x: number; y: number };
    const subpaths = (d: string): Pt[][] =>
      d
        .split('M')
        .filter(Boolean)
        .map((sub) =>
          sub.split('L').map((pair) => {
            const [x, y] = pair.trim().split(/\s+/).map(Number);
            return { x: x!, y: y! };
          }),
        );
    // 折線在水平線 y 上的 x（第一個交點）
    const xAt = (line: readonly Pt[], y: number) => {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i]!;
        const b = line[i + 1]!;
        if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
      }
      return NaN;
    };
    const dist = (line: readonly Pt[], p: Pt) => {
      let d = Infinity;
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i]!;
        const b = line[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        d = Math.min(d, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
      }
      return d;
    };
    let checked = 0;
    for (const { label, g, map, firstExt } of layouts) {
      for (let i = 1; i < ISLES.length; i++) {
        const cu = map.chapters[firstExt + i];
        const cb = map.chapters[firstExt + i - 1];
        if (!cu || !cb) continue;
        const up = sceneGeo(cu, g);
        const lo = sceneGeo(cb, g);
        const upper = (ISLES[i]!.plan(up) as unknown as IslePlan).shape.bridges ?? [];
        const lower = (ISLES[i - 1]!.plan(lo) as unknown as IslePlan).shape.bridges ?? [];
        const ub = upper.find((b) => Math.max(...b.poly.map((p) => p.y)) > up.h - 1);
        const lb = lower.find((b) => Math.min(...b.poly.map((p) => p.y)) < 1);
        if (!ub || !lb) {
          bad.push(`${label} ${ISLES[i]!.name} 交界上沒有橋`);
          continue;
        }
        checked++;
        const ud = subpaths(ub.deck)[0]!;
        const ld = subpaths(lb.deck)[0]!;
        if (Math.max(...ud.map((p) => p.y)) < up.h + 1.9) bad.push(`${label} ${ISLES[i]!.name} 橋面沒有越過交界`);
        if (Math.min(...ld.map((p) => p.y)) > -1.9) bad.push(`${label} ${ISLES[i - 1]!.name} 橋面沒有越過交界`);
        const ur = subpaths(ub.rails)
          .map((r) => xAt(r, up.h))
          .sort((a, b) => a - b);
        const lr = subpaths(lb.rails)
          .map((r) => xAt(r, 0))
          .sort((a, b) => a - b);
        if (ur.length !== 2 || lr.length !== 2 || ur.some((x, k) => !(Math.abs(x - lr[k]!) <= 0.3)))
          bad.push(`${label} ${ISLES[i]!.name} 欄杆 ${ur.map((x) => x.toFixed(2)).join(',')} 對 ${lr.map((x) => x.toFixed(2)).join(',')}`);
        const x = up.corridor.entry;
        for (const dx of [-14, 14])
          for (const dy of [0.5, 1.5, 2.5]) {
            if (dist(ud, { x: x + dx, y: up.h - dy }) > 17.5) bad.push(`${label} ${ISLES[i]!.name} (${dx}, -${dy}) 不在橋面上`);
            if (dist(ld, { x: x + dx, y: dy }) > 17.5) bad.push(`${label} ${ISLES[i - 1]!.name} (${dx}, ${dy}) 不在橋面上`);
          }
      }
      if (bad.length > 20) break;
    }
    expect(checked).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  }, 60_000);

  it('手機：兩島之間走廊那一側的水道，交界下方 70px 內看得到的岸線與淺水外緣（橋兩側 20px 以外）沒有超過 20px 的水平段（第 6 輪看圖驗收：北岸平平地伸到畫面外，淺水帶在交界下方是一條約 42px 的水平直邊）', () => {
    const bad: string[] = [];
    for (const { label, g, geo, plan } of isleCases) {
      if (g.bp !== 'compact' || geo.corridor.exit === null) continue;
      const x0 = geo.corridor.exit;
      const seen = (p: { x: number; y: number }) => p.y >= -2 && p.y <= 70 && p.x >= 0 && p.x <= geo.bandW && Math.abs(p.x - x0) >= 20;
      for (const b of plan(geo).blocks.filter((k) => k.id === 'isle' || k.id === 'reef')) {
        const pts = b.poly;
        for (let i = 0; i < pts.length; i++) {
          const s0 = pts[i]!;
          if (!seen(s0)) continue;
          let lo = s0.x;
          let hi = s0.x;
          for (let j = i + 1; j < pts.length; j++) {
            const q = pts[j]!;
            if (!seen(q) || Math.abs(q.y - s0.y) > 3) break;
            lo = Math.min(lo, q.x);
            hi = Math.max(hi, q.x);
          }
          if (hi - lo > 20) {
            bad.push(`${label} ${b.id} y ${s0.y.toFixed(0)} 從 x ${lo.toFixed(0)} 到 ${hi.toFixed(0)}`);
            break;
          }
        }
      }
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  });

  it('兩座島之間（第 5 輪看圖驗收）：上方那一章的島岸離下方那座島的北岸至少 48px（岸到岸）；兩島只在遠側沒有空間時於卡片後面接起來', () => {
    const bad: string[] = [];
    for (const { label, g, map, firstExt } of layouts) {
      ISLES.forEach((s, i) => {
        if (i === 0) return;
        const cl = map.chapters[firstExt + i];
        const cb = map.chapters[firstExt + i - 1];
        if (!cl || !cb) return;
        const geo = sceneGeo(cl, g);
        const lower = sceneGeo(cb, g);
        const north = northShore(lower, lower.corridor.exit!, ISLES[i - 1]!.name);
        const same = northShore(geo, geo.corridor.entry, ISLES[i - 1]!.name);
        if (JSON.stringify(north) !== JSON.stringify(same)) bad.push(`${label} ${s.name} 上下兩章算出的北岸不同`);
        const C = north.pts.map((p) => ({ x: p.x, y: p.y + geo.h }));
        const isle = s.plan(geo).blocks.find((b) => b.id === 'isle')!;
        const ban = geo.protect.find((p) => p.kind === 'banner')!;
        const left = geo.corridor.entry < (geo.track.left + geo.track.right) / 2;
        // 接起來的那一段（卡片遠緣往內 140 以外）藏在卡片後面，不量
        const joint = (x: number) => north.joined && (left ? x > ban.x1 - 12 - 140 : x < ban.x0 + 12 + 140);
        let min = Infinity;
        let at = '';
        for (const p of isle.poly) {
          if (p.y < geo.h - 260 || p.x < 0 || p.x > geo.bandW || joint(p.x)) continue;
          for (let k = 0; k < C.length - 1; k++) {
            const a = C[k]!;
            const b = C[k + 1]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
            if (d < min) {
              min = d;
              at = `(${p.x.toFixed(0)}, ${(p.y - geo.h).toFixed(0)})`;
            }
          }
        }
        if (min < 48) bad.push(`${label} ${s.name} 離北岸 ${min.toFixed(1)}px ${at}`);
      });
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('看得到的岸線沒有超過 200px 的水平直岸（第 5 輪看圖驗收：上下兩島平行的直岸像人工運河）；章節牌卡片擋住的地方不算', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const ban = geo.protect.find((p) => p.kind === 'banner')!;
      // 卡片（最矮約 78px）擋住的範圍
      const hidden = (p: { x: number; y: number }) => p.x > ban.x0 + 12 && p.x < ban.x1 - 12 && p.y > geo.h - 16 - 70 && p.y < geo.h - 16;
      for (const b of plan(geo).blocks.filter((k) => k.id === 'isle')) {
        const pts = b.poly;
        let i = 0;
        while (i < pts.length) {
          const s0 = pts[i]!;
          if (s0.x < 0 || s0.x > geo.bandW || s0.y < 0 || s0.y > geo.h || hidden(s0)) {
            i++;
            continue;
          }
          let j = i;
          let x0 = s0.x;
          let x1 = s0.x;
          while (j + 1 < pts.length) {
            const q = pts[j + 1]!;
            if (Math.abs(q.y - s0.y) > 5 || q.x < 0 || q.x > geo.bandW || q.y < 0 || q.y > geo.h || hidden(q)) break;
            j++;
            x0 = Math.min(x0, q.x);
            x1 = Math.max(x1, q.x);
          }
          if (x1 - x0 > 200) {
            bad.push(`${label} 岸線 y ${s0.y.toFixed(0)} 從 x ${x0.toFixed(0)} 到 ${x1.toFixed(0)}`);
            break;
          }
          i = j + 1;
        }
      }
      if (bad.length > 20) break;
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('交界接得起來：海峽頂端與延伸第 1 章的南岸在走廊兩側 ±20 都是沙地；延伸章之間走廊在交界上是橋，上下兩章各畫一截', () => {
    const bad: string[] = [];
    for (const { label, g, map, firstExt } of layouts) {
      const strait = sceneGeo(map.strait!, g);
      let prev: { name: string; blocks: readonly TerrainBlock[]; x: number } = {
        name: 'strait',
        blocks: planStrait(strait).blocks,
        x: strait.corridor.entry,
      };
      ISLES.forEach((s, i) => {
        const cl = map.chapters[firstExt + i];
        if (!cl) return;
        const geo = sceneGeo(cl, g);
        const { blocks } = s.plan(geo);
        if (Math.abs(prev.x - geo.corridor.entry) > 0.01) bad.push(`${label} ${s.name} 入口 x 不同`);
        const x = geo.corridor.entry;
        if (i === 0) {
          for (const dx of [-20, 0, 20]) {
            if (!inAny(prev.blocks, 'isle', x + dx, 0.5)) bad.push(`${label} ${prev.name} 上緣 ${dx}`);
            if (!inAny(blocks, 'isle', x + dx, geo.h - 0.5)) bad.push(`${label} ${s.name} 下緣 ${dx}`);
          }
        } else {
          if (!inAny(prev.blocks, 'pier', x, 0.5)) bad.push(`${label} ${prev.name} 頂端沒有橋`);
          if (!inAny(blocks, 'pier', x, geo.h - 0.5)) bad.push(`${label} ${s.name} 底端沒有橋`);
        }
        if (geo.corridor.exit !== null) prev = { name: s.name, blocks, x: geo.corridor.exit };
      });
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

describe('島的南岸與北岸（第 2 輪看圖驗收：島的底邊不是和接縫重合的直線，岸線沒有尖角缺口；第 5 輪：兩島之間不是等寬的直水道）', () => {
  it('bannerSpan 和每一章實際的章節牌（保護框往內 12）一致：下方那一段只靠它畫出上一章的南岸與章節牌下的沙岬', () => {
    const bad: string[] = [];
    for (const { label, geo } of isleCases) {
      const ban = geo.protect.find((p) => p.kind === 'banner')!;
      const { c0, c1 } = bannerSpan(geo, geo.corridor.entry);
      if (Math.abs(ban.x0 + 12 - c0) > 0.5 || Math.abs(ban.x1 - 12 - c1) > 0.5) bad.push(`${label} ${c0}-${c1} 對 ${ban.x0 + 12}-${ban.x1 - 12}`);
    }
    expect(bad).toEqual([]);
  });

  it('延伸第 1 章（下方是海峽）的南岸是往下凸的曲線：兩端在交界上方 26px、中間越過交界 34 到 41px；章節牌的兩根立柱腳下（章底往上 4px）至少有 8px 沙地', () => {
    const bad: string[] = [];
    for (const { label, geo } of isleCases.filter((c) => c.name === 'isle-valuation')) {
      const pts = southShore(geo, geo.corridor.entry);
      const ends = [pts[0]!, pts[pts.length - 1]!];
      if (ends.some((p) => p.y > -25)) bad.push(`${label} 兩端 ${ends.map((p) => p.y.toFixed(1)).join(' ')}`);
      const deepest = Math.max(...pts.map((p) => p.y));
      if (deepest < 34 || deepest > 41) bad.push(`${label} 中間到 ${deepest.toFixed(1)}`);
      const { c0, c1 } = bannerSpan(geo, geo.corridor.entry);
      const at = (x: number) => {
        const i = pts.findIndex((p) => p.x >= x);
        const a = pts[Math.max(0, i - 1)]!;
        const b = pts[Math.max(0, i)]!;
        return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
      };
      for (const x of [c0 + 24, c0 + 30, c1 - 30, c1 - 24])
        if (x > 0 && x < geo.bandW && at(x) < 4) bad.push(`${label} 立柱 ${x.toFixed(0)} 腳下只有 ${(at(x) + 4).toFixed(1)}px`);
    }
    expect(bad).toEqual([]);
  });

  it('北岸（有出口的章）：走廊上的水道南岸在交界往下 26 到 42（淺水帶不越過交界，離拱心石頂至少 16）；章節牌立柱外 12px 內岬頂在交界往上 16 以上，最高到交界往上 28（藏在卡片後面）', () => {
    const bad: string[] = [];
    for (const { label, geo } of isleCases.filter((c) => c.geo.corridor.exit !== null)) {
      const x = geo.corridor.exit!;
      const north = northShore(geo, x, ISLES.find((s) => label.startsWith(s.name))!.name);
      const pts = north.pts;
      const at = (px: number) => {
        const i = pts.findIndex((p) => p.x >= px);
        const a = pts[Math.max(0, i - 1)]!;
        const b = pts[Math.max(0, i)]!;
        return a.y + ((b.y - a.y) * (px - a.x)) / (b.x - a.x || 1);
      };
      if (north.floor < 26 || north.floor > 42 || Math.abs(at(x) - north.floor) > 0.5) bad.push(`${label} 水道南岸 ${north.floor.toFixed(1)}`);
      if (Math.min(...pts.map((p) => p.y)) < -28.01) bad.push(`${label} 岬頂越過交界太多`);
      // 這一章的出口走廊就是上一章的入口走廊：上一章的章節牌在走廊的另一側
      const { c0, c1 } = bannerSpan(geo, x);
      for (const px of [c0 + 12, c0 + 27, c0 + 42, c1 - 42, c1 - 27, c1 - 12])
        if (px > 0 && px < geo.bandW && at(px) > -16) bad.push(`${label} 立柱 ${px.toFixed(0)} 岬頂只到 ${at(px).toFixed(1)}`);
    }
    expect(bad).toEqual([]);
  });

  it('上下兩段在交界上的沙地範圍一致（每 4px 取樣，過渡點兩側 4px 以外沒有不一致）', () => {
    const bad: string[] = [];
    for (const { label, g, map, firstExt } of layouts) {
      const strait = sceneGeo(map.strait!, g);
      let below: { name: string; blocks: readonly TerrainBlock[] } = { name: 'strait', blocks: planStrait(strait).blocks };
      ISLES.forEach((s, i) => {
        const cl = map.chapters[firstExt + i];
        if (!cl) return;
        const geo = sceneGeo(cl, g);
        const { blocks } = s.plan(geo);
        const up = (x: number) => inAny(blocks, 'isle', x, geo.h - 0.5);
        const down = (x: number) => inAny(below.blocks, 'isle', x, 0.5);
        for (let x = 2; x < geo.bandW - 2; x += 4) {
          if (up(x) === down(x)) continue;
          if (up(x - 4) !== up(x + 4) || down(x - 4) !== down(x + 4)) continue;
          bad.push(`${label} ${below.name}／${s.name} x ${x}`);
          break;
        }
        below = { name: s.name, blocks };
      });
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('延伸第 1 章（下方是海峽）的南岸在手機上不是直線：畫面內最深和最淺至少差 8px（第 5 輪看圖驗收；375 約差 12px，320 約差 10px）', () => {
    const bad: string[] = [];
    for (const { name, label, geo } of isleCases.filter((c) => c.name === 'isle-valuation' && c.geo.bp === 'compact')) {
      const ys = southShore(geo, geo.corridor.entry)
        .filter((p) => p.x >= 0 && p.x <= geo.bandW)
        .map((p) => p.y);
      if (Math.max(...ys) - Math.min(...ys) < 8) bad.push(`${name} ${label} 只差 ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)}px`);
    }
    expect(bad).toEqual([]);
  });

  it('海峽頂端畫的那一截和延伸第 1 章島的南端是同一串控制點，越過交界', () => {
    const bad: string[] = [];
    for (const { label, g, map } of layouts) {
      const strait = sceneGeo(map.strait!, g);
      const foot = footPoly(strait, strait.corridor.entry);
      if (!foot.some((p) => p.y > 4)) bad.push(`${label} 南岸沒有越過交界`);
    }
    expect(bad).toEqual([]);
  });

  it('島的岸線（畫面內）沒有尖角缺口：沿岸每 8px 取一點，往陸地凹進去的轉角不超過 30 度（內角至少 150 度），外凸的岬角不超過 60 度', () => {
    const bad: string[] = [];
    for (const { label, geo, plan } of isleCases) {
      const isle = plan(geo).blocks.find((b) => b.id === 'isle')!;
      const pts: { x: number; y: number }[] = [];
      let carry = 0;
      for (let i = 0; i < isle.poly.length; i++) {
        const a = isle.poly[i]!;
        const b = isle.poly[(i + 1) % isle.poly.length]!;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        // 平順的曲線每段的轉角和取樣間距成正比，真正的尖角不管間距多短都轉一樣多：8px 取一點分得出兩者
        for (let t = carry; t < len; t += 8) pts.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
        carry = (carry - len) % 8;
        if (carry < 0) carry += 8;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length]!;
        const b = pts[i]!;
        const c = pts[(i + 1) % pts.length]!;
        if (b.x < 2 || b.x > geo.bandW - 2 || b.y < 2 || b.y > geo.h - 2) continue;
        const t1 = Math.atan2(b.y - a.y, b.x - a.x);
        const t2 = Math.atan2(c.y - b.y, c.x - b.x);
        let d = Math.abs(t2 - t1);
        if (d > Math.PI) d = 2 * Math.PI - d;
        // 島的多邊形是正面積（y 向下時螢幕上的順時針）：外積小於 0 是往陸地凹進去的轉角
        const concave = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 0;
        if (d > (concave ? Math.PI / 6 : Math.PI / 3)) {
          bad.push(`${label} (${b.x.toFixed(0)}, ${b.y.toFixed(0)}) ${concave ? '凹' : '凸'} ${((d * 180) / Math.PI).toFixed(0)} 度`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
