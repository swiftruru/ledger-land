// 測試用的資料（全部自編）與共用工具
import { IDBFactory } from 'fake-indexeddb';
import {
  DB_SCHEMA_VERSION,
  V1_STORES,
  migrations,
  type Attempt,
  type LevelProgress,
  type Meta,
  type Migration,
  type MigrationRegistry,
  type Unlock,
} from '@ledgerland/progress';
import type { KeyValueStorage } from '../src/lib/progress/pending.ts';

export const NOW = '2026-10-23T08:00:00.000Z';
export const DEVICE = 'd_9k2m7q4x';

export function meta(overrides: Partial<Meta> = {}): Meta {
  return { deviceId: DEVICE, createdAt: NOW, dbSchemaVersion: DB_SCHEMA_VERSION, appVersion: '0.0.0+test', contentVersion: 3, importHistory: [], ...overrides };
}

export function attempt(n: number, overrides: Partial<Attempt> = {}): Attempt {
  const id = String(n)
    .padStart(12, '0')
    .replace(/[^0-9]/g, '0');
  return {
    attemptId: `a_${id}`,
    questionId: 'q_7f3k2m9x',
    rev: 1,
    levelId: 'lv_k7m2q9xd',
    answer: 'o_b8k2',
    correct: n % 2 === 0,
    answeredAt: `2026-10-2${n % 9}T10:0${n % 10}:00.000Z`,
    deviceId: DEVICE,
    source: 'play',
    ...overrides,
  };
}

export function level(levelId = 'lv_k7m2q9xd', stars: LevelProgress['stars'] = 2): LevelProgress {
  return { levelId, stars, bestScore: 0.8, firstCompletedAt: NOW, lastPlayedAt: NOW };
}

export function badge(id = 'badge:first_level'): Unlock {
  return { id, kind: 'badge', unlockedAt: NOW };
}

/** 每個測試用一個全新的 IndexedDB 工廠，彼此不干擾 */
export function freshIndexedDB(): void {
  globalThis.indexedDB = new IDBFactory();
}

export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** 測試用的假版本 2：在 levelProgress 加 byStars 索引，並把 settings 的 timerEnabled 轉成 timer 物件（會轉換資料） */
const v2: Migration = {
  version: 2,
  description: '測試用：加索引、轉換 timerEnabled',
  describe: () => ({
    createStores: [],
    createIndexes: [{ store: 'levelProgress', index: { name: 'byStars', keyPath: 'stars' } }],
    transformsData: true,
  }),
  transform(snapshot) {
    const settings = Array.isArray(snapshot['settings']) ? (snapshot['settings'] as { key: string; value: unknown; updatedAt: string }[]) : [];
    return {
      ...snapshot,
      settings: settings.map((s) => (s.key === 'timerEnabled' ? { ...s, key: 'timer', value: { enabled: s.value } } : s)),
    };
  },
};

export const TEST_REGISTRY: MigrationRegistry = { ...migrations, 2: v2 };
export { V1_STORES };
