// 暫存佇列（06 第 4.3、4.4 節）：IndexedDB 連線因為其他分頁升級而關閉、或寫入重試仍失敗時，寫入先排進 localStorage 的 ll:pending；
// 下次啟動（或重新整理）後依序重放到 IndexedDB。另外 ll:lite 存精簡快照（各關星星、錯題本、解鎖），只在寫入失敗時更新。
import type { Attempt, ErrorRecord, JsonValue, LabSandbox, LabState, LevelProgress, ProgressStore, ReviewQueueEntry, Unlock } from '@ledgerland/progress';

export const PENDING_KEY = 'll:pending';
export const LITE_KEY = 'll:lite';

export type PendingOp =
  | { readonly op: 'addAttempt'; readonly value: Attempt }
  | { readonly op: 'putLevelProgress'; readonly value: LevelProgress }
  | { readonly op: 'putReview'; readonly value: ReviewQueueEntry }
  | { readonly op: 'removeReview'; readonly questionId: string }
  | { readonly op: 'addUnlock'; readonly value: Unlock }
  | { readonly op: 'putLabState'; readonly value: LabState }
  | { readonly op: 'putLabSandbox'; readonly value: LabSandbox }
  | { readonly op: 'removeLabSandbox'; readonly id: string }
  | { readonly op: 'setSetting'; readonly key: string; readonly value: JsonValue; readonly updatedAt: string }
  | { readonly op: 'appendError'; readonly value: ErrorRecord };

/** localStorage 的最小介面，測試時用 Map 代替 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LiteSnapshot {
  readonly savedAt: string;
  readonly levelProgress: readonly LevelProgress[];
  readonly reviewQueue: readonly ReviewQueueEntry[];
  readonly unlocks: readonly Unlock[];
}

export class PendingQueue {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = PENDING_KEY,
  ) {}

  list(): PendingOp[] {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
    } catch {
      return [];
    }
  }

  push(op: PendingOp): void {
    try {
      this.storage.setItem(this.key, JSON.stringify([...this.list(), op]));
    } catch {
      /* 寫不進 localStorage 時只能放棄這一筆 */
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* 忽略 */
    }
  }

  get size(): number {
    return this.list().length;
  }
}

export function applyPending(store: ProgressStore, op: PendingOp): Promise<void> {
  switch (op.op) {
    case 'addAttempt':
      return store.addAttempt(op.value);
    case 'putLevelProgress':
      return store.putLevelProgress(op.value);
    case 'putReview':
      return store.putReview(op.value);
    case 'removeReview':
      return store.removeReview(op.questionId);
    case 'addUnlock':
      return store.addUnlock(op.value);
    case 'putLabState':
      return store.putLabState(op.value);
    case 'putLabSandbox':
      return store.putLabSandbox(op.value);
    case 'removeLabSandbox':
      return store.removeLabSandbox(op.id);
    case 'setSetting':
      return store.setSetting(op.key, op.value, op.updatedAt);
    case 'appendError':
      return store.appendError(op.value);
  }
}

/** 依序重放；全部成功才清空佇列，中途失敗就保留剩下的（下次再試） */
export async function replayPending(store: ProgressStore, queue: PendingQueue): Promise<number> {
  const ops = queue.list();
  if (ops.length === 0) return 0;
  let done = 0;
  for (const op of ops) {
    await applyPending(store, op);
    done++;
  }
  queue.clear();
  return done;
}

export function writeLiteSnapshot(storage: KeyValueStorage, lite: LiteSnapshot): void {
  try {
    storage.setItem(LITE_KEY, JSON.stringify(lite));
  } catch {
    /* 忽略 */
  }
}

export function readLiteSnapshot(storage: KeyValueStorage): LiteSnapshot | undefined {
  try {
    const raw = storage.getItem(LITE_KEY);
    return raw === null ? undefined : (JSON.parse(raw) as LiteSnapshot);
  } catch {
    return undefined;
  }
}
