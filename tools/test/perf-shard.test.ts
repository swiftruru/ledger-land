// Lighthouse 的網址分組（tools/lib/perf-shard.mjs，09 第 10.2 節）：每個網址剛好落在一組、順序不變；格式不對時丟錯
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../lib/fs.mjs';
import { parseShard, shardUrls } from '../lib/perf-shard.mjs';

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `u${i}` }));

describe('parseShard', () => {
  it('讀出第幾組與共幾組', () => {
    expect(parseShard('2/3')).toEqual({ index: 2, total: 3 });
    expect(parseShard('1/1')).toEqual({ index: 1, total: 1 });
  });
  it('格式不對時丟錯', () => {
    for (const bad of ['', '2', 'a/b', '1/3/5', '-1/3', '1.5/3', 'true']) expect(() => parseShard(bad)).toThrow('第幾組/共幾組');
  });
  it('超出範圍時丟錯', () => {
    for (const bad of ['0/3', '4/3', '1/0']) expect(() => parseShard(bad)).toThrow('範圍不對');
  });
});

describe('shardUrls', () => {
  it('依順序輪流分，組內順序不變', () => {
    const urls = names(9);
    expect(shardUrls(urls, '1/3').map((u) => u.name)).toEqual(['u0', 'u3', 'u6']);
    expect(shardUrls(urls, '2/3').map((u) => u.name)).toEqual(['u1', 'u4', 'u7']);
    expect(shardUrls(urls, '3/3').map((u) => u.name)).toEqual(['u2', 'u5', 'u8']);
  });
  it('每個網址剛好在一組（網址數不整除時也一樣）', () => {
    for (const count of [1, 2, 9, 10, 11]) {
      for (const total of [1, 2, 3, 4]) {
        const urls = names(count);
        const all = Array.from({ length: total }, (_, i) => shardUrls(urls, `${i + 1}/${total}`)).flat();
        expect(all.map((u) => u.name).sort()).toEqual(urls.map((u) => u.name).sort());
      }
    }
  });
  it('1/1 是全部', () => {
    expect(shardUrls(names(5), '1/1')).toHaveLength(5);
  });
  it('urls.json 現在的網址分三組，每組都有網址而且合起來是全部', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'apps/web/perf/urls.json'), 'utf8')) as { urls: Array<{ name: string }> };
    const groups = [1, 2, 3].map((i) => shardUrls(cfg.urls, `${i}/3`).map((u) => u.name));
    for (const g of groups) expect(g.length).toBeGreaterThan(0);
    expect(groups.flat().sort()).toEqual(cfg.urls.map((u) => u.name).sort());
  });
});
