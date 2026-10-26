// ProgressStore 的 IndexedDB 實作（06 第 4.1 到 4.4 節）。每個寫入都是一個交易、立刻 await 完成（每答一題就寫一次）。
// 快速跳頁的補強（14 第 5.2 節）：有對應 PendingOp 的寫入在開交易之前先同步排進暫存佇列（localStorage 的 ll:pending），交易 complete 後才移除；
// 頁面在 complete 前被關閉（作答後馬上整頁跳轉、pagehide、visibilitychange 轉 hidden 後被回收）時這一筆留在佇列，下次啟動 replayPending 補寫。
// 不需要另外監聽 pagehide：IndexedDB 沒有同步提交的辦法，能做的只有「先留底、再開交易」。appendError 重放會多一筆，所以只在失敗時才排進佇列。
// 錯誤處理（4.4）：QuotaExceededError 通知畫面並把這筆寫入留在暫存佇列；其他錯誤重開連線再試一次，仍失敗就留在暫存佇列、寫精簡快照並通知畫面。
// 其他分頁要升級（blocking）時 suspend()：關閉連線，之後的寫入全部進暫存佇列，讀取會 throw StoreSuspendedError（畫面提示重新整理）。
import { dueToday } from '@ledgerland/quiz';
import {
  ALL_STORES,
  DATA_STORES,
  DB_SCHEMA_VERSION,
  ERRORS_MAX,
  LEARNING_SETTING_KEYS,
  META_KEY,
  compareCodeUnits,
  compareIso,
  deriveLevelProgress,
  importSnapshot,
  type Attempt,
  type DeriveOptions,
  type ErrorRecord,
  type ImportOptions,
  type JsonValue,
  type LabSandbox,
  type LabState,
  type LevelProgress,
  type LevelSpec,
  type ListAttemptsQuery,
  type Meta,
  type ProgressData,
  type ProgressSnapshot,
  type ProgressStore,
  type ReviewQueueEntry,
  type SettingEntry,
  type SnapshotRecord,
  type Unlock,
} from '@ledgerland/progress';
import type { ProgressDB } from './db.ts';
import type { LiteSnapshot, PendingOp, PendingQueue } from './pending.ts';

export class StoreSuspendedError extends Error {
  constructor() {
    super('網站已在其他分頁更新，重新整理後才能繼續讀寫進度');
    this.name = 'StoreSuspendedError';
  }
}

export interface IndexedDBStoreHooks {
  readonly now: () => string;
  /** meta 還不存在（第一次啟動）時建立 */
  readonly createMeta: () => Meta;
  /** 連線中斷或寫入失敗時重開；失敗就 throw */
  readonly reopen: () => Promise<ProgressDB>;
  readonly pending?: PendingQueue;
  readonly onQuotaExceeded?: () => void;
  readonly onWriteFailed?: (lite: LiteSnapshot | undefined) => void;
  /** setSetting 成功（或排進佇列）後呼叫，用來同步 localStorage 的鏡像 */
  readonly onSettingChanged?: (key: string, value: JsonValue) => void;
}

export function isQuotaExceeded(e: unknown): boolean {
  return (
    (e instanceof Error && e.name === 'QuotaExceededError') || (typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'QuotaExceededError')
  );
}

/** 重放兩次結果相同的操作才在交易前先排進佇列；appendError 重放會多一筆錯誤紀錄，只在失敗時才留 */
function replaysIdempotently(op: PendingOp): boolean {
  return op.op !== 'appendError';
}

function sortAttempts(list: Attempt[]): Attempt[] {
  return list.sort((x, y) => compareIso(x.answeredAt, y.answeredAt) || compareCodeUnits(x.attemptId, y.attemptId));
}

type MetaRow = Meta & { key: string };

export class IndexedDBProgressStore implements ProgressStore {
  readonly schemaVersion = DB_SCHEMA_VERSION;
  private db: ProgressDB | null;
  private suspended = false;
  private closed = false;

  constructor(
    db: ProgressDB,
    private readonly hooks: IndexedDBStoreHooks,
  ) {
    this.db = db;
  }

  get isSuspended(): boolean {
    return this.suspended;
  }

  /** 其他分頁要升級：寫入都已 await 完成，所以 flush 之後直接關閉連線 */
  async suspend(): Promise<void> {
    this.suspended = true;
    await this.flush();
    this.db?.close();
    this.db = null;
  }

  /** 連線被意外關閉：丟掉舊連線，下一次操作時重開一次 */
  markTerminated(): void {
    this.db = null;
  }

  /** 連線壞了：關掉（可能已經關了）再丟掉，下一次操作重開 */
  private dropConnection(): void {
    try {
      this.db?.close();
    } catch {
      /* 已關閉 */
    }
    this.db = null;
  }

  private async conn(): Promise<ProgressDB> {
    if (this.closed) throw new Error('IndexedDBProgressStore 已關閉');
    if (this.db !== null) return this.db;
    this.db = await this.hooks.reopen();
    return this.db;
  }

  private async read<T>(op: (db: ProgressDB) => Promise<T>): Promise<T> {
    if (this.suspended) throw new StoreSuspendedError();
    try {
      return await op(await this.conn());
    } catch (e) {
      if (isQuotaExceeded(e)) {
        this.hooks.onQuotaExceeded?.();
        throw e;
      }
      this.dropConnection();
      return op(await this.conn());
    }
  }

  /**
   * 寫入：有對應的 PendingOp 時先同步排進暫存佇列、交易 complete 後移除，失敗也不 throw（留在佇列）；
   * 沒有 PendingOp 的操作（匯入、重建、meta）失敗會 throw。
   */
  private async write(pendingOp: PendingOp | undefined, op: (db: ProgressDB) => Promise<void>): Promise<void> {
    const queue = pendingOp === undefined ? undefined : this.hooks.pending;
    if (this.suspended) {
      if (pendingOp !== undefined && queue !== undefined) {
        // 不是進行中的寫入：留給重新整理後（或其他分頁下次啟動時）重放，不持有鎖
        queue.disown(queue.push(pendingOp, this.hooks.now()));
        return;
      }
      throw new StoreSuspendedError();
    }
    // 先留底再開交易（同步寫 localStorage，記下排入時間）；交易完成後只移除自己這一筆
    const ticket = pendingOp !== undefined && queue !== undefined && replaysIdempotently(pendingOp) ? queue.push(pendingOp, this.hooks.now()) : undefined;
    const settle = (): void => {
      if (ticket !== undefined) queue?.remove(ticket);
    };
    /** 失敗時確保這一筆在佇列裡（並放掉進行中的標記，讓下次啟動的任何分頁都能重放）；回傳 false 表示沒有佇列可留（呼叫端要 throw） */
    const keep = (): boolean => {
      if (pendingOp === undefined || queue === undefined) return false;
      queue.disown(ticket ?? queue.push(pendingOp, this.hooks.now()));
      return true;
    };
    try {
      await op(await this.conn());
      settle();
      return;
    } catch (e) {
      if (isQuotaExceeded(e)) {
        this.hooks.onQuotaExceeded?.();
        if (keep()) return;
        throw e;
      }
      this.dropConnection();
    }
    try {
      await op(await this.conn());
      settle();
    } catch (e2) {
      this.hooks.onWriteFailed?.(await this.liteSnapshot());
      if (keep()) return;
      throw e2;
    }
  }

  private async liteSnapshot(): Promise<LiteSnapshot | undefined> {
    try {
      const db = await this.conn();
      const tx = db.transaction(['levelProgress', 'reviewQueue', 'unlocks'], 'readonly');
      const [levelProgress, reviewQueue, unlocks] = await Promise.all([
        tx.objectStore('levelProgress').getAll() as Promise<LevelProgress[]>,
        tx.objectStore('reviewQueue').getAll() as Promise<ReviewQueueEntry[]>,
        tx.objectStore('unlocks').getAll() as Promise<Unlock[]>,
      ]);
      return { savedAt: this.hooks.now(), levelProgress, reviewQueue, unlocks };
    } catch {
      return undefined;
    }
  }

  async getMeta(): Promise<Meta> {
    return this.read(async (db) => {
      const row = (await db.get('meta', META_KEY)) as MetaRow | undefined;
      if (row !== undefined) {
        const { key: _omit, ...meta } = row;
        return meta;
      }
      const created = this.hooks.createMeta();
      await db.put('meta', { key: META_KEY, ...created });
      return created;
    });
  }
  async putMeta(meta: Meta): Promise<void> {
    return this.write(undefined, async (db) => {
      await db.put('meta', { key: META_KEY, ...meta });
    });
  }

  async addAttempt(attempt: Attempt): Promise<void> {
    return this.write({ op: 'addAttempt', value: attempt }, async (db) => {
      const tx = db.transaction('attempts', 'readwrite');
      const existing = await tx.store.getKey(attempt.attemptId);
      if (existing === undefined) await tx.store.add(attempt);
      await tx.done;
    });
  }
  async listAttempts(query: ListAttemptsQuery = {}): Promise<Attempt[]> {
    return this.read(async (db) => {
      const rows = (
        query.questionId === undefined
          ? await db.getAll('attempts')
          : query.rev === undefined
            ? await db.getAllFromIndex('attempts', 'byQuestion', query.questionId)
            : await db.getAllFromIndex('attempts', 'byQuestionRev', [query.questionId, query.rev])
      ) as Attempt[];
      const list = rows.filter(
        (a) =>
          (query.levelId === undefined || a.levelId === query.levelId) &&
          (query.source === undefined || a.source === query.source) &&
          (query.from === undefined || compareIso(a.answeredAt, query.from) >= 0) &&
          (query.to === undefined || compareIso(a.answeredAt, query.to) <= 0),
      );
      return sortAttempts(list);
    });
  }

  async getLevelProgress(levelId: string): Promise<LevelProgress | undefined> {
    return this.read((db) => db.get('levelProgress', levelId) as Promise<LevelProgress | undefined>);
  }
  async putLevelProgress(progress: LevelProgress): Promise<void> {
    return this.write({ op: 'putLevelProgress', value: progress }, async (db) => {
      await db.put('levelProgress', progress);
    });
  }
  async listLevelProgress(): Promise<LevelProgress[]> {
    return this.read((db) => db.getAll('levelProgress') as Promise<LevelProgress[]>);
  }

  async getReview(questionId: string): Promise<ReviewQueueEntry | undefined> {
    return this.read((db) => db.get('reviewQueue', questionId) as Promise<ReviewQueueEntry | undefined>);
  }
  async putReview(entry: ReviewQueueEntry): Promise<void> {
    return this.write({ op: 'putReview', value: entry }, async (db) => {
      await db.put('reviewQueue', entry);
    });
  }
  async listDueReviews(today: string, limit?: number): Promise<ReviewQueueEntry[]> {
    const all = await this.listReviews();
    return dueToday(all, today, limit ?? all.length);
  }
  async listReviews(): Promise<ReviewQueueEntry[]> {
    return this.read((db) => db.getAll('reviewQueue') as Promise<ReviewQueueEntry[]>);
  }
  async removeReview(questionId: string): Promise<void> {
    return this.write({ op: 'removeReview', questionId }, async (db) => {
      await db.delete('reviewQueue', questionId);
    });
  }

  async addUnlock(unlock: Unlock): Promise<void> {
    return this.write({ op: 'addUnlock', value: unlock }, async (db) => {
      const tx = db.transaction('unlocks', 'readwrite');
      const prev = (await tx.store.get(unlock.id)) as Unlock | undefined;
      if (prev === undefined || compareIso(prev.unlockedAt, unlock.unlockedAt) > 0) await tx.store.put(unlock);
      await tx.done;
    });
  }
  async hasUnlock(id: string): Promise<boolean> {
    return this.read(async (db) => (await db.getKey('unlocks', id)) !== undefined);
  }
  async listUnlocks(kind?: Unlock['kind']): Promise<Unlock[]> {
    return this.read(async (db) => {
      const rows = (await db.getAll('unlocks')) as Unlock[];
      return kind === undefined ? rows : rows.filter((u) => u.kind === kind);
    });
  }

  async getLabState(storyId: string): Promise<LabState | undefined> {
    return this.read((db) => db.get('labState', storyId) as Promise<LabState | undefined>);
  }
  async putLabState(state: LabState): Promise<void> {
    return this.write({ op: 'putLabState', value: state }, async (db) => {
      await db.put('labState', state);
    });
  }
  async listLabState(): Promise<LabState[]> {
    return this.read((db) => db.getAll('labState') as Promise<LabState[]>);
  }

  async getLabSandbox(id: string): Promise<LabSandbox | undefined> {
    return this.read((db) => db.get('labSandbox', id) as Promise<LabSandbox | undefined>);
  }
  async putLabSandbox(sandbox: LabSandbox): Promise<void> {
    return this.write({ op: 'putLabSandbox', value: sandbox }, async (db) => {
      await db.put('labSandbox', sandbox);
    });
  }
  async removeLabSandbox(id: string): Promise<void> {
    return this.write({ op: 'removeLabSandbox', id }, async (db) => {
      await db.delete('labSandbox', id);
    });
  }

  async getSetting(key: string): Promise<SettingEntry | undefined> {
    return this.read((db) => db.get('settings', key) as Promise<SettingEntry | undefined>);
  }
  async setSetting(key: string, value: JsonValue, updatedAt: string): Promise<void> {
    await this.write({ op: 'setSetting', key, value, updatedAt }, async (db) => {
      await db.put('settings', { key, value, updatedAt } satisfies SettingEntry);
    });
    this.hooks.onSettingChanged?.(key, value);
  }
  async allSettings(): Promise<SettingEntry[]> {
    return this.read((db) => db.getAll('settings') as Promise<SettingEntry[]>);
  }

  async appendError(record: ErrorRecord): Promise<void> {
    return this.write({ op: 'appendError', value: record }, async (db) => {
      const tx = db.transaction('errors', 'readwrite');
      await tx.store.add(record);
      const extra = (await tx.store.count()) - ERRORS_MAX;
      if (extra > 0) {
        let cursor = await tx.store.openCursor();
        let removed = 0;
        while (cursor !== null && removed < extra) {
          await cursor.delete();
          removed++;
          cursor = await cursor.continue();
        }
      }
      await tx.done;
    });
  }
  async listErrors(): Promise<ErrorRecord[]> {
    return this.read((db) => db.getAll('errors') as Promise<ErrorRecord[]>);
  }
  async clearErrors(): Promise<void> {
    return this.write(undefined, async (db) => {
      await db.clear('errors');
    });
  }

  async addSnapshot(record: SnapshotRecord): Promise<void> {
    return this.write(undefined, async (db) => {
      await db.add('snapshots', record);
    });
  }
  async listSnapshots(): Promise<SnapshotRecord[]> {
    return this.read((db) => db.getAll('snapshots') as Promise<SnapshotRecord[]>);
  }

  async exportAll(): Promise<ProgressSnapshot> {
    const meta = await this.getMeta();
    return this.read(async (db) => {
      const tx = db.transaction([...ALL_STORES], 'readonly');
      const [attempts, levelProgress, reviewQueue, unlocks, labState, labSandbox, settings, errors, snapshots] = await Promise.all([
        tx.objectStore('attempts').getAll() as Promise<Attempt[]>,
        tx.objectStore('levelProgress').getAll() as Promise<LevelProgress[]>,
        tx.objectStore('reviewQueue').getAll() as Promise<ReviewQueueEntry[]>,
        tx.objectStore('unlocks').getAll() as Promise<Unlock[]>,
        tx.objectStore('labState').getAll() as Promise<LabState[]>,
        tx.objectStore('labSandbox').getAll() as Promise<LabSandbox[]>,
        tx.objectStore('settings').getAll() as Promise<SettingEntry[]>,
        tx.objectStore('errors').getAll() as Promise<ErrorRecord[]>,
        tx.objectStore('snapshots').getAll() as Promise<SnapshotRecord[]>,
      ]);
      await tx.done;
      return { meta, attempts: sortAttempts(attempts), levelProgress, reviewQueue, unlocks, labState, labSandbox, settings, errors, snapshots };
    });
  }

  /** 在記憶體中合併（packages/progress 的 importSnapshot）後整批寫回：一個交易內清空資料 store 再寫入，避免寫到一半 */
  async importAll(incoming: ProgressData, options: ImportOptions): Promise<ProgressSnapshot> {
    const current = await this.exportAll();
    const next = importSnapshot(current, incoming, options);
    await this.write(undefined, async (db) => {
      const tx = db.transaction(['meta', ...DATA_STORES], 'readwrite');
      await tx.objectStore('meta').put({ key: META_KEY, ...next.meta });
      for (const name of DATA_STORES) {
        const store = tx.objectStore(name);
        await store.clear();
        for (const row of next[name]) await store.put(row);
      }
      await tx.done;
    });
    // 偏好只有勾選套用時才會變；學習資料的鍵（收藏）不論選項都可能變，一併通知（目前的鏡像只收 locale 與 timerEnabled，收藏不經過這個 hook 讀）
    for (const s of next.settings) if (options.settings || LEARNING_SETTING_KEYS.includes(s.key)) this.hooks.onSettingChanged?.(s.key, s.value);
    return next;
  }

  async rebuildLevelProgress(levels: readonly LevelSpec[], options: DeriveOptions = {}): Promise<LevelProgress[]> {
    const attempts = await this.listAttempts();
    const derived = deriveLevelProgress(attempts, levels, options);
    await this.write(undefined, async (db) => {
      const tx = db.transaction('levelProgress', 'readwrite');
      await tx.store.clear();
      for (const row of derived) await tx.store.put(row);
      await tx.done;
    });
    return derived;
  }

  /** 每個寫入都已 await 交易完成，沒有累積的寫入 */
  async flush(): Promise<void> {}

  async close(): Promise<void> {
    this.closed = true;
    this.db?.close();
    this.db = null;
  }
}
