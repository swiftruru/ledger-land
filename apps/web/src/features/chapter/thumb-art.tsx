// 章節主卡頂端的場景縮圖（站規 2.3）：闖關地圖規格 6.4 的各章題材，畫成 720 × 160 的橫幅，主角道具放在中間 360 寬（手機只看得到中間這一段）。
// 純裝飾、沒有文字與數字，不用強調色、不用虛線或點線、不畫大圓色塊（會被看成關卡節點，地圖規格 6.5）。
// 顏色全部是 class（chapter.css 的 .cht-*），用地圖的 --ll-scene-* tokens（深色時只有浪花、線條、石頭與路面做中性的調整）。
// 地景（海、岸線、格線、山稜、小島）可以被外框裁切；小物件（帆船、樹、木箱、短浪、浮標…）標 data-obj，
// 畫好後量一次（外框尺寸改變時再量），看不完整的物件整個不畫（model.ts 的 thumbObjectFits），邊緣不會出現半艘船或一小段弧線。
// 這個模組由 ChapterThumb 在第一次繪製之後才 import()，自成一個 chunk，不排在 LCP 前面。
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { thumbObjectFits, type ThumbKind } from './model.ts';

/** 幾道短浪（不是虛線：每一道是獨立的一小段弧；每一道各自判斷看不看得完整） */
function Ripples({ at, cls = 'cht-foam-ln' }: { at: readonly (readonly [number, number])[]; cls?: string }) {
  return (
    <g className={cls}>
      {at.map(([x, y]) => (
        <path key={`${x}-${y}`} data-obj d={`M${x} ${y} q6 -5 12 0 t12 0`} />
      ))}
    </g>
  );
}

/** 一棵樹：樹幹加三團樹冠 */
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g data-obj transform={`translate(${x} ${y}) scale(${s})`}>
      <rect className="cht-wood" x={-3} y={-14} width={6} height={14} rx={2} />
      <path className="cht-leaf cht-edge" d="M-14 -16 c-4 -10 6 -18 14 -16 c6 -8 18 -2 16 8 c6 6 0 16 -8 14 h-16 c-8 2 -12 -2 -6 -6z" />
    </g>
  );
}

/** 一間小屋（正面）：牆、屋頂、門 */
function House({ x, y, s = 1, roof = 'cht-roof' }: { x: number; y: number; s?: number; roof?: string }) {
  return (
    <g data-obj transform={`translate(${x} ${y}) scale(${s})`}>
      <rect className="cht-road cht-edge" x={-14} y={-20} width={28} height={20} rx={2} />
      <path className={`${roof} cht-edge`} d="M-18 -19 L0 -34 L18 -19 Z" />
      <rect className="cht-wood" x={-4} y={-11} width={8} height={11} rx={1.5} />
      <rect className="cht-glow" x={6} y={-15} width={5} height={5} rx={1} />
    </g>
  );
}

/** 帆船（正面）：船身與帆 */
function Sailboat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g data-obj transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="cht-wood cht-edge" d="M-20 0 h40 l-7 9 h-26 z" />
      <path className="cht-ln" d="M0 0 V-30" />
      <path className="cht-foam cht-edge" d="M2 -28 L18 -4 H2 Z" />
      <path className="cht-roof cht-edge" d="M-2 -22 L-14 -4 H-2 Z" />
    </g>
  );
}

/** 木箱 */
function Crate({ x, y, w = 22, h = 18 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g data-obj>
      <rect className="cht-wood cht-edge" x={x} y={y - h} width={w} height={h} rx={2} />
      <path className="cht-ln-thin" d={`M${x + 3} ${y - h + 3} L${x + w - 3} ${y - 3} M${x + w - 3} ${y - h + 3} L${x + 3} ${y - 3}`} />
    </g>
  );
}

/** 天平（正面）：底座、柱、橫桿、兩個秤盤 */
function Balance({ x, y, s = 1, left = 'cht-glow', right = 'cht-roof' }: { x: number; y: number; s?: number; left?: string; right?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="cht-rock-deep cht-edge" d="M-26 0 h52 l-8 -10 h-36 z" />
      <rect className="cht-wood cht-edge" x={-4} y={-92} width={8} height={82} rx={2} />
      <path className="cht-wood-ln" d="M-56 -84 H56" />
      <path className="cht-glow cht-edge" d="M-7 -96 l7 -8 l7 8 l-7 8z" />
      <path className="cht-ln-thin" d="M-56 -84 L-70 -44 M-56 -84 L-42 -44 M56 -84 L42 -44 M56 -84 L70 -44" />
      <path className={`${left} cht-edge`} d="M-76 -44 h40 c-3 12 -34 12 -40 0z" />
      <path className={`${right} cht-edge`} d="M36 -44 h40 c-6 12 -37 12 -40 0z" />
    </g>
  );
}

/** 一疊金幣（側面看的扁圓柱，一層一層往上疊） */
function CoinStack({ x, y, n }: { x: number; y: number; n: number }) {
  const layers: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const cy = y - i * 6;
    layers.push(<path key={i} className="cht-glow cht-edge" d={`M${x - 14} ${cy} v-5 a14 4 0 0 1 28 0 v5 a14 4 0 0 1 -28 0z`} />);
  }
  return <g data-obj>{layers}</g>;
}

/** 小島：沙岸加草地 */
function Isle({ d, inner }: { d: string; inner: string }) {
  return (
    <g>
      <path className="cht-shore cht-edge" d={d} />
      <path className="cht-grass" d={inner} />
    </g>
  );
}

/** 旗子：旗桿與一面無字的旗 */
function Flag({ x, y, h = 40, cls = 'cht-roof' }: { x: number; y: number; h?: number; cls?: string }) {
  return (
    <g data-obj>
      <path className="cht-ln" d={`M${x} ${y} V${y - h}`} />
      <path className={`${cls} cht-edge`} d={`M${x + 1} ${y - h} c8 -3 14 3 22 0 v12 c-8 3 -14 -3 -22 0z`} />
    </g>
  );
}

/** 齒輪：n 個齒，外徑 r，中心有孔 */
function Gear({ x, y, r, n, cls }: { x: number; y: number; r: number; n: number; cls: string }) {
  const pts: string[] = [];
  const inner = r - 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const step = (Math.PI * 2) / n;
    const p = (ang: number, rr: number) => `${(x + rr * Math.cos(ang)).toFixed(1)} ${(y + rr * Math.sin(ang)).toFixed(1)}`;
    pts.push(p(a, inner), p(a + step * 0.12, r), p(a + step * 0.42, r), p(a + step * 0.54, inner));
  }
  return (
    <g data-obj>
      <path className={`${cls} cht-edge`} d={`M${pts.join('L')}Z`} />
      <circle className="cht-plaza cht-edge" cx={x} cy={y} r={Math.max(3, r * 0.22)} />
    </g>
  );
}

function Dock() {
  return (
    <>
      <path className="cht-sea" d="M0 0 H720 V60 C650 72 600 54 530 64 C470 72 440 84 390 82 C330 80 300 66 240 72 C180 78 120 62 60 68 C30 71 12 66 0 64 Z" />
      <path
        className="cht-foam-ln cht-thick"
        d="M0 64 C12 66 30 71 60 68 C120 62 180 78 240 72 C300 66 330 80 390 82 C440 84 470 72 530 64 C600 54 650 72 720 60"
      />
      <Ripples
        at={[
          [92, 30],
          [190, 16],
          [250, 46],
          [470, 26],
          [560, 40],
          [640, 18],
        ]}
      />
      {/* 從沙灘走上棧橋的一小段路（和地圖的路同樣是實線，不畫圓點） */}
      <path className="cht-roadway-edge" d="M392 166 C392 138 358 126 358 96" />
      <path className="cht-roadway" d="M392 166 C392 138 358 126 358 96" />
      {/* 碼頭棧橋與木樁 */}
      <rect className="cht-wood cht-edge" x={338} y={12} width={40} height={86} rx={3} />
      <path className="cht-ln-thin" d="M338 22 h40 M338 31 h40 M338 40 h40 M338 49 h40 M338 58 h40 M338 67 h40 M338 76 h40 M338 85 h40" />
      <rect className="cht-rock-deep" x={331} y={20} width={7} height={9} rx={2} />
      <rect className="cht-rock-deep" x={331} y={48} width={7} height={9} rx={2} />
      <rect className="cht-rock-deep" x={378} y={20} width={7} height={9} rx={2} />
      <rect className="cht-rock-deep" x={378} y={48} width={7} height={9} rx={2} />
      {/* 繫在棧橋邊的小划船（俯視） */}
      <g data-obj>
        <path className="cht-ln-thin" d="M385 26 C392 24 396 30 400 34" />
        <path className="cht-wood cht-edge" d="M396 36 C408 22 446 22 458 36 C446 50 408 50 396 36Z" />
        <path className="cht-sand" d="M404 36 C414 28 440 28 450 36 C440 44 414 44 404 36Z" />
        <path className="cht-ln-thin" d="M418 30 v12 M436 30 v12" />
      </g>
      {/* 浮標 */}
      <circle data-obj className="cht-roof cht-edge" cx={262} cy={34} r={6} />
      <circle data-obj className="cht-roof cht-edge" cx={548} cy={22} r={5} />
      {/* 沙灘：攤開的地圖（只有格線）、木箱、石頭、草叢 */}
      <g data-obj transform="rotate(-6 492 120)">
        <rect className="cht-road cht-edge" x={462} y={100} width={60} height={40} rx={3} />
        <path className="cht-ln-thin" d="M482 100 v40 M502 100 v40 M462 120 h60" />
      </g>
      <Crate x={296} y={124} />
      <Crate x={274} y={128} w={18} h={14} />
      <path data-obj className="cht-rock-deep" d="M200 128 c4 -10 20 -10 24 0 z" />
      <path data-obj className="cht-rock-deep" d="M560 140 c3 -8 15 -8 18 0 z" />
      <path data-obj className="cht-leaf-ln" d="M150 142 l-4 -12 M156 142 v-14 M162 142 l4 -11" />
      <path data-obj className="cht-leaf-ln" d="M610 120 l-4 -12 M616 120 v-14 M622 120 l4 -11" />
      <Sailboat x={70} y={40} s={0.9} />
      <Sailboat x={668} y={36} s={0.75} />
      {/* 兩隻海鳥 */}
      <path data-obj className="cht-ln" d="M120 24 q5 -5 10 0 q5 -5 10 0" />
      <path data-obj className="cht-ln" d="M590 12 q4 -4 8 0 q4 -4 8 0" />
    </>
  );
}

function Islands() {
  return (
    <>
      <Ripples
        at={[
          [40, 40],
          [130, 120],
          [180, 30],
          [300, 140],
          [430, 26],
          [560, 40],
          [600, 136],
          [680, 90],
        ]}
      />
      <Isle
        d="M176 112 C176 92 216 84 244 88 C272 92 290 100 288 114 C286 128 248 134 222 132 C196 130 176 126 176 112Z"
        inner="M194 110 C196 98 220 94 240 96 C258 98 270 104 268 112 C264 122 238 124 220 122 C204 120 192 118 194 110Z"
      />
      <Isle
        d="M306 82 C306 62 344 52 372 56 C402 60 420 68 418 84 C416 100 378 106 350 104 C322 102 306 98 306 82Z"
        inner="M324 80 C326 68 348 62 368 64 C388 66 402 72 400 82 C396 92 370 94 352 92 C336 90 322 88 324 80Z"
      />
      <Isle
        d="M440 116 C440 96 478 88 506 92 C536 96 552 104 550 118 C548 132 512 138 484 136 C458 134 440 130 440 116Z"
        inner="M458 114 C460 102 482 98 502 100 C520 102 532 108 530 116 C526 126 500 128 482 126 C466 124 456 122 458 114Z"
      />
      <Flag x={232} y={106} h={42} cls="cht-roof" />
      <Flag x={360} y={80} h={46} cls="cht-leaf" />
      <Flag x={496} y={110} h={42} cls="cht-glow" />
      <Tree x={258} y={116} s={0.7} />
      <Tree x={384} y={88} s={0.75} />
      <Tree x={520} y={120} s={0.7} />
      <path data-obj className="cht-rock" d="M44 96 c10 -14 50 -14 60 0 z" />
      <path data-obj className="cht-rock" d="M626 70 c8 -12 40 -12 48 0 z" />
      <path data-obj className="cht-rock-deep" d="M118 70 c3 -7 13 -7 16 0z" />
      <path data-obj className="cht-rock-deep" d="M590 120 c3 -7 13 -7 16 0z" />
      <Sailboat x={130} y={80} s={0.8} />
    </>
  );
}

function Market() {
  const dots = [
    [30, 30],
    [80, 120],
    [140, 60],
    [190, 140],
    [250, 24],
    [300, 150],
    [430, 18],
    [470, 148],
    [540, 70],
    [590, 140],
    [640, 30],
    [690, 110],
    [110, 150],
    [600, 100],
  ];
  return (
    <>
      <g className="cht-dot">
        {dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2} />
        ))}
      </g>
      {/* 彩旗串 */}
      <path className="cht-ln-thin" d="M150 22 Q360 54 570 22" />
      {[190, 230, 270, 310, 350, 390, 430, 470, 510].map((x, i) => {
        const y = 22 + 32 * (1 - ((x - 360) / 210) ** 2) * 0.95;
        const cls = ['cht-roof', 'cht-leaf', 'cht-glow'][i % 3];
        return <path key={x} data-obj className={`${cls} cht-edge`} d={`M${x - 7} ${y.toFixed(1)} h14 l-7 12z`} />;
      })}
      {/* 五層階梯：每一階一個色帶（不寫字） */}
      <rect className="cht-wood cht-edge" x={290} y={128} width={140} height={16} rx={3} />
      <rect className="cht-roof cht-edge" x={302} y={112} width={116} height={16} rx={3} />
      <rect className="cht-leaf cht-edge" x={314} y={96} width={92} height={16} rx={3} />
      <rect className="cht-glow cht-edge" x={326} y={80} width={68} height={16} rx={3} />
      <rect className="cht-sand cht-edge" x={338} y={64} width={44} height={16} rx={3} />
      {/* 兩個攤位 */}
      {[214, 506].map((x) => (
        <g key={x} data-obj>
          <path className="cht-ln" d={`M${x - 26} 136 V96 M${x + 26} 136 V96`} />
          <rect className="cht-wood cht-edge" x={x - 30} y={116} width={60} height={22} rx={3} />
          <path className="cht-roof cht-edge" d={`M${x - 34} 84 h68 v12 c-6 6 -11 6 -17 0 c-6 6 -11 6 -17 0 c-6 6 -11 6 -17 0 c-6 6 -11 6 -17 0z`} />
          <path className="cht-road" d={`M${x - 17} 84 h17 v12 c-6 6 -11 6 -17 0z M${x + 17} 84 h17 v12 c-6 6 -11 6 -17 0z`} />
        </g>
      ))}
      {/* 空白價目牌 */}
      {[268, 454].map((x) => (
        <g key={x} data-obj>
          <path className="cht-ln" d={`M${x} 142 v-20`} />
          <rect className="cht-road cht-edge" x={x - 10} y={108} width={20} height={14} rx={2} />
        </g>
      ))}
      <Tree x={70} y={110} s={0.9} />
      <Tree x={660} y={140} s={0.85} />
    </>
  );
}

function ScaleSquare() {
  const grid: string[] = [];
  for (let x = 40; x < 720; x += 40) grid.push(`M${x} 0 V160`);
  for (let y = 40; y < 160; y += 40) grid.push(`M0 ${y} H720`);
  return (
    <>
      <path className="cht-grid" d={grid.join(' ')} />
      <Balance x={360} y={144} />
      <Crate x={226} y={140} w={26} h={22} />
      <Crate x={252} y={140} w={20} h={16} />
      <Crate x={470} y={140} w={24} h={20} />
      {/* 噴水池與長椅（只在寬的時候看得到） */}
      <g data-obj>
        <path className="cht-rock-deep cht-edge" d="M60 132 h80 l-8 14 h-64z" />
        <path className="cht-foam-ln" d="M100 130 c-6 -16 -16 -18 -22 -12 M100 130 c6 -16 16 -18 22 -12 M100 130 V108" />
      </g>
      <g data-obj>
        <rect className="cht-wood cht-edge" x={590} y={118} width={70} height={8} rx={2} />
        <path className="cht-ln" d="M598 126 v14 M652 126 v14" />
      </g>
      <Tree x={170} y={70} s={0.8} />
      <Tree x={548} y={66} s={0.8} />
    </>
  );
}

function River() {
  return (
    <>
      <path className="cht-sea" d="M0 66 C120 46 220 94 360 76 C500 58 600 96 720 78 V114 C600 132 500 94 360 112 C220 130 120 82 0 102Z" />
      <path className="cht-foam-ln cht-thick" d="M0 66 C120 46 220 94 360 76 C500 58 600 96 720 78" />
      <Ripples
        at={[
          [60, 80],
          [170, 92],
          [300, 98],
          [480, 82],
          [620, 104],
        ]}
      />
      {/* 木橋 */}
      <g data-obj>
        <rect className="cht-wood cht-edge" x={236} y={54} width={30} height={84} rx={3} />
        <path className="cht-ln-thin" d="M236 64 h30 M236 74 h30 M236 84 h30 M236 94 h30 M236 104 h30 M236 114 h30 M236 124 h30" />
        <path className="cht-ln" d="M232 60 V134 M270 60 V134" />
      </g>
      {/* 水閘：兩根柱子、閘板與絞盤 */}
      <rect className="cht-wood cht-edge" x={392} y={52} width={10} height={76} rx={2} />
      <rect className="cht-wood cht-edge" x={446} y={50} width={10} height={76} rx={2} />
      <rect className="cht-rock-deep cht-edge" x={402} y={74} width={44} height={36} rx={2} />
      <path className="cht-ln-thin" d="M402 86 h44 M402 98 h44" />
      <rect className="cht-wood cht-edge" x={388} y={44} width={72} height={8} rx={2} />
      <circle className="cht-road cht-edge" cx={424} cy={36} r={8} />
      <path className="cht-ln-thin" d="M424 28 v16 M416 36 h16" />
      {/* 蘆葦與石頭 */}
      {[150, 540].map((x, i) => {
        const y = i ? 128 : 66;
        return (
          <g key={x} data-obj>
            <path className="cht-leaf-ln" d={`M${x} ${y} l-3 -16 M${x + 6} ${y} v-18 M${x + 12} ${y} l3 -15`} />
            <path className="cht-wood" d={`M${x + 4} ${y - 20} a2.5 6 0 1 0 5 0 a2.5 6 0 1 0 -5 0z`} />
          </g>
        );
      })}
      <path data-obj className="cht-rock-deep" d="M300 150 c3 -8 15 -8 18 0z" />
      <path data-obj className="cht-rock-deep" d="M500 40 c3 -7 13 -7 16 0z" />
      <Tree x={80} y={146} s={0.9} />
      <Tree x={640} y={50} s={0.9} />
    </>
  );
}

function Lighthouse() {
  return (
    <>
      <path className="cht-sea" d="M0 0 H720 V44 C640 58 580 40 500 52 C440 60 400 50 360 54 C300 60 260 44 200 52 C130 60 60 44 0 50Z" />
      <path className="cht-foam-ln cht-thick" d="M0 50 C60 44 130 60 200 52 C260 44 300 60 360 54 C400 50 440 60 500 52 C580 40 640 58 720 44" />
      <Ripples
        at={[
          [80, 20],
          [190, 30],
          [520, 22],
          [640, 30],
        ]}
      />
      {/* 光束（靜止，半透明） */}
      <path className="cht-glow cht-beam" d="M374 34 L560 8 L560 62 Z" />
      {/* 燈塔：塔身、紅色條紋、走道、燈室、屋頂 */}
      <path className="cht-road cht-edge" d="M338 148 L348 46 H372 L382 148 Z" />
      <path className="cht-roof" d="M344.5 82 L347 60 H373 L375.5 82 Z M341 116 L343.5 96 H376.5 L379 116 Z" />
      <path className="cht-edge-only" d="M338 148 L348 46 H372 L382 148 Z" />
      <rect className="cht-wood cht-edge" x={342} y={40} width={36} height={7} rx={2} />
      <rect className="cht-glow cht-edge" x={349} y={24} width={22} height={16} rx={2} />
      <path className="cht-roof cht-edge" d="M345 25 L360 10 L375 25 Z" />
      <rect className="cht-wood" x={354} y={128} width={12} height={20} rx={2} />
      {/* 礁石 */}
      {['M250 70 c6 -16 34 -16 40 0 z', 'M432 76 c5 -12 27 -12 32 0z', 'M120 64 c4 -10 22 -10 26 0z', 'M600 66 c4 -10 22 -10 26 0z'].map((d) => (
        <path key={d} data-obj className="cht-rock-deep cht-edge" d={d} />
      ))}
      {/* 沿路的四盞燈 */}
      {[230, 286, 438, 494].map((x) => (
        <g key={x} data-obj>
          <path className="cht-ln" d={`M${x} 146 V116`} />
          <rect className="cht-glow cht-edge" x={x - 5} y={106} width={10} height={10} rx={2} />
        </g>
      ))}
      <Sailboat x={60} y={30} s={0.8} />
    </>
  );
}

function Gears() {
  return (
    <>
      <path
        className="cht-grid"
        d="M0 30 H720 M0 62 H720 M0 94 H720 M0 126 H720 M120 0 V30 M300 30 V62 M80 62 V94 M520 0 V30 M640 62 V94 M260 94 V126 M600 126 V160 M180 126 V160"
      />
      {/* 三個咬合的齒輪 */}
      <Gear x={340} y={92} r={38} n={12} cls="cht-wood" />
      <Gear x={404} y={58} r={26} n={9} cls="cht-glow" />
      <Gear x={410} y={122} r={22} n={8} cls="cht-rock-deep" />
      {/* 工作台與工具 */}
      <g data-obj>
        <rect className="cht-wood cht-edge" x={188} y={104} width={84} height={10} rx={2} />
        <path className="cht-ln" d="M196 114 v28 M264 114 v28" />
        <rect className="cht-roof cht-edge" x={204} y={92} width={22} height={12} rx={2} />
        <path className="cht-ln" d="M240 104 l14 -18" />
        <rect className="cht-rock-deep" x={250} y={80} width={12} height={8} rx={2} transform="rotate(-50 256 84)" />
      </g>
      <Crate x={488} y={146} w={30} h={24} />
      <Crate x={518} y={146} w={22} h={18} />
      <Crate x={496} y={122} w={20} h={16} />
      {/* 煙囪（寬的時候才看得到） */}
      <g data-obj>
        <rect className="cht-rock-deep cht-edge" x={630} y={60} width={22} height={86} rx={2} />
        <path className="cht-ln" d="M640 52 c-8 -8 6 -14 -2 -24 M650 48 c-6 -8 6 -12 0 -20" />
      </g>
      <Crate x={80} y={146} w={28} h={22} />
    </>
  );
}

function Farm() {
  return (
    <>
      <path className="cht-meadow-deep" d="M0 20 L720 0 V12 L0 34Z M0 54 L720 34 V46 L0 68Z M0 88 L720 68 V80 L0 102Z" />
      {/* 水渠 */}
      <path className="cht-sea" d="M0 126 H720 V142 H0Z" />
      {[40, 180, 520, 640].map((x) => (
        <path key={x} data-obj className="cht-foam-ln" d={`M${x} 134 q6 -4 12 0`} />
      ))}
      {/* 水車：支架、輪框、輪輻、葉片 */}
      <path className="cht-wood-ln" d="M352 140 L380 92 L408 140" />
      <circle className="cht-wheel" cx={380} cy={92} r={40} />
      <path className="cht-ln" d="M380 52 V132 M340 92 H420 M352 64 L408 120 M408 64 L352 120" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} className="cht-wood cht-edge" x={374} y={46} width={12} height={10} rx={2} transform={`rotate(${a} 380 92)`} />
      ))}
      <circle className="cht-wood cht-edge" cx={380} cy={92} r={7} />
      {/* 種子袋與小苗 */}
      <path data-obj className="cht-road cht-edge" d="M246 140 c-8 0 -10 -24 -4 -30 l-4 -6 h20 l-4 6 c6 6 4 30 -4 30z" />
      <path data-obj className="cht-road cht-edge" d="M276 140 c-7 0 -9 -20 -3 -25 l-3 -5 h16 l-3 5 c6 5 4 25 -3 25z" />
      {(
        [
          [470, 116],
          [510, 112],
          [550, 116],
        ] as const
      ).map(([x, y]) => (
        <path key={x} data-obj className="cht-leaf-ln" d={`M${x} ${y} v-10 q-6 -4 -8 -10 M${x} ${y - 10} q6 -4 8 -10`} />
      ))}
      {/* 圍籬 */}
      <path data-obj className="cht-ln" d="M150 118 v-22 M176 118 v-22 M202 118 v-22 M144 102 h64 M144 112 h64" />
      <Tree x={90} y={112} s={0.9} />
      <Tree x={640} y={110} s={0.9} />
    </>
  );
}

function Bakery() {
  const bricks: string[] = [];
  for (let y = 112; y < 160; y += 16) bricks.push(`M0 ${y} H720`);
  for (let row = 0; row < 3; row++) for (let x = row % 2 ? 20 : 0; x < 720; x += 40) bricks.push(`M${x} ${112 + row * 16} v16`);
  return (
    <>
      <path className="cht-grid" d={bricks.join(' ')} />
      {/* 圓頂烤爐、爐口的火光、煙囪 */}
      <path className="cht-rock-deep cht-edge" d="M296 140 C296 80 324 58 360 58 C396 58 424 80 424 140 Z" />
      <path className="cht-glow cht-edge" d="M340 140 v-20 a20 20 0 0 1 40 0 v20z" />
      <path className="cht-roof" d="M350 140 c0 -10 4 -14 10 -20 c6 6 10 10 10 20z" />
      <rect className="cht-rock-deep cht-edge" x={392} y={40} width={16} height={34} rx={2} />
      <path className="cht-ln" d="M398 32 c-8 -8 6 -14 -2 -24 M406 30 c-6 -6 6 -10 0 -18" />
      {/* 輸送帶與麵包（整組一起判斷：只看到半條輸送帶就整組不畫） */}
      <g data-obj>
        <rect className="cht-rock cht-edge" x={440} y={110} width={120} height={12} rx={6} />
        <path className="cht-ln" d="M452 122 v20 M548 122 v20" />
        {[464, 500, 536].map((x) => (
          <g key={x}>
            <rect className="cht-wood cht-edge" x={x - 13} y={96} width={26} height={14} rx={7} />
            <path className="cht-ln-thin" d={`M${x - 6} 99 l4 8 M${x} 99 l4 8`} />
          </g>
        ))}
      </g>
      {/* 麵粉袋 */}
      <path data-obj className="cht-road cht-edge" d="M232 142 c-12 0 -14 -30 -6 -38 l-4 -8 h28 l-4 8 c8 8 6 38 -6 38z" />
      <path data-obj className="cht-road cht-edge" d="M264 142 c-9 0 -11 -22 -4 -28 l-3 -6 h22 l-3 6 c7 6 5 28 -4 28z" />
      <Crate x={120} y={142} w={26} h={20} />
      <Tree x={660} y={90} s={0.85} />
      <Tree x={70} y={80} s={0.8} />
    </>
  );
}

function Summit() {
  return (
    <>
      <path className="cht-grid" d="M0 150 C120 132 240 148 360 136 C480 124 600 144 720 128 M0 124 C140 108 260 126 380 114 C500 102 610 118 720 104" />
      {/* 山稜與山頂的終點旗 */}
      <path className="cht-rock-deep" d="M120 108 L250 52 L320 80 L380 34 L470 76 L540 56 L640 108 Z" />
      <path className="cht-rock cht-edge" d="M180 108 L300 62 L380 34 L470 76 L560 108 Z" />
      <path className="cht-road" d="M367 44 L380 34 L393 44 L386 47 L380 43 L373 49 Z" />
      <Flag x={381} y={35} h={20} cls="cht-glow" />
      {/* 兩個小帳篷 */}
      {[262, 496].map((x) => (
        <g key={x} data-obj>
          <path className="cht-roof cht-edge" d={`M${x - 26} 140 L${x} 106 L${x + 26} 140 Z`} />
          <path className="cht-glow" d={`M${x - 7} 140 L${x} 122 L${x + 7} 140 Z`} />
        </g>
      ))}
      <Flag x={320} y={146} h={30} cls="cht-leaf" />
      <Flag x={430} y={146} h={30} cls="cht-roof" />
      <Tree x={150} y={146} s={0.85} />
      <Tree x={600} y={142} s={0.85} />
      <Tree x={60} y={120} s={0.75} />
    </>
  );
}

/** 延伸區的外海小島：每章一座島，島上的主角道具不同 */
function IsleBase({ children }: { children: ReactNode }) {
  return (
    <>
      <Ripples
        at={[
          [40, 30],
          [120, 120],
          [180, 48],
          [520, 24],
          [600, 140],
          [660, 60],
        ]}
      />
      <Isle
        d="M206 124 C196 98 232 76 278 70 C300 56 340 50 372 58 C412 52 470 62 496 86 C522 108 506 140 462 148 C420 156 380 150 344 154 C296 158 220 152 206 124Z"
        inner="M234 120 C226 102 254 88 288 84 C310 72 344 68 372 74 C404 70 452 78 470 96 C486 112 472 132 440 136 C408 142 376 136 346 140 C306 144 244 138 234 120Z"
      />
      {children}
    </>
  );
}

function IsleValuation() {
  return (
    <IsleBase>
      <CoinStack x={330} y={124} n={5} />
      <CoinStack x={364} y={130} n={7} />
      <CoinStack x={398} y={122} n={4} />
      {/* 空白價格標籤 */}
      {(
        [
          [268, 108],
          [430, 112],
        ] as const
      ).map(([x, y]) => (
        <g key={x} data-obj>
          <path className="cht-roof cht-edge" d={`M${x} ${y} l12 -12 h18 v20 h-18z`} />
          <circle className="cht-road" cx={x + 15} cy={y - 2} r={2.5} />
        </g>
      ))}
      <g data-obj>
        <path className="cht-ln" d="M470 92 V64" />
        <rect className="cht-glow cht-edge" x={465} y={54} width={10} height={10} rx={2} />
      </g>
      <path data-obj className="cht-rock" d="M40 96 c10 -14 50 -14 60 0z" />
      <path data-obj className="cht-rock" d="M620 104 c8 -12 40 -12 48 0z" />
      <Sailboat x={130} y={72} s={0.8} />
    </IsleBase>
  );
}

function IsleFinance() {
  return (
    <IsleBase>
      {/* 小銀行：台階、柱子、山牆 */}
      <rect className="cht-rock cht-edge" x={318} y={128} width={84} height={8} rx={2} />
      <rect className="cht-road cht-edge" x={326} y={92} width={68} height={36} rx={2} />
      <path className="cht-ln" d="M338 96 v30 M352 96 v30 M368 96 v30 M382 96 v30" />
      <path className="cht-roof cht-edge" d="M318 92 L360 66 L402 92 Z" />
      <rect className="cht-glow" x={356} y={76} width={8} height={8} rx={2} />
      {/* 兩個錢袋 */}
      <path data-obj className="cht-wood cht-edge" d="M276 132 c-12 0 -14 -18 -4 -26 l-4 -6 h16 l-4 6 c10 8 8 26 -4 26z" />
      <path data-obj className="cht-wood cht-edge" d="M440 134 c-10 0 -12 -16 -3 -22 l-3 -5 h13 l-3 5 c9 6 7 22 -4 22z" />
      {/* 燈浮標 */}
      <g data-obj>
        <path className="cht-roof cht-edge" d="M600 104 h20 l-4 -24 h-12z" />
        <rect className="cht-glow cht-edge" x={604} y={70} width={12} height={10} rx={2} />
      </g>
      <path data-obj className="cht-rock" d="M60 110 c10 -14 50 -14 60 0z" />
      <Sailboat x={150} y={60} s={0.8} />
    </IsleBase>
  );
}

function IsleStakeholders() {
  return (
    <IsleBase>
      <ellipse className="cht-path-ln" cx={360} cy={112} rx={74} ry={20} />
      <House x={312} y={100} s={0.85} roof="cht-roof" />
      <House x={408} y={100} s={0.85} roof="cht-leaf" />
      <House x={276} y={128} s={0.95} roof="cht-glow" />
      <House x={360} y={140} s={1} roof="cht-roof" />
      <House x={444} y={128} s={0.95} roof="cht-wood" />
      <path data-obj className="cht-wood cht-edge" d="M572 60 C582 50 612 50 622 60 C612 70 582 70 572 60Z" />
      <path data-obj className="cht-rock" d="M60 110 c10 -14 50 -14 60 0z" />
      <Sailboat x={140} y={56} s={0.8} />
    </IsleBase>
  );
}

function IsleLedger() {
  return (
    <IsleBase>
      <Balance x={318} y={140} s={0.62} left="cht-glow" right="cht-leaf" />
      <Balance x={412} y={140} s={0.62} left="cht-roof" right="cht-glow" />
      <path data-obj className="cht-rock-deep cht-edge" d="M250 120 c4 -10 22 -10 26 0z" />
      <path data-obj className="cht-rock-deep cht-edge" d="M458 126 c4 -10 22 -10 26 0z" />
      <path data-obj className="cht-rock" d="M600 100 c10 -14 50 -14 60 0z" />
      <path data-obj className="cht-rock" d="M40 70 c8 -12 40 -12 48 0z" />
      <Sailboat x={140} y={110} s={0.8} />
    </IsleBase>
  );
}

const ART: Record<ThumbKind, () => ReactNode> = {
  dock: Dock,
  islands: Islands,
  market: Market,
  scale: ScaleSquare,
  river: River,
  lighthouse: Lighthouse,
  gears: Gears,
  farm: Farm,
  bakery: Bakery,
  summit: Summit,
  'isle-valuation': IsleValuation,
  'isle-finance': IsleFinance,
  'isle-stakeholders': IsleStakeholders,
  'isle-ledger': IsleLedger,
};

/** 看不完整的小物件標 data-cut（chapter.css 把它設成 visibility: hidden；不用 display: none，下一次量的時候還量得到） */
function hideCutObjects(svg: SVGSVGElement) {
  const box = svg.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  const frame = svg.parentElement;
  const radius = frame ? Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0 : 0;
  for (const el of svg.querySelectorAll<SVGGraphicsElement>('[data-obj]')) {
    el.toggleAttribute('data-cut', !thumbObjectFits(box, el.getBoundingClientRect(), radius));
  }
}

export default function ThumbArt({ kind }: { kind: ThumbKind }) {
  const Art = ART[kind];
  const ref = useRef<SVGGElement>(null);
  // 畫好之後（繪製之前）量一次，外框尺寸改變（轉向、視窗縮放、單欄與兩欄切換）時再量。
  // 換章時 ChapterThumb 用 key={kind} 重新掛載這個元件，新的插圖一樣會量
  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const fit = () => hideCutObjects(svg);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  return (
    <g ref={ref}>
      <Art />
    </g>
  );
}
