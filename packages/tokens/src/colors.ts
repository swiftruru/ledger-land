// 色彩 token 的唯一來源（16 主題）。這裡只有數值與推導規則；CSS 變數檔由 scripts/generate.ts 產生。
// 深色三風味的底色階梯由固定公式推導（16 第 3.2 節），卡片、選取底、註解三階錨定來源色票的原值（16 第 3.1 節）。

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

/** 深色共用強調色（16 第 3.1 節） */
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

/** 深色狀態色的 tint（ink 以 15% 疊在卡片色上，16 第 3.3 節） */
export const flavorTints = {
  violet: { success: '#324239', danger: '#433239', warning: '#433A39', info: '#304249', changeDown: '#434239', expense: '#432F42' },
  berry: { success: '#384239', danger: '#4A3239', warning: '#4A3A39', info: '#374249', changeDown: '#4A4239', expense: '#4A2F42' },
  wine: { success: '#3A4230', danger: '#4C3230', warning: '#4C3A30', info: '#394240', changeDown: '#4C4230', expense: '#4C2F3A' },
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
  link: paper.sky,
  focus: paper.sky,
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

/** 底色階梯以外、三個風味共用的深色值（16 第 3.3 節；只在 html[data-theme="dark"] 寫一次） */
const darkShared = {
  text: night.fg,
  accent: night.purple,
  'accent-ink': night.purpleBright,
  'accent-pressed': night.purpleBright,
  link: night.cyan,
  focus: night.cyan,
  'success-ink': night.green,
  'danger-ink': night.red,
  'warning-ink': night.orange,
  'info-ink': night.cyan,
  'change-up-ink': night.cyan,
  'change-down-ink': night.yellow,
  'element-asset-ink': night.cyan,
  'element-liability-ink': night.red,
  'element-equity-ink': night.green,
  'element-revenue-ink': night.yellow,
  'element-expense-ink': night.pink,
  'highlight-ring': night.purple,
  star: night.yellow,
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

/** 只隨風味變動的底色階梯（覆寫區塊只能含這些 token，測試會檢查） */
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
  'accent-tint',
  'accent-contrast',
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
    'accent-tint': base.selection,
    'accent-contrast': d.bg,
    'success-tint': t.success,
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

/** theme-color 與首次繪製背景色（16 第 7 節）：淺色與三個風味各一個值 */
export const THEME_COLOR = {
  light: paper.paper100,
  violet: flavorDerived.violet.bg,
  berry: flavorDerived.berry.bg,
  wine: flavorDerived.wine.bg,
} as const satisfies Record<ThemeName, string>;

/** manifest 只有一份，用淺色（06 第 2.1 節） */
export const MANIFEST_COLORS = { theme_color: paper.paper100, background_color: paper.paper100 } as const;
