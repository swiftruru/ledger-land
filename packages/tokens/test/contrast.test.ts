// 16 第 6 節：對淺色與三個風味各跑一輪的對比度門檻，以及結構檢查
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_COLOR_TOKENS,
  componentThemes,
  DARK_SUCCESS_INK,
  darkAccent,
  darkColors,
  darkSuccessTint,
  FLAVOR_TOKENS,
  flavorBase,
  flavorColors,
  flavorDerived,
  FLAVORS,
  lightColors,
  night,
  paper,
  PAPER_PRIMARY_LEDGE,
  sceneThemes,
  SEMANTIC_COLOR_TOKENS,
  THEME_COLOR,
  themes,
  type ThemeColors,
  type ThemeName,
} from '../src/colors.ts';
import { blendHex, contrastRatio, deltaEOk, hexToOklab, hslToHex, mixOklab, oklabToHex, relativeLuminance, resolveColor } from '../src/contrast.ts';
import { firstPaintStyle, generateTokensCss, launchScreenStyle } from '../src/css.ts';

const THEMES: ThemeName[] = ['light', 'violet', 'berry', 'wine'];
const isHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v);
/** OKLCh 的色相（0 到 360）、彩度、兩個色相的夾角 */
const hueOf = (hex: string) => {
  const [, a, b] = hexToOklab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};
const chromaOf = (hex: string) => {
  const [, a, b] = hexToOklab(hex);
  return Math.hypot(a, b);
};
const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

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
    { name: 'focus 對 surface', fg: t.focus, bg: t.surface, min: 3 },
    { name: 'focus 對 elevated', fg: t.focus, bg: t.elevated, min: 3 },
    { name: 'selected 對 surface（開關開啟、已按下的外框）', fg: t.selected, bg: t.surface, min: 3 },
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
  it('覆寫區塊只含底色階梯與強調色組；文字、狀態色、星星與其他四個要素的墨色三個風味相同（2026-10-25 選項 B）', () => {
    const flavorTokens = FLAVOR_TOKENS as readonly string[];
    const shared = SEMANTIC_COLOR_TOKENS.filter((k) => !flavorTokens.includes(k));
    for (const k of shared) {
      expect(themes.berry[k]).toBe(themes.violet[k]);
      expect(themes.wine[k]).toBe(themes.violet[k]);
    }
    for (const flavor of ['berry', 'wine'] as const) {
      const keys = Object.keys(flavorColors(flavor));
      expect(keys.every((k) => flavorTokens.includes(k))).toBe(true);
    }
    const common = ['text', 'success-ink', 'danger-ink', 'warning-ink', 'info-ink', 'change-up-ink', 'change-down-ink', 'star'];
    const otherElements = ['element-asset-ink', 'element-liability-ink', 'element-equity-ink', 'element-revenue-ink'];
    expect([...common, ...otherElements].every((k) => !flavorTokens.includes(k))).toBe(true);
    // 強調色組與費用墨色隨風味（選項 B）；焦點框隨風味（M3 驗收第 2 輪）
    expect(['accent', 'accent-ink', 'accent-pressed', 'link', 'highlight-ring', 'element-expense-ink', 'focus'].every((k) => flavorTokens.includes(k))).toBe(
      true,
    );
  });
  it('夜空的強調色組維持色票的紫與亮紫、費用維持粉（選項 B 只改莓果與紅酒）', () => {
    const v = themes.violet;
    expect(v.accent).toBe(night.purple);
    expect(v['highlight-ring']).toBe(night.purple);
    for (const k of ['accent-ink', 'accent-pressed', 'link'] as const) expect(v[k]).toBe(night.purpleBright);
    expect(v['element-expense-ink']).toBe(night.pink);
    expect(sceneThemes.violet['scene-route-walked']).toBe(night.purpleBright);
  });
  it.each(['berry', 'wine'] as const)(
    '%s 的強調色和風味同一個色相家族（選項 B）：色相取註解色，填色 10 度內、墨色 20 度內；彩度夠高（主按鈕一眼看得到）',
    (flavor) => {
      const t = themes[flavor];
      const a = darkAccent(flavor);
      expect(t.accent).toBe(a.accent);
      expect(t['highlight-ring']).toBe(a.accent);
      for (const k of ['accent-ink', 'link'] as const) expect(t[k]).toBe(a.ink);
      expect(t['accent-pressed']).toBe(a.pressed);
      expect(sceneThemes[flavor]['scene-route-walked']).toBe(a.route);
      const h = hueOf(flavorBase[flavor].comment);
      expect(hueDiff(hueOf(t.accent), h)).toBeLessThanOrEqual(10);
      expect(hueDiff(hueOf(t['accent-ink']), h)).toBeLessThanOrEqual(20);
      // 和選取色（同一個色相來源）同一個家族；已走路線和墨色同色相
      expect(hueDiff(hueOf(t.accent), hueOf(t.selected))).toBeLessThanOrEqual(10);
      expect(hueDiff(hueOf(a.route), hueOf(a.ink))).toBeLessThanOrEqual(2);
      expect(chromaOf(t.accent)).toBeGreaterThanOrEqual(0.18);
      expect(chromaOf(t['accent-ink'])).toBeGreaterThanOrEqual(0.14);
      // 反例：原本三風味共用的紫離紅酒的註解色 80 度以上（這個檢查分得出「紫疊在酒紅上」）
      expect(hueDiff(hueOf(night.purple), hueOf(flavorBase.wine.comment))).toBeGreaterThan(60);
    },
  );
  // 選項 B：紅酒的強調色是覆盆子紅與粉，和 danger 的珊瑚色、原本的費用粉同一段色相，所以要量 OKLab 距離。門檻依專案已接受的配對定：
  // 深色的負債珊瑚對費用粉 0.112、紙質的強調赤陶對 danger 0.052（同一個畫面常出現的主按鈕對答錯要更遠，填色對 danger 取 0.14）。
  // 莓果的墨色對費用的亮紫是最小的一組（約 0.106）：兩者同亮度，只靠色相分開，日後調整莓果墨色不要往藍紫移
  it.each(FLAVORS)('%s：強調色不和狀態色、要素色撞色（填色對 danger 至少 0.14；填色與墨色對每一個狀態色、要素色與星星至少 0.10）', (flavor) => {
    const t = themes[flavor];
    const others = [
      'success-ink',
      'danger-ink',
      'warning-ink',
      'info-ink',
      'change-up-ink',
      'change-down-ink',
      'star',
      'element-asset-ink',
      'element-liability-ink',
      'element-equity-ink',
      'element-revenue-ink',
      'element-expense-ink',
    ] as const;
    expect(deltaEOk(t.accent, t['danger-ink'])).toBeGreaterThanOrEqual(0.14);
    for (const role of ['accent', 'accent-ink'] as const)
      for (const k of others) expect(deltaEOk(t[role], t[k]), `${flavor} 的 ${role} 對 ${k}`).toBeGreaterThanOrEqual(0.1);
  });
  it('撞色檢查分得出真的撞色：紅酒改用色票的紅（等於 danger）、紅酒的墨色配原本的費用粉，都會被擋下', () => {
    expect(deltaEOk(night.red, themes.wine['danger-ink'])).toBeLessThan(0.1);
    expect(deltaEOk(darkAccent('wine').ink, night.pink)).toBeLessThan(0.1);
    expect(deltaEOk('#FFFFFF', '#000000')).toBeCloseTo(1, 3);
  });
  it('深色答對的 tint 讀得出是綠色（M3 驗收第 2 輪）：OKLCh 色相 130 到 170 度、彩度至少 0.03，亮度隨各風味的卡片色', () => {
    const lchOf = (hex: string) => {
      const [L, a, b] = hexToOklab(hex);
      return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
    };
    for (const flavor of FLAVORS) {
      const t = themes[flavor];
      expect(t['success-tint']).toBe(darkSuccessTint(t.surface));
      const tint = lchOf(t['success-tint']);
      expect(tint.C).toBeGreaterThanOrEqual(0.03);
      expect(tint.h).toBeGreaterThanOrEqual(130);
      expect(tint.h).toBeLessThanOrEqual(170);
      // 亮度等於答對色以 16% 混進卡片色的亮度（OKLab）
      expect(tint.L).toBeCloseTo(hexToOklab(mixOklab(t['success-ink'], t.surface, 0.16))[0], 2);
      // 回饋面板標頭帶（22%、彩度 0.05）比選項底明顯一階，答對色在上面仍有 4.5:1
      const band = darkSuccessTint(t.surface, 0.22, 0.05);
      expect(contrastRatio(t['success-ink'], band)).toBeGreaterThanOrEqual(4.5);
      expect(lchOf(band).L).toBeGreaterThan(tint.L);
    }
    // 參照：直接以 OKLab 混 16% 在莓果與紅酒只剩灰或橄欖色（彩度不到 0.02），這就是改寫的原因
    for (const flavor of ['berry', 'wine'] as const) {
      const t = themes[flavor];
      expect(lchOf(mixOklab(t['success-ink'], t.surface, 0.16)).C).toBeLessThan(0.02);
    }
    // 不再要求三個風味各自不同：莓果與紅酒的卡片色亮度相同，得到同一個綠（帶入風味色相正是讓它變灰、變橄欖色的原因）
  });
  it('深色的答對色、權益與收入的墨色降過彩度（M3 驗收第 2 輪）；權益要素的 tint 仍是 green 的 15%', () => {
    const chroma = (hex: string) => Math.hypot(hexToOklab(hex)[1], hexToOklab(hex)[2]);
    for (const flavor of FLAVORS) {
      const t = themes[flavor];
      expect(t['success-ink']).toBe(DARK_SUCCESS_INK);
      expect(t['element-equity-ink']).toBe(DARK_SUCCESS_INK);
      expect(t['element-revenue-ink']).toBe(mixOklab(night.yellow, night.fg, 0.6));
      for (const k of ['success-ink', 'element-equity-ink', 'element-revenue-ink'] as const) {
        expect(chroma(t[k])).toBeLessThanOrEqual(0.12);
        // 名詞卡（surface）上的徽記圖示
        expect(contrastRatio(t[k], t.surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(t['element-equity-tint']).toBe(blendHex(night.green, t.surface, 0.15));
    }
    expect(chroma(night.green)).toBeGreaterThan(0.18);
  });
  it('深色的焦點框：夜空是 cyan；莓果與紅酒是帶風味色相的淡色（不是 cyan），對 bg、卡片、elevated 都有 3:1 以上', () => {
    expect(themes.violet.focus).toBe(night.cyan);
    for (const flavor of ['berry', 'wine'] as const) {
      const t = themes[flavor];
      expect(t.focus).not.toBe(night.cyan);
      for (const bg of [t.bg, t.surface, t.elevated, t['surface-2']]) expect(contrastRatio(t.focus, bg)).toBeGreaterThanOrEqual(3);
      const hue = (hex: string) => {
        const [, a, b] = hexToOklab(hex);
        return (Math.atan2(b, a) * 180) / Math.PI;
      };
      expect(Math.abs(hue(t.focus) - hue(flavorBase[flavor].comment))).toBeLessThan(5);
    }
  });
  it('深色狀態色的 tint 等於 ink 以 15% 疊在卡片上', () => {
    for (const flavor of FLAVORS) {
      const t = themes[flavor];
      for (const [ink, tint] of [
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
  it('啟動畫面的 style：只在 App 模式顯示、一律紙色底與淺色字（不分主題，06 第 2.4 節第 7 點）、離場與減少動態、沒有 vh 與安全區', () => {
    const css = launchScreenStyle();
    expect(css.startsWith('#ll-launch{display:none}')).toBe(true);
    expect(css).toContain(
      'html[data-display=app] #ll-launch{display:block;position:fixed;left:0;right:0;top:calc(0px - var(--ll-launch-top,0px));height:calc(100% + var(--ll-launch-top,0px));z-index:200',
    );
    expect(css).toContain(`background:${THEME_COLOR.light};color:${lightColors.text}`);
    for (const name of THEMES) if (name !== 'light') expect(css).not.toContain(THEME_COLOR[name]);
    expect(css).not.toContain('data-theme=dark');
    expect(css).not.toContain('prefers-color-scheme:dark');
    expect(css).toContain('#ll-launch[data-leave]{opacity:0;pointer-events:none}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){html[data-display=app] #ll-launch{transition:none}}');
    expect(css).toContain('html[data-motion=reduced] #ll-launch{transition:none}');
    expect(css).not.toMatch(/\d+(s?vh|dvh|lvh)\b/);
    expect(css).not.toContain('env(');
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

// ---- 站規 1.1.1、1.1.2：連結、按鈕、平面元件的 token（color-mix 換算成實際色後再算） ----

/** 某個主題的完整 token 表（語意加元件），給 resolveColor 查 var() */
const vars = (name: ThemeName): Record<string, string> => ({ ...themes[name], ...componentThemes[name] });
const color = (name: ThemeName, token: string): string => {
  const v = resolveColor(`var(--ll-${token})`, vars(name));
  if (v === null) throw new Error(`${name} 的 --ll-${token} 不是不透明色`);
  return v;
};

describe('mixOklab 與 resolveColor', () => {
  it('已知值：和自己混色不變、和白或黑混 0% 與 100% 等於端點', () => {
    expect(mixOklab('#9E4A25', '#9E4A25', 0.4)).toBe('#9E4A25');
    expect(mixOklab('#9E4A25', '#000000', 1)).toBe('#9E4A25');
    expect(mixOklab('#9E4A25', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(oklabToHex(hexToOklab('#1D5F8C'))).toBe('#1D5F8C');
  });
  it('已知值：黑白各半在 OKLab 是 L 0.5（sRGB #636363）', () => {
    expect(mixOklab('#000000', '#FFFFFF', 0.5)).toBe('#636363');
    expect(hexToOklab('#FFFFFF')[0]).toBeCloseTo(1, 4);
  });
  it('解析 var() 與巢狀 color-mix；含透明度的值回傳 null', () => {
    const v = { a: '#000000', b: 'var(--ll-a)', c: 'color-mix(in oklab, var(--ll-b) 50%, #FFFFFF)' };
    expect(resolveColor('var(--ll-c)', v)).toBe('#636363');
    expect(resolveColor('color-mix(in oklab, var(--ll-a) 30%, transparent)', v)).toBeNull();
    expect(resolveColor('rgb(0 0 0 / 0.4)', v)).toBeNull();
    expect(() => resolveColor('var(--ll-zzz)', v)).toThrow(/找不到 token/);
  });
  it('紙質主按鈕底邊 #6F341A：terracotta 以 70% 疊在黑上', () => {
    expect(blendHex(paper.terracotta, '#000000', 0.7)).toBe(PAPER_PRIMARY_LEDGE);
  });
});

describe.each(THEMES)('主題 %s 的元件 token（站規 1.1.2）', (name) => {
  const c = (token: string) => color(name, token);
  const pairs = [
    ['btn-primary-fg', 'btn-primary-bg', 4.5],
    ['btn-primary-fg', 'btn-primary-pressed', 4.5],
    ['btn-secondary-fg', 'btn-secondary-bg', 4.5],
    ['btn-secondary-fg', 'btn-secondary-pressed', 4.5],
    ['btn-danger-fg', 'btn-danger-bg', 4.5],
    ['btn-icon', 'btn-secondary-bg', 3],
    // 次要按鈕裡的圖示（深色是風味色相，M3 驗收第 5 輪），靜止與按下（已按下的切換）
    ['btn-secondary-icon', 'btn-secondary-bg', 3],
    ['btn-secondary-icon', 'btn-secondary-pressed', 3],
    // NavRow、NavCard 的圖示也用它（第 7 輪）：圖示方塊是 accent-tint，滑過與按下時是卡片色
    ['btn-secondary-icon', 'accent-tint', 3],
    ['btn-secondary-icon', 'surface', 3],
    ['btn-icon', 'chrome-bg', 3],
    ['btn-icon', 'chrome-pressed', 3],
    ['btn-secondary-fg', 'chrome-bg', 4.5],
    ['btn-secondary-fg', 'chrome-pressed', 4.5],
    // 次要按鈕外框對它所在的卡片與頁面底色（站規：守住 3:1）
    ['btn-secondary-border', 'surface', 3],
    ['btn-secondary-border', 'bg', 3],
    ['btn-disabled-fg', 'btn-disabled-bg', 3],
    ['link', 'surface', 4.5],
    ['link', 'surface-2', 4.5],
    ['link', 'bg', 4.5],
    ['link-hover', 'surface', 4.5],
    ['link-hover', 'surface-2', 4.5],
    ['link-hover', 'bg', 4.5],
    ['star-ink', 'star', 4.5],
    // 印章的勾號畫在 star-fill 上
    ['star-ink', 'star-fill', 4.5],
    // 列（NavRow、Disclosure、選單項目）按下的底上的標題與副標
    ['text', 'row-pressed', 7],
    ['text-2', 'row-pressed', 4.5],
  ] as const;
  it.each(pairs)('%s 對 %s 至少 %s:1', (fg, bg, min) => {
    expect(contrastRatio(c(fg), c(bg))).toBeGreaterThanOrEqual(min);
  });
  it('列按下的底和滑過的底（quiet-hover）分得開（M3 驗收第 2 輪：紙質原本兩者相同）', () => {
    expect(c('row-pressed')).not.toBe(c('quiet-hover'));
    expect(contrastRatio(c('row-pressed'), c('quiet-hover'))).toBeGreaterThanOrEqual(1.04);
  });
  it('主按鈕的底邊比面暗（立體感）', () => {
    expect(relativeLuminance(c('btn-primary-ledge'))).toBeLessThan(relativeLuminance(c('btn-primary-bg')));
    expect(relativeLuminance(c('btn-primary-ledge'))).toBeLessThan(relativeLuminance(c('btn-primary-pressed')));
  });
  // 站規 5.1 的通過條件「底邊一定比面暗」：四個主題的次要與危險按鈕都要（M3 驗收第 4 輪，規劃者定案 (a)：深色把面調亮、底邊調暗，
  // 不再用比面亮的外框色當底邊）。面和底邊至少差 1.3:1（危險 1.2:1）才看得出厚度；底邊在卡片與頁面底色上也要看得見
  it.each(['secondary', 'danger'] as const)('%s 按鈕的底邊比面暗、和面分得開', (v) => {
    const ledge = c(`btn-${v}-ledge`);
    const face = c(`btn-${v}-bg`);
    expect(relativeLuminance(ledge)).toBeLessThan(relativeLuminance(face));
    expect(contrastRatio(ledge, face)).toBeGreaterThanOrEqual(v === 'secondary' ? 1.3 : 1.2);
    expect(contrastRatio(ledge, c('surface'))).toBeGreaterThanOrEqual(1.3);
  });
  it('底邊在頁面底色上看得見（主按鈕與危險按鈕至少 1.4:1、次要至少 1.5:1）', () => {
    expect(contrastRatio(c('btn-primary-ledge'), c('bg'))).toBeGreaterThanOrEqual(1.4);
    expect(contrastRatio(c('btn-danger-ledge'), c('bg'))).toBeGreaterThanOrEqual(1.4);
    expect(contrastRatio(c('btn-secondary-ledge'), c('bg'))).toBeGreaterThanOrEqual(1.5);
  });
  it('按下的面和靜止的面分得開（次要與危險按下都比靜止暗）；按下時的字仍有 4.5:1', () => {
    expect(contrastRatio(c('btn-secondary-pressed'), c('btn-secondary-bg'))).toBeGreaterThanOrEqual(1.08);
    expect(contrastRatio(c('btn-danger-pressed'), c('btn-danger-bg'))).toBeGreaterThanOrEqual(1.08);
    expect(contrastRatio(c('btn-danger-fg'), c('btn-danger-pressed'))).toBeGreaterThanOrEqual(4.5);
    // 按下比靜止暗（紙質也是：accent-tint 比 surface 暗、珊瑚色 10% 的淡底比淡底暗）
    expect(relativeLuminance(c('btn-secondary-pressed'))).toBeLessThan(relativeLuminance(c('btn-secondary-bg')));
    expect(relativeLuminance(c('btn-danger-pressed'))).toBeLessThan(relativeLuminance(c('btn-danger-bg')));
  });
  it('選取色（開關開啟、已按下的外框）：對卡片 3:1；開關的圓鈕在開啟軌道上 4.5:1', () => {
    expect(contrastRatio(c('selected'), c('surface'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c('selected'), c('btn-secondary-pressed'))).toBeGreaterThanOrEqual(2);
    // 淺色的圓鈕是卡片色（白），深色是 btn-primary-fg（頁面底色）
    const knob = name === 'light' ? c('surface') : c('btn-primary-fg');
    expect(contrastRatio(knob, c('selected'))).toBeGreaterThanOrEqual(4.5);
  });
  // M3 驗收第 5 輪：深色的空進度條在卡片上只有 1.06 到 1.12:1。四個主題都要看得到一條有邊的軌道：軌道或外框對卡片至少 1.3
  // （淺色的軌道是 surface-2，靠 border 細框 1.37:1；深色另有門檻，見下面「深色 … 的星星、進度條與橫幅」）
  it('進度條的空軌道或外框對卡片至少 1.3:1', () => {
    const track = contrastRatio(c('progress-track'), c('surface'));
    const rim = contrastRatio(c('progress-rim'), c('surface'));
    expect(Math.max(track, rim)).toBeGreaterThanOrEqual(1.3);
  });
  it('停用文字的實際對比（寫回 16 第 6 節）', () => {
    const r = contrastRatio(c('btn-disabled-fg'), c('btn-disabled-bg'));
    // 紙質 4.85、夜空與莓果與紅酒見測試輸出；目標 4.5、最低 3
    console.info(`[tokens] ${name} btn-disabled-fg 對 btn-disabled-bg = ${r.toFixed(2)}`);
    expect(r).toBeGreaterThanOrEqual(3);
  });
});

describe.each(FLAVORS)('深色 %s 的星星、進度條與橫幅（M3 驗收第 1 輪）', (name) => {
  const c = (token: string) => color(name, token);
  it('進度條的填色對軌道（surface-2）至少 3:1；星星與填色是暖金（OKLCh 色相 70 到 95 度，不是檸檬黃或卡其）', () => {
    expect(contrastRatio(c('star-fill'), c('surface-2'))).toBeGreaterThanOrEqual(3);
    for (const token of ['star', 'star-fill']) {
      const [, a, b] = hexToOklab(c(token));
      const hue = (Math.atan2(b, a) * 180) / Math.PI;
      expect(hue).toBeGreaterThanOrEqual(70);
      expect(hue).toBeLessThanOrEqual(95);
    }
    // 來源色票的 yellow（檸檬黃）色相超過 100 度：確認這個檢查真的分得出來
    const [, ya, yb] = hexToOklab(night.yellow);
    expect((Math.atan2(yb, ya) * 180) / Math.PI).toBeGreaterThan(100);
  });
  // M3 驗收第 5 輪：軌道本身對卡片 1.3、外框 1.6（外框對軌道也要 1.3），填色對軌道 3:1
  it('空進度條的軌道與外框在卡片上看得見（M3 驗收第 5 輪）', () => {
    expect(contrastRatio(c('progress-track'), c('surface'))).toBeGreaterThanOrEqual(1.3);
    expect(contrastRatio(c('progress-rim'), c('surface'))).toBeGreaterThanOrEqual(1.6);
    expect(contrastRatio(c('progress-rim'), c('progress-track'))).toBeGreaterThanOrEqual(1.3);
    expect(contrastRatio(c('star-fill'), c('progress-track'))).toBeGreaterThanOrEqual(3);
  });
  it('橫幅的底是狀態色 8% 混進卡片色（info 是外框色 12%），標題 text、內文 text-2、圖示用狀態色（站規 1.20，M3 驗收第 1、4 輪）', () => {
    for (const kind of ['info', 'warning', 'success', 'danger'] as const) {
      // 第 4 輪：info 的青色 8% 讓夜空的橫幅變成冷灰板，改成各風味的外框色（comment）12%（01-core-base.css、14-core-nav.css 的 HintBar）
      const mix =
        kind === 'info'
          ? 'color-mix(in oklab, var(--ll-border-strong) 12%, var(--ll-surface))'
          : `color-mix(in oklab, var(--ll-${kind}-ink) 8%, var(--ll-surface))`;
      const face = resolveColor(mix, vars(name)) ?? '（不是不透明色）';
      expect(contrastRatio(c('text'), face)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(c('text-2'), face)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c(`${kind}-ink`), face)).toBeGreaterThanOrEqual(3);
      // 橫幅內文裡的文中連結
      expect(contrastRatio(c('link'), face)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('元件 token 的結構', () => {
  it('四個主題都有完整的元件 token，tokens.css 的淺色與深色共用區塊都寫了', () => {
    const css = generateTokensCss();
    for (const k of COMPONENT_COLOR_TOKENS) {
      for (const name of THEMES) expect(componentThemes[name][k]).toBeTruthy();
      expect(css.split(`--ll-${k}:`).length - 1).toBe(2);
    }
  });
  it('風味覆寫區塊不含任何元件 token（選項 A：引用底色階梯自動隨風味變）', () => {
    const css = generateTokensCss();
    for (const flavor of ['berry', 'wine'] as const) {
      const start = css.indexOf(`html[data-theme="dark"][data-flavor="${flavor}"]`);
      const block = css.slice(start, css.indexOf('}', start));
      for (const k of COMPONENT_COLOR_TOKENS) expect(block).not.toContain(`--ll-${k}:`);
    }
  });
  it('深色的主按鈕底邊與按下色隨風味變（帶入各自的底色）；強調色本身也隨風味（2026-10-25 選項 B）', () => {
    const ledges = FLAVORS.map((f) => color(f, 'btn-primary-ledge'));
    expect(new Set(ledges).size).toBe(3);
    expect(new Set(FLAVORS.map((f) => color(f, 'accent'))).size).toBe(3);
    expect(new Set(FLAVORS.map((f) => color(f, 'accent-ink'))).size).toBe(3);
  });
  it.each(FLAVORS)('%s：主按鈕按下不發白、焦點框在主按鈕面上看得見、強調填色和未選取的底分得開', (flavor) => {
    const c = (token: string) => color(flavor, token);
    // 深色的按下是提亮（按下色 85% 混頁面底色）：和靜止的面差 1.25:1 以內、色相差 3 度以內，看起來是同一顆按鈕沉下去，不是變成另一個淡色
    expect(contrastRatio(c('btn-primary-pressed'), c('btn-primary-bg'))).toBeLessThanOrEqual(1.25);
    expect(hueDiff(hueOf(c('btn-primary-pressed')), hueOf(c('btn-primary-bg')))).toBeLessThanOrEqual(3);
    // 焦點框以 offset 畫在頁面底色上（對 bg 的門檻在上面），另外和主按鈕的面也要分得開
    expect(contrastRatio(c('focus'), c('btn-primary-bg'))).toBeGreaterThanOrEqual(2);
    // 16 第 6 節表列的「選取對未選取，非文字」：選項的強調外框對卡片與 surface-2
    expect(contrastRatio(c('accent'), c('surface'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c('accent'), c('surface-2'))).toBeGreaterThanOrEqual(3);
  });
  it('地圖節點的底邊（node-ledge）：淺色等於次要按鈕的底邊；深色維持外框色，在路面與地景上至少 2.5:1（M3 驗收第 4 輪）', () => {
    expect(color('light', 'node-ledge')).toBe(color('light', 'btn-secondary-ledge'));
    for (const flavor of FLAVORS) {
      const ledge = color(flavor, 'node-ledge');
      expect(ledge).toBe(themes[flavor]['border-strong']);
      for (const k of ['scene-road', 'scene-plaza', 'scene-meadow', 'scene-sand', 'scene-field', 'scene-rock'] as const)
        expect(contrastRatio(ledge, sceneThemes[flavor][k])).toBeGreaterThanOrEqual(2.5);
    }
  });
  it('選取色：淺色等於強調色；深色的色相等於各風味的外框色（和分段控制同一個色相），三個風味各不相同', () => {
    expect(themes.light.selected).toBe(themes.light.accent);
    const hue = (hex: string) => {
      const [, a, b] = hexToOklab(hex);
      return (Math.atan2(b, a) * 180) / Math.PI;
    };
    for (const flavor of FLAVORS) expect(Math.abs(hue(themes[flavor].selected) - hue(flavorBase[flavor].comment))).toBeLessThan(3);
    expect(new Set(FLAVORS.map((f) => themes[f].selected)).size).toBe(3);
  });
  it('次要按鈕的圖示：淺色等於強調墨色；深色和次要按鈕的面同一個色相（相差 8 度內），和強調墨色也是同一個色相家族（20 度內，不再有第三種色相）', () => {
    expect(color('light', 'btn-secondary-icon')).toBe(themes.light['accent-ink']);
    for (const flavor of FLAVORS) {
      expect(hueDiff(hueOf(color(flavor, 'btn-secondary-icon')), hueOf(color(flavor, 'btn-secondary-bg')))).toBeLessThan(8);
      // 2026-10-25 選項 B 之前，莓果與紅酒的強調墨色是亮紫，這裡要求「和強調墨色相差 25 度以上」；現在強調色也隨風味，改成同一個家族
      expect(hueDiff(hueOf(color(flavor, 'btn-secondary-icon')), hueOf(themes[flavor]['accent-ink']))).toBeLessThanOrEqual(20);
    }
  });
  it('連結等於主題的強調墨色；焦點框維持冷色', () => {
    for (const name of THEMES) expect(themes[name].link).toBe(themes[name]['accent-ink']);
    expect(lightColors.focus).toBe(paper.sky);
    expect(lightColors['info-ink']).toBe(paper.sky);
  });
  it('尺寸 token：按鈕三種面高、唯一的立體厚度 4px、寬版 1040px', () => {
    const css = generateTokensCss();
    for (const line of [
      '--ll-btn-h-sm: 44px',
      '--ll-btn-h-md: 48px',
      '--ll-btn-h-lg: 56px',
      '--ll-btn-depth: 4px',
      '--ll-navrow-h: 56px',
      '--ll-progress-h-sm: 6px',
      '--ll-progress-h-md: 10px',
      '--ll-layout-wide: 1040px',
    ])
      expect(css).toContain(line);
  });
});
