// 幕後頁的技術棧（02 第 1.1 節的 /credits/）：網站真的在用的東西，每一個節點有分層、版本（建置時從套件清單抄，stack-versions.config.ts）、
// 一句角色說明（字串在 StackExplorer 的 useStackLabels）與「搭配」的節點。純資料，不碰 React；單元測試檢查 related 都存在、版本 key 都有。
// 不列還沒裝的東西（拖放的 dnd-kit 只在規劃裡）。深色三風味只寫夜空、莓果、紅酒，不提色票的來源。

export type StackLayer = 'ui' | 'app' | 'data' | 'build' | 'platform' | 'quality';

export interface StackNode {
  readonly id: string;
  readonly layer: StackLayer;
  /** 專有名詞，不翻譯 */
  readonly name: string;
  /** __LL_STACK_VERSIONS__ 的 key；沒有版本的節點（workspace 套件、規則、服務）省略 */
  readonly version?: string;
  /** 搭配的節點 id */
  readonly related: readonly string[];
  /** 這個節點的面板裡放的彩蛋小工具 */
  readonly egg?: 'flavours' | 'offline';
}

export const STACK_LAYERS: readonly StackLayer[] = ['ui', 'app', 'data', 'build', 'platform', 'quality'];

export const STACK_NODES: readonly StackNode[] = [
  { id: 'react', layer: 'ui', name: 'React', version: 'react', related: ['router', 'lingui', 'web-ui', 'zustand'] },
  { id: 'web-ui', layer: 'ui', name: 'web-ui', related: ['react', 'tokens', 'icons'] },
  { id: 'tokens', layer: 'ui', name: 'tokens', related: ['web-ui', 'lightningcss', 'fonts'], egg: 'flavours' },
  { id: 'lingui', layer: 'ui', name: 'Lingui', version: '@lingui/core', related: ['react', 'router'] },
  { id: 'icons', layer: 'ui', name: 'Phosphor Icons', version: '@phosphor-icons/core', related: ['web-ui', 'csp'] },
  { id: 'fonts', layer: 'ui', name: '系統字型', related: ['tokens', 'csp'] },
  { id: 'router', layer: 'app', name: 'React Router', version: 'react-router', related: ['react', 'lingui', 'pwa'] },
  { id: 'zustand', layer: 'app', name: 'Zustand', version: 'zustand', related: ['react', 'progress'] },
  { id: 'idb', layer: 'data', name: 'idb', version: 'idb', related: ['progress'] },
  { id: 'progress', layer: 'data', name: 'progress', related: ['idb', 'zod', 'quiz', 'zustand'] },
  { id: 'zod', layer: 'data', name: 'zod', version: 'zod', related: ['progress', 'content', 'csp'] },
  { id: 'core', layer: 'data', name: 'core', related: ['quiz', 'content'] },
  { id: 'quiz', layer: 'data', name: 'quiz', related: ['core', 'progress'] },
  { id: 'content', layer: 'data', name: 'content', related: ['zod', 'core', 'pwa'] },
  { id: 'vite', layer: 'build', name: 'Vite', version: 'vite', related: ['lightningcss', 'pwa', 'typescript'] },
  { id: 'lightningcss', layer: 'build', name: 'Lightning CSS', version: 'lightningcss', related: ['vite', 'tokens'] },
  { id: 'typescript', layer: 'build', name: 'TypeScript', version: 'typescript', related: ['vite', 'pnpm', 'lint'] },
  { id: 'pnpm', layer: 'build', name: 'pnpm', version: 'pnpm', related: ['typescript', 'node'] },
  { id: 'node', layer: 'build', name: 'Node.js', version: 'node', related: ['pnpm', 'vite'] },
  { id: 'pwa', layer: 'platform', name: 'PWA', version: 'vite-plugin-pwa', related: ['vite', 'router', 'content', 'cloudflare'], egg: 'offline' },
  { id: 'cloudflare', layer: 'platform', name: 'Cloudflare Workers', version: 'wrangler', related: ['pwa', 'csp', 'analytics'] },
  { id: 'csp', layer: 'platform', name: 'CSP', related: ['cloudflare', 'zod', 'icons'] },
  { id: 'analytics', layer: 'platform', name: 'Web Analytics', related: ['cloudflare'] },
  { id: 'zxing', layer: 'platform', name: 'ZXing', version: '@zxing/library', related: ['pwa', 'csp'] },
  { id: 'vitest', layer: 'quality', name: 'Vitest', version: 'vitest', related: ['playwright', 'typescript'] },
  { id: 'playwright', layer: 'quality', name: 'Playwright', version: '@playwright/test', related: ['vitest', 'lighthouse'] },
  { id: 'lighthouse', layer: 'quality', name: 'Lighthouse', version: 'lighthouse', related: ['playwright', 'vite'] },
  { id: 'lint', layer: 'quality', name: 'oxlint 與 Prettier', version: 'oxlint', related: ['typescript'] },
];

const byId = new Map(STACK_NODES.map((n) => [n.id, n]));

export function nodeById(id: string): StackNode | undefined {
  return byId.get(id);
}

/** 搭配的節點（雙向：對方把我列為搭配也算） */
export function relatedOf(id: string): ReadonlySet<string> {
  const out = new Set<string>();
  const me = byId.get(id);
  if (!me) return out;
  for (const r of me.related) out.add(r);
  for (const n of STACK_NODES) if (n.id !== id && n.related.includes(id)) out.add(n.id);
  return out;
}

export function nodesInLayer(layer: StackLayer): readonly StackNode[] {
  return STACK_NODES.filter((n) => n.layer === layer);
}

/** 建置時注入的版本表（apps/web/stack-versions.config.ts）；測試環境由 vitest.config.ts 用同一份資料注入 */
export const STACK_VERSIONS: Readonly<Record<string, string>> = __LL_STACK_VERSIONS__;

export function versionOf(node: StackNode): string | undefined {
  return node.version === undefined ? undefined : STACK_VERSIONS[node.version];
}
