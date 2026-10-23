// 儲存介面（06 第 4.1 節：進度模組是所有讀寫的唯一入口；IndexedDB 的實作在 apps/web，原生儲存日後在 apps/mobile）
// 與記憶體實作 MemoryProgressStore（測試，以及 IndexedDB 完全無法開啟時的降級模式，06 第 4.4 節）。
// 介面不讀時鐘：需要時間的方法（listDueReviews 的 today、setSetting 的 updatedAt）都由呼叫端傳入。
import { dueToday } from '@ledgerland/quiz';
import { deriveLevelProgress, type LevelSpec, type DeriveOptions } from './derive.ts';
import { importSnapshot, type ImportOptions } from './merge.ts';
import {
  type Attempt,
  DB_SCHEMA_VERSION,
  ERRORS_MAX,
  type ErrorRecord,
  type JsonValue,
  type LabSandbox,
  type LabState,
  type LevelProgress,
  type Meta,
  type ProgressData,
  type ProgressSnapshot,
  type ReviewQueueEntry,
  type SettingEntry,
  type SnapshotRecord,
  type Unlock,
  emptySnapshot,
} from './model.ts';
import { compareIso } from './time.ts';
import { clonePlain, compareCodeUnits } from './util.ts';

export interface ListAttemptsQuery {
  readonly questionId?: string;
  readonly rev?: number;
  /** 含起點、含終點的 ISO 時間範圍 */
  readonly from?: string;
  readonly to?: string;
  readonly levelId?: string;
  readonly source?: Attempt['source'];
}

/** 進度儲存介面；每個方法都是非同步，回傳的資料是複本（修改不會影響儲存內容） */
export interface ProgressStore {
  readonly schemaVersion: number;

  getMeta(): Promise<Meta>;
  putMeta(meta: Meta): Promise<void>;

  /** 只增不改；attemptId 已存在時視為同一筆、不覆蓋 */
  addAttempt(attempt: Attempt): Promise<void>;
  /** 依題目、題目加 rev、時間範圍、關卡或來源篩選；一律依 answeredAt 再 attemptId 排序 */
  listAttempts(query?: ListAttemptsQuery): Promise<Attempt[]>;

  getLevelProgress(levelId: string): Promise<LevelProgress | undefined>;
  putLevelProgress(progress: LevelProgress): Promise<void>;
  listLevelProgress(): Promise<LevelProgress[]>;

  getReview(questionId: string): Promise<ReviewQueueEntry | undefined>;
  putReview(entry: ReviewQueueEntry): Promise<void>;
  /** 今天要複習的題目（quiz 的 dueToday：到期且還沒掌握），today 是本地日期 YYYY-MM-DD；limit 預設不限 */
  listDueReviews(today: string, limit?: number): Promise<ReviewQueueEntry[]>;
  listReviews(): Promise<ReviewQueueEntry[]>;
  removeReview(questionId: string): Promise<void>;

  /** 已存在時保留較早的 unlockedAt */
  addUnlock(unlock: Unlock): Promise<void>;
  hasUnlock(id: string): Promise<boolean>;
  listUnlocks(kind?: Unlock['kind']): Promise<Unlock[]>;

  getLabState(storyId: string): Promise<LabState | undefined>;
  putLabState(state: LabState): Promise<void>;
  listLabState(): Promise<LabState[]>;

  getLabSandbox(id: string): Promise<LabSandbox | undefined>;
  putLabSandbox(sandbox: LabSandbox): Promise<void>;
  removeLabSandbox(id: string): Promise<void>;

  getSetting(key: string): Promise<SettingEntry | undefined>;
  setSetting(key: string, value: JsonValue, updatedAt: string): Promise<void>;
  allSettings(): Promise<SettingEntry[]>;

  /** 環狀保留最近 ERRORS_MAX 筆，由實作負責 */
  appendError(record: ErrorRecord): Promise<void>;
  listErrors(): Promise<ErrorRecord[]>;
  clearErrors(): Promise<void>;

  addSnapshot(record: SnapshotRecord): Promise<void>;
  listSnapshots(): Promise<SnapshotRecord[]>;

  /** 整個資料庫的快照（匯出、debug 頁與 migration 用） */
  exportAll(): Promise<ProgressSnapshot>;
  /** 依 options.mode 合併或覆蓋（06 第 4.6 節）；回傳寫入後的快照 */
  importAll(incoming: ProgressData, options: ImportOptions): Promise<ProgressSnapshot>;
  /** 由 attempts 重新推導 levelProgress 並寫回（06 第 4.2 節：另存以加速列表） */
  rebuildLevelProgress(levels: readonly LevelSpec[], options?: DeriveOptions): Promise<LevelProgress[]>;

  /** 把尚未落地的寫入送出（IndexedDB 實作在 blocking、pagehide 時呼叫）；記憶體實作不做事 */
  flush(): Promise<void>;
  close(): Promise<void>;
}

function sortAttempts(list: Attempt[]): Attempt[] {
  return list.sort((x, y) => compareIso(x.answeredAt, y.answeredAt) || compareCodeUnits(x.attemptId, y.attemptId));
}

/** 記憶體實作：所有資料放在一份快照裡；關閉後的操作視為程式錯誤而 throw */
export class MemoryProgressStore implements ProgressStore {
  readonly schemaVersion = DB_SCHEMA_VERSION;
  private state: ProgressSnapshot;
  private closed = false;

  constructor(initial: ProgressSnapshot) {
    this.state = clonePlain(initial);
  }

  /** 以空資料庫起始；meta 由呼叫端提供（deviceId 與時間不在本套件產生） */
  static empty(meta: Meta): MemoryProgressStore {
    return new MemoryProgressStore(emptySnapshot(meta));
  }

  private guard(): void {
    if (this.closed) throw new Error('MemoryProgressStore 已關閉');
  }

  async getMeta(): Promise<Meta> {
    this.guard();
    return clonePlain(this.state.meta);
  }
  async putMeta(meta: Meta): Promise<void> {
    this.guard();
    this.state = { ...this.state, meta: clonePlain(meta) };
  }

  async addAttempt(attempt: Attempt): Promise<void> {
    this.guard();
    if (this.state.attempts.some((a) => a.attemptId === attempt.attemptId)) return;
    this.state = { ...this.state, attempts: [...this.state.attempts, clonePlain(attempt)] };
  }
  async listAttempts(query: ListAttemptsQuery = {}): Promise<Attempt[]> {
    this.guard();
    const list = this.state.attempts.filter(
      (a) =>
        (query.questionId === undefined || a.questionId === query.questionId) &&
        (query.rev === undefined || a.rev === query.rev) &&
        (query.levelId === undefined || a.levelId === query.levelId) &&
        (query.source === undefined || a.source === query.source) &&
        (query.from === undefined || compareIso(a.answeredAt, query.from) >= 0) &&
        (query.to === undefined || compareIso(a.answeredAt, query.to) <= 0),
    );
    return sortAttempts(clonePlain(list));
  }

  async getLevelProgress(levelId: string): Promise<LevelProgress | undefined> {
    this.guard();
    return clonePlain(this.state.levelProgress.find((l) => l.levelId === levelId));
  }
  async putLevelProgress(progress: LevelProgress): Promise<void> {
    this.guard();
    this.state = { ...this.state, levelProgress: upsert(this.state.levelProgress, clonePlain(progress), (l) => l.levelId) };
  }
  async listLevelProgress(): Promise<LevelProgress[]> {
    this.guard();
    return clonePlain(this.state.levelProgress).sort((x, y) => compareCodeUnits(x.levelId, y.levelId));
  }

  async getReview(questionId: string): Promise<ReviewQueueEntry | undefined> {
    this.guard();
    return clonePlain(this.state.reviewQueue.find((r) => r.questionId === questionId));
  }
  async putReview(entry: ReviewQueueEntry): Promise<void> {
    this.guard();
    this.state = { ...this.state, reviewQueue: upsert(this.state.reviewQueue, clonePlain(entry), (r) => r.questionId) };
  }
  async listDueReviews(today: string, limit?: number): Promise<ReviewQueueEntry[]> {
    this.guard();
    return clonePlain(dueToday(this.state.reviewQueue, today, limit ?? this.state.reviewQueue.length));
  }
  async listReviews(): Promise<ReviewQueueEntry[]> {
    this.guard();
    return clonePlain(this.state.reviewQueue).sort((x, y) => compareCodeUnits(x.questionId, y.questionId));
  }
  async removeReview(questionId: string): Promise<void> {
    this.guard();
    this.state = { ...this.state, reviewQueue: this.state.reviewQueue.filter((r) => r.questionId !== questionId) };
  }

  async addUnlock(unlock: Unlock): Promise<void> {
    this.guard();
    const prev = this.state.unlocks.find((u) => u.id === unlock.id);
    if (prev !== undefined && compareIso(prev.unlockedAt, unlock.unlockedAt) <= 0) return;
    this.state = { ...this.state, unlocks: upsert(this.state.unlocks, clonePlain(unlock), (u) => u.id) };
  }
  async hasUnlock(id: string): Promise<boolean> {
    this.guard();
    return this.state.unlocks.some((u) => u.id === id);
  }
  async listUnlocks(kind?: Unlock['kind']): Promise<Unlock[]> {
    this.guard();
    return clonePlain(this.state.unlocks.filter((u) => kind === undefined || u.kind === kind)).sort((x, y) => compareCodeUnits(x.id, y.id));
  }

  async getLabState(storyId: string): Promise<LabState | undefined> {
    this.guard();
    return clonePlain(this.state.labState.find((s) => s.storyId === storyId));
  }
  async putLabState(state: LabState): Promise<void> {
    this.guard();
    this.state = { ...this.state, labState: upsert(this.state.labState, clonePlain(state), (s) => s.storyId) };
  }
  async listLabState(): Promise<LabState[]> {
    this.guard();
    return clonePlain(this.state.labState).sort((x, y) => compareCodeUnits(x.storyId, y.storyId));
  }

  async getLabSandbox(id: string): Promise<LabSandbox | undefined> {
    this.guard();
    return clonePlain(this.state.labSandbox.find((s) => s.id === id));
  }
  async putLabSandbox(sandbox: LabSandbox): Promise<void> {
    this.guard();
    this.state = { ...this.state, labSandbox: upsert(this.state.labSandbox, clonePlain(sandbox), (s) => s.id) };
  }
  async removeLabSandbox(id: string): Promise<void> {
    this.guard();
    this.state = { ...this.state, labSandbox: this.state.labSandbox.filter((s) => s.id !== id) };
  }

  async getSetting(key: string): Promise<SettingEntry | undefined> {
    this.guard();
    return clonePlain(this.state.settings.find((s) => s.key === key));
  }
  async setSetting(key: string, value: JsonValue, updatedAt: string): Promise<void> {
    this.guard();
    this.state = { ...this.state, settings: upsert(this.state.settings, { key, value: clonePlain(value), updatedAt }, (s) => s.key) };
  }
  async allSettings(): Promise<SettingEntry[]> {
    this.guard();
    return clonePlain(this.state.settings).sort((x, y) => compareCodeUnits(x.key, y.key));
  }

  async appendError(record: ErrorRecord): Promise<void> {
    this.guard();
    const errors = [...this.state.errors, clonePlain(record)];
    this.state = { ...this.state, errors: errors.length > ERRORS_MAX ? errors.slice(errors.length - ERRORS_MAX) : errors };
  }
  async listErrors(): Promise<ErrorRecord[]> {
    this.guard();
    return clonePlain(this.state.errors);
  }
  async clearErrors(): Promise<void> {
    this.guard();
    this.state = { ...this.state, errors: [] };
  }

  async addSnapshot(record: SnapshotRecord): Promise<void> {
    this.guard();
    this.state = { ...this.state, snapshots: [...this.state.snapshots, clonePlain(record)] };
  }
  async listSnapshots(): Promise<SnapshotRecord[]> {
    this.guard();
    return clonePlain(this.state.snapshots);
  }

  async exportAll(): Promise<ProgressSnapshot> {
    this.guard();
    return clonePlain(this.state);
  }
  async importAll(incoming: ProgressData, options: ImportOptions): Promise<ProgressSnapshot> {
    this.guard();
    this.state = importSnapshot(this.state, clonePlain(incoming), options);
    return clonePlain(this.state);
  }
  async rebuildLevelProgress(levels: readonly LevelSpec[], options: DeriveOptions = {}): Promise<LevelProgress[]> {
    this.guard();
    const derived = deriveLevelProgress(this.state.attempts, levels, options);
    this.state = { ...this.state, levelProgress: derived };
    return clonePlain(derived);
  }

  async flush(): Promise<void> {
    this.guard();
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

function upsert<T>(list: readonly T[], item: T, keyOf: (x: T) => string): T[] {
  const k = keyOf(item);
  const i = list.findIndex((x) => keyOf(x) === k);
  if (i < 0) return [...list, item];
  const out = [...list];
  out[i] = item;
  return out;
}
