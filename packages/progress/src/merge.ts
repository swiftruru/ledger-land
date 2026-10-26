// 匯入的合併與覆蓋規則（06 第 4.6 節的合併表）。全部是純函式，輸出一律排序成決定性的順序，
// 所以 attempts 與 unlocks 的合併可交換、整體可冪等（merge(a, a) 與正規化後的 a 相同）。
// settings 裡的學習資料（LEARNING_SETTING_KEYS，目前只有收藏）另有規則：不受「也套用設定」控制，合併取聯集、覆蓋取備份（core-2，2026-10-25）。
import { recomputeWrongCount } from './derive.ts';
import { LEARNING_SETTING_KEYS, idListOf } from './model.ts';
import type {
  Attempt,
  ImportHistoryEntry,
  ImportMode,
  LabSandbox,
  LabState,
  LevelProgress,
  ProgressData,
  ProgressSnapshot,
  ReviewQueueEntry,
  SettingEntry,
  Unlock,
} from './schemas.ts';
import { compareIso, earliestIso, latestIso } from './time.ts';
import { canonicalJson, compareCodeUnits, compareNumbers } from './util.ts';

export interface MergeOptions {
  /** 是否也套用備份裡的設定（匯入畫面的「也套用語言與計時設定」；預設不匯入）；學習資料的鍵（收藏）不受這個選項控制 */
  readonly settings: boolean;
  /** 合併（預設）或覆蓋；只影響學習資料的鍵：合併取聯集、覆蓋取來源的值 */
  readonly mode?: ImportMode;
}

/** 匯入來源的描述，寫進 meta.importHistory */
export interface ImportSource {
  readonly deviceId: string;
  readonly origin?: string;
  readonly mode?: ImportHistoryEntry['sourceMode'];
  readonly exportedAt?: string;
}

export interface ImportOptions extends MergeOptions {
  readonly mode: ImportMode;
  readonly importedAt: string;
  readonly source: ImportSource;
}

/** 作答紀錄的去重鍵：題目 id、rev、作答時間、deviceId（06 第 4.6 節） */
export function attemptKey(a: Attempt): string {
  return canonicalJson([a.questionId, a.rev, a.answeredAt, a.deviceId]);
}

/** 決定性的排序：時間、題目、attemptId 之後再以 canonical JSON 決定，兩筆不同的紀錄（例如 attemptId 相同但 deviceId 或 rev 不同）才不會依輸入順序排列 */
function sortAttempts(list: readonly Attempt[]): Attempt[] {
  return [...list].sort(
    (x, y) =>
      compareIso(x.answeredAt, y.answeredAt) ||
      compareCodeUnits(x.questionId, y.questionId) ||
      compareCodeUnits(x.attemptId, y.attemptId) ||
      compareCodeUnits(canonicalJson(x), canonicalJson(y)),
  );
}

/** 聯集去重；同鍵時取 attemptId 較小的一筆（再以 canonical JSON 決定），讓結果與順序無關 */
export function mergeAttempts(a: readonly Attempt[], b: readonly Attempt[]): Attempt[] {
  const map = new Map<string, Attempt>();
  for (const x of [...a, ...b]) {
    const k = attemptKey(x);
    const prev = map.get(k);
    if (prev === undefined || (compareCodeUnits(x.attemptId, prev.attemptId) || compareCodeUnits(canonicalJson(x), canonicalJson(prev))) < 0) map.set(k, x);
  }
  return sortAttempts([...map.values()]);
}

function mergeLevelProgressEntry(x: LevelProgress, y: LevelProgress): LevelProgress {
  const first =
    x.firstCompletedAt === undefined
      ? y.firstCompletedAt
      : y.firstCompletedAt === undefined
        ? x.firstCompletedAt
        : earliestIso(x.firstCompletedAt, y.firstCompletedAt);
  const out: LevelProgress = {
    levelId: x.levelId,
    stars: x.stars > y.stars ? x.stars : y.stars,
    bestScore: Math.max(x.bestScore, y.bestScore),
    lastPlayedAt: latestIso(x.lastPlayedAt, y.lastPlayedAt),
  };
  return first === undefined ? out : { ...out, firstCompletedAt: first };
}

export function mergeLevelProgress(a: readonly LevelProgress[], b: readonly LevelProgress[]): LevelProgress[] {
  const map = new Map<string, LevelProgress>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.levelId);
    map.set(x.levelId, prev === undefined ? x : mergeLevelProgressEntry(prev, x));
  }
  return [...map.values()].sort((x, y) => compareCodeUnits(x.levelId, y.levelId));
}

/** 同一題以最後一次作答結果為準；rev 不同時保留較高的 rev；全部相同時以 canonical JSON 決定，與順序無關 */
function pickReviewEntry(x: ReviewQueueEntry, y: ReviewQueueEntry): ReviewQueueEntry {
  const c = compareNumbers(x.rev, y.rev) || compareIso(x.lastAnsweredAt, y.lastAnsweredAt) || compareCodeUnits(canonicalJson(x), canonicalJson(y));
  return c >= 0 ? x : y;
}

export function mergeReviewQueue(a: readonly ReviewQueueEntry[], b: readonly ReviewQueueEntry[], mergedAttempts: readonly Attempt[]): ReviewQueueEntry[] {
  const map = new Map<string, ReviewQueueEntry>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.questionId);
    map.set(x.questionId, prev === undefined ? x : pickReviewEntry(prev, x));
  }
  const wrong = recomputeWrongCount(mergedAttempts);
  return [...map.values()].map((e) => ({ ...e, wrongCount: wrong.get(e.questionId) ?? 0 })).sort((x, y) => compareCodeUnits(x.questionId, y.questionId));
}

export function mergeUnlocks(a: readonly Unlock[], b: readonly Unlock[]): Unlock[] {
  const map = new Map<string, Unlock>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.id);
    map.set(x.id, prev === undefined ? x : { ...prev, unlockedAt: earliestIso(prev.unlockedAt, x.unlockedAt) });
  }
  return [...map.values()].sort((x, y) => compareCodeUnits(x.id, y.id));
}

function pickLater<T extends { readonly updatedAt: string }>(x: T, y: T): T {
  const c = compareIso(x.updatedAt, y.updatedAt) || compareCodeUnits(canonicalJson(x), canonicalJson(y));
  return c >= 0 ? x : y;
}

export function mergeLabState(a: readonly LabState[], b: readonly LabState[]): LabState[] {
  const map = new Map<string, LabState>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.storyId);
    map.set(x.storyId, prev === undefined ? x : pickLater(prev, x));
  }
  return [...map.values()].sort((x, y) => compareCodeUnits(x.storyId, y.storyId));
}

/** 整筆取 updatedAt 較晚者；overrides、inserted、removed 不逐項合併（三者互相依賴） */
export function mergeLabSandbox(a: readonly LabSandbox[], b: readonly LabSandbox[]): LabSandbox[] {
  const map = new Map<string, LabSandbox>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.id);
    map.set(x.id, prev === undefined ? x : pickLater(prev, x));
  }
  return [...map.values()].sort((x, y) => compareCodeUnits(x.id, y.id));
}

const isLearningKey = (key: string): boolean => LEARNING_SETTING_KEYS.includes(key);

/** 學習資料的 ID 清單取聯集：本機的順序在前，來源新的接在後面；updatedAt 取較晚 */
function unionIdList(local: SettingEntry, incoming: SettingEntry): SettingEntry {
  const list = idListOf(local.value);
  const seen = new Set(list);
  for (const id of idListOf(incoming.value)) if (!seen.has(id)) list.push(id);
  return { key: local.key, value: list, updatedAt: latestIso(local.updatedAt, incoming.updatedAt) };
}

/**
 * 設定：偏好的鍵在套用時以來源的值覆蓋同鍵（不比較時間，使用者是明確勾選要套用）、不套用時保留本機。
 * 學習資料的鍵（LEARNING_SETTING_KEYS）不看 apply：合併模式兩邊都有就取聯集、只有一邊就用那一邊；覆蓋模式取來源的值，來源沒有就移除。
 */
export function mergeSettings(current: readonly SettingEntry[], incoming: readonly SettingEntry[], apply: boolean, mode: ImportMode = 'merge'): SettingEntry[] {
  const map = new Map<string, SettingEntry>();
  for (const x of current) if (mode === 'merge' || !isLearningKey(x.key)) map.set(x.key, x);
  for (const x of incoming) {
    if (isLearningKey(x.key)) {
      const local = map.get(x.key);
      map.set(x.key, local === undefined ? x : unionIdList(local, x));
    } else if (apply) map.set(x.key, x);
  }
  return [...map.values()].sort((x, y) => compareCodeUnits(x.key, y.key));
}

/** 合併兩份學習資料（不含 meta、errors、snapshots） */
export function mergeData(current: ProgressData, incoming: ProgressData, options: MergeOptions): ProgressData {
  const attempts = mergeAttempts(current.attempts, incoming.attempts);
  return {
    attempts,
    levelProgress: mergeLevelProgress(current.levelProgress, incoming.levelProgress),
    reviewQueue: mergeReviewQueue(current.reviewQueue, incoming.reviewQueue, attempts),
    unlocks: mergeUnlocks(current.unlocks, incoming.unlocks),
    labState: mergeLabState(current.labState, incoming.labState),
    labSandbox: mergeLabSandbox(current.labSandbox, incoming.labSandbox),
    settings: mergeSettings(current.settings, incoming.settings, options.settings, options.mode ?? 'merge'),
  };
}

function historyEntry(incoming: ProgressData, options: ImportOptions): ImportHistoryEntry {
  const e: ImportHistoryEntry = {
    importedAt: options.importedAt,
    mode: options.mode,
    sourceDeviceId: options.source.deviceId,
    attempts: incoming.attempts.length,
  };
  return {
    ...e,
    ...(options.source.origin === undefined ? {} : { sourceOrigin: options.source.origin }),
    ...(options.source.mode === undefined ? {} : { sourceMode: options.source.mode }),
    ...(options.source.exportedAt === undefined ? {} : { exportedAt: options.source.exportedAt }),
  };
}

/** 合併模式：meta.deviceId 保留本機、importHistory 加一筆；errors 與 snapshots 不匯入 */
export function mergeSnapshots(current: ProgressSnapshot, incoming: ProgressData, options: ImportOptions): ProgressSnapshot {
  const data = mergeData(current, incoming, { ...options, mode: 'merge' });
  return {
    ...data,
    meta: { ...current.meta, importHistory: [...current.meta.importHistory, historyEntry(incoming, { ...options, mode: 'merge' })] },
    errors: current.errors,
    snapshots: current.snapshots,
  };
}

/** 覆蓋模式（進階選項）：除了偏好設定之外全部取代（收藏等學習資料也取備份的值）；meta.deviceId 保留本機並記下來源 */
export function replaceSnapshot(current: ProgressSnapshot, incoming: ProgressData, options: ImportOptions): ProgressSnapshot {
  const preferences = current.settings.filter((s) => !isLearningKey(s.key));
  const empty: ProgressData = { attempts: [], levelProgress: [], reviewQueue: [], unlocks: [], labState: [], labSandbox: [], settings: preferences };
  const data = mergeData(empty, incoming, { ...options, mode: 'replace' });
  return {
    ...data,
    meta: { ...current.meta, importHistory: [...current.meta.importHistory, historyEntry(incoming, { ...options, mode: 'replace' })] },
    errors: current.errors,
    snapshots: current.snapshots,
  };
}

/** 依 mode 選擇合併或覆蓋 */
export function importSnapshot(current: ProgressSnapshot, incoming: ProgressData, options: ImportOptions): ProgressSnapshot {
  return options.mode === 'replace' ? replaceSnapshot(current, incoming, options) : mergeSnapshots(current, incoming, options);
}
