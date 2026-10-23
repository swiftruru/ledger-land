// IndexedDB 的開啟與版本升級（06 第 4.2、4.3 節）：idb 的 openDB 薄封裝。
// upgrade 依 packages/progress 的 describeMigration(v) 逐版建 object store 與索引；transformsData 的版本先把各 store 讀成 RawSnapshot、
// 寫一筆 snapshots，再套 transformSnapshot 寫回。blocked、blocking、terminated 只轉交給呼叫端（處理在 index.ts 與 indexeddb-store.ts）。
// 規則：只往前、可重複執行（已存在的 store 與索引略過）、不刪任何使用者資料。
import { openDB, type IDBPDatabase, type IDBPObjectStore, type IDBPTransaction } from 'idb';
import {
  DB_NAME,
  DB_SCHEMA_VERSION,
  META_KEY,
  describeMigration,
  migrations,
  transformSnapshot,
  type IndexSpec,
  type MigrationRegistry,
  type RawSnapshot,
} from '@ledgerland/progress';

export type ProgressDB = IDBPDatabase<unknown>;
type UpgradeTx = IDBPTransaction<unknown, string[], 'versionchange'>;
type AnyStore = IDBPObjectStore<unknown, string[], string, 'versionchange'>;

export interface OpenProgressDBOptions {
  readonly name?: string;
  readonly version?: number;
  readonly registry?: MigrationRegistry;
  /** 轉換資料前存快照時用的時間 */
  readonly now: () => string;
  /** 本分頁要升級，但其他分頁還開著舊連線 */
  readonly onBlocked?: (currentVersion: number, blockedVersion: number | null) => void;
  /** 本分頁是舊版，其他分頁要升級：呼叫端要先 flush 再關閉連線 */
  readonly onBlocking?: (currentVersion: number, blockedVersion: number | null) => void;
  /** 連線被意外關閉（例如 iOS 的 IndexedDB server lost） */
  readonly onTerminated?: () => void;
}

function ensureIndexes(store: AnyStore, indexes: readonly IndexSpec[]): void {
  for (const idx of indexes) {
    if (store.indexNames.contains(idx.name)) continue;
    store.createIndex(idx.name, idx.keyPath as string | string[], { unique: idx.unique ?? false });
  }
}

/** 把整個資料庫讀成記憶體快照（只 await IDB 請求，升級交易才不會提前結束） */
async function readRaw(db: ProgressDB, tx: UpgradeTx): Promise<RawSnapshot> {
  const out: Record<string, unknown> = {};
  for (const name of Array.from(db.objectStoreNames)) {
    const rows = (await tx.objectStore(name).getAll()) as unknown[];
    if (name === 'meta') {
      const meta = rows.find((r) => (r as { key?: unknown }).key === META_KEY) as Record<string, unknown> | undefined;
      if (meta !== undefined) {
        const { key: _omit, ...rest } = meta;
        out['meta'] = rest;
      }
    } else out[name] = rows;
  }
  return out;
}

async function writeRaw(db: ProgressDB, tx: UpgradeTx, snapshot: RawSnapshot): Promise<void> {
  for (const name of Array.from(db.objectStoreNames)) {
    const store = tx.objectStore(name);
    await store.clear();
    if (name === 'meta') {
      const meta = snapshot['meta'];
      if (meta !== null && typeof meta === 'object') await store.put({ key: META_KEY, ...(meta as Record<string, unknown>) });
      continue;
    }
    const rows = snapshot[name];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) await store.add(row);
  }
}

async function bumpMetaVersion(db: ProgressDB, tx: UpgradeTx, version: number): Promise<void> {
  if (!db.objectStoreNames.contains('meta')) return;
  const store = tx.objectStore('meta');
  const meta = (await store.get(META_KEY)) as Record<string, unknown> | undefined;
  if (meta !== undefined) await store.put({ ...meta, dbSchemaVersion: version });
}

/** 依序套用 oldVersion + 1 到 target 的 migration（匯出給測試直接驗證） */
export async function runMigrations(
  db: ProgressDB,
  tx: UpgradeTx,
  oldVersion: number,
  target: number,
  registry: MigrationRegistry,
  now: () => string,
): Promise<void> {
  for (let v = oldVersion + 1; v <= target; v++) {
    const plan = describeMigration(v, registry);
    if (plan === undefined) throw new Error(`沒有版本 ${v} 的 migration`);
    for (const spec of plan.createStores) {
      if (db.objectStoreNames.contains(spec.name)) {
        ensureIndexes(tx.objectStore(spec.name), spec.indexes);
        continue;
      }
      const store = db.createObjectStore(spec.name, spec.keyPath === null ? { autoIncrement: spec.autoIncrement ?? true } : { keyPath: spec.keyPath });
      ensureIndexes(store as AnyStore, spec.indexes);
    }
    for (const { store, index } of plan.createIndexes) {
      if (!db.objectStoreNames.contains(store)) throw new Error(`migration ${v} 要在不存在的 store ${store} 上建索引`);
      ensureIndexes(tx.objectStore(store), [index]);
    }
    if (plan.transformsData) {
      const snapshot = await readRaw(db, tx);
      const { snapshots: _omit, ...payload } = snapshot;
      const prev = Array.isArray(snapshot['snapshots']) ? (snapshot['snapshots'] as unknown[]) : [];
      const kept = prev.filter((s) => {
        const fv = (s as { fromVersion?: unknown }).fromVersion;
        return typeof fv === 'number' && fv >= v - 1;
      });
      const withSnapshot: RawSnapshot = { ...snapshot, snapshots: [...kept, { fromVersion: v - 1, createdAt: now(), payload }] };
      const transformed = transformSnapshot(v, withSnapshot, registry);
      if (transformed === undefined) throw new Error(`版本 ${v} 沒有 transform`);
      await writeRaw(db, tx, transformed);
    }
  }
  await bumpMetaVersion(db, tx, target);
}

export function openProgressDB(options: OpenProgressDBOptions): Promise<ProgressDB> {
  const name = options.name ?? DB_NAME;
  const version = options.version ?? DB_SCHEMA_VERSION;
  const registry = options.registry ?? migrations;
  return openDB(name, version, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // idb 不等 upgrade 回傳的 promise：migration 失敗時要自己中止升級交易，openDB 才會以 AbortError 拒絕（不留下半套的結構）
      void runMigrations(db, tx as UpgradeTx, oldVersion, version, registry, options.now).catch(() => {
        tx.done.catch(() => {});
        try {
          tx.abort();
        } catch {
          /* 交易可能已經結束 */
        }
      });
    },
    blocked(currentVersion, blockedVersion) {
      options.onBlocked?.(currentVersion, blockedVersion);
    },
    blocking(currentVersion, blockedVersion) {
      options.onBlocking?.(currentVersion, blockedVersion);
    },
    terminated() {
      options.onTerminated?.();
    },
  });
}
