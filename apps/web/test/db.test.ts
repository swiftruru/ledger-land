// IndexedDB 的開啟與 migration（06 第 4.3 節）：從版本 0 建立全部 store 與索引；假版本 2 的升級可重複執行、transformsData 時寫 snapshots；
// 兩個連線的 blocked 與 blocking 回呼。
import { META_KEY, storesAtVersion } from '@ledgerland/progress';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProgressDB, type ProgressDB } from '../src/lib/progress/db.ts';
import { NOW, TEST_REGISTRY, V1_STORES, freshIndexedDB, level, meta } from './fixtures.ts';

const now = () => NOW;

function structure(db: ProgressDB): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const tx = db.transaction(Array.from(db.objectStoreNames), 'readonly');
  for (const name of Array.from(db.objectStoreNames)) out[name] = Array.from(tx.objectStore(name).indexNames).sort();
  return out;
}

describe('openProgressDB：版本 1', () => {
  beforeEach(freshIndexedDB);

  it('從版本 0 建立 06 第 4.2 節的全部 object store 與索引', async () => {
    const db = await openProgressDB({ now });
    expect(db.version).toBe(1);
    const actual = structure(db);
    for (const spec of V1_STORES) {
      expect(actual[spec.name]).toEqual(spec.indexes.map((i) => i.name).sort());
    }
    expect(Object.keys(actual).sort()).toEqual(V1_STORES.map((s) => s.name).sort());
    db.close();
  });

  it('errors 與 snapshots 是自動遞增的 out-of-line key；meta 以固定 key 存', async () => {
    const db = await openProgressDB({ now });
    await db.add('errors', { at: NOW, route: '/', message: 'x', appVersion: '0', contentVersion: 0 });
    await db.add('errors', { at: NOW, route: '/', message: 'y', appVersion: '0', contentVersion: 0 });
    expect(await db.getAllKeys('errors')).toEqual([1, 2]);
    await db.put('meta', { key: META_KEY, ...meta() });
    expect(((await db.get('meta', META_KEY)) as { deviceId: string }).deviceId).toBe('d_9k2m7q4x');
    db.close();
  });
});

describe('openProgressDB：測試用的假版本 2（加索引、轉換資料）', () => {
  beforeEach(freshIndexedDB);

  async function seedV1(): Promise<void> {
    const db = await openProgressDB({ now, registry: TEST_REGISTRY, version: 1 });
    await db.put('meta', { key: META_KEY, ...meta() });
    await db.put('settings', { key: 'timerEnabled', value: true, updatedAt: NOW });
    await db.put('settings', { key: 'locale', value: 'zh-TW', updatedAt: NOW });
    await db.put('levelProgress', level());
    db.close();
  }

  it('升級到 2：新索引存在、資料已轉換、舊資料存進 snapshots、meta 的版本更新', async () => {
    await seedV1();
    const db = await openProgressDB({ now, registry: TEST_REGISTRY, version: 2 });
    expect(db.version).toBe(2);
    expect(structure(db)['levelProgress']).toEqual(['byStars']);
    expect(
      storesAtVersion(2, TEST_REGISTRY)
        .find((s) => s.name === 'levelProgress')
        ?.indexes.map((i) => i.name),
    ).toEqual(['byStars']);
    const settings = (await db.getAll('settings')) as { key: string; value: unknown }[];
    expect(settings.map((s) => s.key).sort()).toEqual(['locale', 'timer']);
    expect(settings.find((s) => s.key === 'timer')?.value).toEqual({ enabled: true });
    const snapshots = (await db.getAll('snapshots')) as { fromVersion: number; createdAt: string; payload: Record<string, unknown> }[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.fromVersion).toBe(1);
    expect(snapshots[0]!.createdAt).toBe(NOW);
    expect((snapshots[0]!.payload['settings'] as { key: string }[]).map((s) => s.key).sort()).toEqual(['locale', 'timerEnabled']);
    expect(snapshots[0]!.payload['snapshots']).toBeUndefined();
    expect((snapshots[0]!.payload['meta'] as { dbSchemaVersion: number }).dbSchemaVersion).toBe(1);
    expect(((await db.get('meta', META_KEY)) as { dbSchemaVersion: number }).dbSchemaVersion).toBe(2);
    expect(await db.getAllFromIndex('levelProgress', 'byStars', 2)).toHaveLength(1);
    db.close();
  });

  it('可重複執行：再開一次版本 2 不出錯、資料與 snapshots 不變', async () => {
    await seedV1();
    const first = await openProgressDB({ now, registry: TEST_REGISTRY, version: 2 });
    first.close();
    const db = await openProgressDB({ now, registry: TEST_REGISTRY, version: 2 });
    expect(await db.count('snapshots')).toBe(1);
    expect(await db.count('settings')).toBe(2);
    expect(await db.count('levelProgress')).toBe(1);
    db.close();
  });

  it('從版本 0 直接開到 2：兩個版本依序套用、沒有舊資料所以 snapshots 只有空快照', async () => {
    const db = await openProgressDB({ now, registry: TEST_REGISTRY, version: 2 });
    expect(Object.keys(structure(db)).sort()).toEqual(V1_STORES.map((s) => s.name).sort());
    expect(structure(db)['levelProgress']).toEqual(['byStars']);
    expect(await db.count('snapshots')).toBe(1);
    db.close();
  });

  it('沒有登錄的版本：開啟失敗（升級交易中止）', async () => {
    await expect(openProgressDB({ now, registry: TEST_REGISTRY, version: 3 })).rejects.toThrow(/abort/i);
  });
});

describe('openProgressDB：兩個連線（blocked 與 blocking）', () => {
  beforeEach(freshIndexedDB);

  it('舊連線在 blocking 時關閉，新版本的升級不卡住', async () => {
    const events: string[] = [];
    const a = await openProgressDB({
      now,
      registry: TEST_REGISTRY,
      version: 1,
      onBlocking(current, blocked) {
        events.push(`a:blocking ${current}->${blocked}`);
        a.close();
      },
    });
    const b = await openProgressDB({
      now,
      registry: TEST_REGISTRY,
      version: 2,
      onBlocked(current, blocked) {
        events.push(`b:blocked ${current}->${blocked}`);
      },
    });
    expect(b.version).toBe(2);
    expect(events).toContain('a:blocking 1->2');
    b.close();
  });

  it('舊連線不關閉時新連線收到 blocked；舊連線關閉後升級才完成', async () => {
    const events: string[] = [];
    const a = await openProgressDB({
      now,
      registry: TEST_REGISTRY,
      version: 1,
      onBlocking() {
        events.push('a:blocking');
      },
    });
    let settled = false;
    const opening = openProgressDB({
      now,
      registry: TEST_REGISTRY,
      version: 2,
      onBlocked() {
        events.push('b:blocked');
      },
    }).then((db) => {
      settled = true;
      return db;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(events).toEqual(['a:blocking', 'b:blocked']);
    expect(settled).toBe(false);
    a.close();
    const b = await opening;
    expect(b.version).toBe(2);
    b.close();
  });
});
