// 06 第 4.3 節：版本 1 建立全部 store；假的版本 2 驗證升級、只能往前、可重複執行、轉換前存快照並只保留到下一版
import { describe, expect, it } from 'vitest';
import {
  ALL_STORES,
  type Migration,
  type MigrationRegistry,
  ProgressSnapshot,
  describeMigration,
  latestVersion,
  migrateSnapshot,
  migrations,
  storesAtVersion,
  transformSnapshot,
} from '../src/index.ts';
import { Q1, T2, T3, populatedSnapshot, review } from './fixtures.ts';

/** 測試用的假版本 2：reviewQueue 加 lapses 欄位（預設 0）並加索引 */
const v2: Migration = {
  version: 2,
  description: '測試：reviewQueue 加 lapses',
  describe: () => ({ createStores: [], createIndexes: [{ store: 'reviewQueue', index: { name: 'byLapses', keyPath: 'lapses' } }], transformsData: true }),
  transform(s) {
    const rq = Array.isArray(s['reviewQueue']) ? (s['reviewQueue'] as Record<string, unknown>[]) : [];
    return { ...s, reviewQueue: rq.map((r) => (typeof r['lapses'] === 'number' ? r : { ...r, lapses: 0 })) };
  },
};
const registry: MigrationRegistry = { ...migrations, 2: v2 };

describe('版本 1', () => {
  it('建立 06 第 4.2 節的全部 store 與索引', () => {
    const plan = describeMigration(1)!;
    expect(plan.createStores.map((s) => s.name)).toEqual([...ALL_STORES]);
    expect(plan.transformsData).toBe(false);
    const attempts = plan.createStores.find((s) => s.name === 'attempts')!;
    expect(attempts.indexes.map((i) => i.name)).toEqual(['byQuestion', 'byQuestionRev', 'byTime']);
    expect(plan.createStores.find((s) => s.name === 'reviewQueue')!.indexes).toEqual([{ name: 'byDue', keyPath: 'dueAt' }]);
    expect(plan.createStores.find((s) => s.name === 'errors')).toEqual({ name: 'errors', keyPath: null, autoIncrement: true, indexes: [] });
    expect(latestVersion()).toBe(1);
    expect(describeMigration(99)).toBeUndefined();
  });
  it('transform 只補齊缺少的 store，不動既有資料；套用在完整快照上不變', () => {
    const full = populatedSnapshot();
    expect(transformSnapshot(1, full)).toEqual(full);
    const partial = { meta: full.meta, attempts: full.attempts };
    const out = transformSnapshot(1, partial)!;
    expect(out['attempts']).toEqual(full.attempts);
    expect(out['reviewQueue']).toEqual([]);
    expect(ProgressSnapshot.safeParse({ ...out, meta: full.meta }).success).toBe(true);
  });
});

describe('migrateSnapshot', () => {
  it('從 1 升到假的 2：先存快照、再轉換、meta.dbSchemaVersion 跟著改', () => {
    const s1 = populatedSnapshot();
    const r = migrateSnapshot(s1, 1, 2, { now: T2, registry });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s2 = r.value;
    expect((s2['reviewQueue'] as Record<string, unknown>[])[0]).toEqual({ ...review({ questionId: 'q_3p8w5n2d' }), lapses: 0 });
    expect((s2['meta'] as { dbSchemaVersion: number }).dbSchemaVersion).toBe(2);
    const snaps = s2['snapshots'] as { fromVersion: number; createdAt: string; payload: Record<string, unknown> }[];
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.fromVersion).toBe(1);
    expect(snaps[0]!.createdAt).toBe(T2);
    expect(snaps[0]!.payload['reviewQueue']).toEqual(s1.reviewQueue);
    expect(snaps[0]!.payload['snapshots']).toBeUndefined();
    expect(s1.reviewQueue[0]).not.toHaveProperty('lapses');
  });
  it('可重複執行：升到 2 之後再跑一次 2 的 transform 結果不變；從 2 升到 2 不另存快照', () => {
    const once = migrateSnapshot(populatedSnapshot(), 1, 2, { now: T2, registry });
    if (!once.ok) throw new Error('應該成功');
    expect(v2.transform(once.value)).toEqual(once.value);
    const again = migrateSnapshot(once.value, 2, 2, { now: T3, registry });
    if (!again.ok) throw new Error('應該成功');
    expect(again.value).toEqual(once.value);
  });
  it('只能往前；超過最新版拒絕；transform 丟例外回 migration.failed', () => {
    expect(migrateSnapshot(populatedSnapshot(), 2, 1, { now: T2, registry })).toMatchObject({ ok: false, error: { code: 'migration.backwards' } });
    expect(migrateSnapshot(populatedSnapshot(), 1, 3, { now: T2, registry })).toMatchObject({ ok: false, error: { code: 'migration.unknown_version' } });
    const broken: MigrationRegistry = {
      ...registry,
      3: {
        version: 3,
        description: 'x',
        describe: () => ({ createStores: [], createIndexes: [], transformsData: false }),
        transform: () => {
          throw new Error('boom');
        },
      },
    };
    expect(migrateSnapshot(populatedSnapshot(), 1, 3, { now: T2, registry: broken })).toMatchObject({
      ok: false,
      error: { code: 'migration.failed', version: 3 },
    });
  });
  it('舊快照只保留到下一個版本：升到 3 時丟掉 fromVersion 1 的快照', () => {
    const v3: Migration = {
      version: 3,
      description: 'x',
      describe: () => ({ createStores: [], createIndexes: [], transformsData: true }),
      transform: (s) => s,
    };
    const r = migrateSnapshot(populatedSnapshot(), 1, 3, { now: T2, registry: { ...registry, 3: v3 } });
    if (!r.ok) throw new Error('應該成功');
    expect((r.value['snapshots'] as { fromVersion: number }[]).map((s) => s.fromVersion)).toEqual([2]);
  });
  it('storesAtVersion 累積各版本的 store 與索引', () => {
    expect(
      storesAtVersion(2, registry)
        .find((s) => s.name === 'reviewQueue')!
        .indexes.map((i) => i.name),
    ).toEqual(['byDue', 'byLapses']);
    expect(() =>
      storesAtVersion(2, {
        ...registry,
        2: { ...v2, describe: () => ({ createStores: [], createIndexes: [{ store: 'nope', index: { name: 'x', keyPath: 'x' } }], transformsData: false }) },
      }),
    ).toThrow('不存在的 store');
  });
  it('不改輸入', () => {
    const s = populatedSnapshot();
    const copy = JSON.parse(JSON.stringify(s));
    migrateSnapshot(s, 1, 2, { now: T2, registry });
    expect(s).toEqual(copy);
    expect(review({ questionId: Q1 })).not.toHaveProperty('lapses');
  });
});
