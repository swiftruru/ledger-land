// 暫存佇列（06 第 4.3、4.4 節、14 第 5.2 節的快速跳頁補強）：localStorage 的 ll:pending 存還沒確定落地的寫入，下次啟動（或重新整理）後依序重放到 IndexedDB。
// 三種情況會留在佇列：(1) IndexedDB 連線因為其他分頁升級而關閉（suspend）；(2) 寫入重試仍失敗；
// (3) 每筆寫入在開交易之前就先同步排進佇列、交易 complete 之後才移除，所以頁面在交易完成前被關閉（作答後馬上整頁跳轉、
// pagehide、visibilitychange 轉 hidden 之後被系統回收）時，這一筆仍在 localStorage，下次啟動由 replayPending 補寫。
// 重放的每一種操作都是冪等的（attemptId 已存在就略過、put 與 delete 重做結果相同），所以交易其實已經完成但來不及移除也不會重複。
// 重放先比對新舊（core-1，2026-10-25）：佇列裡的項目可能是別的分頁或很久以前留下的，資料庫裡已經有較新的值時不能蓋回舊值。
// 星星與分數用 mergeLevelProgress 取大、設定與實驗室狀態比 updatedAt、錯題本比 (rev, lastAnsweredAt)、刪除比排入時間（PendingEntry.at）。
// 還活著的分頁正在寫的項目不重放：有 Web Locks 時，佇列裡有自己的項目就持有 ll:pending:<token> 鎖，重放前查詢持有中的鎖，跳過那些 token 的項目。
// 只在有項目時才持有鎖（不是整個分頁存活期間），讓頁面離開時通常沒有鎖，不影響往返快取。
// 取捨：刪除不留紀錄，所以「舊的 putReview 在使用者從另一個分頁手動移除之後才重放」仍會把那一題救回錯題本（要排入的分頁在交易完成前被關閉才會發生）。
// 另外 ll:lite 存精簡快照（各關星星、錯題本、解鎖），只在寫入失敗時更新。
import {
  canonicalJson,
  compareIso,
  compareNumbers,
  mergeLevelProgress,
  type Attempt,
  type ErrorRecord,
  type JsonValue,
  type LabSandbox,
  type LabState,
  type LevelProgress,
  type ProgressStore,
  type ReviewQueueEntry,
  type Unlock,
} from '@ledgerland/progress';
import { nowIso, secureRandom } from './app-info.ts';

export const PENDING_KEY = 'll:pending';
export const LITE_KEY = 'll:lite';
/** Web Locks 的鎖名稱前綴：ll:pending:<token> 表示該分頁還有寫入在進行中 */
export const PENDING_LOCK_PREFIX = 'll:pending:';

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

/** 佇列裡的一筆：id 讓寫入完成時能只移除自己這一筆（其他分頁或後來的寫入可能已經排在後面）；id 是 <token>-<序號>。
 *  at 是排入佇列的時間（重放刪除時比對用）；M2 的舊格式與 2026-10-25 之前排入的項目沒有 at */
export interface PendingEntry {
  readonly id: string;
  readonly op: PendingOp;
  readonly at?: string;
}

/** Web Locks（navigator.locks）的最小介面，測試時用假物件 */
export interface PendingLocks {
  request(name: string, callback: () => Promise<void>): Promise<unknown>;
}

/** navigator.locks.query() 的結果（LockManagerSnapshot）裡，持有中的 ll:pending:<token> 鎖對應的 token；還在排隊（pending）的不算 */
export function liveTokensFrom(snapshot: {
  readonly held?: readonly { readonly name?: string }[];
  readonly pending?: readonly { readonly name?: string }[];
}): Set<string> {
  const out = new Set<string>();
  for (const l of snapshot.held ?? []) if (l.name?.startsWith(PENDING_LOCK_PREFIX) === true) out.add(l.name.slice(PENDING_LOCK_PREFIX.length));
  return out;
}

/** 項目 id 的 token 部分（最後一個 - 之前）；舊格式的 legacy-<i> 得到 legacy */
function tokenOf(id: string): string {
  const i = id.lastIndexOf('-');
  return i < 0 ? id : id.slice(0, i);
}

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

function isPendingOp(x: unknown): x is PendingOp {
  return typeof x === 'object' && x !== null && typeof (x as { op?: unknown }).op === 'string';
}

function isEntry(x: unknown): x is PendingEntry {
  return typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string' && isPendingOp((x as { op?: unknown }).op);
}

function randomToken(): string {
  return Math.floor(secureRandom() * 2 ** 32).toString(32);
}

export class PendingQueue {
  private seq = 0;
  /** 這個分頁的識別：項目 id 的前綴，也是鎖名稱 ll:pending:<token> 的後半 */
  readonly token: string;
  /** 自己排入、還沒移除的項目 id；有項目時持有鎖 */
  private readonly own = new Set<string>();
  private releaseLock: (() => void) | null = null;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = PENDING_KEY,
    token?: string,
    private readonly locks: PendingLocks | null = null,
  ) {
    this.token = token ?? randomToken();
  }

  /** 目前的全部項目（依排入順序）。M2 的舊格式（直接存 PendingOp 的陣列）讀到時就地換成新格式 */
  entries(): PendingEntry[] {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      let legacy = false;
      const out: PendingEntry[] = [];
      parsed.forEach((item: unknown, i) => {
        if (isEntry(item)) out.push(item);
        else if (isPendingOp(item)) {
          legacy = true;
          out.push({ id: `legacy-${i}`, op: item });
        }
      });
      if (legacy) this.save(out);
      return out;
    } catch {
      return [];
    }
  }

  list(): PendingOp[] {
    return this.entries().map((e) => e.op);
  }

  /** 排進佇列（同步寫 localStorage），回傳這一筆的 id 給 remove 用；at 是排入的時間（預設現在） */
  push(op: PendingOp, at: string = nowIso()): string {
    const id = `${this.token}-${++this.seq}`;
    this.save([...this.entries(), { id, op, at }]);
    this.own.add(id);
    this.holdLock();
    return id;
  }

  /** 只移除這一筆；其他項目（別的分頁或後來排進來的）不動 */
  remove(id: string): void {
    const rest = this.entries().filter((e) => e.id !== id);
    this.save(rest);
    this.disown(id);
  }

  /** 這一筆不再是進行中的寫入（失敗或 suspend 時留給下次啟動重放）：留在佇列，但不再因為它持有鎖，其他分頁重放時可以處理 */
  disown(id: string): void {
    if (this.own.delete(id) && this.own.size === 0) this.dropLock();
  }

  /** 有自己的項目時持有 ll:pending:<token>（其他分頁重放時跳過這些項目）；鎖 API 不可用或失敗時什麼都不做 */
  private holdLock(): void {
    if (this.locks === null || this.releaseLock !== null) return;
    const granted = new Promise<void>((resolve) => {
      this.releaseLock = resolve;
    });
    try {
      // 回呼回傳的 Promise 要等 releaseLock 被呼叫才 resolve，鎖就一直持有到那時；拿到鎖之前已經放掉（dropLock 先 resolve 了）就立刻歸還
      void this.locks.request(`${PENDING_LOCK_PREFIX}${this.token}`, () => granted).catch(() => {});
    } catch {
      this.releaseLock = null;
    }
  }

  private dropLock(): void {
    const release = this.releaseLock;
    this.releaseLock = null;
    release?.();
  }

  clear(): void {
    this.own.clear();
    this.dropLock();
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* 忽略 */
    }
  }

  get size(): number {
    return this.entries().length;
  }

  private save(entries: readonly PendingEntry[]): void {
    try {
      if (entries.length === 0) this.storage.removeItem(this.key);
      else this.storage.setItem(this.key, JSON.stringify(entries));
    } catch {
      /* 寫不進 localStorage 時只能放棄這一筆 */
    }
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

export interface ReplayOptions {
  /** 還活著的分頁（持有 ll:pending:<token> 鎖）的 token：它們的項目不重放，留給那個分頁自己移除 */
  readonly liveTokens?: ReadonlySet<string>;
  /** setSetting 因資料庫的值較新而略過時呼叫，用資料庫的值重寫一次 localStorage 的鏡像 */
  readonly onSettingKept?: (key: string, value: JsonValue) => void;
}

/** 資料庫裡的紀錄比較新嗎（updatedAt 較晚）；相同時算不比較新，照常重做（冪等） */
const isNewer = (cur: { readonly updatedAt: string } | undefined, incoming: string): boolean => cur !== undefined && compareIso(cur.updatedAt, incoming) > 0;

/** 重放一筆：先讀現值、比較後才寫（core-1）；addAttempt、addUnlock 本來就冪等，appendError 只在失敗時才排入 */
async function replayEntry(store: ProgressStore, entry: PendingEntry, options: ReplayOptions): Promise<void> {
  const op = entry.op;
  switch (op.op) {
    case 'putLevelProgress': {
      const cur = await store.getLevelProgress(op.value.levelId);
      if (cur === undefined) return store.putLevelProgress(op.value);
      // 星星與分數取大、firstCompletedAt 取早、lastPlayedAt 取晚（與匯入合併同一套規則）
      const merged = mergeLevelProgress([cur], [op.value])[0]!;
      if (canonicalJson(merged) === canonicalJson(cur)) return;
      return store.putLevelProgress(merged);
    }
    case 'putReview': {
      const cur = await store.getReview(op.value.questionId);
      // 與匯入合併的 pickReviewEntry 同一套比較：rev 較高、再看最後作答時間
      if (cur !== undefined && (compareNumbers(cur.rev, op.value.rev) || compareIso(cur.lastAnsweredAt, op.value.lastAnsweredAt)) > 0) return;
      return store.putReview(op.value);
    }
    case 'removeReview': {
      if (entry.at !== undefined) {
        const cur = await store.getReview(op.questionId);
        // 移除之後又答錯過（lastAnsweredAt 較晚）：那是新的一筆錯題，不刪
        if (cur === undefined || compareIso(cur.lastAnsweredAt, entry.at) > 0) return;
      }
      return store.removeReview(op.questionId);
    }
    case 'setSetting': {
      const cur = await store.getSetting(op.key);
      if (cur !== undefined && isNewer(cur, op.updatedAt)) {
        options.onSettingKept?.(cur.key, cur.value);
        return;
      }
      return store.setSetting(op.key, op.value, op.updatedAt);
    }
    case 'putLabState': {
      if (isNewer(await store.getLabState(op.value.storyId), op.value.updatedAt)) return;
      return store.putLabState(op.value);
    }
    case 'putLabSandbox': {
      if (isNewer(await store.getLabSandbox(op.value.id), op.value.updatedAt)) return;
      return store.putLabSandbox(op.value);
    }
    case 'removeLabSandbox': {
      if (entry.at !== undefined && isNewer(await store.getLabSandbox(op.id), entry.at)) return;
      return store.removeLabSandbox(op.id);
    }
    default:
      return applyPending(store, op);
  }
}

/**
 * 依序重放，每一筆成功就從佇列移除；中途失敗就把剩下的留著（下次再試）。
 * 不整批 clear：store 本身的寫入會在交易期間把新項目排進同一個佇列，整批清掉會誤刪它們。
 * 重放是冪等的：同一筆重放兩次（例如重放到一半頁面又被關閉）結果相同；資料庫已有較新的值時不寫（replayEntry）。
 * options.liveTokens 的項目（還活著的分頁正在寫）跳過、不計入回傳的筆數。
 */
export async function replayPending(store: ProgressStore, queue: PendingQueue, options: ReplayOptions = {}): Promise<number> {
  const entries = queue.entries();
  if (entries.length === 0) return 0;
  let done = 0;
  for (const entry of entries) {
    if (options.liveTokens?.has(tokenOf(entry.id)) === true) continue;
    await replayEntry(store, entry, options);
    queue.remove(entry.id);
    done++;
  }
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
