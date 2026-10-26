// 由 TypeScript 原始檔產生 CSS 變數檔與殼層要用的片段（07 第 2.1 節、06 第 2.3 節、16 第 7 節）。純 TypeScript，不碰 DOM。
import {
  COMPONENT_COLOR_TOKENS,
  FLAVOR_TOKENS,
  SCENE_COLOR_TOKENS,
  SEMANTIC_COLOR_TOKENS,
  THEME_COLOR,
  darkColors,
  darkComponentColors,
  darkSceneColors,
  flavorBase,
  flavorColors,
  flavorDerived,
  lightColors,
  lightComponentColors,
  lightSceneColors,
  type Flavor,
} from './colors.ts';
import { BASE_FONT_PX, breakpoints, control, fontFamily, motion, radius, rem, space, tabbar, type, typeDisplay, z, TARGET_MIN_PX } from './scale.ts';

const line = (name: string, value: string) => `  --ll-${name}: ${value};`;

function colorBlock(selector: string, tokens: readonly string[], values: Record<string, string>, extra: string[] = []): string {
  return [`${selector} {`, ...extra, ...tokens.map((t) => line(t, values[t]!)), '}'].join('\n');
}

/** 完整的 tokens.css */
export function generateTokensCss(): string {
  const parts: string[] = [];
  parts.push('/* 由 packages/tokens 產生，不要手改；來源是 packages/tokens/src（16 主題、07 設計系統）。執行 pnpm tokens:build 重新產生。 */');
  // 淺色：:root 也放淺色，是 boot 腳本寫入 data-theme 之前的預設
  // 元件 token（站規 1.1.2）接在語意 token 後面；深色只寫在共用區塊，引用底色階梯的值隨風味自動變，風味覆寫區塊不加
  // 場景 token（圖規第 5 節，地圖組）接在最後；深色的值隨風味不同（在這裡算好），所以 berry 與 wine 的覆寫區塊也各寫一組
  const withComponents = [...SEMANTIC_COLOR_TOKENS, ...COMPONENT_COLOR_TOKENS, ...SCENE_COLOR_TOKENS];
  parts.push(
    colorBlock(':root,\nhtml[data-theme="light"]', withComponents, { ...lightColors, ...lightComponentColors, ...lightSceneColors }, [
      '  color-scheme: light;',
    ]),
  );
  // 深色：html[data-theme="dark"] 放 violet 的全部值；berry 與 wine 只覆寫底色階梯（與場景色）
  parts.push(
    colorBlock('html[data-theme="dark"]', withComponents, { ...darkColors('violet'), ...darkComponentColors, ...darkSceneColors('violet') }, [
      '  color-scheme: dark;',
    ]),
  );
  for (const flavor of ['berry', 'wine'] as const) {
    parts.push(
      colorBlock(`html[data-theme="dark"][data-flavor="${flavor}"]`, [...FLAVOR_TOKENS, ...SCENE_COLOR_TOKENS], {
        ...flavorColors(flavor),
        ...darkSceneColors(flavor),
      }),
    );
  }
  // 與主題無關的 token 只寫在 :root（07 第 6.2 節：寫在主題區塊裡會讓 @supports 與減少動態的覆寫失效）
  const root: string[] = [':root {'];
  root.push(line('font-zh', fontFamily.zh), line('font-en', fontFamily.en), line('font-num', fontFamily.num), line('font-mono', fontFamily.mono));
  for (const [name, t] of Object.entries(type)) {
    root.push(line(`type-${name}-size`, rem(t.size)), line(`type-${name}-line`, rem(t.lineHeight)), line(`type-${name}-weight`, String(t.weight)));
  }
  root.push(
    line('type-display-size', typeDisplay.size),
    line('type-display-line', typeDisplay.lineHeight),
    line('type-display-weight', String(typeDisplay.weight)),
  );
  for (const [k, v] of Object.entries(space)) root.push(line(`space-${k}`, `${v}px`));
  root.push(line('target-min', `${TARGET_MIN_PX}px`));
  for (const [k, v] of Object.entries(control)) root.push(line(k, `${v}px`));
  for (const [k, v] of Object.entries(radius)) root.push(line(`radius-${k}`, `${v}px`));
  for (const [k, v] of Object.entries(z)) root.push(line(`z-${k}`, String(v)));
  root.push(
    line('tabbar-h', `${tabbar.heightPx}px`),
    line('tabbar-max-w', `${tabbar.maxWidthPx}px`),
    line('tabbar-inset', `${tabbar.sideInsetPx}px`),
    line('tabbar-rail-w', `${tabbar.railWidthPx}px`),
  );
  for (const [k, v] of Object.entries(motion.duration)) root.push(line(`dur-${k}`, v.normal));
  root.push(line('lift-lag', motion.liftLag.normal));
  for (const [k, v] of Object.entries(motion.ease)) root.push(line(`ease-${k}`, v));
  root.push(
    line('ease-spring-snappy', motion.spring.snappy.fallback),
    line('ease-spring-gentle', motion.spring.gentle.fallback),
    line('ease-lift', motion.spring.lift.fallback),
  );
  // 外觀設定的深色風味色票（16 第 7 節）：每種風味的底色與標誌色，在任何主題都一樣，所以寫在 :root（設定頁不必 import 色彩常數）
  for (const flavor of ['violet', 'berry', 'wine'] as const) {
    root.push(line(`swatch-${flavor}-bg`, flavorDerived[flavor].bg), line(`swatch-${flavor}-mark`, flavorBase[flavor].comment));
  }
  root.push('}');
  parts.push(root.join('\n'));
  parts.push(
    [
      '@supports (transition-timing-function: linear(0, 1)) {',
      '  :root {',
      `    --ll-ease-spring-snappy: ${motion.spring.snappy.linear};`,
      `    --ll-ease-spring-gentle: ${motion.spring.gentle.linear};`,
      `    --ll-ease-lift: ${motion.spring.lift.linear};`,
      '  }',
      '}',
    ].join('\n'),
  );
  const reduced = Object.entries(motion.duration)
    .map(([k, v]) => `--ll-dur-${k}: ${v.reduced};`)
    .concat([`--ll-lift-lag: ${motion.liftLag.reduced};`, '--ll-ease-standard: linear;', '--ll-ease-enter: linear;', '--ll-ease-exit: linear;'])
    .join(' ');
  parts.push(`@media (prefers-reduced-motion: reduce) {\n  :root { ${reduced} }\n}`);
  parts.push(`html[data-motion="reduced"] { ${reduced} }`);
  parts.push(
    `:lang(zh-TW) { font-family: var(--ll-font-zh); }\n:lang(en) { font-family: var(--ll-font-en); }\n.ll-num { font-family: var(--ll-font-num); font-variant-numeric: tabular-nums lining-nums; }`,
  );
  return parts.join('\n\n') + '\n';
}

/** 殼層 head 裡首次繪製背景色的 <style>（06 第 2.3 節）：內容改變時 CSP 雜湊跟著重算 */
export function firstPaintStyle(): string {
  const dark = (flavor: Flavor) => THEME_COLOR[flavor];
  return [
    `html,body{background:${THEME_COLOR.light}}`,
    `@media (prefers-color-scheme:dark){html,body{background:${dark('violet')}}}`,
    `html[data-theme=light],html[data-theme=light] body{background:${THEME_COLOR.light}}`,
    `html[data-theme=dark],html[data-theme=dark] body{background:${dark('violet')}}`,
    `html[data-theme=dark][data-flavor=berry],html[data-theme=dark][data-flavor=berry] body{background:${dark('berry')}}`,
    `html[data-theme=dark][data-flavor=wine],html[data-theme=dark][data-flavor=wine] body{background:${dark('wine')}}`,
  ].join('');
}

export const BREAKPOINT_QUERIES = {
  medium: `(min-width: ${breakpoints.medium}px)`,
  expanded: `(min-width: ${breakpoints.expanded}px)`,
  wide: `(min-width: ${breakpoints.wide}px)`,
} as const;

export { BASE_FONT_PX };
