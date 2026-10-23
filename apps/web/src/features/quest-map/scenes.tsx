// 章節場景（17 第 4、6 節，M2 的幾何色塊版）：每章一個小 SVG，只用 tokens 上色，20 個圖形以內；沒有文字資訊，純裝飾（aria-hidden）。
// 題材用會計的比喻：碼頭、三島、市集、天平、河流、燈塔、齒輪、農田、麵包坊、山頂；延伸區是外海小島。強制色彩下整個隱藏（quest-map.css）。
// M3 每章換成原創手繪風插圖時，只換這裡的元件，章節區段的結構不動。
export type SceneKind = 'dock' | 'islands' | 'market' | 'scale' | 'river' | 'lighthouse' | 'gears' | 'farm' | 'bakery' | 'summit' | 'island';

const CORE_SCENES: readonly SceneKind[] = ['dock', 'islands', 'market', 'scale', 'river', 'lighthouse', 'gears', 'farm', 'bakery', 'summit'];

export function sceneFor(chapterNo: number, extension: boolean): SceneKind {
  if (extension) return 'island';
  return CORE_SCENES[(chapterNo - 1) % CORE_SCENES.length]!;
}

const GROUND = 'var(--ll-surface-2)';
const WATER = 'var(--ll-element-asset-tint)';
const WOOD = 'var(--ll-element-expense-tint)';
const LEAF = 'var(--ll-element-equity-tint)';
const WARM = 'var(--ll-highlight-ring)';
const INK = 'var(--ll-text-4)';
const SUN = 'var(--ll-element-revenue-tint)';

function Stars() {
  // 深色主題的夜空星點（淺色下由 CSS 隱藏）
  return (
    <g className="qm-scene__stars" fill={INK}>
      <circle cx="40" cy="60" r="1.5" />
      <circle cx="140" cy="30" r="1" />
      <circle cx="260" cy="70" r="1.5" />
      <circle cx="340" cy="40" r="1" />
      <circle cx="200" cy="110" r="1" />
    </g>
  );
}

function body(kind: SceneKind) {
  switch (kind) {
    case 'dock':
      return (
        <>
          <rect x="0" y="560" width="400" height="240" fill={WATER} />
          <rect x="0" y="700" width="400" height="100" fill={GROUND} />
          <rect x="120" y="600" width="160" height="22" fill={WOOD} />
          <rect x="140" y="622" width="12" height="60" fill={WOOD} />
          <rect x="248" y="622" width="12" height="60" fill={WOOD} />
          <path d="M60 740 l40 -16 l40 16 l40 -16 l40 16 v40 H60Z" fill={SUN} />
          <circle cx="330" cy="120" r="34" fill={SUN} />
        </>
      );
    case 'islands':
      return (
        <>
          <rect x="0" y="520" width="400" height="280" fill={WATER} />
          <ellipse cx="90" cy="640" rx="70" ry="28" fill={GROUND} />
          <ellipse cx="220" cy="580" rx="60" ry="24" fill={GROUND} />
          <ellipse cx="320" cy="690" rx="66" ry="26" fill={GROUND} />
          <path d="M90 612 v-50 l26 10 l-26 10" fill={WARM} />
          <path d="M220 556 v-50 l26 10 l-26 10" fill={LEAF} />
          <path d="M320 664 v-50 l26 10 l-26 10" fill={SUN} />
        </>
      );
    case 'market':
      return (
        <>
          <rect x="0" y="680" width="400" height="120" fill={GROUND} />
          <rect x="40" y="600" width="110" height="80" fill={WOOD} />
          <path d="M30 600 h130 l-14 -40 H44Z" fill={WARM} />
          <rect x="250" y="610" width="110" height="70" fill={WOOD} />
          <path d="M240 610 h130 l-14 -40 H254Z" fill={SUN} />
          <rect x="160" y="640" width="80" height="8" fill={INK} />
          <rect x="170" y="620" width="60" height="8" fill={INK} />
          <rect x="180" y="600" width="40" height="8" fill={INK} />
        </>
      );
    case 'scale':
      return (
        <>
          <rect x="0" y="700" width="400" height="100" fill={GROUND} />
          <rect x="194" y="520" width="12" height="180" fill={WOOD} />
          <rect x="90" y="520" width="220" height="10" rx="5" fill={WOOD} />
          <path d="M100 530 l-40 70 h80Z" fill={WATER} />
          <path d="M300 530 l-40 70 h80Z" fill={WARM} />
          <rect x="80" y="580" width="40" height="22" fill={LEAF} />
          <rect x="280" y="580" width="40" height="22" fill={SUN} />
        </>
      );
    case 'river':
      return (
        <>
          <rect x="0" y="640" width="400" height="160" fill={GROUND} />
          <path d="M40 300 q40 120 100 200 t60 240 H140 q-20 -140 -60 -220 t-60 -220Z" fill={WATER} />
          <path d="M360 320 q-40 120 -100 200 t-60 220 h60 q20 -140 60 -220 t60 -200Z" fill={WATER} />
          <rect x="150" y="600" width="100" height="16" rx="4" fill={WOOD} />
          <circle cx="330" cy="120" r="34" fill={SUN} />
        </>
      );
    case 'lighthouse':
      return (
        <>
          <rect x="0" y="600" width="400" height="200" fill={WATER} />
          <ellipse cx="200" cy="640" rx="120" ry="40" fill={GROUND} />
          <path d="M176 620 l10 -200 h28 l10 200Z" fill={WOOD} />
          <rect x="182" y="400" width="36" height="28" fill={SUN} />
          <path d="M218 404 l120 -40 v100Z" fill={SUN} opacity="0.5" />
          <circle cx="60" cy="100" r="26" fill={INK} />
        </>
      );
    case 'gears':
      return (
        <>
          <rect x="0" y="680" width="400" height="120" fill={GROUND} />
          <circle cx="120" cy="560" r="60" fill={WOOD} />
          <circle cx="120" cy="560" r="24" fill={GROUND} />
          <circle cx="230" cy="620" r="44" fill={WARM} />
          <circle cx="230" cy="620" r="16" fill={GROUND} />
          <circle cx="310" cy="540" r="36" fill={SUN} />
          <circle cx="310" cy="540" r="12" fill={GROUND} />
        </>
      );
    case 'farm':
      return (
        <>
          <rect x="0" y="600" width="400" height="200" fill={LEAF} />
          <path d="M0 640 h400 M0 690 h400 M0 740 h400" stroke={GROUND} strokeWidth="8" />
          <circle cx="320" cy="560" r="50" fill="none" stroke={WOOD} strokeWidth="10" />
          <path d="M320 510 v100 M270 560 h100" stroke={WOOD} strokeWidth="8" />
          <circle cx="80" cy="120" r="34" fill={SUN} />
        </>
      );
    case 'bakery':
      return (
        <>
          <rect x="0" y="680" width="400" height="120" fill={GROUND} />
          <rect x="60" y="540" width="140" height="140" rx="12" fill={WOOD} />
          <path d="M90 620 a40 40 0 0 1 80 0 v30 H90Z" fill={WARM} />
          <rect x="220" y="640" width="140" height="14" rx="7" fill={INK} />
          <ellipse cx="260" cy="628" rx="18" ry="10" fill={SUN} />
          <ellipse cx="310" cy="628" rx="18" ry="10" fill={SUN} />
        </>
      );
    case 'summit':
      return (
        <>
          <path d="M0 800 L140 420 L240 560 L320 460 L400 800Z" fill={GROUND} />
          <path d="M110 500 L140 420 L170 500Z" fill={WARM} />
          <path d="M140 420 v-80 l30 12 l-30 12" fill={SUN} />
          <circle cx="330" cy="120" r="34" fill={SUN} />
        </>
      );
    case 'island':
      return (
        <>
          <rect x="0" y="540" width="400" height="260" fill={WATER} />
          <ellipse cx="200" cy="660" rx="110" ry="36" fill={GROUND} />
          <rect x="194" y="560" width="8" height="90" fill={WOOD} />
          <path d="M198 560 q-40 -20 -60 10 q30 -6 60 10 q30 -16 60 -10 q-20 -30 -60 -10Z" fill={LEAF} />
          <rect x="100" y="640" width="30" height="8" fill={WARM} />
          <rect x="270" y="640" width="30" height="8" fill={WARM} />
        </>
      );
  }
}

export function ChapterScene({ kind }: { kind: SceneKind }) {
  return (
    <svg className={`qm-scene qm-scene--${kind}`} viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <Stars />
      {body(kind)}
    </svg>
  );
}
