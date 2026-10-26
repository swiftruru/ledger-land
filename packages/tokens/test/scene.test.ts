// 圖規第 5 節：場景 tokens 的對比門檻（四個主題都要成立）與產生物的結構
import { describe, expect, it } from 'vitest';
import {
  DARK_GROUND,
  FLAVORS,
  GRASS_TAME,
  NIGHT_SAND,
  SCENE_COLOR_TOKENS,
  SCENE_TERRAIN_TOKENS,
  darkSceneColors,
  flavorBase,
  flavorDerived,
  lightnessOf,
  night,
  sceneThemes,
  themes,
  type ThemeName,
} from '../src/colors.ts';
import { blendHex, contrastRatio, hexToOklab } from '../src/contrast.ts';
import { generateTokensCss } from '../src/css.ts';

const THEMES: ThemeName[] = ['light', 'violet', 'berry', 'wine'];
/** OKLCh 的色相（0 到 360）、彩度、兩個色相的夾角 */
const hue = (hex: string) => {
  const [, a, b] = hexToOklab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};
const chroma = (hex: string) => {
  const [, a, b] = hexToOklab(hex);
  return Math.hypot(a, b);
};
const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe.each(THEMES)('主題 %s 的場景 tokens（圖規第 5 節）', (name) => {
  const s = sceneThemes[name];
  const t = themes[name];
  it('全部是六位 hex（在 TS 算好，CSS 裡沒有 color-mix）', () => {
    for (const k of SCENE_COLOR_TOKENS) expect(s[k]).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('未走圓點對路面至少 3:1', () => {
    expect(contrastRatio(s['scene-route-ahead'], s['scene-road'])).toBeGreaterThanOrEqual(3);
  });
  it('已走實線對路面至少 4.5:1', () => {
    expect(contrastRatio(s['scene-route-walked'], s['scene-road'])).toBeGreaterThanOrEqual(4.5);
  });
  // 路線經過橋、拱門下與海峽時，旁邊是地景或海（2026-10-25 選項 B 起各風味的路線色不同，每一種都要量）
  it.each(SCENE_TERRAIN_TOKENS)('已走實線對 %s 至少 3:1', (k) => {
    expect(contrastRatio(s['scene-route-walked'], s[k])).toBeGreaterThanOrEqual(3);
  });
  it('已走實線和未走圓點分得開（至少 1.25:1；深色的未走圓點是 text-3，和風味同色相）', () => {
    expect(contrastRatio(s['scene-route-walked'], s['scene-route-ahead'])).toBeGreaterThanOrEqual(1.25);
  });
  // 目前關卡：節點外面是 4px 淡底（accent-tint）加 2px 強調色外圈（08-map-components.css）。外圈對路面 3:1；
  // 對淡底的亮度比在莓果與紅酒只有 2.8（夜空 3.17），外圈是高彩度的強調色、和淡底的色差很大，看圖清楚，所以接受 2.5（16 第 6 節）
  it('目前關卡的外圈（accent）對路面至少 3:1、對內圈的淡底（accent-tint）至少 2.5:1', () => {
    expect(contrastRatio(t.accent, s['scene-road'])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.accent, t['accent-tint'])).toBeGreaterThanOrEqual(2.5);
  });
  it.each(SCENE_TERRAIN_TOKENS)('路邊對 %s 至少 1.2:1', (k) => {
    expect(contrastRatio(s['scene-road-edge'], s[k])).toBeGreaterThanOrEqual(1.2);
  });
  it.each(SCENE_TERRAIN_TOKENS)('%s 對 bg 在 1.1 到 1.45 之間（大面積地景不比卡片搶眼）', (k) => {
    const r = contrastRatio(s[k], t.bg);
    expect(r).toBeGreaterThanOrEqual(1.1);
    expect(r).toBeLessThanOrEqual(1.45);
  });
  it.each(SCENE_TERRAIN_TOKENS)('地圖卡片（scene-card）對 %s 至少 1.25:1：章節牌、紙籤、海峽說明卡與星星籤像立在地上的實物，不像地上的洞', (k) => {
    expect(contrastRatio(s['scene-card'], s[k])).toBeGreaterThanOrEqual(1.25);
  });
  it.each(SCENE_TERRAIN_TOKENS)(
    '章末拱門的石材（scene-arch-stone）對 %s 至少 2.5:1：拱門要是有實物感的終點門，不是淡掉的灰色馬蹄鐵（第 3 輪看圖驗收）',
    (k) => {
      expect(contrastRatio(s['scene-arch-stone'], s[k])).toBeGreaterThanOrEqual(2.5);
    },
  );
  it('拱門的描線與石縫、頂面高光對石材至少 1.6:1（描線比石材暗、高光比石材亮）', () => {
    const lum = (h: string) => contrastRatio(h, '#000000');
    expect(contrastRatio(s['scene-arch-line'], s['scene-arch-stone'])).toBeGreaterThanOrEqual(1.6);
    expect(contrastRatio(s['scene-arch-crest'], s['scene-arch-stone'])).toBeGreaterThanOrEqual(1.6);
    expect(lum(s['scene-arch-line'])).toBeLessThan(lum(s['scene-arch-stone']));
    expect(lum(s['scene-arch-crest'])).toBeGreaterThan(lum(s['scene-arch-stone']));
  });
  it('地圖卡片上的文字：text、text-2 與精通的 warning-ink 至少 4.5:1；「完成」淺色用 accent-ink、深色用 success-ink，也至少 4.5:1', () => {
    for (const k of ['text', 'text-2', 'warning-ink'] as const) expect(contrastRatio(t[k], s['scene-card'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(name === 'light' ? t['accent-ink'] : t['success-ink'], s['scene-card'])).toBeGreaterThanOrEqual(4.5);
  });
  it('不借用會計要素的語意色與 highlight-ring', () => {
    const forbidden = new Set([
      t['element-asset-tint'],
      t['element-liability-tint'],
      t['element-equity-tint'],
      t['element-revenue-tint'],
      t['element-expense-tint'],
      t['highlight-ring'],
    ]);
    for (const k of SCENE_TERRAIN_TOKENS) expect(forbidden.has(s[k])).toBe(false);
  });
});

describe('深色場景 tokens 的公式', () => {
  it.each(FLAVORS)(
    '%s：物件是 surface 加強調色（木頭再混前景色 20%）、路面是 elevated、浪花線是青混前景色 40% 以 30% 疊在 bg 上、描線是 bg 加前景色 24%',
    (f) => {
      const d = flavorDerived[f];
      const s = darkSceneColors(f);
      expect(s['scene-wood']).toBe(blendHex(night.fg, blendHex(night.orange, flavorBase[f].surface, 0.22), 0.2));
      expect(s['scene-road']).toBe(d.elevated);
      expect(s['scene-road-edge']).toBe(blendHex(night.fg, d.elevated, 0.12));
      expect(s['scene-route-ahead']).toBe(d.text3);
      expect(s['scene-foam']).toBe(blendHex(blendHex(night.cyan, night.fg, 0.4), d.bg, 0.3));
      expect(s['scene-line']).toBe(blendHex(night.fg, d.bg, 0.24));
    },
  );
  // 第 4 輪看圖驗收：浪花線是莓果與紅酒畫面上唯一的冷青色（彩度 0.04）、紅酒的村落草地混成橄欖色、深色海峽的棧橋讀不出是橋
  it.each(FLAVORS)('%s：浪花線低彩度（OKLab 0.025 以下），不是畫面上唯一一塊冷青色', (f) => {
    const [, a, b] = hexToOklab(darkSceneColors(f)['scene-foam']);
    expect(Math.hypot(a, b)).toBeLessThanOrEqual(0.025);
  });
  it.each(FLAVORS)('%s：草地（葉色 30% 混進沙地，場景的夜間草地）和沙地的色相差 25 度以內或彩度 0.015 以下：不是橄欖色的污漬', (f) => {
    const s = darkSceneColors(f);
    const [L1, a1, b1] = hexToOklab(s['scene-leaf']);
    const [L2, a2, b2] = hexToOklab(s['scene-sand']);
    const lawn = [L1 * 0.3 + L2 * 0.7, a1 * 0.3 + a2 * 0.7, b1 * 0.3 + b2 * 0.7] as const;
    const hue = (a: number, b: number) => (Math.atan2(b, a) * 180) / Math.PI;
    const chroma = Math.hypot(lawn[1], lawn[2]);
    const dh = Math.abs(((hue(lawn[1], lawn[2]) - hue(a2, b2) + 540) % 360) - 180);
    expect(chroma <= 0.015 || dh <= 25).toBe(true);
  });
  it.each(FLAVORS)('%s：棧橋的木頭對路面至少 2:1、木板線（描線）對木頭至少 1.5:1', (f) => {
    const s = darkSceneColors(f);
    expect(contrastRatio(s['scene-wood'], s['scene-road'])).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(s['scene-line'], s['scene-wood'])).toBeGreaterThanOrEqual(1.5);
  });
  // 第 5 輪看圖驗收：石材加前景色 38% 之後彩度只剩 0.01（紅酒 #837978、莓果 #807A7F），在暖色地景上仍像金屬馬蹄磁鐵
  it.each(FLAVORS)('%s：章末拱門的石材與描線帶那個風味地面的色相（彩度 0.02 以上、和廣場地景的色相差 30 度以內），亮度和廣場加前景色 38% 與 12% 相同', (f) => {
    const s = darkSceneColors(f);
    const ground = hue(s['scene-plaza']);
    for (const k of ['scene-arch-stone', 'scene-arch-line'] as const) {
      expect(chroma(s[k])).toBeGreaterThanOrEqual(0.02);
      expect(hueDiff(hue(s[k]), ground)).toBeLessThanOrEqual(30);
    }
    expect(Math.abs(hexToOklab(s['scene-arch-stone'])[0] - hexToOklab(blendHex(night.fg, s['scene-plaza'], 0.38))[0])).toBeLessThan(0.005);
    expect(Math.abs(hexToOklab(s['scene-arch-line'])[0] - hexToOklab(blendHex(night.fg, s['scene-plaza'], 0.12))[0])).toBeLessThan(0.005);
  });
  // 第 5 輪看圖驗收：紅酒的草地 #303026 是橄欖色的污漬，第 10 章兩翼整片 #2B3327 的綠灰（莓果也有）
  it.each(['berry', 'wine'] as const)(
    '%s：大面積的陸地（每一種陸地地景）和風味 bg 的色相差 60 度以內，或彩度 0.015 以下；草地不是 OKLCh 色相 145 度以下的黃綠或橄欖色',
    (f) => {
      const s = darkSceneColors(f);
      const bg = hue(flavorDerived[f].bg);
      const bad = SCENE_TERRAIN_TOKENS.filter((t) => t !== 'scene-sea' && t !== 'scene-sea-deep').filter(
        (k) => hueDiff(hue(s[k]), bg) > 60 && chroma(s[k]) > 0.015,
      );
      expect(bad).toEqual([]);
      expect(hue(s['scene-meadow'])).toBeGreaterThanOrEqual(145);
      // 第 6 輪看圖驗收：第 10 章的底色（兩翼各約 400px 寬）是地面的深一階，不是草地：和風味 bg 同色相（30 度以內）、比岩地與廣場暗
      expect(hueDiff(hue(s['scene-meadow-deep']), bg)).toBeLessThanOrEqual(30);
      expect(lightnessOf(s['scene-meadow-deep'])).toBeLessThan(Math.min(lightnessOf(s['scene-rock']), lightnessOf(s['scene-plaza'])));
    },
  );
  // 第 2 輪看圖驗收：陸地與海的亮度幾乎相同（violet 的沙 L* 14.5、海 15.3），海岸只靠 1px 青線分辨，大畫面是一片暗泥
  it.each(FLAVORS)('%s：地景的 L* 是 bg 的 L* 加 DARK_GROUND 的值（hex 取整，誤差 0.6）；每塊陸地比海與深海亮 8 以上', (f) => {
    const s = darkSceneColors(f);
    const base = lightnessOf(flavorDerived[f].bg);
    // 莓果與紅酒的第 10 章底色是地面的深一階（GRASS_TAME.deepL）；夜空的沙地是 NIGHT_SAND.dl（第 8 輪看圖驗收）
    const dl = (k: (typeof SCENE_TERRAIN_TOKENS)[number]) =>
      k === 'scene-meadow-deep' && GRASS_TAME.flavors.includes(f) ? GRASS_TAME.deepL : k === 'scene-sand' && f === 'violet' ? NIGHT_SAND.dl : DARK_GROUND[k][3];
    for (const k of SCENE_TERRAIN_TOKENS) expect(Math.abs(lightnessOf(s[k]) - base - dl(k))).toBeLessThan(0.6);
    const lands = SCENE_TERRAIN_TOKENS.filter((k) => k !== 'scene-sea' && k !== 'scene-sea-deep');
    for (const k of lands) for (const w of ['scene-sea', 'scene-sea-deep'] as const) expect(lightnessOf(s[k]) - lightnessOf(s[w])).toBeGreaterThanOrEqual(8);
  });
  it.each(FLAVORS)('%s：浪花線對海與每塊陸地都至少 1.6:1（海岸線看得出來）', (f) => {
    const s = darkSceneColors(f);
    for (const k of SCENE_TERRAIN_TOKENS) expect(contrastRatio(s['scene-foam'], s[k])).toBeGreaterThanOrEqual(1.6);
  });
  it.each(FLAVORS)('%s：地景的彩度低（OKLab 0.045 以下）：夜色的地面，不會整片偏粉紅或螢光', (f) => {
    const s = darkSceneColors(f);
    for (const k of SCENE_TERRAIN_TOKENS) {
      const [, a, b] = hexToOklab(s[k]);
      expect(Math.hypot(a, b)).toBeLessThanOrEqual(0.045);
    }
  });
  // 第 7 輪看圖驗收：夜空延伸區四座島的沙岸是灰褐紫（色相 322 度），墊在章節牌下面，和深藍的海、深綠的草地放在一起像污漬
  it('夜空的沙地是冷的藍灰（OKLab 色相 235 到 275 度、彩度 0.015 到 0.03），不是灰褐紫；地圖卡片仍比它亮 1.3 倍以上；拱門不跟著變', () => {
    const s = darkSceneColors('violet');
    expect(hue(s['scene-sand'])).toBeGreaterThanOrEqual(235);
    expect(hue(s['scene-sand'])).toBeLessThanOrEqual(275);
    expect(chroma(s['scene-sand'])).toBeGreaterThanOrEqual(0.015);
    expect(chroma(s['scene-sand'])).toBeLessThanOrEqual(0.03);
    expect(contrastRatio(s['scene-card'], s['scene-sand'])).toBeGreaterThanOrEqual(1.3);
    // 拱門的色相是「原本的沙地」與廣場的中間（夜空約 307 度，偏廣場的藍紫），沙地改色不影響
    expect(hueDiff(hue(s['scene-arch-stone']), 307)).toBeLessThan(3);
  });
  // 第 8 輪看圖驗收：沙地 #27303A 和島上的草地亮度幾乎相同（OKLab 距離 0.021），延伸島像一整塊深石板，草地的邊在很多螢幕上消失。
  // 審查建議距離 0.04，但那要沙地對 bg 1.54（超過地景 1.45 的上限，14 的決定），所以在上限內取最亮、色相最開的一階
  it('夜空的沙地和草地分得開：OKLab 距離至少 0.028、沙地比草地亮；地圖卡片的 OKLab 亮度比沙地高至少 0.025', () => {
    const s = darkSceneColors('violet');
    const [Ls, as, bs] = hexToOklab(s['scene-sand']);
    const [Lm, am, bm] = hexToOklab(s['scene-meadow']);
    expect(Math.hypot(Ls - Lm, as - am, bs - bm)).toBeGreaterThanOrEqual(0.028);
    expect(Ls).toBeGreaterThan(Lm);
    expect(hexToOklab(s['scene-card'])[0] - Ls).toBeGreaterThanOrEqual(0.025);
  });
  it('海一律偏藍（OKLab 色相 220 到 280 度），三個風味的陸地色相不同（地面跟著風味變）', () => {
    const hue = (hex: string) => {
      const [, a, b] = hexToOklab(hex);
      return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    };
    for (const f of FLAVORS) {
      const h = hue(darkSceneColors(f)['scene-sea']);
      expect(h).toBeGreaterThanOrEqual(220);
      expect(h).toBeLessThanOrEqual(280);
    }
    const plaza = FLAVORS.map((f) => darkSceneColors(f)['scene-plaza']);
    expect(new Set(plaza).size).toBe(3);
  });
});

describe('場景 tokens 寫進 tokens.css', () => {
  const css = generateTokensCss();
  it('淺色、深色共用、berry、wine 四個區塊各寫一次', () => {
    for (const k of SCENE_COLOR_TOKENS) expect(css.split(`--ll-${k}:`).length - 1).toBe(4);
  });
  it.each(['berry', 'wine'] as const)('%s 的覆寫區塊是那個風味自己的場景色', (f) => {
    const start = css.indexOf(`html[data-theme="dark"][data-flavor="${f}"]`);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain(`--ll-scene-sea: ${darkSceneColors(f)['scene-sea']};`);
  });
});
