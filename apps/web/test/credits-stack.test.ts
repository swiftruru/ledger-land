// 幕後頁的技術棧資料（features/credits/stack.ts）：節點與分層的一致性、搭配的雙向、版本表（建置時注入的 __LL_STACK_VERSIONS__）、
// 每個節點與分層的字串在兩份 pages.po 都有翻譯。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STACK_LAYERS, STACK_NODES, STACK_VERSIONS, nodeById, nodesInLayer, relatedOf, versionOf } from '../src/features/credits/stack.ts';

function translated(path: string): Set<string> {
  const po = readFileSync(new URL(path, import.meta.url), 'utf8');
  return new Set([...po.matchAll(/^msgid "(.+)"\nmsgstr "(.+)"$/gm)].map((m) => m[1]!));
}

describe('技術棧資料', () => {
  it('id 不重複、每個節點的層都在 STACK_LAYERS、每一層至少一個節點', () => {
    expect(new Set(STACK_NODES.map((n) => n.id)).size).toBe(STACK_NODES.length);
    for (const n of STACK_NODES) expect(STACK_LAYERS).toContain(n.layer);
    for (const layer of STACK_LAYERS) expect(nodesInLayer(layer).length).toBeGreaterThan(0);
  });

  it('搭配的節點都存在、不自指；relatedOf 是雙向的', () => {
    for (const n of STACK_NODES) {
      for (const r of n.related) {
        expect(r, `${n.id} 的搭配 ${r}`).not.toBe(n.id);
        expect(nodeById(r), `${n.id} 的搭配 ${r} 不存在`).toBeDefined();
        expect(relatedOf(r).has(n.id)).toBe(true);
      }
    }
    expect(relatedOf('nope').size).toBe(0);
  });

  it('有版本的節點在版本表裡都有值，長得像版本號', () => {
    for (const n of STACK_NODES) {
      if (n.version === undefined) continue;
      const v = versionOf(n);
      expect(v, `${n.id} 的版本 key ${n.version}`).toMatch(/^\d+\.\d+\.\d+/);
      expect(STACK_VERSIONS[n.version]).toBe(v);
    }
    expect(versionOf({ id: 'x', layer: 'ui', name: 'x', related: [] })).toBeUndefined();
  });

  it('每個節點的角色說明與每一層的標題在兩份 pages.po 都有翻譯', () => {
    for (const path of ['../src/locales/zh-TW/pages.po', '../src/locales/en/pages.po']) {
      const ids = translated(path);
      for (const n of STACK_NODES) expect(ids.has(`stack.node.${n.id}.role`), `${path} 缺 stack.node.${n.id}.role`).toBe(true);
      for (const layer of STACK_LAYERS) expect(ids.has(`stack.layer.${layer}`), `${path} 缺 stack.layer.${layer}`).toBe(true);
    }
  });

  it('兩個彩蛋各在一個節點上', () => {
    expect(STACK_NODES.filter((n) => n.egg === 'flavours').map((n) => n.id)).toEqual(['tokens']);
    expect(STACK_NODES.filter((n) => n.egg === 'offline').map((n) => n.id)).toEqual(['pwa']);
  });
});
