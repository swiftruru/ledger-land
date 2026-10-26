// 色彩 token 的唯一來源（16 主題）。這裡只有數值與推導規則；CSS 變數檔由 scripts/generate.ts 產生。
// 深色三風味的底色階梯由固定公式推導（16 第 3.2 節），卡片、選取底、註解三階錨定來源色票的原值（16 第 3.1 節）；
// 強調色組：夜空是色票的紫與亮紫，莓果與紅酒由各風味註解色的色相推導（darkAccent，16 第 3.4 節，2026-10-25 選項 B）。
import { hexToOklab, mixOklab, oklabToHex, relativeLuminance } from './contrast.ts';

export type Theme = 'light' | 'dark';
export type Flavor = 'violet' | 'berry' | 'wine';
export const FLAVORS = ['violet', 'berry', 'wine'] as const satisfies readonly Flavor[];
export const DEFAULT_FLAVOR: Flavor = 'violet';

/** 紙質淺色的基礎色票（16 第 2.1 節） */
export const paper = {
  paper50: '#FFFDF9',
  paper100: '#FCF8F0',
  paper200: '#F4F0E7',
  paper300: '#E0DACF',
  paper400: '#C2BDB4',
  ink100: '#8F8880',
  ink300: '#6D6861',
  ink500: '#625D56',
  ink800: '#292622',
  terracotta: '#9E4A25',
  terracottaPressed: '#7F3A1C',
  peach: '#F49A6C',
  sky: '#1D5F8C',
  mint: '#1F6E52',
  ochre: '#7F5A00',
  coral: '#A8383A',
  star: '#F0C64A',
} as const;

/** 深色色票（16 第 3.1 節）：夜空的強調色，以及三個風味共用的狀態色、要素色與前景色的來源 */
export const night = {
  purple: '#9580FF',
  purpleBright: '#AA99FF',
  pink: '#FF80BF',
  pinkBright: '#FF99CC',
  cyan: '#80FFEA',
  green: '#8AFF80',
  orange: '#FFCA80',
  red: '#FF9580',
  yellow: '#FFFF80',
  fg: '#F8F8F2',
} as const;

/** 三風味的底色色相與三階錨定值（16 第 3.1 節） */
export const flavorBase = {
  violet: { hue: 250, surface: '#22212C', selection: '#454158', comment: '#7970A9' },
  berry: { hue: 290, surface: '#2A212C', selection: '#544158', comment: '#9F70A9' },
  wine: { hue: 350, surface: '#2C2122', selection: '#584145', comment: '#A97079' },
} as const satisfies Record<Flavor, { hue: number; surface: string; selection: string; comment: string }>;

/** 推導出來的底色階梯（16 第 3.2 節的公式，數值以文件表列為準；test/contrast.test.ts 驗證與公式一致） */
export const flavorDerived = {
  violet: { bg: '#121018', surface2: '#2C2938', elevated: '#353243', text3: '#948CBA', text2: '#BFBCD2' },
  berry: { bg: '#171018', surface2: '#352938', elevated: '#413243', text3: '#B38CBA', text2: '#CEBCD2' },
  wine: { bg: '#181012', surface2: '#38292C', elevated: '#433235', text3: '#BA8C94', text2: '#D2BCBF' },
} as const satisfies Record<Flavor, { bg: string; surface2: string; elevated: string; text3: string; text2: string }>;

/** OKLCh（L 0 到 1、彩度、色相角度）轉 hex */
function oklch(L: number, C: number, h: number): string {
  const r = (h * Math.PI) / 180;
  return oklabToHex([L, C * Math.cos(r), C * Math.sin(r)]);
}
const hueOf = (hex: string): number => {
  const [, a, b] = hexToOklab(hex);
  return (Math.atan2(b, a) * 180) / Math.PI;
};

/**
 * 深色的星星與答對色（M3 驗收第 1、2 輪）：來源色票的 yellow #FFFF80 是檸檬黃、green #8AFF80 是螢光綠，
 * 在莓果與紅酒上和紫色主按鈕、珊瑚色錯誤四種高彩度色相同時出現。星星改成暖金（對 bg 約 13:1）。
 * 答對色第 1 輪是 green 以 65% 混前景色（#B6FEAC），第 2 輪看圖驗收仍嫌螢光（紅酒底上是互補色，最刺眼），
 * 改成 OKLCh 亮度 0.87、彩度 0.11、色相 148 度的薄荷綠（約 #A2E9AB）：對卡片 12:1 以上、對答對的淡底 7:1 以上。
 * 原始的 yellow 與 green 只留給場景 tokens（地圖組）與 tint 的推導。
 */
export const DARK_STAR = '#FFD166';
export const DARK_SUCCESS_INK = oklch(0.87, 0.11, 148);
/** 深色收入要素的墨色（M3 驗收第 2 輪）：yellow 以 60% 混前景色，降低彩度（檸檬黃在莓果、紅酒的暗底上很刺眼） */
export const DARK_REVENUE_INK = mixOklab(night.yellow, night.fg, 0.6);

/**
 * 深色答對的淡底（M3 驗收第 2 輪）：答對色以 OKLab 混進卡片色時，綠色和莓果、紅酒卡片色的紅紫分量互相抵消，
 * 16% 只剩彩度 0.002 到 0.015（莓果是灰、紅酒是橄欖色）。改成「亮度取答對色以 p 混進卡片色的亮度、色相取答對色、彩度固定」，
 * 三個風味都讀得出是綠色；亮度仍隨各風味的卡片色變。選項底用 16% 與彩度 0.04（回饋面板的標頭帶要更深一階時用 22% 與 0.05）。
 */
export function darkSuccessTint(surface: string, p = 0.16, chroma = 0.04): string {
  return oklch(hexToOklab(mixOklab(DARK_SUCCESS_INK, surface, p))[0], chroma, hueOf(DARK_SUCCESS_INK));
}

/**
 * 深色的焦點框（M3 驗收第 2 輪）：夜空維持來源色票的 cyan；莓果與紅酒的 cyan 和藕粉底邊、紫色已按下框同時出現時三種色相互相打架，
 * 改成帶風味色相的淡色（OKLCh 亮度 0.93、彩度 0.045、色相取各風味的 comment 色），對 bg、卡片、elevated 都在 9:1 以上。
 */
export function darkFocus(flavor: Flavor): string {
  return flavor === 'violet' ? night.cyan : oklch(0.93, 0.045, hueOf(flavorBase[flavor].comment));
}

/**
 * 深色的選取色（M3 驗收第 4 輪，規劃者定案）：開關的開啟軌道、切換按鈕已按下與目前列的外框。
 * 選取色用和分段控制同一個風味色相（各風味的 comment 色），莓果與紅酒的同一張卡上不再同時出現紫色選取與豆沙粉選取。
 * OKLCh 亮度 0.70、彩度 0.10、色相取 comment：比 comment 亮一階、彩度稍高，看得出「開啟」；深色圓鈕（bg）在上面 6.6:1 以上，
 * 對卡片 5.5:1 以上。淺色仍是強調色。強調色自 2026-10-25 起也隨風味（darkAccent），和選取色同一個色相來源。
 */
export function darkSelected(flavor: Flavor): string {
  return oklch(0.7, 0.1, hueOf(flavorBase[flavor].comment));
}

/**
 * 深色的強調色組（選項 B，2026-10-25 維護者決定；16 第 3.4 節）：夜空維持色票的紫（填色）與亮紫（墨色、已走路線）。
 * 莓果與紅酒的紫疊在紅紫、酒紅的底上互相削弱，同一個畫面出現兩種色相，所以各自換成和風味同色相的強調色：
 * 色相取各風味註解色（comment）的 OKLCh 色相 h，和 darkSelected、darkFocus 同一個來源；亮度與彩度兩個風味相同。
 * - 填色（accent、highlight-ring）：OKLCh(0.67, 0.21)。主按鈕的深色字 5.6:1，彩度比夜空的紫（0.18）高一階，主按鈕與節點一眼看得到。
 * - 墨色（accent-ink、link）：OKLCh(0.74, 0.16)。對卡片 6.2:1 以上、對選取膠囊 3.7:1 以上。
 * - 按下色（accent-pressed）：和墨色同亮度與彩度、色相取填色。主按鈕按下的面是它 85% 混 bg，按下去還是同一顆按鈕（只降彩度），
 *   不會變成另一個色相的淡色；也用在徽章的外環與鈴的帽帶。夜空的亮紫和紫本來就同色相（差 2 度），規則相同。
 * - 已走路線（scene-route-walked）：OKLCh(0.78, 0.13)，墨色的色相、亮一階。未走圓點（text-3）和墨色同色相，墨色當路線時只差 1.15:1。
 * 色相偏移（度）：莓果填色 +7.5（洋紅，和夜空的藍紫拉開）、墨色 +10（費用要素的亮紫和墨色同亮度，只能靠色相分開，OKLab 距離 0.10 以上）；
 * 紅酒填色 0（覆盆子紅）、墨色 -15（往粉紅，和 danger 的珊瑚色同亮度帶，色相拉開到 35 度以上、OKLab 距離 0.10 以上）。
 * 門檻在 test/contrast.test.ts（強調色家族、和狀態色與要素色的距離）與 test/scene.test.ts（路線）。
 */
export const DARK_ACCENT = {
  fill: { L: 0.67, C: 0.21 },
  ink: { L: 0.74, C: 0.16 },
  pressed: { L: 0.74, C: 0.16 },
  route: { L: 0.78, C: 0.13 },
  offset: { berry: { fill: 7.5, ink: 10 }, wine: { fill: 0, ink: -15 } },
} as const;

export function darkAccent(flavor: Flavor): { accent: string; ink: string; pressed: string; route: string } {
  if (flavor === 'violet') return { accent: night.purple, ink: night.purpleBright, pressed: night.purpleBright, route: night.purpleBright };
  const h = hueOf(flavorBase[flavor].comment);
  const o = DARK_ACCENT.offset[flavor];
  const { fill, ink, pressed, route } = DARK_ACCENT;
  return {
    accent: oklch(fill.L, fill.C, h + o.fill),
    ink: oklch(ink.L, ink.C, h + o.ink),
    pressed: oklch(pressed.L, pressed.C, h + o.fill),
    route: oklch(route.L, route.C, h + o.ink),
  };
}

/**
 * 深色的費用要素墨色：夜空是色票的粉；莓果與紅酒的強調色占走粉紅到玫瑰這一段色相（紅酒的墨色對粉只有 OKLab 0.03），
 * 改用夜空強調墨色的亮紫（色票原值）。五大要素是類別色，一律搭配圖示與文字（16 第 1 節原則 7）。tint 見 flavorTints
 */
export const DARK_EXPENSE_INK = { violet: night.pink, berry: night.purpleBright, wine: night.purpleBright } as const satisfies Record<Flavor, string>;

/**
 * 深色狀態色的 tint（ink 以 15% 疊在卡片色上，16 第 3.3 節）。success 欄是 green 的 15%，現在只給權益要素用；答對的 tint 見 flavorColors。
 * expense 欄是 DARK_EXPENSE_INK 的 15%（莓果與紅酒是亮紫，2026-10-25）
 */
export const flavorTints = {
  violet: { success: '#324239', danger: '#433239', warning: '#433A39', info: '#304249', changeDown: '#434239', expense: '#432F42' },
  berry: { success: '#384239', danger: '#4A3239', warning: '#4A3A39', info: '#374249', changeDown: '#4A4239', expense: '#3D334C' },
  wine: { success: '#3A4230', danger: '#4C3230', warning: '#4C3A30', info: '#394240', changeDown: '#4C4230', expense: '#3F3343' },
} as const satisfies Record<Flavor, Record<string, string>>;

/** 語意 token 名稱（不含 --ll- 前綴）；四個主題共用同一組名稱 */
export const SEMANTIC_COLOR_TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'elevated',
  'border',
  'border-strong',
  'text',
  'text-2',
  'text-3',
  'text-4',
  'accent',
  'accent-contrast',
  'accent-ink',
  'accent-tint',
  'accent-pressed',
  'link',
  'focus',
  'selected',
  'success-ink',
  'success-tint',
  'danger-ink',
  'danger-tint',
  'warning-ink',
  'warning-tint',
  'info-ink',
  'info-tint',
  'change-up-ink',
  'change-up-tint',
  'change-down-ink',
  'change-down-tint',
  'change-none-ink',
  'change-none-tint',
  'element-asset-ink',
  'element-asset-tint',
  'element-liability-ink',
  'element-liability-tint',
  'element-equity-ink',
  'element-equity-tint',
  'element-revenue-ink',
  'element-revenue-tint',
  'element-expense-ink',
  'element-expense-tint',
  'highlight-ring',
  'star',
  'tabbar-solid-bg',
  'tabbar-glass-bg',
  'tabbar-hairline',
  'tabbar-edge',
  'glass-highlight',
  'glass-rim',
  'glass-shadow',
  'lens-rest-bg',
  'lens-rest-rim',
  'lens-gloss',
  'lens-face',
  'lens-face-shade',
  'lens-spec',
  'lens-ring',
  'lens-lift-shadow',
  'shadow-1',
  'shadow-2',
  'shadow-3',
  'card-ring',
] as const;
export type SemanticColorToken = (typeof SEMANTIC_COLOR_TOKENS)[number];
export type ThemeColors = Record<SemanticColorToken, string>;

/** 鏡片的色散環：固定的 conic-gradient，四主題相同（16 第 2.2 節） */
const LENS_RING =
  'conic-gradient(from 20deg, rgb(255 90 90 / 0.5), rgb(255 220 90 / 0.4), rgb(90 230 160 / 0.45), rgb(90 160 255 / 0.5), rgb(220 90 255 / 0.4), rgb(255 90 90 / 0.5))';

/** 紙質淺色（16 第 2.2 節；玻璃與鏡片數值以 M0a 定案的 tokens.css 為準） */
export const lightColors: ThemeColors = {
  bg: paper.paper100,
  surface: paper.paper50,
  'surface-2': paper.paper200,
  elevated: paper.paper50,
  border: paper.paper300,
  'border-strong': paper.ink100,
  text: paper.ink800,
  'text-2': paper.ink500,
  'text-3': paper.ink300,
  'text-4': paper.paper400,
  accent: paper.terracotta,
  'accent-contrast': paper.paper50,
  'accent-ink': paper.terracotta,
  'accent-tint': paper.paper200,
  'accent-pressed': paper.terracottaPressed,
  // 句中連結等於主題的強調墨色（站規 1.1.1）；焦點框維持冷色，和強調色分開
  link: paper.terracotta,
  focus: paper.sky,
  // 選取色（開關開啟、已按下的外框）：淺色等於強調色；深色隨風味（darkSelected）
  selected: paper.terracotta,
  'success-ink': paper.mint,
  'success-tint': '#E4ECE5',
  'danger-ink': paper.coral,
  'danger-tint': '#F5E5E2',
  'warning-ink': paper.ochre,
  'warning-tint': '#F0E9DB',
  'info-ink': paper.sky,
  'info-tint': '#E4EAEC',
  'change-up-ink': paper.sky,
  'change-up-tint': '#E4EAEC',
  'change-down-ink': paper.ochre,
  'change-down-tint': '#F0E9DB',
  'change-none-ink': paper.ink500,
  'change-none-tint': paper.paper200,
  'element-asset-ink': paper.sky,
  'element-asset-tint': '#E4EAEC',
  'element-liability-ink': paper.coral,
  'element-liability-tint': '#F5E5E2',
  'element-equity-ink': paper.mint,
  'element-equity-tint': '#E4ECE5',
  'element-revenue-ink': paper.ochre,
  'element-revenue-tint': '#F0E9DB',
  'element-expense-ink': paper.terracotta,
  'element-expense-tint': '#F3E8E0',
  'highlight-ring': paper.peach,
  star: paper.star,
  'tabbar-solid-bg': paper.paper50,
  'tabbar-glass-bg': 'rgb(255 253 249 / 0.6)',
  'tabbar-hairline': 'rgb(59 47 42 / 0.10)',
  'tabbar-edge': '0 0 0 0.5px rgb(59 47 42 / 0.11)',
  'glass-highlight': 'inset 0 1px 0.5px rgb(255 255 255 / 0.9), inset 0 -1.5px 2px rgb(255 255 255 / 0.8), inset 0 0 12px rgb(255 255 255 / 0.25)',
  'glass-rim':
    'linear-gradient(135deg, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0.35) 22%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0.3) 80%, rgb(255 255 255 / 0.7))',
  'glass-shadow': '0 6px 20px rgb(60 40 20 / 0.08), 0 1px 2px rgb(60 40 20 / 0.06)',
  'lens-rest-bg': 'linear-gradient(180deg, rgb(255 255 255 / 0.36) 0%, rgb(255 255 255 / 0.05) 55%, rgb(255 255 255 / 0) 100%), rgb(222 216 208 / 0.65)',
  'lens-rest-rim': 'inset 0 1px 1px rgb(255 255 255 / 0.7), inset 0 -1px 1.5px rgb(59 47 42 / 0.1)',
  'lens-gloss': 'linear-gradient(180deg, rgb(255 255 255 / 0.62) 0%, rgb(255 255 255 / 0.22) 55%, rgb(255 255 255 / 0.4) 100%)',
  'lens-face': 'var(--ll-lens-gloss), var(--ll-tabbar-solid-bg)',
  'lens-face-shade': 'inset 0 7px 9px -9px rgb(255 255 255 / 0.9), inset 0 -8px 10px -10px rgb(59 47 42 / 0.22)',
  'lens-spec':
    'linear-gradient(135deg, rgb(255 255 255 / 1) 0%, rgb(255 255 255 / 0.6) 20%, rgb(255 255 255 / 0) 46%, rgb(59 47 42 / 0.12) 70%, rgb(59 47 42 / 0.34) 100%)',
  'lens-ring': LENS_RING,
  'lens-lift-shadow': '0 6px 10px -6px rgb(59 47 42 / 0.16), 0 14px 20px -12px rgb(59 47 42 / 0.32)',
  'shadow-1': '0 1px 2px rgb(60 40 20 / 0.06), 0 1px 1px rgb(60 40 20 / 0.04)',
  'shadow-2': '0 4px 12px rgb(60 40 20 / 0.10)',
  'shadow-3': '0 8px 24px rgb(60 40 20 / 0.16), 0 2px 6px rgb(60 40 20 / 0.10)',
  'card-ring': '0 0 0 1px rgb(60 40 20 / 0.07)',
};

/** 底色階梯與強調色組以外、三個風味共用的深色值（16 第 3.3 節；只在 html[data-theme="dark"] 寫一次） */
const darkShared = {
  text: night.fg,
  'success-ink': DARK_SUCCESS_INK,
  'danger-ink': night.red,
  'warning-ink': night.orange,
  'info-ink': night.cyan,
  'change-up-ink': night.cyan,
  'change-down-ink': night.yellow,
  'element-asset-ink': night.cyan,
  'element-liability-ink': night.red,
  // 權益與收入的墨色和答對色同一種做法（M3 驗收第 2 輪：螢光綠與檸檬黃在名詞卡的徽記上很刺眼）；tint 仍由原色推導
  'element-equity-ink': DARK_SUCCESS_INK,
  'element-revenue-ink': DARK_REVENUE_INK,
  star: DARK_STAR,
  'tabbar-hairline': 'rgb(255 255 255 / 0.10)',
  'tabbar-edge': '0 0 0 0.5px rgb(255 255 255 / 0.10)',
  'glass-highlight': 'inset 0 1px 1px rgb(255 255 255 / 0.14), inset 0 0 12px rgb(255 255 255 / 0.04)',
  'glass-rim':
    'linear-gradient(135deg, rgb(255 255 255 / 0.4), rgb(255 255 255 / 0.12) 22%, rgb(255 255 255 / 0.03) 50%, rgb(255 255 255 / 0.08) 80%, rgb(255 255 255 / 0.22))',
  'glass-shadow': '0 8px 28px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.25)',
  'lens-rest-bg': 'linear-gradient(180deg, rgb(255 255 255 / 0.02) 0%, rgb(255 255 255 / 0) 60%), color-mix(in srgb, var(--ll-border-strong) 20%, transparent)',
  'lens-rest-rim': 'inset 0 1px 1px rgb(255 255 255 / 0.14), inset 0 -1px 1.5px rgb(0 0 0 / 0.25)',
  'lens-gloss': 'linear-gradient(180deg, rgb(255 255 255 / 0.06) 0%, rgb(255 255 255 / 0.02) 55%, rgb(255 255 255 / 0.04) 100%)',
  'lens-face': 'var(--ll-lens-gloss), var(--ll-tabbar-solid-bg)',
  'lens-face-shade': 'inset 0 7px 9px -9px rgb(255 255 255 / 0.22), inset 0 -8px 10px -10px rgb(0 0 0 / 0.4)',
  'lens-spec':
    'linear-gradient(135deg, rgb(255 255 255 / 0.55) 0%, rgb(255 255 255 / 0.25) 20%, rgb(255 255 255 / 0) 46%, rgb(0 0 0 / 0.22) 70%, rgb(0 0 0 / 0.5) 100%)',
  'lens-ring': LENS_RING,
  'lens-lift-shadow': '0 4px 10px rgb(0 0 0 / 0.4), 0 14px 28px -10px rgb(0 0 0 / 0.65)',
  'shadow-1': '0 1px 2px rgb(0 0 0 / 0.30)',
  'shadow-2': '0 4px 12px rgb(0 0 0 / 0.35)',
  'shadow-3': '0 8px 24px rgb(0 0 0 / 0.40), 0 2px 6px rgb(0 0 0 / 0.30)',
} as const;

function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** 隨風味變動的 token：底色階梯，以及強調色組與費用要素墨色（2026-10-25 選項 B）。覆寫區塊只能含這些 token，測試會檢查 */
export const FLAVOR_TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'elevated',
  'border',
  'border-strong',
  'text-2',
  'text-3',
  'text-4',
  'accent',
  'accent-ink',
  'accent-pressed',
  'link',
  'highlight-ring',
  'accent-tint',
  'accent-contrast',
  'focus',
  'selected',
  'success-tint',
  'danger-tint',
  'warning-tint',
  'info-tint',
  'change-up-tint',
  'change-down-tint',
  'change-none-ink',
  'change-none-tint',
  'element-asset-tint',
  'element-liability-tint',
  'element-equity-tint',
  'element-revenue-tint',
  'element-expense-ink',
  'element-expense-tint',
  'tabbar-solid-bg',
  'tabbar-glass-bg',
  'card-ring',
] as const satisfies readonly SemanticColorToken[];
export type FlavorToken = (typeof FLAVOR_TOKENS)[number];

export function flavorColors(flavor: Flavor): Record<FlavorToken, string> {
  const base = flavorBase[flavor];
  const d = flavorDerived[flavor];
  const t = flavorTints[flavor];
  const a = darkAccent(flavor);
  return {
    bg: d.bg,
    surface: base.surface,
    'surface-2': d.surface2,
    elevated: d.elevated,
    border: d.elevated,
    'border-strong': base.comment,
    'text-2': d.text2,
    'text-3': d.text3,
    'text-4': base.comment,
    // 強調色組（darkAccent）：深色的按下是提亮（墨色的亮度、填色的色相）、句中連結等於墨色、highlight-ring 等於填色
    accent: a.accent,
    'accent-ink': a.ink,
    'accent-pressed': a.pressed,
    link: a.ink,
    'highlight-ring': a.accent,
    'accent-tint': base.selection,
    'accent-contrast': d.bg,
    focus: darkFocus(flavor),
    selected: darkSelected(flavor),
    // 答對的淡底：亮度隨各風味的卡片色，色相與彩度固定成讀得出的綠（見 darkSuccessTint）
    'success-tint': darkSuccessTint(base.surface),
    'danger-tint': t.danger,
    'warning-tint': t.warning,
    'info-tint': t.info,
    'change-up-tint': t.info,
    'change-down-tint': t.changeDown,
    'change-none-ink': d.text2,
    'change-none-tint': d.surface2,
    'element-asset-tint': t.info,
    'element-liability-tint': t.danger,
    'element-equity-tint': t.success,
    'element-revenue-tint': t.changeDown,
    'element-expense-ink': DARK_EXPENSE_INK[flavor],
    'element-expense-tint': t.expense,
    'tabbar-solid-bg': d.elevated,
    'tabbar-glass-bg': `rgb(${hexToRgbTriplet(d.elevated)} / 0.5)`,
    'card-ring': `0 0 0 1px rgb(${hexToRgbTriplet(d.elevated)} / 0.70)`,
  };
}

/** 完整的深色主題（某個風味）語意 token */
export function darkColors(flavor: Flavor): ThemeColors {
  return { ...lightColors, ...darkShared, ...flavorColors(flavor) };
}

export const themes = {
  light: lightColors,
  violet: darkColors('violet'),
  berry: darkColors('berry'),
  wine: darkColors('wine'),
} as const;
export type ThemeName = keyof typeof themes;

/**
 * 可點元件的顏色（站規 1.1.1、1.1.2）：連結、按鈕、平面元件（chrome）、進度與收集、遮罩。
 * 值可以引用語意 token（var()）與 color-mix；深色只寫在共用區塊，引用 --ll-bg 等底色階梯的值會隨風味自動變（選項 A：
 * 深色底邊與按下色帶入夜空、莓果、紅酒各自的底色），所以風味覆寫區塊不加任何一行。
 * 測試用 resolveColor（contrast.ts）把 var() 與 color-mix 換算成實際色後再算對比。
 */
export const COMPONENT_COLOR_TOKENS = [
  'link-underline',
  'link-hover',
  'btn-primary-bg',
  'btn-primary-fg',
  'btn-primary-ledge',
  'btn-primary-pressed',
  'btn-secondary-bg',
  'btn-secondary-fg',
  'btn-secondary-border',
  'btn-secondary-ledge',
  'btn-secondary-pressed',
  'btn-secondary-icon',
  'btn-icon',
  'chrome-bg',
  'chrome-pressed',
  'quiet-hover',
  'row-pressed',
  'btn-danger-bg',
  'btn-danger-fg',
  'btn-danger-ledge',
  'btn-danger-pressed',
  'node-ledge',
  'btn-disabled-bg',
  'btn-disabled-fg',
  'star-fill',
  'star-edge',
  'star-ink',
  'collected-ring',
  'progress-track',
  'progress-rim',
  'scrim',
  'stage-glow',
  'stage-core',
] as const;
export type ComponentColorToken = (typeof COMPONENT_COLOR_TOKENS)[number];
export type ComponentColors = Record<ComponentColorToken, string>;

/** 紙質主按鈕的底邊：terracotta 以 70% 疊在黑上（sRGB，和 blendHex 同算法；測試核對等於 #6F341A） */
export const PAPER_PRIMARY_LEDGE = '#6F341A';

export const lightComponentColors: ComponentColors = {
  'link-underline': 'rgb(158 74 37 / 0.45)',
  'link-hover': 'var(--ll-accent-pressed)',
  'btn-primary-bg': 'var(--ll-accent)',
  'btn-primary-fg': 'var(--ll-accent-contrast)',
  'btn-primary-ledge': PAPER_PRIMARY_LEDGE,
  'btn-primary-pressed': 'var(--ll-accent-pressed)',
  'btn-secondary-bg': 'var(--ll-surface)',
  'btn-secondary-fg': 'var(--ll-text)',
  'btn-secondary-border': 'var(--ll-border-strong)',
  'btn-secondary-ledge': 'var(--ll-text-4)',
  'btn-secondary-pressed': 'var(--ll-accent-tint)',
  // 次要按鈕（含已按下的切換）裡的圖示：淺色等於 btn-icon（強調墨色）
  'btn-secondary-icon': 'var(--ll-btn-icon)',
  'btn-icon': 'var(--ll-accent-ink)',
  'chrome-bg': 'var(--ll-surface-2)',
  'chrome-pressed': 'var(--ll-border)',
  'quiet-hover': 'var(--ll-surface-2)',
  // 列（NavRow、Disclosure、選單項目）按下的底（M3 驗收第 2 輪）：紙質的 accent-tint 等於 surface-2（滑過的底），按下去畫面不變；
  // 改成強調色 12% 混進卡片色（約 #F2E2D8）
  'row-pressed': 'color-mix(in oklab, var(--ll-accent) 12%, var(--ll-surface))',
  'btn-danger-bg': 'var(--ll-danger-tint)',
  'btn-danger-fg': 'var(--ll-danger-ink)',
  'btn-danger-ledge': 'var(--ll-danger-ink)',
  // 危險按鈕按下的面（原本寫在 01-core-base.css 的 --_press，淡底帶 15% 珊瑚色時字只剩 4.23:1）：改成 10%，字 4.56:1、和靜止的面差 1.15:1
  'btn-danger-pressed': 'color-mix(in oklab, var(--ll-btn-danger-bg) 90%, var(--ll-btn-danger-fg))',
  // 地圖節點、關卡面板的節點圖示、首頁小地圖的未完成節點底邊（站規 0.4 A1）：淺色和次要按鈕相同
  'node-ledge': 'var(--ll-text-4)',
  'btn-disabled-bg': 'var(--ll-surface-2)',
  'btn-disabled-fg': 'var(--ll-text-3)',
  'star-fill': 'var(--ll-star)',
  'star-edge': 'color-mix(in oklab, var(--ll-warning-ink) 40%, transparent)',
  'star-ink': 'var(--ll-text)',
  'collected-ring': 'color-mix(in oklab, var(--ll-star) 30%, transparent)',
  // 進度條的空軌道與 1px 外框（ProgressBar）：淺色是 surface-2 加 border 細框（外框對卡片 1.37:1）
  'progress-track': 'var(--ll-surface-2)',
  'progress-rim': 'var(--ll-border)',
  scrim: 'rgb(41 38 34 / 0.4)',
  // 結果頁與錯題本入口的舞台光（鈴後面的放射漸層，作答組）：淺色是星星色的暖光，沒有中心亮點
  'stage-glow': 'color-mix(in oklab, var(--ll-star) 24%, transparent)',
  'stage-core': 'transparent',
};

export const darkComponentColors: ComponentColors = {
  // 連結底線是連結色的 50% 透明（2026-10-25：原本寫死亮紫 rgb(170 153 255 / 0.5)，夜空的值不變，莓果與紅酒自動跟著各自的墨色）
  'link-underline': 'color-mix(in oklab, var(--ll-link) 50%, transparent)',
  'link-hover': 'color-mix(in oklab, var(--ll-accent-ink) 70%, var(--ll-text))',
  'btn-primary-bg': 'var(--ll-accent)',
  'btn-primary-fg': 'var(--ll-accent-contrast)',
  'btn-primary-ledge': 'color-mix(in oklab, var(--ll-accent) 60%, var(--ll-bg))',
  'btn-primary-pressed': 'color-mix(in oklab, var(--ll-accent-pressed) 85%, var(--ll-bg))',
  // 深色的次要與危險按鈕（M3 驗收第 4 輪，規劃者定案採 (a)）：站規 5.1 的通過條件是「底邊一定比面暗」，原本深色的底邊是外框色
  // （比面亮），看起來像底部加粗的外框鈕，和主按鈕的暗底邊是兩種厚度。改成面調亮（elevated 混 32% 外框色）、底邊調暗
  // （外框色 40% 混進頁面底色，帶各風味的色相）；1.5px 外框維持 border-strong，形狀清楚。
  // 三風味實際值：面對底邊 1.33 以上（門檻 1.3）、底邊對卡片 1.32 以上（門檻 1.3）、對頁面底色 1.57 以上（門檻 1.5），見 contrast.test.ts。按下的面比靜止暗一階（accent-tint 混 20% 底色）：
  // 面調亮之後和原本的按下色（accent-tint）幾乎一樣，按下去只剩位移
  'btn-secondary-bg': 'color-mix(in oklab, var(--ll-elevated) 68%, var(--ll-border-strong))',
  'btn-secondary-fg': 'var(--ll-text)',
  'btn-secondary-border': 'var(--ll-border-strong)',
  'btn-secondary-ledge': 'color-mix(in oklab, var(--ll-border-strong) 40%, var(--ll-bg))',
  'btn-secondary-pressed': 'color-mix(in oklab, var(--ll-accent-tint) 80%, var(--ll-bg))',
  // 次要按鈕裡的圖示（M3 驗收第 5 輪）：面和外框帶各風味的色相（莓果、紅酒是玫瑰色），當時強調色的紫色圖示放在裡面是第三種色相。
  // 改成選取色（風味色相）60% 混前景色：和面、外框同一個色相，對面 4.6:1 以上、對按下的面 6:1 以上。
  // 主按鈕、連結仍是強調色（2026-10-25 起強調色也隨風味，和這裡同一個色相家族）
  'btn-secondary-icon': 'color-mix(in oklab, var(--ll-selected) 60%, var(--ll-text))',
  'btn-icon': 'var(--ll-accent-ink)',
  'chrome-bg': 'var(--ll-elevated)',
  'chrome-pressed': 'var(--ll-surface-2)',
  'quiet-hover': 'var(--ll-surface-2)',
  // 深色的選取底（accent-tint）和滑過的 surface-2 本來就分得開
  'row-pressed': 'var(--ll-accent-tint)',
  // 危險：面是淡底混 20% 珊瑚色，底邊是珊瑚色 32% 混進底色；字與外框是珊瑚色混 28% 前景色（面調亮後原本的珊瑚字只剩 3.6:1）。
  // 按下的面回到原本的淡底（比靜止暗）
  'btn-danger-bg': 'color-mix(in oklab, var(--ll-danger-tint) 80%, var(--ll-danger-ink))',
  'btn-danger-fg': 'color-mix(in oklab, var(--ll-danger-ink) 72%, var(--ll-text))',
  'btn-danger-ledge': 'color-mix(in oklab, var(--ll-danger-ink) 32%, var(--ll-bg))',
  'btn-danger-pressed': 'var(--ll-danger-tint)',
  // 地圖節點的底邊維持外框色：節點立在路面（elevated）上，按鈕的暗底邊在路面上只有 1.0:1，看不出厚度（地圖組的面是 scene-card）。
  // 用在 .ll-node__disc、.ll-levelsheet__node（08-map-components.css）與首頁小地圖的 .ll-minimap__ledge（home.css）
  'node-ledge': 'var(--ll-border-strong)',
  'btn-disabled-bg': 'var(--ll-surface-2)',
  'btn-disabled-fg': 'var(--ll-text-3)',
  // 填色往暖金拉（混 warning 的橙），不和底色混（混底色會變成土黃、卡其）；收集的外圈是填色 65% 的半透明金
  'star-fill': 'color-mix(in oklab, var(--ll-star) 82%, var(--ll-warning-ink))',
  'star-edge': 'transparent',
  'star-ink': 'var(--ll-bg)',
  'collected-ring': 'color-mix(in oklab, var(--ll-star-fill) 65%, transparent)',
  // 進度條的空軌道（M3 驗收第 5 輪）：surface-2 對卡片只有 1.12:1、border 細框 1.3:1，三個風味的空進度條在卡片上幾乎看不見。
  // 軌道是外框色 28% 混卡片色（對卡片 1.36 以上）、外框是外框色 70% 混卡片色（對卡片 2.3 以上），和淺色一樣看得到一條有邊的凹槽
  'progress-track': 'color-mix(in oklab, var(--ll-border-strong) 28%, var(--ll-surface))',
  'progress-rim': 'color-mix(in oklab, var(--ll-border-strong) 70%, var(--ll-surface))',
  scrim: 'rgb(0 0 0 / 0.65)',
  // 深色的舞台光：外圈帶強調色的夜光，鈴的正後方一小圈星星色
  'stage-glow': 'color-mix(in oklab, var(--ll-accent) 22%, transparent)',
  'stage-core': 'color-mix(in oklab, var(--ll-star) 14%, transparent)',
};

export const componentThemes = {
  light: lightComponentColors,
  violet: darkComponentColors,
  berry: darkComponentColors,
  wine: darkComponentColors,
} as const satisfies Record<ThemeName, ComponentColors>;

/** theme-color 與首次繪製背景色（16 第 7 節）：淺色與三個風味各一個值 */
export const THEME_COLOR = {
  light: paper.paper100,
  violet: flavorDerived.violet.bg,
  berry: flavorDerived.berry.bg,
  wine: flavorDerived.wine.bg,
} as const satisfies Record<ThemeName, string>;

/** manifest 只有一份，用淺色（06 第 2.1 節） */
export const MANIFEST_COLORS = { theme_color: paper.paper100, background_color: paper.paper100 } as const;

// ---- 場景 tokens（地圖組，圖規第 5 節）：地景底色、物件色、道路與路線 ----
// 淺色是固定值；深色由「風味底色混合深色色票」在產生 CSS 時算好（不在 CSS 裡用 color-mix），所以三個風味各自一組，
// 寫在深色共用區塊（violet）與 berry、wine 的覆寫區塊。element-*-tint 與 highlight-ring 是會計要素的語意色，不再用在場景（07 第 2.4 節）。
// 對比門檻在 test/scene.test.ts：未走圓點對路面 3:1、已走實線對路面 4.5:1、路邊對所有地景底色 1.2:1、地景底色對 bg 1.1 到 1.45、
// 地圖卡片（scene-card：章節牌、紙籤、海峽說明卡、星星籤）對所有地景底色 1.25:1（第 1 輪看圖驗收：深色卡片像地上的洞）；
// 章末拱門的石材（scene-arch-stone）對所有地景底色 2.5:1（第 3 輪看圖驗收：石材 1.4 到 1.7:1、描邊同色系，手機上像一個淡掉的灰色馬蹄鐵）。

export const SCENE_COLOR_TOKENS = [
  'scene-sea',
  'scene-sea-deep',
  'scene-foam',
  'scene-sand',
  'scene-meadow',
  'scene-meadow-deep',
  'scene-field',
  'scene-plaza',
  'scene-rock',
  'scene-rock-deep',
  'scene-arch-stone',
  'scene-arch-crest',
  'scene-arch-line',
  'scene-wood',
  'scene-roof',
  'scene-leaf',
  'scene-glow',
  'scene-line',
  'scene-road',
  'scene-road-edge',
  'scene-route-ahead',
  'scene-route-walked',
  'scene-card',
] as const;
export type SceneColorToken = (typeof SCENE_COLOR_TOKENS)[number];
export type SceneColors = Record<SceneColorToken, string>;

/** 大面積的地景底色（場景放置器的地形塊與 .qm-terrain 用；對比測試對它們全部檢查） */
export const SCENE_TERRAIN_TOKENS = [
  'scene-sea',
  'scene-sea-deep',
  'scene-sand',
  'scene-meadow',
  'scene-meadow-deep',
  'scene-field',
  'scene-plaza',
  'scene-rock',
] as const satisfies readonly SceneColorToken[];

/**
 * 紙質淺色的場景色（固定值）。路邊比圖規的表深一階（#D9CFC0 對深海、深草地、岩地不到 1.2:1）。
 * 海、沙、草地、田、廣場比圖規的表深 1% 到 4%（混進暖灰）：白色卡片（surface）對它們原本只有 1.21 到 1.26，到不了 1.25:1。
 */
export const lightSceneColors: SceneColors = {
  'scene-sea': '#D9E5E7',
  'scene-sea-deep': '#C8DBE0',
  'scene-foam': '#F6FAFA',
  'scene-sand': '#ECE2CF',
  'scene-meadow': '#DEE6D2',
  'scene-meadow-deep': '#CCDDBC',
  'scene-field': '#EDE2C3',
  'scene-plaza': '#E8E1D7',
  'scene-rock': '#DCD5CA',
  'scene-rock-deep': '#C9C0B3',
  // 章末拱門：石材比 rock-deep 深三階（對最亮的田與沙也有 2.5:1），描線與石縫是更深的暖褐，頂面高光是淺石色
  'scene-arch-stone': '#918170',
  'scene-arch-crest': '#D6C9B6',
  'scene-arch-line': '#6A5D4F',
  'scene-wood': '#D7BC9E',
  'scene-roof': '#EBB8A0',
  'scene-leaf': '#BCD3AA',
  'scene-glow': '#F7DE9C',
  'scene-line': '#B5AA9C',
  'scene-road': paper.paper50,
  'scene-road-edge': '#C7BBA9',
  'scene-route-ahead': paper.ink100,
  'scene-route-walked': paper.terracotta,
  'scene-card': paper.paper50,
};

/** sRGB 線性混色（和 contrast.ts 的 blendHex 同算法）：fg 以 alpha 疊在 bg 上 */
function mixHex(fg: string, bg: string, alpha: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const f = p(fg);
  const b = p(bg);
  return `#${f
    .map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, '0').toUpperCase())
    .join('')}`;
}

/** CIE L*（0 到 100）：場景地景的亮度用它定（陸海亮度差的門檻也是 L*） */
export function lightnessOf(hex: string): number {
  const y = relativeLuminance(hex);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** OKLCh 的彩度與色相固定，二分 OKLab 亮度，找 CIE L* 等於 target 的顏色 */
function atLightness(target: number, C: number, h: number): string {
  let lo = 0.05;
  let hi = 0.6;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (lightnessOf(oklch(m, C, h)) < target) lo = m;
    else hi = m;
  }
  return oklch(lo, C, h);
}

/** OKLab 的 (a, b) 向量相加：[彩度, 色相] 各一份，回傳合成的彩度與色相 */
function addHues(parts: readonly (readonly [number, number])[]): { C: number; h: number } {
  let a = 0;
  let b = 0;
  for (const [C, h] of parts) {
    a += C * Math.cos((h * Math.PI) / 180);
    b += C * Math.sin((h * Math.PI) / 180);
  }
  return { C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
}

/**
 * 深色地景（第 2 輪看圖驗收：陸地與海的亮度幾乎相同、海岸只靠 1px 青線分辨，紅褐色的陸地配青色海、紫色卡片，大畫面是一片暗泥；
 * 三個風味的陸地都是同一種暖棕）。每塊地景是「地景色相一份加風味色相一份」（OKLab 的 a、b 向量相加，彩度都很低），亮度用 CIE L* 定，
 * 從各風味 bg 的 L* 往上加：海與深海加 5.7 與 5.2（藍、帶一點風味色），陸地加 14.1 到 14.9（廣場與岩地只有風味色，沙、田、草地再加自己的色相），
 * 陸海差 8 以上，對 bg 都在 1.1 到 1.45 之間（大面積地景不比卡片搶眼）。所以夜空的陸地偏藍紫、莓果偏紫紅、紅酒偏紅棕，海一律是深藍。
 * 表列：[地景色相, 地景彩度, 風味彩度, 比 bg 亮多少 L*]；風味色相取各風味的 comment 色。
 */
export const DARK_GROUND = {
  'scene-sea-deep': [250, 0.032, 0.009, 5.2],
  'scene-sea': [245, 0.036, 0.009, 5.7],
  'scene-plaza': [0, 0, 0.026, 14.1],
  'scene-sand': [75, 0.014, 0.026, 14.4],
  'scene-meadow': [150, 0.028, 0.018, 14.2],
  'scene-field': [95, 0.018, 0.024, 14.6],
  'scene-meadow-deep': [155, 0.036, 0.015, 14.8],
  'scene-rock': [0, 0, 0.013, 14.9],
} as const satisfies Record<(typeof SCENE_TERRAIN_TOKENS)[number], readonly [number, number, number, number]>;

/**
 * 莓果與紅酒的草地（第 5 輪看圖驗收：綠色加上紅褐的風味色變成 OKLCh 色相 107 到 135 度的橄欖色，第 5 章整片、第 10 章兩翼與第 2 章島上的草地
 * 在暖色地景上像一塊污漬）：草地的色相離風味 bg 超過 60 度，所以彩度壓到 GRASS_TAME.maxC 以下（看起來是帶一點綠的夜色地面），
 * 色相不低於 GRASS_TAME.minHue（真正的綠，不是黃綠的橄欖色）。夜空的草地是偏青的綠，和藍紫的地面相襯，不改。
 * 第 10 章的底色 scene-meadow-deep（第 6 輪看圖驗收：1440 寬兩翼各約 400px 寬的同一塊綠灰色，在棕紅色地景兩側）不再是草地，
 * 改成那個風味地面的深一階：色相是風味色（和廣場、岩地同一種）、彩度 deepC、亮度比 bg 高 deepL（比岩地暗約 1，仍比海亮 8 以上）。
 * 草地色只留給第 10 章軌道旁的草坡環、第 5 章與島上的草地
 */
export const GRASS_TAME = {
  flavors: ['berry', 'wine'] as readonly Flavor[],
  tokens: ['scene-meadow'] as readonly string[],
  maxC: 0.013,
  minHue: 150,
  deepC: 0.02,
  deepL: 13.9,
} as const;

/**
 * 章末拱門的石材（第 5 輪看圖驗收：石材加前景色 38% 之後彩度只剩 0.01，在莓果、紅酒的暖色地景上仍是中性冷灰的金屬磁鐵）：
 * 亮度沿用原本的公式（對所有地景 2.5:1 以上），色相取那個風味沙地與廣場的中間，石材彩度 ARCH_TINT.stone、描線 line、頂面高光 crest
 */
export const ARCH_TINT = { stone: 0.026, line: 0.026, crest: 0.014 } as const;

/**
 * 夜空的沙地（第 7 輪看圖驗收：延伸區四座島的沙岸是 OKLCh 色相 322 度的灰褐紫 #342D35，大片墊在章節牌與紙籤下面，
 * 和深藍的海、深綠的草地放在一起像一片污漬）：夜空不加沙地自己的暖色相（75 度加藍紫的地面合成紅褐），改成冷的藍灰（色相 h、彩度 C），
 * 像月光下的沙灘。拱門的色相仍用原本的沙地算（拱門不變）。莓果與紅酒的沙地跟著暖色的風味地面，不改。
 * 第 8 輪看圖驗收：沙地 #27303A 和島上的草地 #243130 亮度幾乎相同（OKLab 距離 0.021），延伸島像一整塊深石板。
 * 改成彩度 0.028、色相 255 度（更藍，和偏青的草地色相差更大），亮度用 dl（比 bg 亮多少 L*）提高到地景對 bg 1.45 倍上限以內的最亮一階
 * （#27313F，對 bg 1.43，14 的地景色決定）：和草地的距離 0.029、比草地亮 0.009，地圖卡片仍亮 1.35 倍。
 * 審查建議的 OKLab 亮度 0.33 到 0.34（距離 0.04）會讓沙地對 bg 1.54 到 1.61、浪花線對沙地不到 1.6:1、卡片對沙地 1.2 到 1.25，
 * 超出已決定的上限，要維護者看圖決定（foundation/r9 有對照圖）
 */
export const NIGHT_SAND = { h: 255, C: 0.028, dl: 14.9 } as const;

/**
 * 深色的場景色（某個風味）：地景見 DARK_GROUND；物件是 surface 加強調色；路面是 elevated、路邊是 elevated 加前景色 12%；未走圓點是 text-3。
 * 已走實線（darkAccent 的 route）：夜空是亮紫（accent-ink；一般的強調紫對 elevated 的路面只有約 4:1，不到 4.5:1）；莓果與紅酒是墨色的色相、
 * 亮一階（OKLCh 0.78、0.13），和同色相的未走圓點（text-3）分得開。
 * 浪花線是「青混前景色 40%」以 30% 疊在 bg 上（第 4 輪看圖驗收：原本 bg 加青 30% 是莓果與紅酒畫面上唯一的冷青色，海峽整片青綠浪線很搶眼；
 * 改成低彩度的灰藍，OKLab 彩度 0.02 以下，對海與陸地仍在 1.6:1 以上）；描線是 bg 加前景色 24%（陸地調亮後，18% 的描線對陸地只剩 1.2:1）。
 * 葉色是「綠混青 30%」以 22% 疊在 surface 上（第 4 輪看圖驗收：純綠混進紅酒的紅褐色變成橄欖色，村落的草地像污漬）。
 * 木頭是 surface 加橙 22% 再混前景色 20%（第 4 輪看圖驗收：深色海峽的棧橋對路面只有 1.35:1，幾乎被路面蓋滿，讀不出是一座橋）。
 * 章末拱門的亮度是那個風味的廣場地景加前景色：石材 38%、頂面高光 64%、描線 12%（第 4 輪看圖驗收）；色相與彩度見 ARCH_TINT
 * （第 5 輪看圖驗收：只混前景色時彩度 0.01，仍是中性冷灰）；石材對所有地景仍在 2.5:1 以上。草地見 GRASS_TAME。
 * 地圖卡片是 elevated 加前景色 8%：比最亮的地景亮 1.3 倍以上，卡片才像立在地上的實物；
 * 卡片上的 text 與 text-2 仍有 8.5 與 5.2:1（強調墨色只有約 4:1，所以卡片上的「完成」在深色改用答對色，見 08-map-components.css）。
 */
export function darkSceneColors(flavor: Flavor): SceneColors {
  const d = flavorDerived[flavor];
  const s = flavorBase[flavor].surface;
  const hf = hueOf(flavorBase[flavor].comment);
  const tame = GRASS_TAME.flavors.includes(flavor);
  const ground = (k: keyof typeof DARK_GROUND): string => {
    const [ht, ct, cf, dl] = DARK_GROUND[k];
    let v = addHues([
      [ct, ht],
      [cf, hf],
    ]);
    if (tame && GRASS_TAME.tokens.includes(k)) v = { C: Math.min(v.C, GRASS_TAME.maxC), h: Math.max((v.h + 360) % 360, GRASS_TAME.minHue) };
    if (tame && k === 'scene-meadow-deep') return atLightness(lightnessOf(d.bg) + GRASS_TAME.deepL, GRASS_TAME.deepC, hf);
    return atLightness(lightnessOf(d.bg) + dl, v.C, v.h);
  };
  // 拱門：亮度照舊（廣場地景加前景色），色相是沙地與廣場的中間（OKLab 平均），帶 ARCH_TINT 的彩度
  const archHue = addHues([
    [1, hueOf(ground('scene-sand'))],
    [1, hueOf(ground('scene-plaza'))],
  ]).h;
  const arch = (p: number, C: number): string => oklch(hexToOklab(mixHex(night.fg, ground('scene-plaza'), p))[0], C, archHue);
  return {
    'scene-sea': ground('scene-sea'),
    'scene-sea-deep': ground('scene-sea-deep'),
    'scene-foam': mixHex(mixHex(night.cyan, night.fg, 0.4), d.bg, 0.3),
    'scene-sand': flavor === 'violet' ? atLightness(lightnessOf(d.bg) + NIGHT_SAND.dl, NIGHT_SAND.C, NIGHT_SAND.h) : ground('scene-sand'),
    'scene-meadow': ground('scene-meadow'),
    'scene-meadow-deep': ground('scene-meadow-deep'),
    'scene-field': ground('scene-field'),
    'scene-plaza': ground('scene-plaza'),
    'scene-rock': ground('scene-rock'),
    // 拱門、繩柱：比描線亮一階，深色下才看得出石頭與外框
    'scene-rock-deep': mixHex(night.fg, d.bg, 0.28),
    // 章末拱門：亮度是廣場地景加前景色，石材 38%（對所有地景 2.9:1 以上）、頂面高光 64%、描線與石縫 12%（比石材暗 2:1 以上）；
    // 色相跟著那個風味的地面（ARCH_TINT），不是中性冷灰
    'scene-arch-stone': arch(0.38, ARCH_TINT.stone),
    'scene-arch-crest': arch(0.64, ARCH_TINT.crest),
    'scene-arch-line': arch(0.12, ARCH_TINT.line),
    'scene-wood': mixHex(night.fg, mixHex(night.orange, s, 0.22), 0.2),
    'scene-roof': mixHex(night.pink, s, 0.22),
    'scene-leaf': mixHex(mixHex(night.green, night.cyan, 0.3), s, 0.22),
    'scene-glow': mixHex(night.yellow, s, 0.55),
    'scene-line': mixHex(night.fg, d.bg, 0.24),
    'scene-road': d.elevated,
    'scene-road-edge': mixHex(night.fg, d.elevated, 0.12),
    'scene-route-ahead': d.text3,
    'scene-route-walked': darkAccent(flavor).route,
    'scene-card': mixHex(night.fg, d.elevated, 0.08),
  };
}

export const sceneThemes = {
  light: lightSceneColors,
  violet: darkSceneColors('violet'),
  berry: darkSceneColors('berry'),
  wine: darkSceneColors('wine'),
} as const satisfies Record<ThemeName, SceneColors>;
