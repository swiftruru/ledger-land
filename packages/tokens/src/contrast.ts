// WCAG 2.x 相對亮度與對比度（sRGB）；給 test/contrast.test.ts 與日後的圖表色票使用。純 TypeScript。

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`不是六位 hex 色碼：${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL（0 到 360、0 到 100、0 到 100）轉 hex，用來驗證 16 第 3.2 節的推導公式 */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** 把前景以 alpha 疊在背景上（sRGB 線性混色，16 第 2.2 節的淡底算法） */
export function blendHex(fg: string, bg: string, alpha: number): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  const out = f.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

// ---- OKLab 混色與 token 值的換算（站規 1.1.2）：tokens.css 的元件 token 用 color-mix(in oklab, …)，測試換算成實際色後再算對比 ----

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB hex 轉 OKLab（L、a、b） */
export function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab 轉 sRGB hex（超出色域時逐通道夾在 0 到 1） */
export function oklabToHex([L, a, b]: readonly [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const hex = rgb.map((c) =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase(),
  );
  return `#${hex.join('')}`;
}

/**
 * OKLab 的歐氏距離（感知上的色差；0 是同一色，0.02 以下肉眼幾乎分不出）。強調色和狀態色、要素色的撞色檢查用
 * （test/contrast.test.ts；2026-10-25 選項 B：填色對 danger 0.14 以上、填色與墨色對每一個狀態色與要素色 0.10 以上）
 */
export function deltaEOk(a: string, b: string): number {
  const A = hexToOklab(a);
  const B = hexToOklab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/** CSS 的 color-mix(in oklab, a p, b)：p 是 a 的比例（0 到 1） */
export function mixOklab(a: string, b: string, p: number): string {
  const A = hexToOklab(a);
  const B = hexToOklab(b);
  return oklabToHex([A[0] * p + B[0] * (1 - p), A[1] * p + B[1] * (1 - p), A[2] * p + B[2] * (1 - p)]);
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * 把 token 值換算成不透明的 hex：支援 #RRGGBB、var(--ll-x)（從 vars 查）、color-mix(in oklab, X p%, Y)。
 * 含透明度的值（rgb(… / a)、transparent，或和 transparent 混色）回傳 null：那些不是拿來算文字對比的顏色。
 */
export function resolveColor(value: string, vars: Readonly<Record<string, string>>, depth = 0): string | null {
  if (depth > 16) throw new Error(`token 循環引用：${value}`);
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  const ref = /^var\(--ll-([a-z0-9-]+)\)$/i.exec(v);
  if (ref) {
    const next = vars[ref[1]!];
    if (next === undefined) throw new Error(`找不到 token：--ll-${ref[1]}`);
    return resolveColor(next, vars, depth + 1);
  }
  const mix = /^color-mix\(in oklab,\s*(.+)\)$/i.exec(v);
  if (mix) {
    const [first, second] = splitTopLevel(mix[1]!);
    const pm = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(first!);
    if (!pm || second === undefined) throw new Error(`看不懂的 color-mix：${v}`);
    const a = resolveColor(pm[1]!, vars, depth + 1);
    const b = resolveColor(second, vars, depth + 1);
    if (a === null || b === null) return null;
    return mixOklab(a, b, Number(pm[2]) / 100);
  }
  return null;
}
