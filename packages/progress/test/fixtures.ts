// 測試共用的自編資料：ID、時間與數字都是自編的，與老師的教材無關。
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type {
  Attempt,
  LabSandbox,
  LabState,
  LevelProgress,
  Meta,
  ProgressData,
  ProgressSnapshot,
  ReviewQueueEntry,
  SettingEntry,
  Unlock,
} from '../src/index.ts';
import { emptySnapshot } from '../src/index.ts';

export const DEVICE_A = 'd_1a2b3c4d';
export const DEVICE_B = 'd_9z8y7x6w';
export const Q1 = 'q_7k2m9x4a';
export const Q2 = 'q_3p8w5n2d';
export const Q3 = 'q_6t4r2k9m';
export const LV1 = 'lv_3n8p5w2d';
export const LV2 = 'lv_8k2m7q4x';
export const CH1 = 'ch_4m7x2k';
export const STORY1 = 'story_8k3p6t';
export const STEP1 = 'st_2x9k4m';
export const STEP2 = 'st_7h4n2q';
export const TERM1 = 'tm_5p8k2w9x';

export const T0 = '2026-03-01T08:00:00.000Z';
export const T1 = '2026-03-01T08:05:00.000Z';
export const T2 = '2026-03-02T09:00:00.000Z';
export const T3 = '2026-03-03T10:00:00.000Z';

/** 決定性的假亂數（線性同餘），只給測試用 */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const sha256 = (text: string): Uint8Array => new Uint8Array(createHash('sha256').update(text, 'utf8').digest());
export const deflate = (bytes: Uint8Array): Uint8Array => new Uint8Array(deflateRawSync(bytes));
export const inflate = (bytes: Uint8Array): Uint8Array => new Uint8Array(inflateRawSync(bytes));
export const identity = (bytes: Uint8Array): Uint8Array => bytes;

let seq = 0;
export function attemptId(n?: number): string {
  const v = n ?? ++seq;
  return `a_${String(v).padStart(12, '0')}`;
}

export function attempt(partial: Partial<Attempt> & { questionId: string; answeredAt: string }): Attempt {
  return {
    attemptId: attemptId(),
    rev: 1,
    levelId: LV1,
    chapterId: CH1,
    answer: 'o_a1b2',
    correct: true,
    deviceId: DEVICE_A,
    source: 'play',
    ...partial,
  };
}

export function level(partial: Partial<LevelProgress> & { levelId: string }): LevelProgress {
  return { stars: 1, bestScore: 0.6, firstCompletedAt: T1, lastPlayedAt: T1, ...partial };
}

export function review(partial: Partial<ReviewQueueEntry> & { questionId: string }): ReviewQueueEntry {
  return { rev: 1, lastResult: 'wrong', lastAnsweredAt: T1, box: 1, dueAt: '2026-03-02', wrongCount: 1, status: 'active', addedBy: 'auto', ...partial };
}

export function unlock(id: string, unlockedAt: string): Unlock {
  return { id, kind: id.startsWith('term:') ? 'term' : 'badge', unlockedAt };
}

export function labState(partial: Partial<LabState> = {}): LabState {
  return { storyId: STORY1, stepId: STEP1, updatedAt: T1, ...partial };
}

export function sandbox(partial: Partial<LabSandbox> = {}): LabSandbox {
  return {
    id: 'sandbox-default',
    basedOn: { story: STORY1, storyRev: 1, throughStep: STEP1 },
    policy: 'teacher@1',
    layout: 'teacher@1',
    overrides: [{ stepId: STEP2, eventId: 'e1', param: 'amount', value: 4200 }],
    inserted: [{ id: 'local_1', after: STEP1, events: [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 3100 } }] }],
    removed: [],
    updatedAt: T1,
    ...partial,
  };
}

export function setting(key: string, value: SettingEntry['value'], updatedAt = T1): SettingEntry {
  return { key, value, updatedAt };
}

export function meta(partial: Partial<Meta> = {}): Meta {
  return { deviceId: DEVICE_A, createdAt: T0, dbSchemaVersion: 1, appVersion: '0.2.0', contentVersion: 3, importHistory: [], ...partial };
}

export function data(partial: Partial<ProgressData> = {}): ProgressData {
  return { attempts: [], levelProgress: [], reviewQueue: [], unlocks: [], labState: [], labSandbox: [], settings: [], ...partial };
}

export function snapshot(partial: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { ...emptySnapshot(meta()), ...partial };
}

/** 一份有東西的快照：兩筆作答、一關、一筆錯題、兩個解鎖、故事進度、自由實驗、兩個設定 */
export function populatedSnapshot(): ProgressSnapshot {
  return snapshot({
    attempts: [
      attempt({ attemptId: 'a_000000000101', questionId: Q1, answeredAt: T0, correct: true }),
      attempt({ attemptId: 'a_000000000102', questionId: Q2, answeredAt: T1, correct: false, answer: ['o_b8k2'] }),
    ],
    levelProgress: [level({ levelId: LV1, stars: 1, bestScore: 0.5, firstCompletedAt: T1, lastPlayedAt: T1 })],
    reviewQueue: [review({ questionId: Q2 })],
    unlocks: [unlock(`term:${TERM1}`, T0), unlock('badge:chapter-complete-1', T1)],
    labState: [labState()],
    labSandbox: [sandbox()],
    settings: [
      setting('locale', 'zh-TW'),
      setting('timerEnabled', false),
      setting('labView', { policy: 'teacher@1', window: 'cumulative', statement: 'bs', journalLayerOpen: false }),
    ],
  });
}
