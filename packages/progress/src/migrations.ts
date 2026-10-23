// 資料版本升級（06 第 4.3 節）。每個版本一個 Migration：describe() 說明要建立的 object store 與索引（IndexedDB 實作在 upgrade 回呼中照做），
// transform() 轉換記憶體中的資料快照（匯入舊版備份時在記憶體中跑同一套；IndexedDB 實作把同一個 transform 套在讀出的資料上再寫回）。
// 規則：只能往前、可重複執行不出錯、同一個版本內不刪除任何使用者資料；會轉換資料的版本先把舊資料存進 snapshots，保留到下一個版本。
import { DB_SCHEMA_VERSION } from './model.ts';
import { type ProgressError, type Result, err, ok, progressError } from './result.ts';
import { clonePlain } from './util.ts';

export interface IndexSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly unique?: boolean;
}

export interface StoreSpec {
  readonly name: string;
  /** null 表示自動遞增的 out-of-line key（errors、snapshots） */
  readonly keyPath: string | null;
  readonly autoIncrement?: boolean;
  readonly indexes: readonly IndexSpec[];
}

/** 一個版本在 IndexedDB 結構上的變更；只增不刪（06 第 4.3 節） */
export interface MigrationPlan {
  readonly createStores: readonly StoreSpec[];
  /** 在既有 store 上新增的索引 */
  readonly createIndexes: readonly { readonly store: string; readonly index: IndexSpec }[];
  /** transform 會改變資料時為 true：IndexedDB 實作與 migrateSnapshot 都先把舊資料存進 snapshots */
  readonly transformsData: boolean;
}

/**
 * 記憶體中的資料快照（版本不限）：鍵是 store 名稱，值是該 store 的紀錄陣列；meta 是單一物件。
 * 舊版本的形狀與目前的 ProgressSnapshot 可能不同，所以型別上只保證是物件，升到最新版後再用 Zod 驗證。
 */
export type RawSnapshot = Readonly<Record<string, unknown>>;

export interface Migration {
  readonly version: number;
  readonly description: string;
  describe(): MigrationPlan;
  /** 純函式：輸入舊版快照，輸出新版快照；重複套用在已經是新版的快照上不出錯、結果不變 */
  transform(snapshot: RawSnapshot): RawSnapshot;
}

export type MigrationRegistry = Readonly<Record<number, Migration>>;

const ATTEMPT_INDEXES: readonly IndexSpec[] = [
  { name: 'byQuestion', keyPath: 'questionId' },
  { name: 'byQuestionRev', keyPath: ['questionId', 'rev'] },
  { name: 'byTime', keyPath: 'answeredAt' },
];

/** 版本 1：建立全部 object store（06 第 4.2 節的表） */
export const V1_STORES: readonly StoreSpec[] = [
  { name: 'meta', keyPath: 'key', indexes: [] },
  { name: 'attempts', keyPath: 'attemptId', indexes: ATTEMPT_INDEXES },
  { name: 'levelProgress', keyPath: 'levelId', indexes: [] },
  { name: 'reviewQueue', keyPath: 'questionId', indexes: [{ name: 'byDue', keyPath: 'dueAt' }] },
  { name: 'unlocks', keyPath: 'id', indexes: [] },
  { name: 'labState', keyPath: 'storyId', indexes: [] },
  { name: 'labSandbox', keyPath: 'id', indexes: [] },
  { name: 'settings', keyPath: 'key', indexes: [] },
  { name: 'errors', keyPath: null, autoIncrement: true, indexes: [] },
  { name: 'snapshots', keyPath: null, autoIncrement: true, indexes: [] },
];

const ARRAY_STORES = ['attempts', 'levelProgress', 'reviewQueue', 'unlocks', 'labState', 'labSandbox', 'settings', 'errors', 'snapshots'] as const;

const v1: Migration = {
  version: 1,
  description: '建立全部 object store',
  describe: () => ({ createStores: V1_STORES, createIndexes: [], transformsData: false }),
  transform(snapshot) {
    // 補齊缺少的 store（空陣列），已有的資料原樣保留
    const out: Record<string, unknown> = { ...snapshot };
    for (const name of ARRAY_STORES) if (!Array.isArray(out[name])) out[name] = [];
    return out;
  },
};

export const migrations: MigrationRegistry = { 1: v1 };

export function latestVersion(registry: MigrationRegistry = migrations): number {
  return Math.max(0, ...Object.keys(registry).map(Number));
}

export function describeMigration(version: number, registry: MigrationRegistry = migrations): MigrationPlan | undefined {
  return registry[version]?.describe();
}

export function transformSnapshot(version: number, snapshot: RawSnapshot, registry: MigrationRegistry = migrations): RawSnapshot | undefined {
  return registry[version]?.transform(snapshot);
}

/** 升級後 store 的完整結構（給 IndexedDB 實作比對與測試用）：依序套用 1 到 version 的 plan */
export function storesAtVersion(version: number, registry: MigrationRegistry = migrations): StoreSpec[] {
  const stores = new Map<string, StoreSpec>();
  for (let v = 1; v <= version; v++) {
    const plan = registry[v]?.describe();
    if (plan === undefined) continue;
    for (const s of plan.createStores) stores.set(s.name, s);
    for (const { store, index } of plan.createIndexes) {
      const prev = stores.get(store);
      if (prev === undefined) throw new Error(`migration ${v} 要在不存在的 store ${store} 上建索引`);
      if (!prev.indexes.some((i) => i.name === index.name)) stores.set(store, { ...prev, indexes: [...prev.indexes, index] });
    }
  }
  return [...stores.values()];
}

export interface MigrateOptions {
  /** 轉換資料前存快照時用的時間（呼叫端提供，本套件不讀時鐘） */
  readonly now: string;
  readonly registry?: MigrationRegistry;
}

function metaOf(snapshot: RawSnapshot): Record<string, unknown> {
  const m = snapshot['meta'];
  return m !== null && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

/**
 * 把記憶體中的快照從 from 版升到 to 版（06 第 4.3、4.6 節）。from 大於 to 回 migration.backwards；
 * to 超過登錄的最新版回 migration.unknown_version；transform throw 時回 migration.failed。
 * from 等於 to 時仍會把 to 版的 transform 跑一遍（可重複執行），但不另存快照。
 */
export function migrateSnapshot(
  snapshot: RawSnapshot,
  from: number,
  to: number = DB_SCHEMA_VERSION,
  options: MigrateOptions,
): Result<RawSnapshot, ProgressError> {
  const registry = options.registry ?? migrations;
  if (from > to) return err(progressError('migration.backwards', { from, to }));
  if (to > latestVersion(registry) || to < 1) return err(progressError('migration.unknown_version', { version: to }));
  let current: RawSnapshot = clonePlain(snapshot);
  const start = Math.max(1, from === to ? to : from + 1);
  for (let v = start; v <= to; v++) {
    const m = registry[v];
    if (m === undefined) return err(progressError('migration.unknown_version', { version: v }));
    const plan = m.describe();
    if (plan.transformsData && v > from) {
      const { snapshots: _omit, ...payload } = current;
      const prev = Array.isArray(current['snapshots']) ? (current['snapshots'] as unknown[]) : [];
      const kept = prev.filter((s) => {
        const fv = (s as { fromVersion?: unknown }).fromVersion;
        return typeof fv === 'number' && fv >= v - 1;
      });
      current = { ...current, snapshots: [...kept, { fromVersion: v - 1, createdAt: options.now, payload }] };
    }
    try {
      current = m.transform(current);
    } catch (e) {
      return err(progressError('migration.failed', { version: v, reason: e instanceof Error ? e.message : String(e) }));
    }
    current = { ...current, meta: { ...metaOf(current), dbSchemaVersion: v } };
  }
  return ok(current);
}
