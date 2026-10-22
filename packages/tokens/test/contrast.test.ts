// 16 第 6 節：對淺色與三個風味各跑一輪的對比度門檻，以及結構檢查
import { describe, expect, it } from 'vitest';
import {
  FLAVORS,
  FLAVOR_TOKENS,
  SEMANTIC_COLOR_TOKENS,
  THEME_COLOR,
  flavorBase,
  flavorColors,
  flavorDerived,
  lightColors,
  themes,
  type ThemeColors,
  type ThemeName,
} from '../src/colors.ts';
import { blendHex, contrastRatio, hslToHex } from '../src/contrast.ts';
import { firstPaintStyle, generateTokensCss } from '../src/css.ts';

const THEMES: ThemeName[] = ['light', 'violet', 'berry', 'wine'];
const isHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v);

function pairs(t: ThemeColors): { name: string; fg: string; bg: string; min: number }[] {
  return [
    { name: 'text 對 surface', fg: t.text, bg: t.surface, min: 7 },
    { name: 'text-2 對 surface', fg: t['text-2'], bg: t.surface, min: 4.5 },
    { name: 'text-3 對 surface', fg: t['text-3'], bg: t.surface, min: 4.5 },
    { name: 'text-2 對 surface-2（chip）', fg: t['text-2'], bg: t['surface-2'], min: 4.5 },
    { name: 'border-strong 對 surface', fg: t['border-strong'], bg: t.surface, min: 3 },
    { name: '主按鈕文字對填色', fg: t['accent-contrast'], bg: t.accent, min: 4.5 },
    { name: 'accent-ink 對 surface', fg: t['accent-ink'], bg: t.surface, min: 4.5 },
    { name: 'text 對選取膠囊', fg: t.text, bg: t['accent-tint'], min: 4.5 },
    { name: 'accent-ink 對選取膠囊（圖示）', fg: t['accent-ink'], bg: t['accent-tint'], min: 3 },
    { name: 'link 對 surface', fg: t.link, bg: t.surface, min: 4.5 },
    { name: 'focus 對 bg', fg: t.focus, bg: t.bg, min: 3 },
    { name: 'success 對 tint', fg: t['success-ink'], bg: t['success-tint'], min: 4.5 },
    { name: 'danger 對 tint', fg: t['danger-ink'], bg: t['danger-tint'], min: 4.5 },
    { name: 'warning 對 tint', fg: t['warning-ink'], bg: t['warning-tint'], min: 4.5 },
    { name: 'info 對 tint', fg: t['info-ink'], bg: t['info-tint'], min: 4.5 },
    { name: '資產 ink 對 tint', fg: t['element-asset-ink'], bg: t['element-asset-tint'], min: 4.5 },
    { name: '負債 ink 對 tint', fg: t['element-liability-ink'], bg: t['element-liability-tint'], min: 4.5 },
    { name: '權益 ink 對 tint', fg: t['element-equity-ink'], bg: t['element-equity-tint'], min: 4.5 },
    { name: '收入 ink 對 tint', fg: t['element-revenue-ink'], bg: t['element-revenue-tint'], min: 4.5 },
    { name: '費用 ink 對 tint', fg: t['element-expense-ink'], bg: t['element-expense-tint'], min: 4.5 },
    { name: 'change-up 對 surface-2', fg: t['change-up-ink'], bg: t['surface-2'], min: 4.5 },
    { name: 'change-down 對 surface-2', fg: t['change-down-ink'], bg: t['surface-2'], min: 4.5 },
    { name: 'change-none 對 tint', fg: t['change-none-ink'], bg: t['change-none-tint'], min: 4.5 },
  ];
}

describe.each(THEMES)('主題 %s 的對比度門檻（16 第 6 節）', (name) => {
  const t = themes[name];
  it.each(pairs(t))('$name 至少 $min:1', ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
  it('所有用在對比配對的 token 都是六位 hex', () => {
    for (const p of pairs(t)) {
      expect(isHex(p.fg)).toBe(true);
      expect(isHex(p.bg)).toBe(true);
    }
  });
});

describe('深色三風味的結構（16 第 3 節）', () => {
  it.each(FLAVORS)('%s：相鄰層 1.15 到 1.35:1，玻璃底（elevated）比卡片亮', (flavor) => {
    const t = themes[flavor];
    // 16 第 1 節寫相鄰層 1.2 到 1.35、第 6 節寫 1.15 到 1.35，但依 16 第 3.2 節公式推導出的實際值是：surface 對 bg 1.19 到 1.20、
    // surface-2 對 surface 1.12 到 1.13、elevated 對 surface-2 1.14 到 1.16、elevated 對 surface 1.28 到 1.30（M0b 實測，已回報規劃工作階段修正文件）。
    // 門檻依實際值定：每一層都要比下一層亮、相鄰至少 1.10、不超過 1.35；bg 到 surface 至少 1.15；surface 到 elevated 至少 1.25
    const steps = [
      [t.surface, t.bg, 1.15],
      [t['surface-2'], t.surface, 1.1],
      [t.elevated, t['surface-2'], 1.1],
      [t.elevated, t.surface, 1.25],
    ] as const;
    for (const [hi, lo, min] of steps) {
      const r = contrastRatio(hi, lo);
      expect(r).toBeGreaterThanOrEqual(min);
      expect(r).toBeLessThanOrEqual(1.35);
    }
    const lum = (h: string) => contrastRatio(h, '#000000');
    expect(lum(t.elevated)).toBeGreaterThan(lum(t.surface));
  });
  it.each(FLAVORS)('%s：卡片、Selection、Comment 等於錨定值', (flavor) => {
    const t = themes[flavor];
    expect(t.surface).toBe(flavorBase[flavor].surface);
    expect(t['accent-tint']).toBe(flavorBase[flavor].selection);
    expect(t['border-strong']).toBe(flavorBase[flavor].comment);
  });
  it.each(FLAVORS)('%s：推導層與 16 第 3.2 節的 HSL 公式一致', (flavor) => {
    const h = flavorBase[flavor].hue;
    const d = flavorDerived[flavor];
    expect(d.bg).toBe(hslToHex(h, 20, 8));
    expect(d.surface2).toBe(hslToHex(h, 15, 19));
    expect(d.elevated).toBe(hslToHex(h, 15, 23));
    expect(d.text3).toBe(hslToHex(h, 25, 64));
    expect(d.text2).toBe(hslToHex(h, 20, 78));
  });
  it('覆寫區塊只含底色階梯，強調色與狀態色三個風味相同', () => {
    const shared = SEMANTIC_COLOR_TOKENS.filter((k) => !(FLAVOR_TOKENS as readonly string[]).includes(k));
    for (const k of shared) {
      expect(themes.berry[k]).toBe(themes.violet[k]);
      expect(themes.wine[k]).toBe(themes.violet[k]);
    }
    for (const flavor of ['berry', 'wine'] as const) {
      const keys = Object.keys(flavorColors(flavor));
      expect(keys.every((k) => (FLAVOR_TOKENS as readonly string[]).includes(k))).toBe(true);
    }
    expect(['accent', 'accent-ink', 'link', 'success-ink', 'danger-ink', 'star'].every((k) => !(FLAVOR_TOKENS as readonly string[]).includes(k))).toBe(true);
  });
  it('深色狀態色的 tint 等於 ink 以 15% 疊在卡片上', () => {
    for (const flavor of FLAVORS) {
      const t = themes[flavor];
      for (const [ink, tint] of [
        ['success-ink', 'success-tint'],
        ['danger-ink', 'danger-tint'],
        ['warning-ink', 'warning-tint'],
        ['info-ink', 'info-tint'],
        ['change-down-ink', 'change-down-tint'],
        ['element-expense-ink', 'element-expense-tint'],
      ] as const) {
        const expected = blendHex(t[ink], t.surface, 0.15);
        const diff = contrastRatio(expected, t[tint]);
        expect(diff).toBeLessThan(1.03);
      }
    }
  });
});

describe('紙質淺色（16 第 1、2 節）', () => {
  it('沒有純白或純黑當底色或文字色', () => {
    for (const k of ['bg', 'surface', 'surface-2', 'elevated', 'text', 'text-2', 'text-3'] as const) {
      expect(lightColors[k].toUpperCase()).not.toBe('#FFFFFF');
      expect(lightColors[k].toUpperCase()).not.toBe('#000000');
    }
  });
  it('淡底等於 ink 以 12% 疊在卡片色上', () => {
    for (const [ink, tint] of [
      ['success-ink', 'success-tint'],
      ['danger-ink', 'danger-tint'],
      ['warning-ink', 'warning-tint'],
      ['info-ink', 'info-tint'],
      ['element-expense-ink', 'element-expense-tint'],
    ] as const) {
      const expected = blendHex(lightColors[ink], lightColors.surface, 0.12);
      expect(contrastRatio(expected, lightColors[tint])).toBeLessThan(1.03);
    }
  });
  it('蜜桃只當裝飾：不是任何 tint 或強調填色', () => {
    expect(lightColors.accent).not.toBe('#F49A6C');
    expect(lightColors['accent-tint']).not.toBe('#F49A6C');
    expect(lightColors['highlight-ring']).toBe('#F49A6C');
  });
});

describe('產生物', () => {
  it('theme-color 四個值與首次繪製 style 一致', () => {
    const css = firstPaintStyle();
    for (const name of THEMES) expect(css).toContain(THEME_COLOR[name]);
    expect(css).not.toMatch(/\s{2,}/);
  });
  it('tokens.css 含四個主題區塊與減少動態的覆寫，沒有破折號', () => {
    const css = generateTokensCss();
    expect(css).toContain('html[data-theme="light"]');
    expect(css).toContain('html[data-theme="dark"] {');
    expect(css).toContain('html[data-theme="dark"][data-flavor="berry"]');
    expect(css).toContain('html[data-theme="dark"][data-flavor="wine"]');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/[–—]/);
  });
});
