// 闖關地圖的幾何（圖規第 1、2、11.1 節）：斷點常數、欄位樣板、走廊、曲線、pathLength、保護框、sceneGeo、角色位置與移動路徑；第 2.9 節的數值驗證重算。
// 掃描範圍：軌道寬 288 到 440 每 1px 加上 480、560；區帶寬 320、360、375、430、768、1024、1280、1440、1920；正式內容的章節結構、合成的 1 到 8 關章節、
// 三種樣板、入口在左與在右；另加字級 200% 與 125%。
// M3：章節徽章的判定（03 第 2.10 節）、場景對應（17 第 4 節）、延伸區與 examScope 的資料（03 第 2.2 節）、fixture 進度
import { readFileSync, readdirSync } from 'node:fs';
import { breakpoints, motion, tabbar } from '@ledgerland/tokens';
import { describe, expect, it } from 'vitest';
import { availableEndLinks, buildChapters, indexData, type MapChapter } from '../src/features/quest-map/data.ts';
import { SEAM_DOTS, SEAM_MID, SEAM_MID_LOW, seamFill, seamPaths, seamY } from '../src/features/quest-map/terrain.ts';
import {
  EMPTY_FIXTURE_PROGRESS,
  FIXTURE_UNSCORED_LEVEL,
  FULL_FIXTURE_CORE,
  FULL_FIXTURE_EXTENSION,
  fixtureData,
  fixtureProgress,
  fixtureVariantFrom,
  fullFixtureData,
  fullFixtureSource,
} from '../src/features/quest-map/fixtures.ts';
import {
  badgeCount,
  badgeStateByStars,
  badgeStateFor,
  badgeUnlockId,
  chapterDone,
  currentLevelId,
  earnedBadges,
  levelDone,
  masteryUnlockId,
  withBadges,
  type MapProgress,
} from '../src/features/quest-map/progress.ts';
import { ALL_SCENES, CORE_SCENES, EXTENSION_SCENES, sceneFor } from '../src/features/quest-map/scenes.tsx';
import { fixtureRequestFrom, loadQuestMap } from '../src/features/quest-map/useQuestMap.ts';
import {
  ARCH,
  BANNER,
  BELL,
  BP_EXPANDED,
  BP_MEDIUM,
  BOW,
  CORRIDOR_SWAY,
  EXIT_SWAY,
  DOT_AVOID,
  DOT_CLEAR,
  DOT_PERIOD,
  END_ZONE,
  JITTER_PX,
  LINE_CLEAR,
  MARKER_SIZE,
  MIN_CORRIDOR_STEP,
  MIN_STEP,
  NODE_GAP,
  PAD_IN,
  PAD_OUT,
  PLAQUE,
  RAIL_WIDTH,
  ROAD_HALF,
  ROUTE_K,
  SAMPLE_STEP,
  STAR_TAG,
  STRAIT,
  TEMPLATES,
  SWITCHBACK,
  SWITCHBACK_DEG,
  TURN_ANGLE_DEG,
  bellRect,
  BOW_SETS,
  bowStyle,
  centreColumnUsable,
  columnX,
  corridorX,
  cubicPoint,
  dotCount,
  fitZones,
  geometryFor,
  hashSeed,
  layoutChapter,
  layoutMap,
  markerAt,
  markerTransform,
  miniMapWindow,
  pathLengthFor,
  pointRectDistance,
  rect,
  rectsIntersect,
  ringRect,
  sampleCubic,
  sceneGeo,
  GROUND,
  seededRandom,
  starTagRect,
  trackGeometry,
  switchbackDeg,
  switchbackHandle,
  turnBackFlags,
  type ChapterLayout,
  type LayoutChapterInput,
  type MapGeometry,
  type Point,
  type QuestMapLayout,
  type Rect,
  type RoutePart,
  type RouteSegment,
  type Side,
} from '../src/features/quest-map/layout.ts';
import { normalizeLevelCode } from '../src/features/quest-map/level-code.ts';
import { ARCH_PAUSE_MS, EASE_STANDARD, STEP_MS, WALK_MAX_MS, cubicBezierEasing, walkPlan, walkTimeline } from '../src/features/quest-map/walk.ts';

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `lv_${prefix}${String(i).padStart(4, '0')}`);

// ---------------------------------------------------------------------------------------------
// 測試資料：正式內容的章節結構（content/chapters，主線依 order、延伸區接在後面）與掃描用的幾何

const contentChapters: LayoutChapterInput[] = (() => {
  const dir = new URL('../../../content/chapters/', import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { id: string; order: number; scope?: string; status?: string; levelIds: string[] })
    .filter((c) => c.status !== 'draft')
    .sort((a, b) => Number(a.scope === 'extension') - Number(b.scope === 'extension') || a.order - b.order)
    .map((c) => ({ id: c.id, levelIds: c.levelIds, extension: c.scope === 'extension' }));
})();

/** 合成的地圖：主線 1 到 8 關各一章，延伸區 2、1、3 關（海峽、只有一關的延伸章） */
const syntheticMap: LayoutChapterInput[] = [
  ...[3, 1, 8, 2, 5, 4, 7, 6].map((n, i) => ({ id: `ch_syn${i}`, levelIds: ids(`s${i}x`, n) })),
  ...[2, 1, 3].map((n, i) => ({ id: `ch_ext${i}`, levelIds: ids(`e${i}x`, n), extension: true })),
];

const COMPACT_TRACKS = Array.from({ length: 440 - 288 + 1 }, (_, i) => 288 + i);
const BANDS = [320, 360, 375, 430, 768, 1024, 1280, 1440, 1920];
const GEOMETRIES: { label: string; g: MapGeometry }[] = [
  ...COMPACT_TRACKS.map((w) => ({ label: `軌道 ${w}`, g: geometryFor(w + 32) })),
  ...BANDS.map((vw) => ({ label: `區帶 ${vw}`, g: geometryFor(vw) })),
  ...[320, 375, 768, 1280].map((vw) => ({ label: `區帶 ${vw} 字級 200%`, g: geometryFor(vw, 32) })),
  { label: '區帶 375 字級 125%', g: geometryFor(375, 20) },
];

interface ChapterCase {
  readonly label: string;
  readonly g: MapGeometry;
  readonly ch: ChapterLayout;
}
interface MapCase {
  readonly label: string;
  readonly g: MapGeometry;
  readonly map: QuestMapLayout;
}

let cache: { maps: MapCase[]; chapters: ChapterCase[] } | null = null;
/** 所有幾何下的正式內容地圖、合成地圖，以及單獨排的合成章節（1 到 8 關、三種樣板、入口左右、起點與終點章） */
function cases() {
  if (cache) return cache;
  const maps: MapCase[] = [];
  const chapters: ChapterCase[] = [];
  for (const { label, g } of GEOMETRIES) {
    for (const [name, input] of [
      ['正式內容', contentChapters],
      ['合成地圖', syntheticMap],
    ] as const) {
      const map = layoutMap(input, g);
      maps.push({ label: `${label} ${name}`, g, map });
      for (const ch of map.chapters) chapters.push({ label: `${label} ${name} ${ch.chapterId}`, g, ch });
    }
    for (let n = 0; n <= 8; n++) {
      for (let index = 0; index < 3; index++) {
        for (const entrySide of ['left', 'right'] as const) {
          const id = `ch_t${n}${index}${entrySide[0]}`;
          const ch = layoutChapter(
            { id, levelIds: ids(`t${n}${index}${entrySide[0]}`, n) },
            { index, entrySide, first: n % 2 === 0, last: n % 3 === 0, nextLevelId: 'lv_next0000', offset: 0 },
            g,
          );
          chapters.push({ label: `${label} 合成 ${n} 關 樣板 ${TEMPLATES[index]} 入口 ${entrySide}`, g, ch });
        }
      }
    }
  }
  cache = { maps, chapters };
  return cache;
}

/** 每個 part 取 200 點（直線等分、曲線依參數） */
function partSamples(part: RoutePart, count = 200): Point[] {
  if (part.kind === 'cubic') return sampleCubic(part.p0, part.c0, part.c1, part.p1, count - 1);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return { x: part.p0.x + (part.p1.x - part.p0.x) * t, y: part.p0.y + (part.p1.y - part.p0.y) * t };
  });
}

/** part 的凸包外框：曲線一定在控制點的凸包內，離矩形夠遠就不必逐點算 */
function partHull(part: RoutePart): Rect {
  const pts = part.kind === 'cubic' ? [part.p0, part.c0, part.c1, part.p1] : [part.p0, part.p1];
  return rect(Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y)));
}

/** 道路邊緣（半寬 10）到矩形的最短距離；超過 limit 時不逐點算，直接回傳 limit */
function roadClearance(seg: RouteSegment, r: Rect, limit = 50): number {
  let best = limit;
  for (const part of seg.parts) {
    const hull = partHull(part);
    const hullGap = Math.hypot(Math.max(r.x0 - hull.x1, 0, hull.x0 - r.x1), Math.max(r.y0 - hull.y1, 0, hull.y0 - r.y1)) - ROAD_HALF;
    if (hullGap >= best) continue;
    for (const p of partSamples(part)) best = Math.min(best, pointRectDistance(p, r) - ROAD_HALF);
  }
  return best;
}

/** 每段的端點節點（路線本來就會進入它們的圓盤） */
function endpointIds(ch: ChapterLayout, seg: RouteSegment, k: number): Set<string> {
  const n = ch.nodes.length;
  if (seg.kind === 'enter') return new Set([ch.nodes[0]!.levelId]);
  if (seg.kind === 'step') return new Set([ch.nodes[k - 1]!.levelId, ch.nodes[k]!.levelId]);
  return n > 0 ? new Set([ch.nodes[n - 1]!.levelId]) : new Set();
}

const fmtR = (r: Rect) => `(${r.x0.toFixed(1)}, ${r.y0.toFixed(1)})-(${r.x1.toFixed(1)}, ${r.y1.toFixed(1)})`;

// ---------------------------------------------------------------------------------------------

describe('地圖幾何：斷點常數（圖規第 1.2 節）', () => {
  it('斷點與 rail 寬和 tokens 相同；ease-standard 和 tokens 相同', () => {
    expect(BP_MEDIUM).toBe(breakpoints.medium);
    expect(BP_EXPANDED).toBe(breakpoints.expanded);
    expect(RAIL_WIDTH).toBe(tabbar.railWidthPx);
    expect(`cubic-bezier(${EASE_STANDARD.join(', ')})`).toBe(motion.ease.standard);
  });

  it('軌道寬：compact 是 min(vw - 32, 440)，medium 480，expanded 以上 560；斷點在 600 與 1024', () => {
    expect([320, 360, 375, 430, 472, 599].map((vw) => geometryFor(vw).trackW)).toEqual([288, 328, 343, 398, 440, 440]);
    expect([600, 768, 1023].map((vw) => geometryFor(vw).trackW)).toEqual([480, 480, 480]);
    expect([1024, 1280, 1440, 1920].map((vw) => geometryFor(vw).trackW)).toEqual([560, 560, 560, 560]);
    expect([599, 600, 1023, 1024, 1440].map((vw) => geometryFor(vw).bp)).toEqual(['compact', 'medium', 'medium', 'expanded', 'expanded']);
  });

  it('rail 區、走廊、欄位與章節牌內縮依斷點；1280 寬時軌道 420 到 980、中心 700', () => {
    const pick = (g: MapGeometry) => [g.railZone, g.corridorInset, g.colInset, g.bannerInset];
    expect(pick(geometryFor(375))).toEqual([0, 44, 52, 70]);
    expect(pick(geometryFor(768))).toEqual([0, 56, 64, 82]);
    expect(pick(geometryFor(1280))).toEqual([120, 56, 72, 82]);
    const g = geometryFor(1280);
    expect([g.trackLeft, g.trackLeft + g.trackW, g.trackLeft + g.trackW / 2]).toEqual([420, 980, 700]);
    expect(geometryFor(375).trackLeft).toBe(16);
    expect(geometryFor(768).trackLeft).toBe(144);
  });

  it('兩翼寬：768 時 144、1280 時 300、1440 時 380、1920 時 620；手機 16 不放物件', () => {
    for (const [vw, wing] of [
      [768, 144],
      [1280, 300],
      [1440, 380],
      [1920, 620],
    ] as const) {
      const g = geometryFor(vw);
      expect(g.trackLeft - g.railZone).toBe(wing);
      expect(g.bandW - g.trackLeft - g.trackW).toBe(wing);
      const geo = sceneGeo(layoutMap(contentChapters, g).chapters[0]!, g);
      expect(geo.wings.left!.x1 - geo.wings.left!.x0).toBe(wing);
      expect(geo.wings.right!.x1 - geo.wings.right!.x0).toBe(wing);
    }
    const phone = geometryFor(375);
    expect(sceneGeo(layoutMap(contentChapters, phone).chapters[0]!, phone).wings).toEqual({ left: null, right: null });
  });

  it('第 1 章的場景延伸到地面（below）：h 多 GROUND、兩翼跟著延伸，節點與保護框的座標不變，起點正下方多一個保護框', () => {
    for (const vw of [375, 768, 1280, 1440]) {
      const g = geometryFor(vw);
      const cl = layoutMap(contentChapters, g).chapters[0]!;
      const base = sceneGeo(cl, g);
      const geo = sceneGeo(cl, g, GROUND);
      expect(geo.h).toBe(cl.height + GROUND);
      expect(geo.nodes).toEqual(base.nodes);
      expect(geo.protect.slice(0, base.protect.length)).toEqual(base.protect);
      const apron = geo.protect.slice(base.protect.length);
      expect(apron).toHaveLength(1);
      expect(apron[0]).toMatchObject({ kind: 'stone', y0: cl.height, y1: cl.height + GROUND });
      expect((apron[0]!.x0 + apron[0]!.x1) / 2).toBe(cl.startStone!.x);
      // 兩翼（手機沒有）一樣延伸到地面：不用條件式的 expect，沒有翼時兩邊都是空陣列
      const wings = [geo.wings.left, geo.wings.right].filter((w): w is NonNullable<typeof w> => w !== null);
      expect(wings.map((w) => w.y1 - w.y0)).toEqual(wings.map(() => cl.height + GROUND));
    }
  });

  it('章節牌實際寬度 218、273、328、398、440；紙籤 184、239、320', () => {
    const widths = (vw: number) => {
      const map = layoutMap(contentChapters, geometryFor(vw));
      return {
        banner: new Set(map.chapters.map((c) => c.bannerRect.x1 - c.bannerRect.x0)),
        plaque: new Set(map.chapters.map((c) => c.plaqueRect.x1 - c.plaqueRect.x0)),
      };
    };
    expect(widths(320)).toEqual({ banner: new Set([218]), plaque: new Set([184]) });
    expect(widths(375)).toEqual({ banner: new Set([273]), plaque: new Set([239]) });
    expect(widths(430).banner).toEqual(new Set([328]));
    expect(widths(768)).toEqual({ banner: new Set([398]), plaque: new Set([320]) });
    expect(widths(1280)).toEqual({ banner: new Set([440]), plaque: new Set([320]) });
  });

  it('清單寬等於軌道寬（第 2 輪看圖驗收：切換檢視時頂部工具不左右移動）', () => {
    expect([375, 768, 1280].map((vw) => geometryFor(vw).listW)).toEqual([343, 480, 560]);
  });

  it('取不到寬度時用 375；字級 200% 時章節牌區、章末區、海峽與卡片上限依比例放大（16 的倍數）', () => {
    expect(geometryFor(Number.NaN).bandW).toBe(375);
    expect(geometryFor(0).trackW).toBe(343);
    const g = geometryFor(320, 32);
    expect([g.fontScale, g.bannerZone, g.endZone, g.straitH, g.bannerMaxH, g.plaqueMaxH]).toEqual([2, 320, 384, 480, 288, 256]);
    const h = geometryFor(375, 20);
    expect([h.bannerZone, h.endZone, h.straitH]).toEqual([224, 240, 304]);
    expect(geometryFor(375, 12).fontScale).toBe(1);
  });

  it('C 欄只在軌道寬 328 以上可用：320 寬只有左右交錯，360 寬以上三欄都用得到', () => {
    expect(centreColumnUsable(geometryFor(359))).toBe(false);
    expect(centreColumnUsable(geometryFor(360))).toBe(true);
    const cols = (vw: number) => new Set(layoutMap(contentChapters, geometryFor(vw)).chapters.flatMap((c) => c.nodes.map((n) => n.col)));
    expect(cols(320)).toEqual(new Set(['L', 'R']));
    for (const vw of [360, 375, 768, 1280]) expect(cols(vw)).toEqual(new Set(['L', 'C', 'R']));
  });

  it('小地圖的幾何：軌道寬等於卡片寬、左緣 0、沒有 rail 區與兩翼', () => {
    const g = trackGeometry(343);
    expect([g.bandW, g.trackW, g.trackLeft, g.railZone, g.corridorInset, g.colInset]).toEqual([343, 343, 0, 0, 44, 52]);
    expect(trackGeometry(520).colInset).toBe(64);
    expect(trackGeometry(600).colInset).toBe(72);
    const map = layoutMap(contentChapters, g);
    for (const c of map.chapters) for (const n of c.nodes) expect(n.x).toBeGreaterThanOrEqual(52 - JITTER_PX);
  });
});

describe('地圖幾何：第 2.9 節的數值驗證（路寬 20、鈴 60、星星籤 60 × 22）', () => {
  // 用和 layoutChapter 相同的曲線公式重算；每條曲線取 4,000 點
  const curve = (p0: Point, c0: Point, c1: Point, p1: Point) => sampleCubic(p0, c0, c1, p1, 4000);
  const clear = (pts: Point[], r: Rect) => Math.min(...pts.map((p) => pointRectDistance(p, r))) - ROAD_HALF;
  const stepCurve = (dx: number) => {
    const a = { x: 0, y: 0 };
    const b = { x: dx, y: NODE_GAP };
    return { a, b, pts: curve(a, { x: ROUTE_K * dx, y: 0 }, { x: dx - ROUTE_K * dx, y: NODE_GAP }, b) };
  };

  it('節點間：路線邊緣到前一關的鈴框 4.8、7.8、10.8；到後一關的星星籤 4.0、7.0、9.8；鈴框到星星籤 44、52、60', () => {
    const rows = [104, 112, 120].map((dx) => {
      const { a, b, pts } = stepCurve(dx);
      const bell = bellRect(a);
      const star = starTagRect(b);
      return [clear(pts, bell), clear(pts, star), Math.max(star.x0 - bell.x1, bell.x0 - star.x1)];
    });
    const expected = [
      [4.8, 4.0, 44],
      [7.8, 7.0, 52],
      [10.8, 9.8, 60],
    ];
    rows.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]![j]!, 1)));
  });

  it('入口曲線邊緣到第一關的星星籤 24.3、鈴框 28；出口曲線邊緣到最後一關的鈴框與星星籤各 26（Δx 104 起，越大越寬）', () => {
    // [入口到星星籤, 入口到鈴框, 出口到鈴框, 出口到星星籤]
    const rows = [104, 112, 120].map((dx) => {
      const y0 = 176 + PAD_IN;
      const p0 = { x: dx, y: y0 };
      const entry = curve({ x: 0, y: 176 }, { x: 0, y: 176 + ROUTE_K * PAD_IN }, { x: dx - ROUTE_K * dx, y: y0 }, p0);
      const pl = { x: 0, y: 0 };
      const exit = curve(pl, { x: ROUTE_K * dx, y: 0 }, { x: dx, y: PAD_OUT - ROUTE_K * PAD_OUT }, { x: dx, y: PAD_OUT });
      return [clear(entry, starTagRect(p0)), clear(entry, bellRect(p0)), clear(exit, bellRect(pl)), clear(exit, starTagRect(pl))];
    });
    [24.3, 28, 26, 26].forEach((v, j) => expect(rows[0]![j]).toBeCloseTo(v, 1));
    for (const row of rows.slice(1)) row.forEach((v, j) => expect(v).toBeGreaterThanOrEqual(rows[0]![j]! - 1e-9));
  });

  it('星星籤放寬到 76px 時，Δx 112 會壓進路線 0.3px：所以籤固定 60px 寬', () => {
    const { b, pts } = stepCurve(MIN_STEP);
    const wide = rect(b.x - 38, b.y - STAR_TAG.bottom, b.x + 38, b.y - STAR_TAG.top);
    expect(clear(pts, wide)).toBeCloseTo(-0.3, 1);
    expect(STAR_TAG.halfW * 2).toBe(60);
  });
});

describe('地圖幾何：不變式（圖規第 11.1 節）', () => {
  it('1. 相鄰節點 |Δx| >= 112；走廊到第一關、最後一關到走廊 |Δx| >= 104；第一關不在入口那一欄', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    for (const { label, ch } of cases().chapters) {
      const n = ch.nodes;
      for (let i = 1; i < n.length; i++) if (Math.abs(n[i]!.x - n[i - 1]!.x) < MIN_STEP - 1e-9) bad.push(`${label} 第 ${i} 關`);
      if (n.length > 0) {
        if (Math.abs(n[0]!.x - ch.entryX) < MIN_CORRIDOR_STEP - 1e-9) bad.push(`${label} 入口`);
        if (Math.abs(n[n.length - 1]!.x - ch.exitX) < MIN_CORRIDOR_STEP - 1e-9) bad.push(`${label} 出口`);
        if (n[0]!.col === (ch.entrySide === 'left' ? 'L' : 'R')) bad.push(`${label} 第一關在入口那一欄`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('2. 每段道路（每段取 200 點，半寬 10）離星星籤、非端點的外圈、章節牌、紙籤、海峽說明卡與每個鈴框至少 4px', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    let worst = Infinity;
    const check = (label: string, seg: RouteSegment, targets: readonly [string, Rect][]) => {
      for (const [name, r] of targets) {
        const c = roadClearance(seg, r);
        worst = Math.min(worst, c);
        if (c < 4) bad.push(`${label} ${seg.kind} 到 ${name} ${fmtR(r)} 只有 ${c.toFixed(2)}`);
      }
    };
    for (const { label, ch } of cases().chapters) {
      ch.segments.forEach((seg, k) => {
        const ends = endpointIds(ch, seg, k);
        const targets: [string, Rect][] = [
          ['章節牌', ch.bannerRect],
          ['紙籤', ch.plaqueRect],
        ];
        for (const n of ch.nodes) {
          targets.push([`星星籤 ${n.levelId}`, starTagRect(n)], [`鈴框 ${n.levelId}`, bellRect(n)]);
          if (!ends.has(n.levelId)) targets.push([`外圈 ${n.levelId}`, ringRect(n)]);
        }
        check(label, seg, targets);
      });
    }
    for (const { label, map } of cases().maps) if (map.strait) check(`${label} 海峽`, map.strait.segment, [['說明卡', map.strait.plaqueRect]]);
    expect(bad).toEqual([]);
    // 最緊的地方是一端折返、一端穿越（C 欄）的關到關（1024 寬約 4.7）與窄軌道的 S 形緩彎（約 4.3）；兩邊都夾住，確定真的量到了
    expect(worst).toBeGreaterThanOrEqual(4.3);
    expect(worst).toBeLessThan(6);
  });

  it(
    '11. 同一節點的進出兩段：離圓心 32px 以外至少 22px（路寬 20 加 2：折返節點斜著分開，兩條路面在圓盤外不合併成「<」尖楔，第 3 輪看圖驗收）；只有一關、入口出口同側的章（正式內容沒有）32px 以外至少 18px',
    { timeout: 60_000 },
    () => {
      const bad: string[] = [];
      let worst = Infinity;
      const dense = (s: RouteSegment) => s.parts.flatMap((p) => partSamples(p, 160));
      const sep = (a: Point[], b: Point[]) => {
        let d = Infinity;
        for (const p of a) for (const q of b) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
        return d;
      };
      for (const { label, ch } of cases().chapters) {
        ch.nodes.forEach((n, i) => {
          // 進場段是 segments[i]（第一關是 enter），出場段是 segments[i + 1]（最後一關是 exit）
          // 只看離圓心 32 到 96px 的點（更遠的兩段早就分開；第 4 輪的緩彎讓一段變成兩段曲線，全部點兩兩比會超時）
          const ring = (p: Point) => {
            const r = Math.hypot(p.x - n.x, p.y - n.y);
            return r > 32 && r < 96;
          };
          const a = dense(ch.segments[i]!);
          const b = dense(ch.segments[i + 1]!);
          const d32 = sep(a.filter(ring), b.filter(ring));
          if (ch.nodes.length === 1) {
            if (d32 < 18) bad.push(`${label} 第 ${i} 關 ${d32.toFixed(1)}`);
            return;
          }
          worst = Math.min(worst, d32);
          if (d32 < 22) bad.push(`${label} 第 ${i} 關 ${d32.toFixed(1)}`);
        });
      }
      expect(bad).toEqual([]);
      // 實測最小約 26（字級 200% 的 1280 寬、zigzag 的第一關）：確定真的量到了折返節點
      expect(worst).toBeLessThan(32);
    },
  );

  it('13. 關到關的路線在兩關的高度之間單調上升（寬軌道的折返節點也不會凸起成 S 形）；入口曲線不低於走廊頂、出口曲線不高過章末區底', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    for (const { label, ch } of cases().chapters) {
      if (ch.nodes.length === 0) continue;
      ch.segments.forEach((s, k) => {
        // 入口段的前兩段是走廊的擺動（CORRIDOR_SWAY），這裡要看的是接到節點的那一段曲線
        // 關到關的緩彎是兩段或三段曲線：整段一起看
        const cubics = s.parts.filter((p) => p.kind === 'cubic');
        const parts = s.kind === 'step' ? cubics : [s.kind === 'enter' ? cubics[cubics.length - 1] : cubics[0]];
        if (!parts[0]) return;
        const ys = parts.flatMap((p) => partSamples(p!)).map((p) => p.y);
        for (let i = 1; i < ys.length; i++) if (ys[i]! < ys[i - 1]! - 1e-6) return void bad.push(`${label} ${s.kind} ${k} 往下走`);
        const lo = Math.min(parts[0]!.p0.y, parts[parts.length - 1]!.p1.y);
        const hi = Math.max(parts[0]!.p0.y, parts[parts.length - 1]!.p1.y);
        if (Math.min(...ys) < lo - 1e-6 || Math.max(...ys) > hi + 1e-6) bad.push(`${label} ${s.kind} ${k} 超出兩端的高度`);
      });
    }
    expect(bad).toEqual([]);
  });

  /** 沿折線每 2px 一點，最長的一段「直線」：段內每一點離兩端連線都不超過 1px（曲率近似 0） */
  const longestStraight = (pts: readonly Point[]): number => {
    const q: Point[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const a = q[q.length - 1]!;
      const b = pts[i]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 2; s <= l; s += 2) q.push({ x: a.x + ((b.x - a.x) * s) / l, y: a.y + ((b.y - a.y) * s) / l });
    }
    let best = 0;
    let j = 0;
    for (let i = 0; i < q.length; i++) {
      j = Math.max(j, i);
      while (j + 1 < q.length) {
        const a = q[i]!;
        const b = q[j + 1]!;
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let ok = true;
        for (let k = i + 1; k <= j && ok; k++) ok = Math.abs((b.x - a.x) * (a.y - q[k]!.y) - (a.x - q[k]!.x) * (b.y - a.y)) / L <= 1;
        if (!ok) break;
        j++;
      }
      best = Math.max(best, Math.hypot(q[j]!.x - q[i]!.x, q[j]!.y - q[i]!.y));
    }
    return best;
  };

  it(
    '14. 走廊沒有超過 120px 的直線、章內相鄰兩關之間沒有超過 120px（或連線長一半）的直線（第 5 輪看圖驗收：章節交界的走廊是筆直的垂直段，zigzag 章是直線段之字）；拱門開口與海峽棧橋是直的，拱頂以上 40px 是直的（第 6 輪）',
    { timeout: 60_000 },
    () => {
      const bad: string[] = [];
      let worstStep = 0;
      let worstCorridor = 0;
      const dense = (parts: readonly RoutePart[], dy = 0) =>
        parts.flatMap((p, i) => (i ? partSamples(p, 120).slice(1) : partSamples(p, 120))).map((p) => ({ x: p.x, y: p.y + dy }));
      for (const { label, g, map } of cases().maps) {
        if (!BANDS.includes(g.bandW) && g.bandW % 8 !== 0) continue;
        map.chapters.forEach((c, i) => {
          for (const s of c.segments.filter((x) => x.kind === 'step')) {
            const l = longestStraight(dense(s.parts));
            const a = s.parts[0]!.p0;
            const b = s.parts[s.parts.length - 1]!.p1;
            // 連線長的一半：桌面的關到關連線約 430px，大彎（離連線 17 到 26px）在節點附近仍接近直線
            const limit = Math.max(120, Math.hypot(b.x - a.x, b.y - a.y) / 2);
            worstStep = Math.max(worstStep, l);
            if (l > limit) bad.push(`${label} ${c.chapterId} 到 ${s.toLevelId} 直線 ${l.toFixed(0)}（上限 ${limit.toFixed(0)}）`);
          }
          const next = map.chapters[i + 1];
          if (!next || (map.strait && map.strait.beforeIndex === i + 1)) return;
          // 走廊：拱頂以上（出口段穿過拱門中心與拱頂的兩條直線之後）接下一章入口的擺動（最後一段接到第一關的曲線之前）
          const exit = c.segments[c.segments.length - 1]!;
          const k = exit.parts.findIndex((p) => p.kind === 'line' && p.p0.x === c.archCenter.x && p.p0.y === c.archCenter.y);
          const archRun = exit.parts[k]!;
          // 拱頂以上 EXIT_SWAY.clear 一律是直的（第 6 輪看圖驗收：拱心石前不拐小鉤），剩下 EXIT_SWAY.min 以上才擺（字級 100% 時不擺）
          const archTop = c.archCenter.y + ARCH.height / 2;
          const swayFrom = archTop + EXIT_SWAY.clear;
          if (Math.abs(archRun.p1.y - (c.height - swayFrom >= EXIT_SWAY.min ? swayFrom : c.height)) > 1e-6)
            bad.push(`${label} ${c.chapterId} 拱頂以上的直線段不對`);
          const enter = next.segments[0]!;
          // 走廊從拱頂量起（拱門開口裡那一段不算）
          const above: RoutePart = { kind: 'line', p0: { x: c.archCenter.x, y: archTop }, p1: archRun.p1 };
          const corridor = [...dense([above, ...exit.parts.slice(k + 1)], c.offset), ...dense(enter.parts.slice(0, -1), next.offset).slice(1)];
          const l = longestStraight(corridor);
          worstCorridor = Math.max(worstCorridor, l);
          if (l > 120) bad.push(`${label} ${c.chapterId} 的走廊直線 ${l.toFixed(0)}`);
        });
      }
      expect(bad).toEqual([]);
      // 確定真的量到了（S 形緩彎約 120、走廊約 60）
      expect(worstStep).toBeGreaterThan(60);
      expect(worstCorridor).toBeGreaterThan(20);
    },
  );

  it('12. 已走實線與未走圓點在節點端裁掉：實線離圓心 30（收在圓盤底下）、圓點的第一顆與最後一顆離圓心 40；區段交界那一端不裁', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    const ends = (d: string, h: number): [Point, Point] => {
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return [
        { x: nums[0]!, y: h - nums[1]! },
        { x: nums[nums.length - 2]!, y: h - nums[nums.length - 1]! },
      ];
    };
    for (const { label, ch } of cases().chapters) {
      if (ch.nodes.length === 0) continue;
      ch.segments.forEach((s, k) => {
        const from = s.kind === 'enter' ? null : ch.nodes[s.kind === 'exit' ? ch.nodes.length - 1 : k - 1]!;
        const to = s.kind === 'exit' ? null : ch.nodes[k]!;
        for (const [name, d, r] of [
          ['實線', s.line.d, LINE_CLEAR],
          ['圓點', s.dots.d, DOT_CLEAR],
        ] as const) {
          const [p, q] = ends(d, ch.height);
          // d 只留一位小數：容許 0.2px
          if (from && Math.abs(Math.hypot(p.x - from.x, p.y - from.y) - r) > 0.2) bad.push(`${label} ${s.kind} ${name}起點`);
          if (to && Math.abs(Math.hypot(q.x - to.x, q.y - to.y) - r) > 0.2) bad.push(`${label} ${s.kind} ${name}終點`);
          const [fp, fq] = ends(s.d, ch.height);
          if (!from && (p.x !== fp.x || p.y !== fp.y)) bad.push(`${label} ${s.kind} ${name}起點被裁`);
          if (!to && (q.x !== fq.x || q.y !== fq.y)) bad.push(`${label} ${s.kind} ${name}終點被裁`);
        }
        if (s.dots.pathLength % DOT_PERIOD !== 0 || s.dots.pathLength < DOT_PERIOD) bad.push(`${label} ${s.kind} 圓點 pathLength ${s.dots.pathLength}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('12b. 未走圓點不壓在拱門石材的邊上：拱圈內緣上下 4px（圓點半徑加 1）、拱心石上緣上下 3px 內沒有圓心（第 7 輪看圖驗收的水珠）', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    let checked = 0;
    let worstInner = Infinity;
    for (const { label, g, ch } of cases().chapters) {
      if (ch.last) continue;
      const s = ch.segments.find((x) => x.kind === 'exit')!;
      // dots.d 換成折線（y 向下）、量弧長，圓點在 k × 16 / (pathLength + 0.01) 的位置（和 QuestMap 一樣多 0.01）
      const nums = s.dots.d.match(/[MLC]|-?\d+(\.\d+)?/g)!;
      const pts: Point[] = [];
      for (let i = 0; i < nums.length;) {
        const c = nums[i++];
        const p = () => ({ x: Number(nums[i++]), y: Number(nums[i++]) });
        if (c === 'C') pts.push(...sampleCubic(pts[pts.length - 1]!, p(), p(), p(), 400).slice(1));
        else pts.push(p());
      }
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1]! + Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y));
      const L = cum[cum.length - 1]!;
      const top = ch.height - ch.archRect.y1;
      for (let k = 0; k * DOT_PERIOD <= s.dots.pathLength; k++) {
        const at = (k * DOT_PERIOD * L) / (s.dots.pathLength + 0.01);
        const j = Math.max(
          1,
          cum.findIndex((c) => c >= at),
        );
        const f = (at - cum[j - 1]!) / (cum[j]! - cum[j - 1]! || 1);
        const x = pts[j - 1]!.x + (pts[j]!.x - pts[j - 1]!.x) * f;
        const y = pts[j - 1]!.y + (pts[j]!.y - pts[j - 1]!.y) * f;
        if (Math.abs(x - ch.exitX) > 1 || y < top + ARCH.key - 8 || y > top + ARCH.inner + 8) continue;
        checked++;
        const inner = Math.abs(y - (top + ARCH.inner));
        worstInner = Math.min(worstInner, inner);
        // 字級放大時出口很長，間距只能在 14 到 18 之間挑，少數只做到相切（內緣 3、上緣少 0.5px 以內）
        const zoomed = g.fontScale > 1 ? 1 : 0;
        if (inner < DOT_AVOID - zoomed) bad.push(`${label} 拱圈內緣 ${inner.toFixed(2)}`);
        if (Math.abs(y - (top + ARCH.key)) < DOT_AVOID - 1 - zoomed / 2) bad.push(`${label} 拱心石上緣 ${Math.abs(y - (top + ARCH.key)).toFixed(2)}`);
      }
      // 出口的間距仍在 14 到 18 之間
      if (Math.abs(L / (s.dots.pathLength / DOT_PERIOD) - DOT_PERIOD) >= 2)
        bad.push(`${label} 出口圓點間距 ${(L / (s.dots.pathLength / DOT_PERIOD)).toFixed(2)}`);
    }
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThan(1000);
    expect(worstInner).toBeLessThan(8);
    // 沒有要避開的位置時照舊是 round(L / 16)
    expect([24, 100, 250].map((l) => dotCount(l))).toEqual([2, 6, 16]);
  });

  it('折返節點：前後兩點（含走廊）在同一側；zigzag 每一關都是折返，穿越型節點維持水平', () => {
    expect(turnBackFlags([300, 60], 60, 300)).toEqual([true, true]);
    expect(turnBackFlags([180, 300, 180], 60, 60)).toEqual([false, true, false]);
    expect(turnBackFlags([300], 60, 60)).toEqual([true]);
    expect(turnBackFlags([300], 60, 400)).toEqual([false]);
    // 首頁小地圖的軌道寬上限以舊版 20 度為理由（minimap-frame.ts），新版折返是 30 度
    expect(SWITCHBACK_DEG).toBeGreaterThan(TURN_ANGLE_DEG);
  });

  it('3. 道路（含走廊上的直線）都在軌道內', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    const inTrack = (label: string, seg: RouteSegment, g: MapGeometry, h: number) => {
      for (const part of seg.parts) {
        for (const p of partSamples(part)) {
          if (p.x - ROAD_HALF < g.trackLeft - 1e-9 || p.x + ROAD_HALF > g.trackLeft + g.trackW + 1e-9 || p.y < -1e-9 || p.y > h + 1e-9) {
            bad.push(`${label} ${seg.kind} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            return;
          }
        }
      }
    };
    for (const { label, g, ch } of cases().chapters) for (const s of ch.segments) inTrack(label, s, g, ch.height);
    for (const { label, g, map } of cases().maps) if (map.strait) inTrack(`${label} 海峽`, map.strait.segment, g, map.strait.height);
    expect(bad).toEqual([]);
  });

  it('4. 鈴在任一節點時，不碰前後節點（與自己）的外圈與星星籤、章節牌與立柱、紙籤與木樁、拱門', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    for (const { label, ch } of cases().chapters) {
      ch.nodes.forEach((n, i) => {
        const bell = bellRect(n);
        const others: [string, Rect][] = [
          ['章節牌', ch.bannerRect],
          ['立柱', ch.bannerPosts[0]],
          ['立柱', ch.bannerPosts[1]],
          ['紙籤', ch.plaqueRect],
          ['木樁', ch.stakeRect],
          ['拱門', ch.archRect],
          ['自己的外圈', ringRect(n)],
        ];
        for (const j of [i - 1, i + 1]) {
          const m = ch.nodes[j];
          if (m) others.push([`外圈 ${j}`, ringRect(m)], [`星星籤 ${j}`, starTagRect(m)]);
        }
        for (const [name, r] of others) if (rectsIntersect(bell, r)) bad.push(`${label} 第 ${i} 關的鈴碰到${name}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('5. 相鄰兩章（含海峽）的出口 x 等於入口 x，交界兩端的切線都是垂直的，區段首尾相接', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    const lastPart = (s: RouteSegment) => s.parts[s.parts.length - 1]!;
    const vertical = (p: RoutePart) => p.kind === 'line' && p.p0.x === p.p1.x && p.p1.y > p.p0.y;
    // 入口直線可能是走廊的擺動（兩段三次曲線）：起點的切線仍是垂直的（第一個控制點在起點正上方）
    const verticalStart = (p: RoutePart) => vertical(p) || (p.kind === 'cubic' && p.c0.x === p.p0.x && p.c0.y > p.p0.y);
    // 出口在拱頂以上也擺動（第 5 輪看圖驗收）：最後一段是三次曲線時，終點的切線是垂直的（最後一個控制點在終點正下方）
    const verticalEnd = (p: RoutePart) => vertical(p) || (p.kind === 'cubic' && p.c1.x === p.p1.x && p.c1.y < p.p1.y);
    for (const { label, map } of cases().maps) {
      const { chapters, strait } = map;
      chapters.forEach((b, i) => {
        const first = b.segments[0]!.parts[0]!;
        if (!verticalStart(first) || first.p0.x !== b.entryX || (i > 0 && first.p0.y !== 0)) bad.push(`${label} ${b.chapterId} 入口不是從底邊垂直進來`);
        if (i === 0) return;
        const a = chapters[i - 1]!;
        const exit = lastPart(a.segments[a.segments.length - 1]!);
        if (!verticalEnd(exit) || exit.p1.x !== a.exitX || exit.p1.y !== a.height) bad.push(`${label} ${a.chapterId} 出口不是垂直到頂邊`);
        // 海峽下面那一章：出口接棧橋（PierStub 是直的），拱門以上不擺
        if (strait && strait.beforeIndex === i && !vertical(exit)) bad.push(`${label} ${a.chapterId} 接海峽的出口不是直線`);
        if (strait && strait.beforeIndex === i) {
          const s = strait.segment.parts[0]!;
          if (strait.x !== a.exitX || strait.x !== b.entryX || !vertical(s) || s.p0.y !== 0 || s.p1.y !== strait.height) bad.push(`${label} 海峽接不上`);
          if (strait.offset !== a.offset + a.height || b.offset !== strait.offset + strait.height) bad.push(`${label} 海峽的位置不對`);
        } else {
          if (a.exitX !== b.entryX || a.exitSide !== b.entrySide) bad.push(`${label} ${a.chapterId} 到 ${b.chapterId} 的 x 不同`);
          if (b.offset !== a.offset + a.height) bad.push(`${label} ${b.chapterId} 的位置不對`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('6. 拱門跨在走廊上、離視窗邊至少 8px；紙籤不碰拱門、頂端離章頂至少 24；章節牌與立柱在區段與軌道內', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    const inside = (r: Rect, x0: number, y0: number, x1: number, y1: number) =>
      r.x0 >= x0 - 1e-9 && r.x1 <= x1 + 1e-9 && r.y0 >= y0 - 1e-9 && r.y1 <= y1 + 1e-9;
    for (const { label, g, ch } of cases().chapters) {
      const tr = g.trackLeft + g.trackW;
      if (!(ch.archRect.x0 < ch.exitX && ch.exitX < ch.archRect.x1)) bad.push(`${label} 拱門不在走廊上`);
      if (ch.archRect.x0 < 8 || ch.archRect.x1 > g.bandW - 8) bad.push(`${label} 拱門 ${fmtR(ch.archRect)} 離視窗邊不到 8px`);
      if (rectsIntersect(ch.plaqueRect, ch.archRect) || rectsIntersect(ch.stakeRect, ch.archRect)) bad.push(`${label} 紙籤碰到拱門`);
      if (ch.plaqueRect.y1 > ch.height - PLAQUE.topGap + 1e-9) bad.push(`${label} 紙籤頂端離章頂不到 24`);
      if (!inside(ch.plaqueRect, g.trackLeft, ch.height - ch.endZone, tr, ch.height)) bad.push(`${label} 紙籤超出軌道或章末區`);
      for (const r of [ch.bannerRect, ...ch.bannerPosts]) if (!inside(r, g.trackLeft, 0, tr, ch.bannerZone)) bad.push(`${label} 章節牌 ${fmtR(r)} 超出`);
      if (ch.bannerRect.y1 > ch.bannerZone - 12 + 1e-9) bad.push(`${label} 章節牌上方沒留 12`);
      if (ch.bannerPosts.some((r) => r.y0 < BANNER.shadowH / 2 - 1e-9)) bad.push(`${label} 立柱的地面陰影伸出區段底邊`);
      if (ch.archRect.y1 > ch.height - 24 + 1e-9) bad.push(`${label} 拱門伸進接縫`);
    }
    for (const { label, g, map } of cases().maps) {
      const s = map.strait;
      if (!s) continue;
      if (!inside(s.plaqueRect, g.trackLeft, 0, g.trackLeft + g.trackW, s.height) || rectsIntersect(s.plaqueRect, s.pierRect)) bad.push(`${label} 海峽說明卡`);
    }
    expect(bad).toEqual([]);
  });

  it('8. 每段的 pathLength 都是 16 的倍數，和折線長度差不到半個週期', { timeout: 60_000 }, () => {
    const bad: string[] = [];
    const segs = [...cases().chapters.flatMap((c) => c.ch.segments), ...cases().maps.flatMap((m) => (m.map.strait ? [m.map.strait.segment] : []))];
    for (const s of segs) {
      if (s.pathLength % DOT_PERIOD !== 0 || s.pathLength < DOT_PERIOD || Math.abs(s.pathLength - s.length) > DOT_PERIOD / 2 + 1e-9)
        bad.push(`${s.kind} ${s.length} → ${s.pathLength}`);
    }
    expect(bad).toEqual([]);
    expect([0, 7, 8, 23, 24, 100].map(pathLengthFor)).toEqual([16, 16, 16, 16, 32, 96]);
  });

  it('9. 區段高度加總等於地圖總高：章高 520 + (n - 1) × 120，正式內容 11,480px（不受寬度影響）', () => {
    const bad: string[] = [];
    for (const { label, g, map } of cases().maps) {
      const sum = map.chapters.reduce((s, c) => s + c.height, 0) + (map.strait?.height ?? 0);
      if (sum !== map.totalHeight) bad.push(label);
      if (g.fontScale === 1) {
        for (const c of map.chapters) if (c.height !== 520 + (c.nodes.length - 1) * NODE_GAP) bad.push(`${label} ${c.chapterId} 高 ${c.height}`);
        if (map.strait && map.strait.height !== STRAIT) bad.push(`${label} 海峽高 ${map.strait.height}`);
      }
    }
    expect(bad).toEqual([]);
    expect(contentChapters).toHaveLength(14);
    expect(contentChapters.reduce((s, c) => s + c.levelIds.length, 0)).toBe(47);
    for (const vw of BANDS) expect(layoutMap(contentChapters, geometryFor(vw)).totalHeight).toBe(11_480);
    expect(END_ZONE + PAD_OUT + PAD_IN + 176).toBe(520);
  });

  it('10. 第 1 章有起點石、路線從石頭開始；最後一章的路線停在拱門中心；其他章沒有起點石', () => {
    for (const { map } of cases().maps) {
      const [first, ...rest] = map.chapters;
      expect(first!.startStone).toEqual({ x: first!.entryX, y: 24, r: 10 });
      expect(first!.segments[0]!.parts[0]!.p0).toEqual({ x: first!.entryX, y: 24 });
      for (const c of rest) expect(c.startStone).toBeNull();
      const last = map.chapters[map.chapters.length - 1]!;
      const end = last.segments[last.segments.length - 1]!;
      expect(end.parts[end.parts.length - 1]!.p1).toEqual(last.archCenter);
      expect(last.archCenter.y).toBe(last.height - last.endZone + ARCH.bottom + ARCH.height / 2);
      expect(end.toLevelId).toBeNull();
    }
  });
});

describe('地圖幾何：欄位樣板、出入口與路線（圖規第 2.1 到 2.5 節）', () => {
  it('相同輸入每次都得到相同座標；不同章節 ID 的抖動不同，但都在 ±6px 內', () => {
    const g = geometryFor(375);
    expect(layoutMap(contentChapters, g)).toEqual(layoutMap(contentChapters, g));
    expect(seededRandom(hashSeed('ch_c5f8w2'))()).toBe(seededRandom(hashSeed('ch_c5f8w2'))());
    const ctx = { index: 0, entrySide: 'left' as Side, first: false, last: false, nextLevelId: null, offset: 0 };
    const a = layoutChapter({ id: 'ch_aaaaaa', levelIds: ids('a', 6) }, ctx, g);
    const b = layoutChapter({ id: 'ch_bbbbbb', levelIds: ids('b', 6) }, ctx, g);
    expect(a.nodes.map((n) => n.col)).toEqual(b.nodes.map((n) => n.col));
    expect(a.nodes.map((n) => n.x)).not.toEqual(b.nodes.map((n) => n.x));
    const jitters = cases().chapters.flatMap(({ g: gg, ch }) => ch.nodes.map((n) => Math.abs(n.x - columnX(n.col, gg))));
    expect(Math.max(...jitters)).toBeLessThanOrEqual(JITTER_PX);
    expect(Math.max(...jitters)).toBeGreaterThan(JITTER_PX / 2);
  });

  it('三種樣板依章序輪流（主線與延伸區合併計數）；入口側等於上一章的出口側，第 1 章入口在左', () => {
    const map = layoutMap(contentChapters, geometryFor(375));
    expect(map.chapters.map((c) => c.template)).toEqual(map.chapters.map((_, i) => TEMPLATES[i % 3]));
    expect(map.chapters[0]!.entrySide).toBe('left');
    expect(map.chapters.slice(1).map((c) => c.entrySide)).toEqual(map.chapters.slice(0, -1).map((c) => c.exitSide));
    expect(map.chapters.map((c) => c.entryX)).toEqual(map.chapters.map((c) => corridorX(c.entrySide, map.geometry)));
  });

  it('樣板的欄位：zigzag 是 F N F N，wave 是 C F C N，sweep 是 F C N C；320 寬時一律左右交錯', () => {
    const cols = (vw: number, index: number, entrySide: Side, n = 6) =>
      layoutChapter({ id: 'ch_cols', levelIds: ids('c', n) }, { index, entrySide, first: false, last: false, nextLevelId: null, offset: 0 }, geometryFor(vw))
        .nodes.map((x) => x.col)
        .join('');
    expect(cols(375, 0, 'left')).toBe('RLRLRL');
    expect(cols(375, 1, 'left')).toBe('CRCLCR');
    expect(cols(375, 2, 'left')).toBe('RCLCRC');
    expect(cols(375, 2, 'right')).toBe('LCRCLC');
    for (let index = 0; index < 3; index++) expect(cols(320, index, 'left')).toBe('RLRLRL');
  });

  it('2 關與 3 關的章一定左右擺動；出口在最後一關的反側（在 C 時看倒數第二關）', () => {
    const bad: string[] = [];
    for (const { label, ch } of cases().chapters) {
      const n = ch.nodes;
      if (n.length >= 2 && new Set(n.map((x) => x.x)).size === 1) bad.push(`${label} 沒有擺動`);
      const last = n[n.length - 1];
      const prev = n[n.length - 2];
      const want: Side = !last
        ? ch.entrySide
        : last.col === 'L'
          ? 'right'
          : last.col === 'R'
            ? 'left'
            : prev
              ? prev.col === 'L'
                ? 'right'
                : 'left'
              : ch.entrySide === 'left'
                ? 'right'
                : 'left';
      if (ch.exitSide !== want) bad.push(`${label} 出口在 ${ch.exitSide}`);
    }
    expect(bad).toEqual([]);
  });

  it('穿越型節點水平進出（0.7 × |Δx|）；折返節點進場段從下方、出場段往上方：關到關另一端也折返時斜 30 度（pair），另一端穿越時 22 到 30 度（single），入口與出口那一端斜 30 度；入口曲線從走廊垂直離開、出口曲線垂直進走廊', () => {
    const bad: string[] = [];
    let pairs = 0;
    let singles = 0;
    for (const vw of [320, 375, 768, 1280]) {
      const map = layoutMap(contentChapters, geometryFor(vw));
      for (const c of map.chapters) {
        const turn = turnBackFlags(
          c.nodes.map((n) => n.x),
          c.entryX,
          c.exitX,
        );
        // 節點端的控制點：dir 是 1（出場，往上）或 -1（進場，從下方）；other 是關到關另一端的節點
        // scale：關到關有緩彎時分成 BOW.parts 段，第一段與最後一段的把手方向不變、長度是原本的 1/BOW.parts
        const ok = (p: Point, ctl: Point, toward: number, i: number, dir: 1 | -1, kind: 'step' | 'enter' | 'exit', other = -1, scale = 1) => {
          const dx = Math.abs(toward - p.x);
          const s = Math.sign(toward - p.x);
          if (!turn[i]) return Math.abs(ctl.x - (p.x + s * ROUTE_K * dx * scale)) < 1e-9 && ctl.y === p.y;
          const k = kind === 'step' ? (turn[other] ? 'pair' : 'single') : kind;
          if (k === 'pair') pairs++;
          if (k === 'single') singles++;
          const h = switchbackHandle(dx, k);
          // 切線角度：pair、enter、exit 正好 30 度
          const deg = (Math.atan2(Math.abs(ctl.y - p.y), Math.abs(ctl.x - p.x)) * 180) / Math.PI;
          if (k !== 'single' && Math.abs(deg - SWITCHBACK_DEG) > 1e-6) return false;
          return Math.abs(ctl.x - (p.x + s * h.hx * scale)) < 1e-9 && Math.abs(ctl.y - (p.y + dir * h.rise * scale)) < 1e-9;
        };
        c.segments.forEach((s, k) => {
          const cubics = s.parts.filter((x) => x.kind === 'cubic');
          const p = s.kind === 'enter' ? cubics[cubics.length - 1] : cubics[0];
          if (!p || p.kind !== 'cubic' || c.nodes.length === 0) return;
          // 關到關有緩彎（BOW）時是 BOW.parts 段曲線：節點兩端的把手在第一段的起點與最後一段的終點，方向和沒有緩彎時相同
          const q = cubics[cubics.length - 1]!;
          const sc = cubics.length > 1 ? 1 / BOW.parts : 1;
          const good =
            s.kind === 'step'
              ? q.kind === 'cubic' && ok(p.p0, p.c0, q.p1.x, k - 1, 1, 'step', k, sc) && ok(q.p1, q.c1, p.p0.x, k, -1, 'step', k - 1, sc)
              : s.kind === 'enter'
                ? p.c0.x === p.p0.x && ok(p.p1, p.c1, c.entryX, 0, -1, 'enter')
                : ok(p.p0, p.c0, c.exitX, c.nodes.length - 1, 1, 'exit') && p.c1.x === p.p1.x;
          if (!good) bad.push(`${vw} ${c.chapterId} ${s.kind} ${k}`);
        });
      }
    }
    expect(bad).toEqual([]);
    // 正式內容裡兩種折返都很多（zigzag 章是 pair，wave 與 sweep 的 C 欄旁邊是 single）：確定都量到了
    expect(pairs).toBeGreaterThan(40);
    expect(singles).toBeGreaterThan(20);
  });

  it('折返節點的把手（第 3 輪看圖驗收的「<」尖楔）：pair 斜 30 度、桌面中段約 12 度；single 從 |Δx| 112 的 22 度升到 192 以上的 30 度；把手的垂直分量有上限', () => {
    expect(SWITCHBACK_DEG).toBe(30);
    expect(switchbackDeg(416, 'pair')).toBe(30);
    expect(switchbackDeg(112, 'single')).toBeCloseTo(22, 9);
    expect(switchbackDeg(152, 'single')).toBeCloseTo(26, 9);
    expect(switchbackDeg(208, 'single')).toBe(30);
    expect(switchbackDeg(416, 'enter')).toBe(30);
    // 兩端都折返：垂直分量最多 54（NODE_GAP 的一半以內），整支把手等比例縮短、角度不變
    const wide = switchbackHandle(416, 'pair');
    expect(wide.rise).toBeCloseTo(SWITCHBACK.pair.riseMax, 9);
    expect((Math.atan2(wide.rise, wide.hx) * 180) / Math.PI).toBeCloseTo(30, 9);
    expect(SWITCHBACK.pair.riseMax).toBeLessThan(NODE_GAP / 2);
    // 正式內容的 pair 是 |Δx| 172 以上，一律被上限夾住（把手 93.5 × 54）；上限以內時水平長是 ROUTE_K × |Δx|
    expect(switchbackHandle(184, 'pair').hx).toBeCloseTo(wide.hx, 9);
    expect(switchbackHandle(120, 'pair').hx).toBeCloseTo(ROUTE_K * 120, 9);
    expect(switchbackHandle(150, 'single').hx).toBeCloseTo(SWITCHBACK.single.k * 150, 9);
    // 桌面 |Δx| 416 的 pair：中段最平的切線約 12 度，兩端 30 度
    const pts = sampleCubic({ x: 0, y: 0 }, { x: wide.hx, y: wide.rise }, { x: 416 - wide.hx, y: NODE_GAP - wide.rise }, { x: 416, y: NODE_GAP }, 400);
    let min = 90;
    for (let i = 1; i < pts.length; i++) min = Math.min(min, (Math.atan2(pts[i]!.y - pts[i - 1]!.y, pts[i]!.x - pts[i - 1]!.x) * 180) / Math.PI);
    expect(min).toBeGreaterThan(10);
    expect(min).toBeLessThan(14);
    expect(switchbackHandle(150, 'enter').rise).toBeCloseTo(SWITCHBACK.enter.riseMax, 9);
    expect(switchbackHandle(150, 'exit').rise).toBeCloseTo(SWITCHBACK.exit.riseMax, 9);
  });

  it('字級放大時紙籤貼齊章末區上緣（頂端離章頂 32），木樁換成一根從地面立到紙籤後面的長柱子（第 4 輪看圖驗收：200% 時紙籤和下一章的章節牌相隔約 270px）', () => {
    for (const map of [layoutMap(contentChapters, geometryFor(320, 32)), layoutMap(contentChapters, geometryFor(1280, 24))])
      for (const c of map.chapters) {
        const yE = c.height - c.endZone;
        expect(c.plaqueRect.y1).toBe(c.height - PLAQUE.zoomTop);
        expect(c.plaqueRect.y0).toBeGreaterThanOrEqual(yE + PLAQUE.bottom);
        expect(c.stakeRect.y0).toBe(yE + PLAQUE.bottom - PLAQUE.stakeH);
        expect(c.stakeRect.y1).toBe(c.height - PLAQUE.zoomTop - 24);
      }
    // 字級 100% 不變：下緣在章末區 y=40、木樁 16
    for (const c of layoutMap(contentChapters, geometryFor(375)).chapters) {
      const yE = c.height - c.endZone;
      expect(c.plaqueRect.y0).toBe(yE + PLAQUE.bottom);
      expect(c.stakeRect.y1 - c.stakeRect.y0).toBe(PLAQUE.stakeH);
    }
  });

  it('字級放大時依量到的卡片高度收緊章節牌區與章末區（第 5 輪看圖驗收：200% 中文的紙籤頂到下一章章節牌立柱約 138px）：紙籤頂到下一章的柱腳 36px，卡片下緣在 20、上方留 12 到 27；字級 100% 時不理會量到的高度', () => {
    const g = geometryFor(320, 32);
    const sized = contentChapters.map((c) => ({ ...c, bannerH: 150, plaqueH: 118 }));
    const map = layoutMap(sized, g);
    const plain = layoutMap(contentChapters, g);
    expect(fitZones({ bannerH: 150, plaqueH: 118 }, g)).toEqual({ bannerZone: 192, endZone: 192, bannerH: 150, plaqueH: 118 });
    // 量不到時照最大高度（和沒有量一樣）；量到的比最大高度大時照量到的高度，區段放得下整張卡片（第 9 輪：320 加 200% 的第 10 章章節牌下半被裁掉）
    expect(fitZones({}, g)).toEqual({ bannerZone: g.bannerZone, endZone: g.endZone, bannerH: g.bannerMaxH, plaqueH: g.plaqueMaxH });
    expect(fitZones({ bannerH: 430, plaqueH: 300 }, g)).toEqual({ bannerZone: 464, endZone: 384, bannerH: 430, plaqueH: 300 });
    const gaps: number[] = [];
    map.chapters.forEach((c, i) => {
      expect(c.bannerZone).toBe(192);
      expect(c.endZone).toBe(192);
      expect(c.height).toBeLessThan(plain.chapters[i]!.height);
      expect(c.bannerRect.y0).toBe(BANNER.bottom);
      expect(c.bannerRect.y1).toBe(BANNER.bottom + 150);
      expect(c.bannerZone - c.bannerRect.y1).toBeGreaterThanOrEqual(12);
      expect(c.bannerZone - c.bannerRect.y1).toBeLessThan(28);
      const yE = c.height - c.endZone;
      expect(c.plaqueRect.y1).toBe(c.height - PLAQUE.zoomTop);
      expect(c.plaqueRect.y0).toBeGreaterThanOrEqual(yE + PLAQUE.bottom);
      const next = map.chapters[i + 1];
      // 紙籤頂（地圖座標）到下一章章節牌的柱腳（區段底往上 4）
      if (next && !(map.strait && map.strait.beforeIndex === i + 1)) gaps.push(next.offset + BANNER.bottom - BANNER.postH - (c.offset + c.plaqueRect.y1));
    });
    expect(gaps.length).toBeGreaterThan(10);
    expect(new Set(gaps)).toEqual(new Set([PLAQUE.zoomTop + BANNER.bottom - BANNER.postH]));
    // 字級 100%：量到的高度不影響排版
    expect(layoutMap(sized, geometryFor(320)).totalHeight).toBe(layoutMap(contentChapters, geometryFor(320)).totalHeight);
  });

  it('關到關的緩彎（第 4 到 6 輪看圖驗收）：兩端都折返的關到關分成 BOW.parts 段；360 寬以下是 C 形，中點離連線是連線長的 0.062 倍（13 到 16.5px）、一段在上一段在下交錯；375 寬以上同一章相鄰兩段不同形（連線 1/3 與 2/3 處的偏移差 4px 以上）、離連線最遠 10px 以上、中段的切線斜率至少是連線的 0.7 倍（不出現平台）', () => {
    /** 點離 a→b 連線的距離，正值是上方（y 大的那一側） */
    const above = (a: Point, b: Point, m: Point) =>
      (Math.sign(b.x - a.x) * ((b.x - a.x) * (m.y - a.y) - (b.y - a.y) * (m.x - a.x))) / Math.hypot(b.x - a.x, b.y - a.y);
    const ends = (s: RouteSegment) => [s.parts[0]!.p0, s.parts[s.parts.length - 1]!.p1] as const;
    /** 每章的關到關（依序）：有緩彎的是 BOW.parts 段曲線 */
    const stepsOf = (vw: number) => layoutMap(contentChapters, geometryFor(vw)).chapters.map((c) => c.segments.filter((s) => s.kind === 'step'));
    /** 沿連線 1/3 與 2/3 處的偏移（曲線上投影最接近的點） */
    const profile = (s: RouteSegment) => {
      const [a, b] = ends(s);
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const pts = s.parts.flatMap((p) => partSamples(p, 120));
      const proj = (p: Point) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L;
      return [1 / 3, 2 / 3].map((f) =>
        above(
          a,
          b,
          pts.reduce((best, p) => (Math.abs(proj(p) - f * L) < Math.abs(proj(best) - f * L) ? p : best)),
        ),
      );
    };
    expect([320, 360, 375, 430, 768, 1280].map((vw) => bowStyle(geometryFor(vw)))).toEqual([0, 0, 1, 2, 2, 2]);
    for (const vw of [320, 360]) {
      const bowed = stepsOf(vw).flatMap((list) => list.filter((s) => s.parts.length > 1).map((s) => ({ list, s })));
      expect(bowed.length).toBeGreaterThan(10);
      for (const { s } of bowed) {
        expect(s.parts.length).toBe(BOW.parts);
        const [a, b] = ends(s);
        // 對稱的把手加對稱的偏移：t = 0.5（第 2 段的終點）正好離連線「連線長 × BOW_SETS[0] 的倍數」（320 寬約 13.6、360 寬約 16；離星星籤與鈴框的距離由不變式 2 守）
        const off = Math.abs(above(a, b, s.parts[BOW.parts / 2 - 1]!.p1));
        expect(off).toBeCloseTo(Math.hypot(b.x - a.x, b.y - a.y) * BOW_SETS[0][0], 6);
        expect(off).toBeGreaterThanOrEqual(13);
        expect(off).toBeLessThanOrEqual(16.5);
      }
      // 同一章相鄰兩段在連線的不同側（視覺上一段往上鼓、一段往下鼓）
      const side = (s: RouteSegment) => Math.sign(above(...ends(s), s.parts[BOW.parts / 2 - 1]!.p1));
      const same = bowed.slice(1).filter((x, i) => x.list === bowed[i]!.list && side(x.s) === side(bowed[i]!.s));
      expect(same).toEqual([]);
    }
    for (const vw of [375, 430, 768, 1280, 1920]) {
      let pairs = 0;
      let worst = Infinity;
      for (const list of stepsOf(vw))
        list.forEach((s, i) => {
          if (s.parts.length === 1) return;
          expect(s.parts.length).toBe(BOW.parts);
          const [a, b] = ends(s);
          // 看得出是彎的：離連線最遠 10px 以上
          expect(Math.max(...s.parts.flatMap((p) => partSamples(p, 60)).map((p) => Math.abs(above(a, b, p))))).toBeGreaterThanOrEqual(10);
          // 中段（t = 0.5，第 3 段的起點）的切線斜率至少是連線的 0.7 倍：不出現接近水平的平台（第 6 輪看圖驗收）
          const mid = s.parts[BOW.parts / 2]!;
          if (mid.kind !== 'cubic') throw new Error(`${vw} 緩彎的第 3 段不是曲線`);
          expect((mid.c0.y - mid.p0.y) / Math.abs(mid.c0.x - mid.p0.x)).toBeGreaterThanOrEqual((0.7 * (b.y - a.y)) / Math.abs(b.x - a.x));
          // 同一章相鄰兩段不同形：連線 1/3 與 2/3 處的偏移，向量差 4px 以上
          const prev = list[i - 1];
          if (!prev || prev.parts.length === 1) return;
          const [p1, p2] = profile(prev);
          const [q1, q2] = profile(s);
          worst = Math.min(worst, Math.hypot(p1! - q1!, p2! - q2!));
          pairs++;
        });
      // 正式內容的 zigzag 章（第 1、4、7、10、13 章）有 7 組相鄰的緩彎
      expect(pairs).toBeGreaterThanOrEqual(7);
      expect(worst).toBeGreaterThanOrEqual(4);
    }
  });

  it('SVG 的 d 是 y 向下的區段座標；toLevelId：入口與關到關是走到的那一關，出口是下一章第一關', () => {
    const map = layoutMap(contentChapters, geometryFor(375));
    const [c1, c2] = map.chapters;
    expect(c1!.segments.map((s) => s.kind)).toEqual(['enter', ...Array(c1!.nodes.length - 1).fill('step'), 'exit']);
    expect(c1!.segments.map((s) => s.toLevelId)).toEqual([...c1!.nodes.map((n) => n.levelId), c2!.nodes[0]!.levelId]);
    const enter = c2!.segments[0]!;
    // 入口直線是走廊的擺動：兩段三次曲線，從底邊的走廊 x 垂直出發，往外側擺 CORRIDOR_SWAY 再回到章節牌區頂的走廊 x
    expect(enter.d.startsWith(`M${c2!.entryX} ${c2!.height} C${c2!.entryX} `)).toBe(true);
    const [sa, sb] = enter.parts;
    expect(sa!.kind === 'cubic' && sb!.kind === 'cubic').toBe(true);
    expect(Math.abs(sa!.p1.x - c2!.entryX)).toBe(CORRIDOR_SWAY);
    expect(sb!.p1).toEqual({ x: c2!.entryX, y: c2!.bannerZone });
    // 樣本點間距不超過 8px，含每個 part 的兩端
    for (const s of c1!.segments) {
      for (let i = 1; i < s.samples.length; i++) {
        const d = Math.hypot(s.samples[i]!.x - s.samples[i - 1]!.x, s.samples[i]!.y - s.samples[i - 1]!.y);
        expect(d).toBeLessThanOrEqual(SAMPLE_STEP + 1e-9);
      }
      expect(s.samples[0]).toEqual(s.parts[0]!.p0);
      expect(s.samples[s.samples.length - 1]).toEqual(s.parts[s.parts.length - 1]!.p1);
    }
    expect(cubicPoint({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, 1)).toEqual({ x: 100, y: 200 });
  });

  it('沒有關卡的章：和一關的章一樣高，路線沿走廊直走；只有一關的章出口在那一關的反側', () => {
    const g = geometryFor(375);
    const map = layoutMap(
      [
        { id: 'ch_a', levelIds: ids('a', 2) },
        { id: 'ch_empty', levelIds: [] },
        { id: 'ch_one', levelIds: ids('o', 1) },
      ],
      g,
    );
    const empty = map.chapters[1]!;
    expect(empty.height).toBe(520);
    expect(empty.segments).toHaveLength(1);
    expect(empty.segments[0]!.toLevelId).toBe('lv_o0000');
    expect(empty.exitX).toBe(empty.entryX);
    const one = map.chapters[2]!;
    expect(one.nodes[0]!.col).not.toBe(one.entrySide === 'left' ? 'L' : 'R');
  });

  it('海峽只插在主線與第一個延伸章之間，棧橋 x 等於上一章出口；說明卡在走廊另一側、木樁加卡片垂直置中', () => {
    const g = geometryFor(375);
    const map = layoutMap(contentChapters, g);
    const s = map.strait!;
    const firstExt = map.chapters.findIndex((c) => c.extension);
    expect(s.beforeIndex).toBe(firstExt);
    expect(s.x).toBe(map.chapters[firstExt - 1]!.exitX);
    expect(s.segment.toLevelId).toBe(map.chapters[firstExt]!.nodes[0]!.levelId);
    expect(map.chapters[firstExt - 1]!.segments.at(-1)!.toLevelId).toBe(s.segment.toLevelId);
    expect(s.side === 'left' ? s.plaqueRect.x0 : s.plaqueRect.x1).toBe(s.side === 'left' ? s.x + PLAQUE.corridorGap : s.x - PLAQUE.corridorGap);
    expect([s.stakeRect.y0, s.plaqueRect.y0, s.plaqueRect.y1]).toEqual([48, 64, 192]);
    expect(layoutMap([{ id: 'ch_x', levelIds: ids('x', 2), extension: true }], g).strait).toBeNull();
    expect(
      layoutMap(
        contentChapters.filter((c) => !c.extension),
        g,
      ).strait,
    ).toBeNull();
  });

  it('章節牌在入口走廊的另一側，紙籤在出口走廊的另一側；紙籤與下一章的章節牌同一側（成對的地標）', () => {
    const bad: string[] = [];
    for (const { label, map } of cases().maps) {
      map.chapters.forEach((c, i) => {
        if (c.bannerSide === c.entrySide) bad.push(`${label} ${c.chapterId} 章節牌在入口側`);
        if (c.plaqueSide === c.exitSide) bad.push(`${label} ${c.chapterId} 紙籤在出口側`);
        const next = map.chapters[i + 1];
        if (next && next.bannerSide !== c.plaqueSide) bad.push(`${label} ${c.chapterId} 紙籤與下一章章節牌不同側`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('保護框：每個節點三個（外圈 +12、星星籤 +12、鈴 +8），加上章節牌、拱門、紙籤、木樁、起點石與道路；道路每 8px 一個 ±18 的框', () => {
    const map = layoutMap(contentChapters, geometryFor(375));
    const c = map.chapters[0]!;
    const count = (k: string) => c.protect.filter((r) => r.kind === k).length;
    // 起點有兩個：起點石（路線的圓頭）與小旗
    expect([count('node'), count('stars'), count('bell'), count('banner'), count('arch'), count('plaque'), count('stake'), count('stone')]).toEqual([
      c.nodes.length,
      c.nodes.length,
      c.nodes.length,
      1,
      1,
      1,
      1,
      2,
    ]);
    expect(count('road')).toBe(c.segments.reduce((s, x) => s + x.samples.length, 0));
    const node = c.protect.find((r) => r.kind === 'node')!;
    expect([node.x1 - node.x0, node.y1 - node.y0]).toEqual([92, 92]);
    const bell = c.protect.find((r) => r.kind === 'bell')!;
    expect([bell.x1 - bell.x0, bell.y1 - bell.y0]).toEqual([76, 76]);
    const road = c.protect.find((r) => r.kind === 'road')!;
    expect(road.x1 - road.x0).toBe(36);
    expect(map.chapters[1]!.protect.some((r) => r.kind === 'stone')).toBe(false);
    expect(map.strait!.protect.map((r) => r.kind).slice(0, 3)).toEqual(['strait', 'stake', 'pier']);
  });
});

describe('地圖幾何：角色、場景與小地圖（圖規第 2.7、2.8、6.2 節，站規第 1.16 節）', () => {
  const g = geometryFor(375);
  const map = layoutMap(contentChapters, g);
  const [c1, c2] = map.chapters;
  const lv = (c: ChapterLayout, i: number) => c.nodes[i]!.levelId;

  it('markerAt 是節點圓心的地圖座標；markerTransform 讓 60px 的鈴水平置中、腳底在圓心上方 38px', () => {
    const p = markerAt(map, lv(c2!, 0))!;
    expect(p).toEqual({ x: c2!.nodes[0]!.x, y: c2!.offset + c2!.nodes[0]!.y });
    expect(markerAt(map, 'lv_none')).toBeNull();
    expect(MARKER_SIZE).toBe(60);
    expect(markerTransform({ x: 100, y: 200 })).toBe('translate(70px, -238px)');
    expect(BELL.foot).toBe(38);
    expect(BELL.head - BELL.foot).toBe(MARKER_SIZE);
  });

  it('站在最後一關時，鈴頭頂進入章末區 18px，離紙籤 22px', () => {
    for (const c of map.chapters) {
      const last = c.nodes[c.nodes.length - 1]!;
      const bell = bellRect(last);
      const endBottom = c.height - c.endZone;
      expect(bell.y1 - endBottom).toBe(18);
      expect(c.plaqueRect.y0 - bell.y1).toBe(22);
    }
  });

  it('同一章相鄰兩關：一段、700ms；倒退時沿路線倒著走、不停', () => {
    const plan = walkPlan(map, lv(c1!, 0), lv(c1!, 1))!;
    expect(plan.hops).toBe(1);
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]!.points[0]).toEqual(markerAt(map, lv(c1!, 0)));
    expect(plan.legs[0]!.points.at(-1)).toEqual(markerAt(map, lv(c1!, 1)));
    expect(walkTimeline(plan).duration).toBe(STEP_MS);
    const back = walkPlan(map, lv(c1!, 1), lv(c1!, 0))!;
    expect(back.legs).toHaveLength(1);
    expect(back.legs[0]!.pauseChapterId).toBeNull();
    expect(back.legs[0]!.points).toEqual([...plan.legs[0]!.points].reverse());
    expect(walkPlan(map, lv(c1!, 0), lv(c1!, 0))).toEqual({ legs: [], hops: 0 });
    expect(walkPlan(map, 'lv_none', lv(c1!, 0))).toBeNull();
  });

  it('跨章：走到這一章的拱門中心停 400ms，再經走廊與下一章入口到第一關；總長不超過 2,200ms', () => {
    const plan = walkPlan(map, lv(c1!, c1!.nodes.length - 1), lv(c2!, 0))!;
    expect(plan.hops).toBe(2);
    expect(plan.legs.map((l) => l.pauseChapterId)).toEqual([c1!.chapterId, null]);
    expect(plan.legs[0]!.points.at(-1)).toEqual({ x: c1!.archCenter.x, y: c1!.offset + c1!.archCenter.y });
    const tl = walkTimeline(plan);
    expect(tl.duration).toBe(2 * STEP_MS + ARCH_PAUSE_MS);
    expect(tl.pauses).toHaveLength(1);
    expect(tl.pauses[0]!.chapterId).toBe(c1!.chapterId);
    // 停頓期間位置不動
    const at = tl.pauses[0]!.at / tl.duration;
    const end = (tl.pauses[0]!.at + ARCH_PAUSE_MS) / tl.duration;
    const held = tl.frames.filter((f) => f.offset >= at - 1e-9 && f.offset <= end + 1e-9);
    expect(new Set(held.map((f) => f.transform)).size).toBe(1);
    // 經過海峽是三段；從第一關走到最後一關也壓在 2,200ms 以內
    const s = map.strait!;
    const before = map.chapters[s.beforeIndex - 1]!;
    const after = map.chapters[s.beforeIndex]!;
    expect(walkPlan(map, lv(before, before.nodes.length - 1), lv(after, 0))!.hops).toBe(3);
    const lastCh = map.chapters.at(-1)!;
    const far = walkTimeline(walkPlan(map, lv(c1!, 0), lv(lastCh, lastCh.nodes.length - 1))!);
    expect(far.duration).toBe(WALK_MAX_MS);
    expect(far.pauses).toHaveLength(1);
  });

  it('時間軸的關鍵影格：offset 從 0 到 1 不遞減，最後一格是終點；每段套 ease-standard', () => {
    const plan = walkPlan(map, lv(c1!, c1!.nodes.length - 1), lv(c2!, 1))!;
    const tl = walkTimeline(plan);
    expect(tl.frames[0]!.offset).toBe(0);
    expect(tl.frames.at(-1)!.offset).toBe(1);
    for (let i = 1; i < tl.frames.length; i++) expect(tl.frames[i]!.offset).toBeGreaterThanOrEqual(tl.frames[i - 1]!.offset);
    expect(tl.frames.at(-1)!.transform).toBe(markerTransform(markerAt(map, lv(c2!, 1))!));
    expect(tl.frames[0]!.transform).toBe(markerTransform(markerAt(map, lv(c1!, c1!.nodes.length - 1))!));
    const ease = cubicBezierEasing(...EASE_STANDARD);
    expect([ease(0), ease(1)]).toEqual([0, 1]);
    expect(ease(0.5)).toBeGreaterThan(0.75);
    for (let i = 1; i <= 20; i++) expect(ease(i / 20)).toBeGreaterThanOrEqual(ease((i - 1) / 20));
    const linear = cubicBezierEasing(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 5);
    expect(walkTimeline({ legs: [], hops: 0 })).toEqual({ frames: [], duration: 0, pauses: [], end: null });
  });

  it('sceneGeo：y 向下、保護框同一組、最後一章沒有出口走廊、手機沒有兩翼', () => {
    const geo = sceneGeo(c2!, g);
    expect(geo.h).toBe(c2!.height);
    expect(geo.nodes).toEqual(c2!.nodes.map((n) => ({ x: n.x, y: c2!.height - n.y })));
    expect(geo.protect).toHaveLength(c2!.protect.length);
    for (const r of geo.protect) expect(r.y0).toBeLessThan(r.y1);
    const banner = geo.protect.find((r) => r.kind === 'banner')!;
    expect(banner.y1).toBe(c2!.height - (BANNER.bottom - BANNER.postH) + 12);
    expect(geo.corridor).toEqual({ entry: c2!.entryX, exit: c2!.exitX });
    expect(geo.track).toEqual({ left: 16, right: 359 });
    expect(sceneGeo(map.chapters.at(-1)!, g).corridor.exit).toBeNull();
    const strait = sceneGeo(map.strait!, g);
    expect(strait.nodes).toEqual([]);
    expect(strait.corridor).toEqual({ entry: map.strait!.x, exit: map.strait!.x });
  });

  it('seamFill：波浪以上的 path 與上方那一段的底色（地圖頂端是 --ll-bg）；上下同地景時沒有填色（陸地畫一條石緣線，海什麼都不畫）', () => {
    expect(seamFill(375, 7, 'sand', null)).toMatchObject({ d: seamPaths(375, 7).fill, fill: 'var(--ll-bg)', coast: null, dots: [] });
    expect(seamFill(375, 7, 'sea-deep', 'sea-deep')).toBeNull();
    // 陸在下、海在上：中線降到 20，海岸畫在波浪上方
    expect(seamFill(375, 7, 'meadow-deep', 'sea-deep')).toMatchObject({ d: seamPaths(375, 7, SEAM_MID_LOW).fill, fill: 'var(--ll-scene-sea-deep)' });
    expect(seamFill(375, 7, 'meadow-deep', 'sea-deep')!.coast).not.toBeNull();
    // 海在下、陸在上：中線 12，海岸畫在波浪下方；陸接陸：三排圓點；海接海（深淺不同）：只有填色
    expect(seamFill(375, 7, 'sea', 'plaza')).toMatchObject({ d: seamPaths(375, 7).fill, fill: 'var(--ll-scene-plaza)', dots: [] });
    expect(seamFill(375, 7, 'sea', 'plaza')!.coast).not.toBeNull();
    expect(seamFill(375, 7, 'rock', 'plaza')!.dots).toHaveLength(SEAM_DOTS.rows.length);
    expect(seamFill(375, 7, 'rock', 'plaza')!.coast).toBeNull();
    // 海接海（深淺不同，fixture 的第 2 章頂端接海峽）：海岸畫在波浪上方（島伸過接縫時島的上緣就是海岸）
    expect(seamFill(375, 7, 'sea', 'sea-deep')).toMatchObject({ d: seamPaths(375, 7, SEAM_MID_LOW).fill, dots: [] });
    expect(seamFill(375, 7, 'sea', 'sea-deep')!.coast).not.toBeNull();
    // 第 5 輪看圖驗收：海接海時地景層不畫浪花線與淺水帶；深淺不同時是漸層（blend），波浪與海岸只給伸過接縫的陸地用
    expect(seamFill(375, 7, 'sea', 'sea-deep')!.blend).toBe(true);
    for (const [t, a] of [
      ['sea', 'plaza'],
      ['meadow-deep', 'sea-deep'],
      ['rock', 'plaza'],
      ['sand', null],
    ] as const)
      expect(seamFill(375, 7, t, a)!.blend).toBeUndefined();
  });

  it('接縫波浪（第 4 輪看圖驗收）：兩個正弦相加、相位看種子；中線 12 時整條在頂端 1 到 23px，陸在下時在 9 到 31px；相鄰兩章的波浪不同', () => {
    for (const seed of [1, 7, 12345, 0xdeadbeef]) {
      for (const [mid, lo, hi] of [
        [SEAM_MID, 1, 23],
        [SEAM_MID_LOW, 9, 31],
      ] as const) {
        for (let x = 0; x <= 1920; x += 4) {
          const y = seamY(x, seed, mid);
          expect(y).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(y).toBeLessThanOrEqual(hi + 1e-9);
        }
      }
    }
    // 不是規律的扇貝：每 64px 的高度序列不重複（單一正弦時每個波長一模一樣）
    const ys = Array.from({ length: 20 }, (_, i) => Math.round(seamY(i * 64, 7)));
    expect(new Set(ys).size).toBeGreaterThan(4);
    expect(seamY(100, 1)).not.toBeCloseTo(seamY(100, 2), 1);
  });

  it('小地圖：同一套 layoutMap 用卡片寬排，裁切 200px，下一關在下方 40% 處；沒有進度時從起點開始', () => {
    const mini = layoutMap(contentChapters, trackGeometry(320));
    const ch = mini.chapters[0]!;
    const w = miniMapWindow(ch, lv(ch, 1));
    expect(w.top - w.bottom).toBe(200);
    expect(ch.nodes[1]!.y - w.bottom).toBe(80);
    expect(miniMapWindow(ch, null)).toEqual({ bottom: 0, top: 200 });
    const lastWin = miniMapWindow(ch, lv(ch, ch.nodes.length - 1), 400);
    expect(lastWin.top).toBeLessThanOrEqual(ch.height);
    // 鈴頭頂與星星籤都在視窗內
    const n = ch.nodes[1]!;
    expect(bellRect(n).y1).toBeLessThanOrEqual(w.top);
    expect(starTagRect(n).y0).toBeGreaterThanOrEqual(w.bottom);
  });
});

describe('關卡代號正規化（02 第 4.7 節）', () => {
  it('NFKC、小寫、去空白與連字號、去 lv_ 前綴、o 當 0、i 與 l 當 1', () => {
    expect(normalizeLevelCode('K7M2 Q9XD')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('ｋ７ｍ２－ｑ９ｘｄ')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('lv_k7m2q9xd')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('LV_K7M2-Q9XD')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('k7mO qlxi')).toEqual({ ok: true, code: 'k7m0q1x1' });
    expect(normalizeLevelCode('lv_lv1lv1lv')).toEqual({ ok: true, code: '1v11v11v' });
  });
  it('長度不是 8 或含 u 時格式錯誤', () => {
    expect(normalizeLevelCode('')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9x')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9xdd')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9xu')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9x!')).toEqual({ ok: false });
  });
});

function chapterOf(id: string, levelIds: readonly string[], extension = false, unscoredIds: readonly string[] = []): MapChapter {
  return {
    id,
    order: 1,
    chapterNo: 1,
    extension,
    notInExam: extension,
    inExam: !extension,
    title: id,
    badgeTitle: `徽章 ${id}`,
    objectives: [],
    levels: levelIds.map((l, i) => ({ id: l, chapterId: id, levelNo: i + 1, unscored: unscoredIds.includes(l) })),
    chapterEndLinks: [],
  };
}

function progressOf(stars: Record<string, 0 | 1 | 2 | 3>, badges: string[] = []): MapProgress {
  const levels = new Map<string, { stars: 0 | 1 | 2 | 3; bestScore: number; lastPlayedAt: string }>();
  for (const [id, s] of Object.entries(stars)) levels.set(id, { stars: s, bestScore: s / 3, lastPlayedAt: '2026-10-24T00:00:00.000Z' });
  return { levels, badges: new Set(badges), due: 0 };
}

describe('章節徽章（03 第 2.10 節）', () => {
  const data = indexData([chapterOf('ch_a', ['lv_a1', 'lv_a2', 'lv_a3']), chapterOf('ch_b', ['lv_b1', 'lv_b2']), chapterOf('ch_empty', [])], new Map());

  it('完成是每關至少一星，精通是每關三星；少一關、沒有關卡都是未取得', () => {
    expect(badgeStateByStars(data, progressOf({ lv_a1: 1, lv_a2: 2 }), 'ch_a')).toBe('locked');
    expect(badgeStateByStars(data, progressOf({ lv_a1: 1, lv_a2: 2, lv_a3: 3 }), 'ch_a')).toBe('done');
    expect(badgeStateByStars(data, progressOf({ lv_a1: 3, lv_a2: 3, lv_a3: 3 }), 'ch_a')).toBe('mastery');
    expect(badgeStateByStars(data, progressOf({}), 'ch_empty')).toBe('locked');
    expect(badgeStateByStars(data, progressOf({}), 'ch_none')).toBe('locked');
  });

  it('章節牌的狀態取星星與已存 unlock 的較高者：徽章不收回', () => {
    expect(badgeStateFor(data, progressOf({ lv_a1: 1 }, [badgeUnlockId('ch_a')]), 'ch_a')).toBe('done');
    expect(badgeStateFor(data, progressOf({ lv_a1: 1 }, [masteryUnlockId('ch_a')]), 'ch_a')).toBe('mastery');
    expect(badgeStateFor(data, progressOf({ lv_a1: 3, lv_a2: 3, lv_a3: 3 }), 'ch_a')).toBe('mastery');
    expect(badgeStateFor(data, progressOf({}), 'ch_a')).toBe('locked');
  });

  it('unlock ID 的格式是 badge:<章節 ID> 與 badge:<章節 ID>:mastery，符合進度 schema 的規則', () => {
    expect(badgeUnlockId('ch_c5f8w2')).toBe('badge:ch_c5f8w2');
    expect(masteryUnlockId('ch_c5f8w2')).toBe('badge:ch_c5f8w2:mastery');
    expect(masteryUnlockId('ch_c5f8w2')).toMatch(/^(term|badge):[A-Za-z0-9_.:-]+$/);
  });

  it('新取得的徽章：只列星星達成但進度沒有的，同時取得完成與精通時狀態是 mastery、兩個 ID 都寫', () => {
    const none = earnedBadges(data, progressOf({ lv_a1: 1 }));
    expect(none).toEqual([]);
    const done = earnedBadges(data, progressOf({ lv_a1: 1, lv_a2: 1, lv_a3: 2 }));
    expect(done).toEqual([{ chapterId: 'ch_a', state: 'done', unlockIds: ['badge:ch_a'] }]);
    const both = earnedBadges(data, progressOf({ lv_a1: 3, lv_a2: 3, lv_a3: 3, lv_b1: 1, lv_b2: 1 }, ['badge:ch_b']));
    expect(both).toEqual([{ chapterId: 'ch_a', state: 'mastery', unlockIds: ['badge:ch_a', 'badge:ch_a:mastery'] }]);
    const upgrade = earnedBadges(data, progressOf({ lv_a1: 3, lv_a2: 3, lv_a3: 3 }, ['badge:ch_a']));
    expect(upgrade).toEqual([{ chapterId: 'ch_a', state: 'mastery', unlockIds: ['badge:ch_a:mastery'] }]);
    expect(earnedBadges(data, progressOf({ lv_a1: 3, lv_a2: 3, lv_a3: 3 }, ['badge:ch_a', 'badge:ch_a:mastery']))).toEqual([]);
  });

  it('徽章數每章一枚，精通不另外計數；withBadges 不改原進度', () => {
    const p = progressOf({}, ['badge:ch_a', 'badge:ch_a:mastery', 'badge:ch_b']);
    expect(badgeCount(p)).toBe(2);
    const q = withBadges(p, ['badge:ch_c', 'badge:ch_a']);
    expect(badgeCount(q)).toBe(3);
    expect(p.badges.size).toBe(3);
    expect(q.badges.has('badge:ch_c')).toBe(true);
  });
});

describe('不計分關卡（level.unscored）', () => {
  // ch_m 混合：兩個計分、一個不計分；ch_u 整章不計分
  const data = indexData(
    [chapterOf('ch_m', ['lv_m1', 'lv_m2', 'lv_mu'], false, ['lv_mu']), chapterOf('ch_u', ['lv_u1', 'lv_u2'], true, ['lv_u1', 'lv_u2'])],
    new Map(),
  );
  const read = (ids: string[], stars: Record<string, 0 | 1 | 2 | 3> = {}): MapProgress => {
    const p = progressOf(stars);
    const levels = new Map(p.levels);
    for (const id of ids) levels.set(id, { stars: 0, bestScore: 0, lastPlayedAt: '2026-10-24T00:00:00.000Z' });
    return { ...p, levels };
  };

  it('完成的定義：計分關卡至少一星、不計分關卡有紀錄就算已讀完；目前關卡與本章進度跟著算', () => {
    const p = read(['lv_mu'], { lv_m1: 1 });
    expect(levelDone(p, data.levelById.get('lv_m1')!)).toBe(true);
    expect(levelDone(p, data.levelById.get('lv_m2')!)).toBe(false);
    expect(levelDone(p, data.levelById.get('lv_mu')!)).toBe(true);
    expect(levelDone(read([], { lv_mu: 0 }), data.levelById.get('lv_mu')!)).toBe(true);
    expect(currentLevelId(data, p)).toBe('lv_m2');
    expect(chapterDone(data, p, 'ch_m')).toEqual({ done: 2, total: 3 });
    expect(currentLevelId(data, read(['lv_mu'], { lv_m1: 1, lv_m2: 2 }))).toBe('lv_u1');
  });

  it('徽章判定跳過不計分關卡；整章不計分時每關讀完就是完成、沒有精通', () => {
    expect(badgeStateByStars(data, progressOf({ lv_m1: 1, lv_m2: 2 }), 'ch_m')).toBe('done');
    expect(badgeStateByStars(data, progressOf({ lv_m1: 3, lv_m2: 3 }), 'ch_m')).toBe('mastery');
    expect(badgeStateByStars(data, read(['lv_mu'], { lv_m1: 3 }), 'ch_m')).toBe('locked');
    expect(badgeStateByStars(data, read(['lv_u1']), 'ch_u')).toBe('locked');
    expect(badgeStateByStars(data, read(['lv_u1', 'lv_u2']), 'ch_u')).toBe('done');
    expect(earnedBadges(data, read(['lv_u1', 'lv_u2']))).toEqual([{ chapterId: 'ch_u', state: 'done', unlockIds: ['badge:ch_u'] }]);
  });

  it('buildChapters 依 unscoredLevelIds 標旗標；fixture 的不計分關卡在 all 進度裡是已讀完且沒有星星', () => {
    const chapters = buildChapters([{ id: 'ch_x', order: 1, title: 'x', levelIds: ['lv_x1', 'lv_x2'], objectives: [] }], new Set(['lv_x2']));
    expect(chapters[0]!.levels.map((l) => l.unscored)).toEqual([false, true]);
    const d = fixtureData('zh-TW');
    const u = d.levelById.get(FIXTURE_UNSCORED_LEVEL)!;
    expect(u.unscored).toBe(true);
    const all = fixtureProgress('all');
    expect(all.levels.get(FIXTURE_UNSCORED_LEVEL)!.stars).toBe(0);
    expect(levelDone(all, u)).toBe(true);
    expect(badgeStateByStars(d, all, u.chapterId)).toBe('mastery');
    expect(levelDone(fixtureProgress('default'), u)).toBe(false);
  });
});

describe('章末的相關實驗室步驟（03 第 4.4 節）：只連到已發布的故事', () => {
  const ch: MapChapter = {
    ...chapterOf('ch_l', ['lv_l1']),
    chapterEndLinks: [
      { kind: 'lab', story: 'story_pub', step: 'st_1' },
      { kind: 'lab', story: 'story_draft', step: 'st_2' },
    ],
  };
  it('manifest 沒有故事時一個都不顯示；有的只留已發布的（故事步驟路由存在時）', () => {
    expect(availableEndLinks(indexData([ch], new Map()), ch, true)).toEqual([]);
    expect(availableEndLinks(indexData([ch], new Map(), new Set(['story_pub'])), ch, true)).toEqual([{ kind: 'lab', story: 'story_pub', step: 'st_1' }]);
    const d = fixtureData('zh-TW');
    const fx2 = d.chapterById.get('ch_fx0002')!;
    expect(fx2.chapterEndLinks).toHaveLength(1);
    expect(availableEndLinks(d, fx2)).toEqual([]);
  });
  it('故事步驟的路由還不存在（LAB_STEP_ROUTE_READY 為 false）時，就算故事已發布也不顯示（站規 2.2.6 的 404 防護）', () => {
    expect(availableEndLinks(indexData([ch], new Map(), new Set(['story_pub'])), ch)).toEqual([]);
  });
});

describe('章節場景的對應（17 第 4 節）', () => {
  it('主線 10 章各一個不同的場景、延伸區 4 章各一座不同的小島，超出時輪流', () => {
    expect(CORE_SCENES).toHaveLength(10);
    expect(EXTENSION_SCENES).toHaveLength(4);
    expect(new Set(ALL_SCENES).size).toBe(14);
    expect(Array.from({ length: 10 }, (_, i) => sceneFor(i + 1, false))).toEqual(CORE_SCENES);
    expect(Array.from({ length: 4 }, (_, i) => sceneFor(i + 1, true))).toEqual(EXTENSION_SCENES);
    expect(sceneFor(11, false)).toBe('dock');
    expect(sceneFor(5, true)).toBe('isle-valuation');
    expect(sceneFor(0, false)).toBe('dock');
    expect(EXTENSION_SCENES.every((k) => k.startsWith('isle-'))).toBe(true);
  });
});

describe('延伸區與期中考範圍的資料（03 第 2.2 節、17 第 5.1 節）', () => {
  const raw = (id: string, order: number, scope?: string, examScope?: string) => ({
    id,
    order,
    scope,
    examScope,
    title: id,
    levelIds: [`lv_${id}1`],
    objectives: [],
  });

  it('scope 為 extension 的章放延伸區且一律不列入期中考；主線章依 examScope 判斷', () => {
    const chapters = buildChapters([
      raw('ch_e1', 4, 'extension', 'not_in_exam'),
      raw('ch_c1', 1, 'core', 'unconfirmed'),
      raw('ch_c2', 2, 'core', 'not_in_exam'),
      raw('ch_c3', 3),
    ]);
    expect(chapters.map((c) => c.id)).toEqual(['ch_c1', 'ch_c2', 'ch_c3', 'ch_e1']);
    expect(chapters.map((c) => c.extension)).toEqual([false, false, false, true]);
    expect(chapters.map((c) => c.notInExam)).toEqual([false, true, false, true]);
    // 期中考範圍（T32）：只有主線章節且 examScope 為 midterm 才標；unconfirmed、沒填與延伸章都不標
    expect(chapters.map((c) => c.inExam)).toEqual([false, false, false, false]);
    expect(buildChapters([raw('ch_m1', 1, 'core', 'midterm'), raw('ch_m2', 2, 'extension', 'midterm')]).map((c) => c.inExam)).toEqual([true, false]);
    expect(chapters.map((c) => c.chapterNo)).toEqual([1, 2, 3, 1]);
    // 延伸章就算 examScope 沒填也不列入期中考
    expect(buildChapters([raw('ch_e2', 1, 'extension')])[0]!.notInExam).toBe(true);
  });

  it('fixture：延伸章標不列入期中考；ch1new 全三星但沒有徽章、all 完成與精通都有；quest-full 有 14 章', () => {
    const d = fixtureData('zh-TW');
    expect(d.chapters.filter((c) => c.extension).every((c) => c.notInExam)).toBe(true);
    expect(d.chapters.filter((c) => !c.extension).every((c) => !c.notInExam)).toBe(true);
    const ch1new = fixtureProgress('ch1new');
    expect(ch1new.badges.size).toBe(0);
    expect(badgeStateByStars(d, ch1new, 'ch_fx0001')).toBe('mastery');
    expect(earnedBadges(d, ch1new)).toEqual([{ chapterId: 'ch_fx0001', state: 'mastery', unlockIds: ['badge:ch_fx0001', 'badge:ch_fx0001:mastery'] }]);
    const all = fixtureProgress('all');
    expect(earnedBadges(d, all)).toEqual([]);
    expect(badgeCount(all)).toBe(3);
    expect(badgeStateFor(d, fixtureProgress('ch1done'), 'ch_fx0001')).toBe('done');
    expect(fixtureVariantFrom('ch1new')).toBe('ch1new');
    expect(fixtureVariantFrom('other')).toBe('default');
    const full = fullFixtureData('en');
    expect(full.chapters).toHaveLength(FULL_FIXTURE_CORE + FULL_FIXTURE_EXTENSION);
    expect(full.chapters.filter((c) => c.extension)).toHaveLength(4);
    expect(new Set(full.chapters.map((c) => sceneFor(c.chapterNo, c.extension))).size).toBe(14);
    expect(EMPTY_FIXTURE_PROGRESS.levels.size).toBe(0);
  });

  it('fullFixtureSource 的關卡名稱與解析', async () => {
    const full = fullFixtureData('zh-TW');
    const first = full.chapters[0]!.levels[0]!.id;
    expect((await fullFixtureSource.levelMeta(first, 'zh-TW')).title).toBe('第 1 站');
    expect((await fullFixtureSource.levelMeta(first, 'en')).title).toBe('Stop 1');
    expect(await fullFixtureSource.resolve(first)).toEqual({ status: 'active', kind: 'level' });
    expect(await fullFixtureSource.resolve('lv_nope0000')).toEqual({ status: 'unknown' });
    await expect(fullFixtureSource.levelMeta('lv_nope0000', 'zh-TW')).rejects.toThrow('fixture 沒有關卡');
  });

  it('fixture 請求：quest、quest-full、其他', () => {
    expect(fixtureRequestFrom('?ll-fixture=quest')).toEqual({ fixture: 'quest', variant: null });
    expect(fixtureRequestFrom('?ll-fixture=quest-full&ll-fixture-progress=all')).toEqual({ fixture: 'quest-full', variant: 'all' });
    expect(fixtureRequestFrom('?ll-fixture=x')).toEqual({ fixture: null, variant: null });
  });
});

// 維護者 2026-10-26：點進地圖或章節頁要直接看到完整的資訊。useQuestMap 的載入（loadQuestMap）把章節快照和進度一起讀、一起回傳，
// 不再先回傳空進度、第一次繪製後才補上（以前的 progressReady）
describe('loadQuestMap：章節快照與進度一起到', () => {
  it('fixture quest：回傳的 ready 狀態同時有資料與該 variant 的進度，沒有 progressReady 欄位', async () => {
    const state = await loadQuestMap('zh-TW', fixtureRequestFrom('?ll-fixture=quest&ll-fixture-progress=all'));
    expect(state.status).toBe('ready');
    expect(state.data.chapters).toHaveLength(3);
    expect(state.progress).toEqual(fixtureProgress(fixtureVariantFrom('all')));
    expect(state.progress.levels.size).toBeGreaterThan(0);
    expect('progressReady' in state).toBe(false);
  });

  it('fixture quest-full：進度是空的 fixture 進度，和資料一起到', async () => {
    const state = await loadQuestMap('en', fixtureRequestFrom('?ll-fixture=quest-full'));
    expect(state.progress).toBe(EMPTY_FIXTURE_PROGRESS);
    expect(state.data.chapters.length).toBe(FULL_FIXTURE_CORE + FULL_FIXTURE_EXTENSION);
    expect(state.source).toBe(fullFixtureSource);
  });
});
