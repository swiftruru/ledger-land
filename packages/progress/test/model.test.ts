import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_ID_RE,
  Attempt,
  DB_SCHEMA_VERSION,
  DEVICE_ID_RE,
  type JsonValue,
  LabSandbox,
  ProgressSnapshot,
  ReviewQueueEntry,
  SETTING_SCHEMAS,
  Unlock,
  generateAttemptId,
  generateDeviceId,
} from '../src/index.ts';
import { attempt, populatedSnapshot, review, sandbox, seededRandom, Q1, T1 } from './fixtures.ts';

describe('ID 產生', () => {
  it('deviceId 是 d_ 加 8 碼、attemptId 是 a_ 加 12 碼 Crockford 小寫，且由注入的亂數決定', () => {
    const d1 = generateDeviceId(seededRandom(7));
    const d2 = generateDeviceId(seededRandom(7));
    expect(d1).toBe(d2);
    expect(d1).toMatch(DEVICE_ID_RE);
    expect(d1).toHaveLength(10);
    const a = generateAttemptId(seededRandom(11));
    expect(a).toMatch(ATTEMPT_ID_RE);
    expect(a).toHaveLength(14);
    expect(a).not.toMatch(/[ilou]/);
  });
  it('亂數超出 [0, 1) 是程式錯誤', () => {
    expect(() => generateDeviceId(() => 1)).toThrow(RangeError);
  });
  it('schema 版本從 1 開始', () => {
    expect(DB_SCHEMA_VERSION).toBe(1);
  });
});

describe('Zod schema', () => {
  it('接受合法的作答紀錄，拒絕多餘欄位與壞時間', () => {
    expect(Attempt.safeParse(attempt({ questionId: Q1, answeredAt: T1 })).success).toBe(true);
    expect(Attempt.safeParse({ ...attempt({ questionId: Q1, answeredAt: T1 }), extra: 1 }).success).toBe(false);
    expect(Attempt.safeParse(attempt({ questionId: Q1, answeredAt: '2026-03-01' })).success).toBe(false);
    expect(Attempt.safeParse(attempt({ questionId: Q1, answeredAt: '2026-03-01T08:00:00+08:00' })).success).toBe(true);
    expect(Attempt.safeParse(attempt({ questionId: 'q_bad', answeredAt: T1 })).success).toBe(false);
  });
  it('各題型的 answer 形狀都能存（字串、陣列、布林、物件）', () => {
    const answers: JsonValue[] = [
      'o_b8k2',
      ['o_2k7m', 'o_8p3w'],
      true,
      'is_gross_profit',
      { it_4k2m: 'asset' },
      { t1: 'up', t3: 2100 },
      [[{ account: 'cash', side: 'debit', amount: 10 }]],
    ];
    for (const answer of answers) {
      expect(Attempt.safeParse(attempt({ questionId: Q1, answeredAt: T1, answer })).success).toBe(true);
    }
  });
  it('錯題本的 dueAt 是本地日期；unlock 的 kind 要和 id 前綴一致', () => {
    expect(ReviewQueueEntry.safeParse(review({ questionId: Q1, dueAt: T1 })).success).toBe(false);
    expect(ReviewQueueEntry.safeParse(review({ questionId: Q1, dueAt: '2026-03-02' })).success).toBe(true);
    expect(Unlock.safeParse({ id: 'term:tm_5p8k2w9x', kind: 'badge', unlockedAt: T1 }).success).toBe(false);
    expect(Unlock.safeParse({ id: 'badge:x', kind: 'badge', unlockedAt: T1 }).success).toBe(true);
  });
  it('自由實驗的形狀同 03 第 3.7 節；整份快照可驗證', () => {
    expect(LabSandbox.safeParse(sandbox()).success).toBe(true);
    expect(LabSandbox.safeParse(sandbox({ inserted: [{ id: 'st_abc123', after: 'st_2x9k4m', events: [] }] as never })).success).toBe(false);
    expect(ProgressSnapshot.safeParse(populatedSnapshot()).success).toBe(true);
  });
  it('已知設定鍵有各自的值 schema', () => {
    expect(SETTING_SCHEMAS.labView.safeParse({ policy: 'ifrs@1', window: 'transaction', statement: 'cf', journalLayerOpen: true }).success).toBe(true);
    expect(SETTING_SCHEMAS.labView.safeParse({ policy: 'ifrs@1', window: 'weekly', statement: 'cf', journalLayerOpen: true }).success).toBe(false);
    expect(SETTING_SCHEMAS.persistResult.safeParse({ granted: false, trigger: 'launch', at: T1 }).success).toBe(true);
  });
});
