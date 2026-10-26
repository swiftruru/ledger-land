// 第 1 章「課程定位」：起點的沙灘碼頭（圖規 6.4 的 C01，也是其他章的範本）。底色是沙地（地圖組的 .qm-terrain），這一層畫地形塊與物件：
// - medium 以上：入口那一翼的上半是海（岸線不規則，和上方第 2 章的海接成一片），主角道具是從沙灘伸進海裡的碼頭棧橋，北側綁著一艘小划船，
//   岸線從棧橋靠沙灘那一段穿過；岸邊有礁石、海面有短浪與帆船。另一翼頂端是一個海灣（也和上方的海接起來，往下延伸到章高約一半），
//   下面是一塊有機邊的草地上的兩間小店（小店、攤位）與一盞路燈，店門口一條小路彎到區帶外緣，路邊一排木樁，還有沙丘（第 3 輪看圖驗收：兩翼都是「地塊加物件」）。
//   夜景是棧橋上的兩盞燈、小店的窗與路燈（深色主題才有光暈）。
// - 手機：沒有兩翼，主角道具是攤開的地圖（72 × 52，只用 scene-line 畫摺線與格線，不畫虛線與 X），放在節點交錯留下的空側，旁邊一支木樁燈（夜景）；
//   另一側的空位放一排木樁與草、幾顆石頭（軌道裡最多兩組）。
// - 頂端：接縫那 24px 整條鋪成沙地，兩翼的海從畫面外接上來；兩條海岸在交界的 x 是 scene-kit 的 seamCoast（第 2 章章節牌沙灘的底端從同一組 x 起筆），
//   海岸線、浪花線與上下兩章的陸地都接成一片，沒有直角缺口（第 2 輪看圖驗收）。
// 放置、著地與保護框都交給 scene-kit 的 placeProps；這個檔只決定構圖（候選位置與岸線的形狀）和畫法。
import type { Bp, Point, SceneGeo } from '../quest-map/layout.ts';
import { inflate, SEAM } from '../quest-map/layout.ts';
import type { SceneProps } from '../quest-map/scenes.tsx';
import {
  byDepth,
  dayNight,
  envelope,
  FOAM,
  Glow,
  GLOW,
  Grass,
  Gulls,
  Lamps,
  LEAF,
  LINE,
  MEADOW,
  nearSide,
  organic,
  PAPER,
  placeProps,
  pointInPoly,
  polyPath,
  Prop,
  rectPoly,
  ROCK,
  ROCK_DEEP,
  ROOF,
  roughen,
  Sailboat,
  SAND,
  SceneDefs,
  SEA,
  seamCoast,
  shadeFill,
  smoothClosed,
  Terrain,
  TerrainRect,
  useSceneIds,
  WaterTexture,
  waterTexture,
  WING_GAP,
  WING_REACH,
  wingSpan,
  WOOD,
  type Anchor,
  type Placed,
  type PropSpec,
  type Side,
  type TerrainBlock,
} from './scene-kit.tsx';

export const geoAware = true;

const WIDE: readonly Bp[] = ['medium', 'expanded'];

/** 主角道具：有兩翼時是棧橋（依翼寬由大到小）；放不下時（手機、600 到 767）改走 planCompact：軌道裡的小海灣加木棧道與划船 */
const HERO: PropSpec = {
  id: 'pier',
  tier: 'hero',
  ground: ['wing'],
  variants: [
    { w: 220, h: 80, bps: WIDE, form: 'pier', anchors: [{ wing: 'near', u: 0.15, v: 0.54 }] },
    { w: 144, h: 68, bps: WIDE, form: 'pier', anchors: [{ wing: 'near', u: 0, v: 0.54 }] },
    { w: 112, h: 64, bps: WIDE, form: 'pier', anchors: [{ wing: 'near', u: 0, v: 0.54 }] },
    { w: 100, h: 60, bps: WIDE, form: 'pier', anchors: [{ wing: 'near', u: 0, v: 0.54 }] },
  ],
};

/** 棧橋的比例（框內座標，往左是海）：T 形端頭、甲板、甲板北側的划船與燈；畫圖與岸線計算共用 */
function pierGeom(w: number, h: number) {
  const s = h / 80;
  const lip = Math.round(8 * s);
  const t = Math.max(14, Math.round(20 * s));
  const lampH = Math.round(30 * s);
  const boatH = Math.max(14, Math.round(22 * s));
  const deckY = Math.max(lampH - t / 2 + 6, boatH + 8);
  const head = Math.round(Math.min(40, w * 0.2));
  const boatW = Math.round(Math.min(64, w * 0.34));
  const boatX = head + 8;
  const boatY = deckY - 4 - boatH;
  return { s, lip, t, lampH, boatH, deckY, head, boatW, boatX, boatY };
}

export interface Water {
  readonly side: Side;
  readonly d: string;
  readonly poly: readonly Point[];
  readonly shore: string;
  readonly swash: string;
  /** 離軌道 400px 以外的地紋（6.6）；那一塊不到 160px 寬時是空字串（只剩一排會像尺規刻度） */
  readonly texture: string;
}

export interface DockPlan {
  readonly blocks: readonly TerrainBlock[];
  readonly waters: readonly Water[];
  readonly props: readonly Placed[];
  /** 接縫那 24px 整條鋪成沙地（上面還有一章時）：兩翼的海蓋在上面，交界的陸地範圍就是 seamCoast */
  readonly seamSand: boolean;
  /** 另一翼小店底下的草地（地形塊 lawn）與店門口往外的小路（地形塊 lane）；沒有時是空字串 */
  readonly lawn?: string;
  readonly lane?: { readonly d: string; readonly edges: string };
}

// ---------------------------------------------------------------------------------------------
// 岸線（只有這一章用，從 scene-kit 搬過來，省 scene-kit 的預算）

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 一翼的水域（海灣）：岸線由 (y, d) 控制點決定，d 是岸線離軌道邊的距離；水從岸線一直鋪到區帶外緣（含 rail 底下），
 * 最後一點之後往外緣收邊。上緣在畫面外，和上方那一章的底色接在一起（接縫在這一段變成連續的水面）。
 */
function wingWater(
  geo: SceneGeo,
  side: Side,
  ctrl: readonly (readonly [number, number])[],
  seed: string,
): { d: string; poly: Point[]; shore: string; swash: string } {
  const sx = (d: number) => (side === 'left' ? geo.track.left - d : geo.track.right + d);
  const edge = side === 'left' ? -4 : geo.bandW + 4;
  // 岸線從畫面外（y = -28）垂直進來，和上方那一章的底色接起來時不會在接縫處彎出小鉤子
  const shorePts = [{ x: sx(ctrl[0]![1]), y: -28 }, ...ctrl.map(([y, d]) => ({ x: sx(d), y }))];
  const last = shorePts[shorePts.length - 1]!;
  // 外緣與上緣不加起伏，只有岸線不規則
  const rough = roughen(
    [...shorePts, { x: edge, y: last.y + 12 }, { x: edge, y: -28 }],
    seed,
    10,
    (a, b) => (a.x === edge && b.x === edge) || (a.y <= -4 && b.y <= -4),
  );
  const { d, poly } = smoothClosed(rough);
  // 岸邊的浪花線：只畫岸線那一段（不含外緣），從取樣多邊形取出 x 在區帶內側的點
  const inner = poly.filter((p) => (side === 'left' ? p.x > 0 : p.x < geo.bandW) && p.y > -6);
  const line = (pts: readonly Point[]) => (pts.length > 1 ? `M${pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join(' L')}` : '');
  // 第二道浪線：沿岸線往水裡平移 10px（法線方向），離上緣 32px 以下才畫，避開接縫
  const swash: Point[] = [];
  for (let i = 1; i < inner.length - 1; i++) {
    const a = inner[i - 1]!;
    const b = inner[i + 1]!;
    const p = inner[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    let q = { x: p.x + nx * 10, y: p.y + ny * 10 };
    if (!pointInPoly(q, poly)) q = { x: p.x - nx * 10, y: p.y - ny * 10 };
    if (q.y > 32 && q.x > 4 && q.x < geo.bandW - 4 && pointInPoly(q, poly)) swash.push(q);
  }
  return { d, poly, shore: line(inner), swash: line(swash) };
}

/** 水域在高度 y 的岸線 x（離軌道最近的那一點）；那個高度沒有水時 null */
function shoreX(poly: readonly Point[], y: number, side: Side, geo: SceneGeo): number | null {
  const xs = poly.filter((p) => Math.abs(p.y - y) < 6 && p.x > 0 && p.x < geo.bandW).map((p) => p.x);
  if (xs.length === 0) return null;
  return side === 'left' ? Math.max(...xs) : Math.min(...xs);
}

/** 一翼的水域最遠伸到哪裡（離軌道邊） */
const reach = (geo: SceneGeo, side: Side) => Math.min(side === 'left' ? geo.track.left : geo.bandW - geo.track.right, WING_REACH + 40);
/** 一翼的海岸在接縫的位置（離軌道邊）：seamCoast 的 xa 或 xb，和第 2 章章節牌沙灘的底端同一個 x */
function topD(geo: SceneGeo, side: Side): number {
  const c = seamCoast(geo);
  return side === 'left' ? geo.track.left - c.xa : c.xb - geo.track.right;
}

/** 水域的岸線與第二道浪線（取樣多邊形裡 x 在區帶內、y 在 -6 以下的點；第二道往水裡平移 gap，離上緣 32px 以下才畫） */
function shoreLines(poly: readonly Point[], geo: SceneGeo, gap = 10): { shore: string; swash: string } {
  const inner = poly.filter((p) => p.x > 0 && p.x < geo.bandW && p.y > -6);
  const line = (pts: readonly Point[]) => (pts.length > 1 ? `M${pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join(' L')}` : '');
  const swash: Point[] = [];
  for (let i = 1; i < inner.length - 1; i++) {
    const a = inner[i - 1]!;
    const b = inner[i + 1]!;
    const p = inner[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    let q = { x: p.x + nx * gap, y: p.y + ny * gap };
    if (!pointInPoly(q, poly)) q = { x: p.x - nx * gap, y: p.y - ny * gap };
    if (q.y > 32 && q.x > 4 && q.x < geo.bandW - 4 && pointInPoly(q, poly)) swash.push(q);
  }
  return { shore: line(inner), swash: line(swash) };
}

/** 小路：經過三個點的二次曲線（每 6px 一點）兩側各 9px 的帶狀多邊形，加兩條路緣線（只畫區帶內的部分） */
function lanePath([a, b, c]: readonly Point[], bandW: number): { poly: Point[]; d: string; edges: string } {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    const u = 1 - t;
    return { x: u * u * a!.x + 2 * u * t * b!.x + t * t * c!.x, y: u * u * a!.y + 2 * u * t * b!.y + t * t * c!.y };
  });
  const side = (k: number) =>
    pts.map((p, i) => {
      const q = pts[Math.max(0, i - 1)]!;
      const r = pts[Math.min(pts.length - 1, i + 1)]!;
      const len = Math.hypot(r.x - q.x, r.y - q.y) || 1;
      return { x: p.x - ((r.y - q.y) / len) * k, y: p.y + ((r.x - q.x) / len) * k };
    });
  const L = side(9);
  const R = side(-9);
  const edge = (q: readonly Point[]) => {
    const inside = q.filter((p) => p.x > 0 && p.x < bandW);
    return inside.length > 1 ? `M${inside.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}` : '';
  };
  const poly = [...L, ...R.reverse()];
  return { poly, d: polyPath(poly), edges: edge(L) + edge(side(-9)) };
}

export interface Cove extends Water {
  /** 小海灣在高度 y 的岸線 x（靠軌道中線那一側） */
  readonly edge: (y: number) => number;
  readonly yTop: number;
  readonly yBot: number;
}

/**
 * 手機與沒有棧橋的 medium（第 2 輪看圖驗收：第 1 章在 320 到 430 寬只剩一片沙，看不出是碼頭）：海從區帶邊緣伸進軌道，成一個小海灣。
 * 候選：每一關的另一側（節點交錯留下的空側），上下由那一側的保護框（節點、星星籤、章節牌、紙籤、拱門；鈴框不算，角色可以站在水邊）決定；
 * 形狀是貼著區帶邊的半橢圓，最深到軌道中線再過去 24px，離路面 12px 以上。依面積由大到小排，寬不到 120、高不到 64 的不算
 */
export function coves(geo: SceneGeo, tight: SceneGeo): Cove[] {
  const mid = (geo.track.left + geo.track.right) / 2;
  const hard = tight.protect.filter((r) => r.kind !== 'road' && r.kind !== 'bell');
  const roads = tight.protect.filter((r) => r.kind === 'road');
  const out: { cove: Cove; area: number }[] = [];
  for (const [i, n] of geo.nodes.entries()) {
    const side: Side = n.x < mid ? 'right' : 'left';
    const on = hard.filter((r) => (side === 'right' ? r.x1 > mid : r.x0 < mid));
    if (on.some((r) => r.y0 < n.y && r.y1 > n.y)) continue;
    const yTop = Math.max(SEAM + 16, ...on.filter((r) => r.y1 <= n.y).map((r) => r.y1)) + 6;
    const yBot = Math.min(geo.h - 16, ...on.filter((r) => r.y0 >= n.y).map((r) => r.y0)) - 6;
    if (yBot - yTop < 64) continue;
    const right = side === 'right';
    const yc = (yTop + yBot) / 2;
    const ry = (yBot - yTop) / 2;
    const E = right ? geo.bandW + 14 : -14;
    const rx = Math.abs(E - (right ? mid - 24 : mid + 24));
    const edgeRaw = (y: number) => {
      const t = (y - yc) / ry;
      let x = E + (right ? -1 : 1) * rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (const r of roads) if (r.y0 - 12 < y && y < r.y1 + 12) x = right ? Math.max(x, r.x1 + 12) : Math.min(x, r.x0 - 12);
      return x;
    };
    const rows: Point[] = [];
    for (let y = yTop; y <= yBot + 0.01; y += 8) rows.push({ x: edgeRaw(y), y });
    // 岸線平滑：相鄰三列取最靠區帶邊的那一個（不會切進路面），再平均
    const xs = rows.map((_, k) => (right ? Math.max : Math.min)(...rows.slice(Math.max(0, k - 1), k + 2).map((p) => p.x)));
    const sm = xs.map((_, k) => xs.slice(Math.max(0, k - 1), k + 2).reduce((a, b) => a + b, 0) / xs.slice(Math.max(0, k - 1), k + 2).length);
    const widths = sm.map((x) => Math.abs(E - x) - 14);
    if (Math.max(...widths) < 120) continue;
    const far = right ? geo.bandW + 40 : -40;
    const ctrl = [{ x: far, y: yTop - 6 }, ...rows.map((p, k) => ({ x: sm[k]!, y: p.y })), { x: far, y: yBot + 6 }];
    const { d, poly } = smoothClosed(
      roughen(ctrl, `dock cove ${i}`, 5, (a, b) => Math.abs(a.x - far) < 1 || Math.abs(b.x - far) < 1),
      5,
    );
    const edge = (y: number) => {
      const hit = poly.filter((p) => Math.abs(p.y - y) < 5 && p.x > -20 && p.x < geo.bandW + 20).map((p) => p.x);
      return hit.length ? (right ? Math.min(...hit) : Math.max(...hit)) : right ? geo.bandW : 0;
    };
    out.push({ cove: { side, d, poly, ...shoreLines(poly, geo, 8), texture: '', edge, yTop, yBot }, area: widths.reduce((a, b) => a + Math.max(0, b), 0) });
  }
  return out.sort((a, b) => b.area - a.area).map((c) => c.cove);
}

/** 有兩翼但棧橋放不下時（600 到 767）：兩翼頂端各一片海，從接縫的 seamCoast 往下收回區帶外緣 */
function topWater(geo: SceneGeo, side: Side): Water {
  const top = topD(geo, side);
  const S = reach(geo, side);
  const w = wingWater(
    geo,
    side,
    [
      [-4, top],
      [0.07 * geo.h, top + 16],
      [0.16 * geo.h, Math.max(top + 6, 0.55 * S)],
      [0.26 * geo.h, 0.95 * S],
    ],
    `dock-top-${side}`,
  );
  return { side, ...w, texture: '' };
}

/** 木棧道加划船（手機的主角道具，框 92 × 52，往左是岸、往右是海；海灣在左邊時翻轉）：40 × 12 的棧道與兩根樁、端頭一盞燈（夜景）、48 × 26 的划船綁在端頭 */
const JETTY = { w: 92, h: 52 } as const;

/**
 * 手機（或棧橋放不下的 medium）：軌道裡的小海灣、伸進海灣的木棧道與划船（主角道具）；攤開的地圖降為次要道具，
 * 棧道根部一支木樁燈（夜景）、海灣裡一個浮標與短浪、節點空側一排木樁與草。物件填色用 scene-wood、scene-roof、scene-leaf。
 * 保護框和 G9 的量法一致再嚴一點：紙籤與章節牌下方整排多 16px（木樁、立柱那一帶），路面外擴 3px（量測沿畫出來的路取樣，轉彎處多出幾 px）
 */
function planCompact(geo: SceneGeo, base: readonly TerrainBlock[], seamSand: boolean): DockPlan {
  const tight: SceneGeo = {
    ...geo,
    protect: geo.protect.map((r) =>
      r.kind === 'road' ? { ...r, ...inflate(r, 3) } : r.kind === 'plaque' || r.kind === 'banner' ? { ...r, y1: r.y1 + 16 } : r,
    ),
  };
  const waters: Water[] = geo.wings.left && geo.wings.right ? (['left', 'right'] as const).map((s) => topWater(geo, s)) : [];
  const tw = geo.track.right - geo.track.left;
  const u = (cx: number) => (cx - geo.track.left) / tw;
  // 依面積試每個海灣，第一個放得下木棧道的就用：棧道的根部壓在岸上 14px（框的岸側在 edge(y) 往陸地 14），由海灣中間往上下找；
  // 放不下就換下一個海灣（不讓放置器在別處掃描空位，棧道一定在水邊）
  let cove: Cove | null = null;
  let hero: Placed | undefined;
  const sea = waters.map((w) => ({ id: 'sea', poly: w.poly }));
  for (const c of coves(geo, tight)) {
    const right = c.side === 'right';
    const anchors: Anchor[] = [];
    const yc = (c.yTop + c.yBot) / 2;
    for (const dy of [0, -8, 8, -16, 16, -24, 24, -32, 32, -40, 40]) {
      const y1 = yc + JETTY.h / 2 + dy;
      const shore = c.edge(y1 - 18);
      const x0 = right ? shore - 14 : shore + 14 - JETTY.w;
      anchors.push({ track: true, u: u(x0 + JETTY.w / 2), v: y1 / geo.h });
    }
    const [p] = placeProps([{ id: 'jetty', tier: 'minor', ground: ['sand', 'sea'], variants: [{ ...JETTY, form: 'jetty', anchors }] }], tight, {
      blocks: [...base, ...sea, { id: 'sea', poly: c.poly }],
    });
    if (!p) continue;
    cove = c;
    hero = { ...p, tier: 'hero', flip: !right };
    break;
  }
  const blocks: TerrainBlock[] = [...base, ...sea, ...(cove ? [{ id: 'sea', poly: cove.poly }] : [])];
  const taken: Placed[] = hero ? [hero] : [];
  const DRY = ['sand', '!sea'];
  const map: PropSpec = {
    id: 'map',
    tier: hero ? 'minor' : 'hero',
    ground: DRY,
    variants: [
      {
        w: 72,
        h: 52,
        form: 'map',
        anchors: [{ node: 1 }, { node: 0 }, { node: 2 }, { node: 1, dv: -28 }, { node: 1, dv: 28 }, { node: 0, dv: -30 }, { node: 2, dv: 30 }],
      },
    ],
  };
  const [mapP] = placeProps([map], tight, { blocks, taken });
  if (mapP) taken.push(mapP);
  const extra: PropSpec[] = [];
  if (hero && cove) {
    const right = cove.side === 'right';
    extra.push(
      ...(['buoy', 'ripple'] as const).map((form): PropSpec => ({
        id: `${form}-cove`,
        tier: 'detail',
        ground: ['sea'],
        whole: true,
        variants: [
          {
            w: form === 'buoy' ? 16 : 30,
            h: form === 'buoy' ? 24 : 10,
            form,
            anchors: [0.75, 0.6, 0.88].flatMap((k) =>
              [form === 'buoy' ? cove.yBot - 10 : cove.yTop + 22, (cove.yTop + cove.yBot) / 2 + (form === 'buoy' ? 24 : -20)].map((y) => {
                const e = cove.edge(y - 6);
                const x = right ? e + (geo.bandW - e) * k : e * (1 - k);
                return { track: true as const, u: u(x), v: y / geo.h };
              }),
            ),
          },
        ],
      })),
    );
  } else if (mapP) extra.push(mapLamp(mapP, geo));
  const lamp = placeProps(extra, tight, { blocks, taken });
  const rest = placeProps([...TRACK_PROPS, ...groundDetails(geo)], tight, { blocks, taken: [...taken, ...lamp] });
  const props = [...taken, ...lamp, ...rest];
  return { blocks, waters: [...waters, ...(cove ? [cove] : [])], props, seamSand };
}

/** 構圖（純函式，測試也用）：先放主角道具，依它畫出岸線，再放次要道具與細節 */
export function planDock(geo: SceneGeo): DockPlan {
  const sand: TerrainBlock = { id: 'sand', poly: rectPoly({ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }) };
  const wings: TerrainBlock[] = (['left', 'right'] as const).flatMap((side) => {
    const w = side === 'left' ? geo.wings.left : geo.wings.right;
    return w ? [{ id: 'wing', poly: rectPoly({ x0: w.x0, y0: SEAM, x1: w.x1, y1: geo.h }) }] : [];
  });
  const base = [sand, ...wings];
  const seamSand = geo.corridor.exit !== null;
  const [hero] = placeProps([HERO], geo, { blocks: base });
  if (!hero) return planCompact(geo, base, seamSand);

  const near = nearSide(geo);
  const far: Side = near === 'left' ? 'right' : 'left';
  const h = geo.h;
  /** 區段本身的高（第 1 章的場景延伸到地面時 h 比它多 geo.ground）：另一翼頂端的海灣照它的比例畫，和沒有地面時同一個形狀 */
  const hs = h - (geo.ground ?? 0);
  const W = hero.x1 - hero.x0;

  // 入口翼的海：頂端從 seamCoast 的 x 起筆（和第 2 章的章節牌沙灘同一個 x），往下先外凸一個小岬、再收一個小灣，
  // 岸線在棧橋靠沙灘的那一段（離軌道邊 dCross）穿過甲板，往下逐漸退到外緣；上半是海、下半是沙灘
  const pg = pierGeom(W, hero.y1 - hero.y0);
  const yDeck = hero.y0 + pg.deckY + pg.t / 2;
  const heroNear = near === 'left' ? geo.track.left - hero.x1 : hero.x0 - geo.track.right;
  const dCross = heroNear + 0.4 * W;
  const S = reach(geo, near);
  const top = topD(geo, near);
  // 頂端到棧橋之間每 44px 一個控制點，離軌道的距離從 top 漸變到 dCross × 0.85，加上交錯的起伏（+16、-8；頂端 40px 內收掉，
  // 交界那一段是直的、和第 2 章接得起來），一路交錯到棧橋前：岸線沒有一長段直的（第 2 輪看圖驗收），穿過棧橋的地方也不是轉折點
  const yA = yDeck - 26;
  const dA = Math.max(top + 12, dCross * 0.85);
  const mid: [number, number][] = [];
  for (let y = 44, k = 0; y < yA; y += 44, k++) mid.push([y, top + ((dA - top) * y) / yA + (k % 2 ? -8 : 16) * Math.min(1, y / 40)]);
  const nearWater = wingWater(
    geo,
    near,
    [[-4, top], ...mid, [yDeck, dCross], [yDeck + 0.1 * h, dCross + 0.3 * (S - dCross)], [yDeck + 0.2 * h, S * 0.92]],
    'dock-near',
  );
  // 另一翼頂端的小海灣
  const Sf = reach(geo, far);
  const farWater = geo.wings[far]
    ? wingWater(
        geo,
        far,
        [
          [-4, topD(geo, far)],
          [0.12 * hs, 50 + 0.2 * Sf],
          [0.24 * hs, 0.6 * Sf],
          [0.36 * hs, 0.8 * Sf],
          [0.46 * hs, 0.96 * Sf],
        ],
        'dock-far',
      )
    : null;
  const waters: Water[] = [
    { side: near, ...nearWater, texture: waterTexture(geo, near, nearWater.poly) },
    ...(farWater ? [{ side: far, ...farWater, texture: waterTexture(geo, far, farWater.poly) }] : []),
  ];
  const blocks = [...base, ...waters.map((w) => ({ id: 'sea', poly: w.poly }))];

  // 動態候選：以「物件中心離軌道邊的距離」換算成翼內的比例 u
  const uAt = (side: Side, centre: number, w: number): number => {
    const span = wingSpan(side, geo)!;
    const depth = Math.abs(span.inner - span.outer);
    return Math.min(1, Math.max(0, (centre - WING_GAP - w / 2) / Math.max(1, depth - w)));
  };
  const distOf = (side: Side, x: number) => (side === 'left' ? geo.track.left - x : x - geo.track.right);
  const onShore = (side: Side, poly: readonly Point[], y: number, w: number, hh: number): Anchor[] => {
    const x = shoreX(poly, y, side, geo);
    return x === null ? [] : [{ wing: side === near ? 'near' : 'far', u: uAt(side, distOf(side, x), w), v: (y + hh * 0.35) / h }];
  };
  // 另一翼（第 3 輪看圖驗收：1440 寬時右翼只有一座柵欄和一個小丘，下方三分之一整條空著，左重右輕）：海灣往下延伸到章高約一半，
  // 海灣下方是兩間小店（小店與攤位）加一盞路燈，墊在一塊有機邊的草地上（地形塊 lawn）；店門口一條小路往下彎到區帶外緣（地形塊 lane），路邊一排木樁。
  // 和入口那一翼一樣是「地塊加物件」兩層；夜裡窗子與燈各一圈 r 18 的光暈
  const DRY = ['sand', '!sea'];
  const [kiosk] = geo.wings[far]
    ? placeProps(
        [
          {
            id: 'kiosk',
            tier: 'minor',
            group: 'shops',
            ground: DRY,
            // 翼夠寬時放大 1.25 倍（1280 以上），攤位與路燈跟著同一個倍數
            variants: [80, 64].map((w) => ({
              w,
              h: (w * 62) / 64,
              form: 'kiosk',
              anchors: [0.3, 0.12, 0.55, 0].flatMap((u) => [0.7, 0.76, 0.64].map((v) => ({ wing: 'far' as const, u, v }))),
            })),
          },
        ],
        geo,
        { blocks, taken: [hero] },
      )
    : [];
  let lawn: Point[] | null = null;
  let lane: ReturnType<typeof lanePath> | null = null;
  const fence: Anchor[] = [];
  const shops: Placed[] = [];
  if (kiosk) {
    const kd = distOf(far, (kiosk.x0 + kiosk.x1) / 2);
    const vk = kiosk.y1 / h;
    const k = (kiosk.x1 - kiosk.x0) / 64;
    const more = placeProps(
      [
        {
          id: 'stall',
          tier: 'minor',
          group: 'shops',
          ground: DRY,
          variants: [
            {
              w: 54 * k,
              h: 46 * k,
              form: 'stall',
              anchors: [kd + 72 * k, kd - 72 * k].map((c) => ({ wing: 'far' as const, u: uAt(far, c, 54 * k), v: vk + 0.03 })),
            },
          ],
        },
        {
          id: 'shop-lamp',
          tier: 'minor',
          group: 'shops',
          ground: DRY,
          tall: true,
          variants: [
            {
              w: 14 * k,
              h: 46 * k,
              form: 'shop-lamp',
              anchors: [kd - 48 * k, kd + 120 * k, kd + 48 * k].map((c) => ({ wing: 'far' as const, u: uAt(far, c, 14 * k), v: vk + 0.05 })),
            },
          ],
        },
        // 店門口的貨：兩個木箱與一籃水果（攤位外側，放不下就試小店內側）
        {
          id: 'goods',
          tier: 'minor',
          group: 'shops',
          ground: DRY,
          variants: [
            {
              w: 36 * k,
              h: 28 * k,
              form: 'goods',
              anchors: [kd + 124 * k, kd - 84 * k, kd + 160 * k].map((c) => ({ wing: 'far' as const, u: uAt(far, c, 36 * k), v: vk + 0.065 })),
            },
          ],
        },
      ],
      geo,
      { blocks, taken: [hero, kiosk] },
    );
    const group = [kiosk, ...more];
    // 草地：每個東西的下半（底線往上 45%）加門口 24px，聯集外擴 18 再推出起伏；東西改成站在草地上
    lawn = smoothClosed(
      organic(
        (() => {
          const env = envelope(
            group.map((p) => ({ x0: p.x0, y0: p.y1 - 0.45 * (p.y1 - p.y0), x1: p.x1, y1: p.y1 + 24 })),
            18,
            Math.min(...group.map((p) => p.y1 - 0.45 * (p.y1 - p.y0))) - 14,
            Math.max(...group.map((p) => p.y1)) + 24 + 14,
            12,
          );
          return [...env.ys.map((y, i) => ({ x: env.L[i]!, y })), ...env.ys.map((y, i) => ({ x: env.R[i]!, y })).reverse()];
        })(),
        'dock lawn',
        7,
        undefined,
        14,
        56,
        120,
      ),
      3,
    ).poly;
    shops.push(...group.map((p) => ({ ...p, ground: ['lawn'] })));
    // 小路：小店門口往外下方彎到區帶外緣（離章底 40px 以上）
    const door = { x: (kiosk.x0 + kiosk.x1) / 2, y: kiosk.y1 + 10 };
    const edgeX = far === 'left' ? -30 : geo.bandW + 30;
    const yEnd = Math.min(h - 40, door.y + 0.18 * h);
    const ctrl = { x: door.x + (edgeX - door.x) * 0.2, y: yEnd + 16 };
    const end = { x: edgeX, y: yEnd - 12 };
    lane = lanePath([door, ctrl, end], geo.bandW);
    // 路邊的木樁：小路後半段的下方 30px
    for (const t of [0.62, 0.8, 0.45]) {
      const u = 1 - t;
      const x = u * u * door.x + 2 * u * t * ctrl.x + t * t * end.x;
      const y = u * u * door.y + 2 * u * t * ctrl.y + t * t * end.y;
      fence.push({ wing: 'far', u: uAt(far, distOf(far, x), 44), v: (y + 40) / h });
    }
  }
  const land: TerrainBlock[] = [...(lawn ? [{ id: 'lawn', poly: lawn }] : []), ...(lane ? [{ id: 'lane', poly: lane.poly }] : [])];
  const OPEN = ['sand', '!sea', '!lawn', '!lane'];
  const pierFar = heroNear + W;
  const vBuoy = (yDeck + 44) / h;

  const minor: PropSpec[] = [
    {
      id: 'buoy-near',
      tier: 'minor',
      group: 'pier',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 16,
          h: 24,
          form: 'buoy',
          anchors: [
            { wing: 'near', u: uAt(near, pierFar + 28, 16), v: vBuoy },
            { wing: 'near', u: uAt(near, pierFar + 44, 16), v: vBuoy - 0.1 },
            { wing: 'near', u: 0.9, v: 0.36 },
          ],
        },
      ],
    },
    {
      id: 'rocks-near',
      tier: 'minor',
      ground: ['wing'],
      variants: [
        {
          w: 44,
          h: 22,
          form: 'rocks',
          anchors: [...onShore(near, nearWater.poly, yDeck + 0.15 * h, 44, 22), ...onShore(near, nearWater.poly, yDeck + 0.22 * h, 44, 22)],
        },
      ],
    },
    {
      id: 'boat-near',
      tier: 'minor',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 48,
          h: 56,
          form: 'sailboat',
          anchors: [
            { wing: 'near', u: 0.62, v: 0.2 },
            { wing: 'near', u: 0.9, v: 0.26 },
            { wing: 'near', u: 0.35, v: 0.15 },
            { wing: 'near', u: 0.1, v: 0.12 },
          ],
        },
      ],
    },
    {
      id: 'gulls-near',
      tier: 'minor',
      group: 'boat-near',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 36,
          h: 14,
          form: 'gulls',
          anchors: [
            { wing: 'near', u: 0.25, v: 0.09 },
            { wing: 'near', u: 0.7, v: 0.07 },
            { wing: 'near', u: 0.5, v: 0.32 },
          ],
        },
      ],
    },
    {
      id: 'beach-near',
      tier: 'minor',
      ground: ['sand', '!sea'],
      variants: [
        {
          w: 72,
          h: 32,
          form: 'beach',
          anchors: [
            { wing: 'near', u: 0.35, v: 0.93 },
            { wing: 'near', u: 0.1, v: 0.88 },
            { wing: 'near', u: 0.7, v: 0.95 },
          ],
        },
        {
          w: 44,
          h: 30,
          form: 'stakes',
          anchors: [
            { wing: 'near', u: 0.3, v: 0.93 },
            { wing: 'near', u: 0.8, v: 0.9 },
          ],
        },
      ],
    },
    {
      id: 'boat-far',
      tier: 'minor',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 48,
          h: 56,
          form: 'sailboat',
          anchors: [
            { wing: 'far', u: 0.55, v: 0.16 },
            { wing: 'far', u: 0.85, v: 0.15 },
            { wing: 'far', u: 0.3, v: 0.12 },
            { wing: 'far', u: 1, v: 0.2 },
          ],
        },
      ],
    },
    {
      id: 'gulls-far',
      tier: 'minor',
      group: 'boat-far',
      ground: ['wing'],
      variants: [
        {
          w: 36,
          h: 14,
          form: 'gulls',
          anchors: [
            { wing: 'far', u: 0.45, v: 0.34 },
            { wing: 'far', u: 0.75, v: 0.4 },
            { wing: 'far', u: 0.2, v: 0.3 },
          ],
        },
      ],
    },
    {
      id: 'dune-far',
      tier: 'minor',
      ground: OPEN,
      variants: [
        {
          w: 112,
          h: 34,
          form: 'dune',
          anchors: [
            { wing: 'far', u: 0.3, v: 0.54 },
            { wing: 'far', u: 0.6, v: 0.6 },
          ],
        },
        {
          w: 84,
          h: 28,
          form: 'dune',
          anchors: [
            { wing: 'far', u: 0.3, v: 0.54 },
            { wing: 'far', u: 0.7, v: 0.6 },
          ],
        },
      ],
    },
    // 路邊一排木樁（和小店同一組）：小路下方與上方各試幾個位置；沒有小店時照舊放在下半
    {
      id: 'stakes-far',
      tier: 'minor',
      group: kiosk ? 'shops' : undefined,
      ground: OPEN,
      variants: [
        {
          w: 44,
          h: 30,
          form: 'stakes',
          anchors: [
            ...fence,
            { wing: 'far', u: 0.15, v: 0.94 },
            { wing: 'far', u: 0.85, v: 0.8 },
            { wing: 'far', u: 0.15, v: 0.82 },
            { wing: 'far', u: 0.55, v: 0.88 },
          ],
        },
      ],
    },
    ...(farWater
      ? [
          {
            id: 'rocks-far',
            tier: 'minor' as const,
            ground: ['wing'],
            variants: [{ w: 36, h: 20, form: 'rocks', anchors: onShore(far, farWater.poly, 0.17 * hs, 36, 20) }],
          },
        ]
      : []),
    // 水面的短浪（細節，不佔組的名額）
    ...(
      [
        ['ripple-1', 'near', 0.5, 0.33],
        ['ripple-2', 'near', 0.85, 0.12],
        ['ripple-3', 'far', 0.7, 0.07],
      ] as const
    ).map(([id, wing, u, v]): PropSpec => ({
      id,
      tier: 'detail',
      ground: ['sea'],
      whole: true,
      variants: [
        {
          w: 30,
          h: 10,
          form: 'ripple',
          anchors: [
            { wing, u, v },
            { wing, u: u * 0.6, v: v + 0.04 },
            { wing, u: Math.min(1, u + 0.2), v: v + 0.08 },
          ],
        },
      ],
    })),
    ...groundDetails(geo),
  ];
  const all = [...blocks, ...land];
  const props = [hero, ...shops, ...placeProps(minor, geo, { blocks: all, taken: [hero, ...shops] })];
  return { blocks: all, waters, props, seamSand, lawn: lawn ? polyPath(lawn) : '', lane: lane ?? undefined };
}

/** 地圖旁的木樁燈（夜景，細節不佔組的名額）：先試地圖靠軌道中線的那一側，再試另一側與上方 */
function mapLamp(map: Placed, geo: SceneGeo): PropSpec {
  const tw = geo.track.right - geo.track.left;
  const u = (x: number) => (x - geo.track.left) / tw;
  const mid = (geo.track.left + geo.track.right) / 2;
  // 燈框中心離地圖框 20px（燈寬 20，和地圖之間留放置器要的 8px 間隔再多 2）
  const toward = map.x0 > mid ? map.x0 - 20 : map.x1 + 20;
  const away = map.x0 > mid ? map.x1 + 20 : map.x0 - 20;
  const v = (map.y1 + 6) / geo.h;
  return {
    id: 'lamp-map',
    tier: 'detail',
    ground: ['sand'],
    tall: true,
    variants: [
      {
        w: 20,
        h: 48,
        form: 'lamp',
        anchors: [
          { track: true, u: u(toward), v },
          { track: true, u: u(away), v },
          { track: true, u: u(toward), v: (map.y0 + 4) / geo.h },
        ],
      },
    ],
  };
}

/**
 * 地圖底部的地面（geo.ground，只有第 1 章有；第 3 輪 handoff：起點下方 184px 是一條什麼都沒有的沙地）：起點下方的軌道裡加兩叢草與一堆小石頭
 * （細節，不佔軌道兩組的名額；起點正下方有 sceneGeo 的保護框，不會像路通進石頭裡）。兩翼照 h 比例排的東西（沙灘的木樁、小路與路邊木樁）本來就會延伸下來。
 * 手機的地面下段在浮動的 Tab bar 後面，候選的底線都在區段底下 150px 以內
 */
function groundDetails(geo: SceneGeo): PropSpec[] {
  const g = geo.ground ?? 0;
  if (g < 96) return [];
  const y0 = geo.h - g;
  const at = (us: readonly number[], ys: readonly number[]): Anchor[] => ys.flatMap((y) => us.map((u) => ({ track: true as const, u, v: (y0 + y) / geo.h })));
  const sand = ['sand', '!sea'];
  return [
    { id: 'rocks-ground', tier: 'detail', ground: sand, variants: [{ w: 36, h: 20, form: 'rocks', anchors: at([0.62, 0.78, 0.42, 0.9], [104, 132, 80]) }] },
    { id: 'grass-ground', tier: 'detail', ground: sand, variants: [{ w: 28, h: 18, form: 'grass', anchors: at([0.34, 0.5, 0.22, 0.72], [64, 120, 92]) }] },
    { id: 'grass-ground-2', tier: 'detail', ground: sand, variants: [{ w: 28, h: 18, form: 'grass', anchors: at([0.86, 0.58, 0.12], [146, 72, 112]) }] },
  ];
}

/** 手機的軌道裡：節點交錯留下的空側放一排木樁加草（沙灘一角），再加幾顆石頭（最多兩組，放不下就換小的或不畫） */
const spots = (vs: readonly number[], us: readonly number[]): Anchor[] => vs.flatMap((v) => us.map((u) => ({ track: true as const, u, v })));
const TRACK_PROPS: readonly PropSpec[] = [
  {
    id: 'beach-track',
    tier: 'minor',
    ground: ['sand', '!sea'],
    variants: [
      {
        w: 72,
        h: 32,
        form: 'beach',
        anchors: [
          { node: 0, dv: 6 },
          { node: 2, dv: 6 },
          { node: 0, dv: -30 },
          { node: 2, dv: 34 },
          { node: 1, dv: 60 },
        ],
      },
      { w: 44, h: 30, form: 'stakes', anchors: [{ node: 0 }, { node: 2 }, { node: 1, dv: 56 }] },
    ],
  },
  {
    id: 'rocks-track',
    tier: 'minor',
    ground: ['sand', '!sea'],
    variants: [{ w: 36, h: 20, form: 'rocks', anchors: spots([0.3, 0.46, 0.62], [0.5, 0.42, 0.58]) }],
  },
  // 草叢是細節（不佔軌道兩組的名額）：沙灘上多一點 scene-leaf 的綠
  ...(
    [
      ['grass-track', [0.72, 0.56, 0.4], [0.3, 0.7, 0.5]],
      ['grass-track-2', [0.2, 0.86, 0.3], [0.62, 0.38, 0.5]],
    ] as const
  ).map(([id, vs, us]): PropSpec => ({ id, tier: 'detail', ground: ['sand', '!sea'], variants: [{ w: 28, h: 18, form: 'grass', anchors: spots(vs, us) }] })),
];

// ---------------------------------------------------------------------------------------------
// 畫法（划船、浮標、木樁目前只有這一章用；第二個場景要用時搬進 scene-kit）

/** 划船 64 × 24（俯視）：船身與兩條座板 */
function Rowboat({ w = 64, h = 24 }: { w?: number; h?: number }) {
  const m = h / 2;
  return (
    <>
      <path
        d={`M2 ${m}C${w * 0.22} 1 ${w * 0.78} 1 ${w - 2} ${m}C${w * 0.78} ${h - 1} ${w * 0.22} ${h - 1} 2 ${m}Z`}
        fill={ROOF}
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path d={`M${w * 0.36} 4.5V${h - 4.5}M${w * 0.62} 4.5V${h - 4.5}M${w * 0.16} ${m}H${w * 0.84}`} stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

/** 浮標 16 × 24：浮體與白帶、水面的圈 */
function Buoy() {
  return (
    <>
      <path d="M3 20V10a5 5 0 0 1 10 0v10ZM8 5V1" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M1 21q7 4 14 0M4 14h8" fill="none" stroke={FOAM} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** 一排木樁 w × h：三根樁加一條繩子 */
function Stakes({ w = 44, h = 30 }: { w?: number; h?: number }) {
  const xs = [4, w / 2 - 3, w - 10];
  const hs = [h - 8, h - 3, h - 10];
  return (
    <>
      <path d={xs.map((x, i) => `M${x} ${h - 1 - hs[i]!}h6v${hs[i]!}h-6Z`).join('')} fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path
        d={`M7 ${h - hs[0]! + 4}Q${(xs[0]! + xs[1]!) / 2 + 3} ${h - hs[0]! + 12} ${xs[1]! + 3} ${h - hs[1]! + 4}Q${(xs[1]! + xs[2]!) / 2 + 3} ${h - hs[1]! + 12} ${xs[2]! + 3} ${h - hs[2]! + 4}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

/** 碼頭棧橋（框內座標，往左是海）：T 形端頭、木板甲板、樁、兩盞燈與綁在北側的划船 */
function Pier({ w, h, gid }: { w: number; h: number; gid: string }) {
  const g = pierGeom(w, h);
  const top = g.deckY - g.lip;
  const bottom = g.deckY + g.t + g.lip;
  const lines: string[] = [];
  for (let x = g.head + 10; x < w - 4; x += 10) lines.push(`M${x} ${g.deckY + 2}v${g.t - 4}`);
  for (let y = top + 8; y < bottom - 4; y += 8) lines.push(`M3 ${y}h${g.head - 6}`);
  // 綁船的繩子：船頭到端頭的角
  lines.push(`M${g.boatX + 4} ${g.boatY + g.boatH / 2}Q${g.head + 2} ${g.boatY + g.boatH} ${g.head - 3} ${top + 3}`);
  const stub = Math.round(6 * g.s);
  const posts: string[] = [];
  for (let x = g.head + 18; x < w - 10; x += 34) posts.push(`M${x} ${g.deckY + g.t + 1}v${stub}`);
  posts.push(`M6 ${bottom + 1}v${stub}M${g.head - 6} ${bottom + 1}v${stub}`);
  const lamps = [{ x: g.head / 2, y: g.deckY + g.t / 2, h: g.lampH }, ...(w >= 140 ? [{ x: w - 10, y: g.deckY + g.t / 2, h: Math.round(g.lampH * 0.8) }] : [])];
  return (
    <>
      <path d={posts.join('')} stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      <path
        d={`M1 ${top}H${g.head}V${g.deckY}H${w - 1}V${g.deckY + g.t}H${g.head}V${bottom}H1Z`}
        fill={WOOD}
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={lines.join('')} fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <g transform={`translate(${g.boatX} ${g.boatY})`}>
        <Rowboat w={g.boatW} h={g.boatH} />
      </g>
      <Lamps at={lamps} gid={gid} />
    </>
  );
}

/** 木棧道加划船（框 92 × 52，往左是岸）：40 × 12 的甲板（scene-wood）與木板線、兩根樁，端頭一盞燈（夜裡有光暈）與繫船柱，48 × 26 的划船（scene-roof）綁在端頭外側 */
function Jetty({ gid }: { gid: string }) {
  return (
    <>
      <path d="M8 36v5M30 36v5" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M2 23h40v12H2Z" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 24v10M22 24v10M32 24v10" stroke={LINE} strokeWidth="1.1" opacity="0.6" />
      <path d="M41 25Q48 32 52 36" fill="none" stroke={LINE} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M44 50q12 3 24 0t22 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(42 24)">
        <Rowboat w={48} h={26} />
      </g>
      <Lamps at={[{ x: 37, y: 26, h: 20 }]} gid={gid} />
    </>
  );
}

/** 深色主題的攤開地圖：被旁邊的燈照亮的羊皮紙（木色混 45% 的燈光色）。只用木色時和夜裡的沙地一樣暗，摺線也看不見，像一塊深色污漬（第 2 輪看圖驗收） */
const NIGHT_PARCHMENT = `color-mix(in oklab, ${WOOD} 55%, ${GLOW})`;

/** 攤開的地圖（手機的次要道具，72 × 52；放不下海灣時改當主角道具）：三折的紙（深色主題是燈下的羊皮紙色）、摺線與格線（只用 scene-line，不畫虛線、不畫 X），一顆壓角的小石頭 */
function FoldedMap() {
  return (
    <>
      <g transform="rotate(-6 36 26)">
        <path d="M8 12 29 8l17 4 18-4v33l-18 4-17-4-21 4Z" {...dayNight(PAPER, NIGHT_PARCHMENT)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M29 8v33M46 12v33M8 24.5l21-4 17 4 18-4M8 34.5l21-4 17 4 18-4" fill="none" stroke={LINE} strokeWidth="1" opacity="0.7" />
      </g>
      <path d="M57 47q2-7 8-6q5 1 4 6Z" fill={ROCK_DEEP} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 幾顆石頭（w × h，大小不一） */
function Rocks({ w, h }: { w: number; h: number }) {
  const b = h - 1;
  return (
    <path
      d={`M2 ${b}q0-${h * 0.62} ${w * 0.3}-${h * 0.62}q${w * 0.28} 0 ${w * 0.3} ${h * 0.62}ZM${w * 0.5} ${b}q${w * 0.04}-${h * 0.42} ${w * 0.2}-${h * 0.42}q${w * 0.16} 0 ${w * 0.18} ${h * 0.42}ZM${w * 0.8} ${b}q0-${h * 0.26} ${w * 0.08}-${h * 0.26}q${w * 0.09} 0 ${w * 0.1} ${h * 0.26}Z`}
      fill={ROCK_DEEP}
      stroke={LINE}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

/** 沙丘 w × h：背光面一塊淡影、一道稜線、一叢草 */
function Dune({ w, h }: { w: number; h: number }) {
  return (
    <>
      <path
        d={`M2 ${h - 1}C${w * 0.2} ${h * 0.2} ${w * 0.42} ${h * 0.08} ${w * 0.56} ${h * 0.42}C${w * 0.68} ${h * 0.7} ${w * 0.86} ${h * 0.6} ${w - 2} ${h - 1}Z`}
        {...shadeFill}
        opacity="0.16"
      />
      <path
        d={`M${w * 0.1} ${h - 4}C${w * 0.24} ${h * 0.3} ${w * 0.42} ${h * 0.12} ${w * 0.56} ${h * 0.42}`}
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g transform={`translate(${w * 0.3} ${h * 0.12})`}>
        <Grass w={22} h={14} />
      </g>
    </>
  );
}

/** 沙灘一角：一排木樁加一叢草 */
function Beach() {
  return (
    <>
      <Stakes w={44} h={30} />
      <g transform="translate(44 12)">
        <Grass w={28} h={18} />
      </g>
    </>
  );
}

/** 小店 64 × 62（另一翼，往左是外側）：牆、山形屋頂、窗（scene-glow，夜裡一圈 r 18 的光暈）、木門與門上的小雨棚 */
function Kiosk({ gid }: { gid: string }) {
  return (
    <>
      <path d="M7 61V27h50v34Z" {...dayNight(PAPER, ROCK_DEEP)} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 29 32 6l30 23Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <Glow x={21} y={43} r={18} gid={gid} />
      <path d="M13 36h17v14H13Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M38 61V40h13v21Z" fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M21.5 36v14M13 43h17" stroke={LINE} strokeWidth="1.2" />
      <path d="M35 40l3-5h13l3 5Z" fill={ROOF} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

/** 攤位 54 × 46：兩根柱子、紅白相間的遮雨棚、木頭櫃台與上面兩籃貨 */
function Stall() {
  return (
    <>
      <path d="M6 45V14M48 45V14" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2 16 6 5h42l4 11Z" fill={ROOF} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 5l-2 11h8l1-11ZM32 5l1 11h8l-2-11Z" {...dayNight(PAPER, ROCK_DEEP)} />
      <path d="M2 16h50" stroke={LINE} strokeWidth="1.5" />
      <path d="M5 45V30h44v15Z" fill={WOOD} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 30q0-7 8-7t8 7ZM28 30q0-7 8-7t8 7Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 37h44" stroke={LINE} strokeWidth="1.2" opacity="0.5" />
    </>
  );
}

/** 店門口的貨 36 × 28：兩個木箱（一高一低）與一籃水果 */
function Goods() {
  return (
    <>
      <path d="M1 27V11h15v16ZM15 27V16h12v11ZM1 19h15" fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M26 27l-1-7h11l-1 7Z" fill={WOOD} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M26 20q0-5 5-5t5 5Z" fill={GLOW} stroke={LINE} strokeWidth="1.1" strokeLinejoin="round" />
    </>
  );
}

/**
 * 夜裡的草地：葉色混一點沙色，比沙地亮一點點、帶綠（只用 scene-meadow 時在莓果、紅酒的暗紅褐地上像一個深綠色的洞）。
 * 第 5 輪：深色葉色改成綠混 30% 青之後，紅酒裡 30% 的葉色是一塊偏灰的亮斑（1440 寬時房子後面像一塊污漬），葉色降到 20%
 */
const LAWN_NIGHT = `color-mix(in oklab, ${LEAF} 20%, ${SAND})`;

/** 路燈 14 × 46：燈柱與燈罩（scene-glow），夜裡一圈 r 18 的光暈 */
function ShopLamp({ gid }: { gid: string }) {
  return (
    <>
      <Glow x={7} y={8} r={18} gid={gid} />
      <path d="M3 3h8v10H3ZM6 13h2v30h2.5v2h-7v-2H6Z" fill={GLOW} stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  );
}

function Art({ p, gid }: { p: Placed; gid: string }) {
  const w = p.x1 - p.x0;
  const h = p.y1 - p.y0;
  switch (p.form) {
    case 'pier':
      return <Pier w={w} h={h} gid={gid} />;
    case 'jetty':
      return <Jetty gid={gid} />;
    case 'lamp':
      return <Lamps at={[{ x: w / 2, y: h - 1, h: h - 12 }]} gid={gid} />;
    case 'map':
      return <FoldedMap />;
    case 'sailboat':
      return <Sailboat />;
    case 'buoy':
      return <Buoy />;
    case 'gulls':
      return <Gulls />;
    case 'beach':
      return <Beach />;
    case 'stakes':
      return <Stakes w={w} h={h} />;
    case 'grass':
      return <Grass w={w} h={h} />;
    case 'rocks':
      return <Rocks w={w} h={h} />;
    case 'dune':
      return <Dune w={w} h={h} />;
    case 'kiosk':
    case 'stall':
    case 'goods':
    case 'shop-lamp': {
      const base = { kiosk: 64, stall: 54, goods: 36, 'shop-lamp': 14 }[p.form];
      const k = Math.round((w / base) * 100) / 100;
      const art = p.form === 'kiosk' ? <Kiosk gid={gid} /> : p.form === 'stall' ? <Stall /> : p.form === 'goods' ? <Goods /> : <ShopLamp gid={gid} />;
      return k === 1 ? art : <g transform={`scale(${k})`}>{art}</g>;
    }
    case 'ripple':
      return <path d="M1 8q7-7 14 0t14 0" fill="none" stroke={FOAM} strokeWidth="2" strokeLinecap="round" />;
    default:
      return null;
  }
}

export default function Dock({ geo }: SceneProps) {
  const ids = useSceneIds();
  const plan = planDock(geo);
  const wingRects = (['left', 'right'] as const).flatMap((s) => {
    const w = geo.wings[s];
    return w ? [{ ...w, y0: SEAM }] : [];
  });
  return (
    <>
      <SceneDefs ids={ids} />
      <TerrainRect id="sand" r={{ x0: 0, y0: SEAM, x1: geo.bandW, y1: geo.h }} />
      {/* 接縫整條鋪沙，兩翼的海蓋在上面：交界的陸地範圍就是 seamCoast（第 2 章章節牌沙灘的底端），海岸線上下接成一條 */}
      {plan.seamSand && <rect x={-2} y={-2} width={geo.bandW + 4} height={SEAM + 10} fill={SAND} />}
      {wingRects.map((r) => (
        <TerrainRect key={r.x0} id="wing" r={r} />
      ))}
      {plan.waters.map((w) => (
        <Terrain key={w.side} id="sea" d={w.d} fill={SEA}>
          <WaterTexture ids={ids} geo={geo} d={w.texture} k={w.side} />
          {w.swash && <path d={w.swash} fill="none" stroke={FOAM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />}
          {w.shore && <path d={w.shore} fill="none" stroke={FOAM} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        </Terrain>
      ))}
      {/* 另一翼小店底下的草地（不描邊）與店門口的小路（scene-rock，兩條淡淡的路緣線） */}
      {plan.lawn && <path data-terrain-block="lawn" d={plan.lawn} {...dayNight(MEADOW, LAWN_NIGHT)} />}
      {plan.lane && (
        <>
          <path data-terrain-block="lane" d={plan.lane.d} fill={ROCK} />
          <path d={plan.lane.edges} fill="none" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        </>
      )}
      {[...plan.props].sort(byDepth).map((p) => (
        <Prop key={p.id} p={p}>
          <Art p={p} gid={ids.glow} />
        </Prop>
      ))}
    </>
  );
}
