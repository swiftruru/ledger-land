// 06 第 4.6 節合併表：每一列一例（含去重與衝突）、覆蓋模式、importHistory；收藏（settings 的 favourites）是學習資料，合併時取聯集（core-2）
import { describe, expect, it } from 'vitest';
import {
  CREDITS_EGGS_SETTING_KEY,
  FAVOURITES_SETTING_KEY,
  LEARNING_SETTING_KEYS,
  type ImportOptions,
  importSnapshot,
  mergeData,
  mergeSnapshots,
  replaceSnapshot,
} from '../src/index.ts';
import {
  DEVICE_A,
  DEVICE_B,
  LV1,
  LV2,
  Q1,
  Q2,
  Q3,
  STORY1,
  STEP1,
  STEP2,
  T0,
  T1,
  T2,
  T3,
  TERM1,
  attempt,
  data,
  labState,
  level,
  review,
  sandbox,
  setting,
  snapshot,
  unlock,
} from './fixtures.ts';

const opts: ImportOptions = {
  mode: 'merge',
  settings: false,
  importedAt: T3,
  source: { deviceId: DEVICE_B, origin: 'https://example.test', mode: 'browser', exportedAt: T2 },
};

describe('合併規則', () => {
  it('attempts：依（題目、rev、作答時間、deviceId）取聯集去重；同鍵不同 attemptId 取較小者', () => {
    const shared = attempt({ attemptId: 'a_000000000002', questionId: Q1, answeredAt: T0 });
    const sameKeyOtherId = { ...shared, attemptId: 'a_000000000001' };
    const a = data({ attempts: [shared, attempt({ attemptId: 'a_000000000003', questionId: Q2, answeredAt: T1 })] });
    const b = data({ attempts: [sameKeyOtherId, attempt({ attemptId: 'a_000000000004', questionId: Q1, answeredAt: T0, deviceId: DEVICE_B })] });
    const m = mergeData(a, b, { settings: false });
    expect(m.attempts.map((x) => x.attemptId)).toEqual(['a_000000000001', 'a_000000000004', 'a_000000000003']);
  });
  it('levelProgress：stars 與 bestScore 取最大、firstCompletedAt 最早、lastPlayedAt 最晚；沒有 firstCompletedAt 的一邊不影響', () => {
    const a = data({
      levelProgress: [
        level({ levelId: LV1, stars: 1, bestScore: 0.6, firstCompletedAt: T2, lastPlayedAt: T2 }),
        { levelId: LV2, stars: 0, bestScore: 0, lastPlayedAt: T0 },
      ],
    });
    const b = data({
      levelProgress: [
        level({ levelId: LV1, stars: 3, bestScore: 0.4, firstCompletedAt: T1, lastPlayedAt: T1 }),
        level({ levelId: LV2, stars: 2, bestScore: 0.8, firstCompletedAt: T3, lastPlayedAt: T3 }),
      ],
    });
    const m = mergeData(a, b, { settings: false });
    expect(m.levelProgress).toEqual([
      { levelId: LV1, stars: 3, bestScore: 0.6, firstCompletedAt: T1, lastPlayedAt: T2 },
      { levelId: LV2, stars: 2, bestScore: 0.8, firstCompletedAt: T3, lastPlayedAt: T3 },
    ]);
  });
  it('reviewQueue：同題取最後作答者；rev 高者優先；wrongCount 由合併後的 attempts 重算', () => {
    const attempts = [
      attempt({ attemptId: 'a_000000000011', questionId: Q1, answeredAt: T0, correct: false }),
      attempt({ attemptId: 'a_000000000012', questionId: Q1, answeredAt: T1, correct: false, deviceId: DEVICE_B }),
      attempt({ attemptId: 'a_000000000013', questionId: Q2, answeredAt: T1, correct: true }),
    ];
    const a = data({
      attempts: attempts.slice(0, 1),
      reviewQueue: [
        review({ questionId: Q1, lastAnsweredAt: T2, box: 2, lastResult: 'correct', wrongCount: 9 }),
        review({ questionId: Q2, rev: 1, lastAnsweredAt: T3 }),
      ],
    });
    const b = data({
      attempts: attempts.slice(1),
      reviewQueue: [review({ questionId: Q1, lastAnsweredAt: T1, box: 1 }), review({ questionId: Q2, rev: 2, lastAnsweredAt: T0, status: 'question_updated' })],
    });
    const m = mergeData(a, b, { settings: false });
    expect(m.reviewQueue).toEqual([
      { ...review({ questionId: Q2, rev: 2, lastAnsweredAt: T0, status: 'question_updated' }), wrongCount: 0 },
      { ...review({ questionId: Q1, lastAnsweredAt: T2, box: 2, lastResult: 'correct' }), wrongCount: 2 },
    ]);
  });
  it('unlocks：聯集，unlockedAt 取最早', () => {
    const a = data({ unlocks: [unlock(`term:${TERM1}`, T2)] });
    const b = data({ unlocks: [unlock(`term:${TERM1}`, T1), unlock('badge:b1', T3)] });
    expect(mergeData(a, b, { settings: false }).unlocks).toEqual([unlock('badge:b1', T3), unlock(`term:${TERM1}`, T1)]);
  });
  it('labState：同故事取 updatedAt 較晚者', () => {
    const a = data({ labState: [labState({ stepId: STEP1, updatedAt: T1 })] });
    const b = data({ labState: [labState({ stepId: STEP2, updatedAt: T2 })] });
    expect(mergeData(a, b, { settings: false }).labState).toEqual([{ storyId: STORY1, stepId: STEP2, updatedAt: T2 }]);
    expect(mergeData(b, a, { settings: false }).labState).toEqual([{ storyId: STORY1, stepId: STEP2, updatedAt: T2 }]);
  });
  it('labSandbox：整筆取 updatedAt 較晚者，overrides 不逐項合併', () => {
    const older = sandbox({ updatedAt: T1, overrides: [{ stepId: STEP2, eventId: 'e1', param: 'amount', value: 1 }] });
    const newer = sandbox({ updatedAt: T2, overrides: [] });
    expect(mergeData(data({ labSandbox: [older] }), data({ labSandbox: [newer] }), { settings: false }).labSandbox).toEqual([newer]);
  });
  it('settings：預設不匯入；勾選時以來源覆蓋同鍵', () => {
    const a = data({ settings: [setting('locale', 'zh-TW'), setting('timerEnabled', false)] });
    const b = data({ settings: [setting('locale', 'en', T2)] });
    expect(mergeData(a, b, { settings: false }).settings).toEqual([setting('locale', 'zh-TW'), setting('timerEnabled', false)]);
    expect(mergeData(a, b, { settings: true }).settings).toEqual([setting('locale', 'en', T2), setting('timerEnabled', false)]);
  });
  it('mergeSnapshots：meta.deviceId 保留本機、importHistory 加一筆；errors 與 snapshots 不動', () => {
    const current = snapshot({ errors: [{ at: T0, route: '/play/', message: 'x', appVersion: '0.2.0', contentVersion: 3 }] });
    const incoming = data({ attempts: [attempt({ questionId: Q1, answeredAt: T0, deviceId: DEVICE_B })] });
    const m = mergeSnapshots(current, incoming, opts);
    expect(m.meta.deviceId).toBe(DEVICE_A);
    expect(m.meta.importHistory).toEqual([
      { importedAt: T3, mode: 'merge', sourceDeviceId: DEVICE_B, sourceOrigin: 'https://example.test', sourceMode: 'browser', exportedAt: T2, attempts: 1 },
    ]);
    expect(m.errors).toHaveLength(1);
    expect(m.attempts).toHaveLength(1);
  });
});

describe('覆蓋模式', () => {
  it('除了設定之外全部取代；deviceId 保留、importHistory 記 replace', () => {
    const current = snapshot({
      attempts: [attempt({ questionId: Q1, answeredAt: T0 })],
      unlocks: [unlock('badge:old', T0)],
      settings: [setting('locale', 'zh-TW')],
    });
    const incoming = data({ attempts: [attempt({ questionId: Q2, answeredAt: T1, deviceId: DEVICE_B })], settings: [setting('locale', 'en')] });
    const r = replaceSnapshot(current, incoming, { ...opts, mode: 'replace' });
    expect(r.attempts.map((a) => a.questionId)).toEqual([Q2]);
    expect(r.unlocks).toEqual([]);
    expect(r.settings).toEqual([setting('locale', 'zh-TW')]);
    expect(r.meta.deviceId).toBe(DEVICE_A);
    expect(r.meta.importHistory[0]?.mode).toBe('replace');
  });
});

describe('收藏（settings 的 favourites）：學習資料，不受「也套用語言與計時設定」控制', () => {
  const fav = (ids: unknown[], at = T1) => setting(FAVOURITES_SETTING_KEY, ids as string[], at);
  const favOf = (settings: readonly { key: string; value: unknown; updatedAt: string }[]) => settings.find((s) => s.key === FAVOURITES_SETTING_KEY);

  it('LEARNING_SETTING_KEYS 是 favourites 與 creditsEggs', () => {
    expect(LEARNING_SETTING_KEYS).toEqual(['favourites', 'creditsEggs']);
  });

  it('預設選項（settings: false）的合併：兩邊取聯集，本機的順序在前、來源新的接在後面；updatedAt 取較晚', () => {
    const local = data({ settings: [setting('locale', 'zh-TW'), fav([Q1, Q2])] });
    const incoming = data({ settings: [setting('locale', 'en', T2), fav([Q3, Q1], T2)] });
    const m = mergeData(local, incoming, { settings: false });
    expect(favOf(m.settings)).toEqual(fav([Q1, Q2, Q3], T2));
    expect(m.settings.find((s) => s.key === 'locale')?.value).toBe('zh-TW');
  });

  it('勾選套用設定（settings: true）的合併仍是聯集，不是整份蓋掉', () => {
    const local = data({ settings: [fav([Q1, Q2], T2)] });
    const incoming = data({ settings: [setting('locale', 'en', T1), fav([Q3], T1)] });
    const m = mergeData(local, incoming, { settings: true });
    expect(favOf(m.settings)).toEqual(fav([Q1, Q2, Q3], T2));
    expect(m.settings.find((s) => s.key === 'locale')?.value).toBe('en');
  });

  it('只有一邊有收藏就用那一邊；不是陣列的值當作空清單；非字串與重複的項目去掉', () => {
    expect(favOf(mergeData(data(), data({ settings: [fav([Q1])] }), { settings: false }).settings)).toEqual(fav([Q1]));
    expect(favOf(mergeData(data({ settings: [fav([Q2])] }), data(), { settings: false }).settings)).toEqual(fav([Q2]));
    const broken = data({ settings: [setting(FAVOURITES_SETTING_KEY, 'oops', T1)] });
    expect(favOf(mergeData(broken, data({ settings: [fav([Q1, 3, '', Q1], T2)] }), { settings: false }).settings)).toEqual(fav([Q1], T2));
  });

  it('合併冪等：merge(a, a) 的收藏不變；再合併一次也不變', () => {
    const a = data({ settings: [fav([Q2, Q1])] });
    const once = mergeData(a, a, { settings: false });
    expect(favOf(once.settings)).toEqual(fav([Q2, Q1]));
    expect(mergeData(once, once, { settings: false })).toEqual(once);
  });

  it('覆蓋模式：收藏取備份的清單；備份沒有收藏時本機的收藏也清掉；語言等偏好仍保留本機', () => {
    const current = snapshot({ settings: [setting('locale', 'zh-TW'), fav([Q1, Q2])] });
    const withFav = replaceSnapshot(current, data({ settings: [fav([Q3], T2), setting('locale', 'en')] }), { ...opts, mode: 'replace' });
    expect(favOf(withFav.settings)).toEqual(fav([Q3], T2));
    expect(withFav.settings.find((s) => s.key === 'locale')?.value).toBe('zh-TW');
    const withoutFav = importSnapshot(current, data(), { ...opts, mode: 'replace' });
    expect(favOf(withoutFav.settings)).toBeUndefined();
    expect(withoutFav.settings).toEqual([setting('locale', 'zh-TW')]);
    // 覆蓋模式勾選套用設定：偏好取備份，收藏一樣取備份
    const both = replaceSnapshot(current, data({ settings: [fav([Q3], T2), setting('locale', 'en')] }), { ...opts, mode: 'replace', settings: true });
    expect(both.settings).toEqual([fav([Q3], T2), setting('locale', 'en')]);
  });

  it('mergeSnapshots 走同一套規則', () => {
    const current = snapshot({ settings: [fav([Q1])] });
    const m = mergeSnapshots(current, data({ settings: [fav([Q2], T2)] }), opts);
    expect(favOf(m.settings)).toEqual(fav([Q1, Q2], T2));
  });
});

describe('「幕後」的彩蛋（settings 的 creditsEggs）：和收藏一樣是學習資料', () => {
  const eggs = (ids: unknown[], at = T1) => setting(CREDITS_EGGS_SETTING_KEY, ids as string[], at);
  const eggsOf = (settings: readonly { key: string; value: unknown; updatedAt: string }[]) => settings.find((s) => s.key === CREDITS_EGGS_SETTING_KEY);

  it('合併取聯集（不受 settings 選項控制）、去重、updatedAt 取較晚；只有一邊有就用那一邊', () => {
    const local = data({ settings: [setting('locale', 'zh-TW'), eggs(['egg-a', 'egg-b'])] });
    const incoming = data({ settings: [setting('locale', 'en', T2), eggs(['egg-c', 'egg-a'], T2)] });
    expect(eggsOf(mergeData(local, incoming, { settings: false }).settings)).toEqual(eggs(['egg-a', 'egg-b', 'egg-c'], T2));
    expect(eggsOf(mergeData(local, incoming, { settings: true }).settings)).toEqual(eggs(['egg-a', 'egg-b', 'egg-c'], T2));
    expect(eggsOf(mergeData(data(), incoming, { settings: false }).settings)).toEqual(eggs(['egg-c', 'egg-a'], T2));
    expect(eggsOf(mergeData(local, data(), { settings: false }).settings)).toEqual(eggs(['egg-a', 'egg-b']));
  });

  it('覆蓋模式取備份的清單；備份沒有時本機的也清掉；偏好仍保留本機', () => {
    const current = snapshot({ settings: [setting('locale', 'zh-TW'), eggs(['egg-a'])] });
    const withEggs = replaceSnapshot(current, data({ settings: [eggs(['egg-b'], T2), setting('locale', 'en')] }), { ...opts, mode: 'replace' });
    expect(eggsOf(withEggs.settings)).toEqual(eggs(['egg-b'], T2));
    expect(withEggs.settings.find((s) => s.key === 'locale')?.value).toBe('zh-TW');
    const without = importSnapshot(current, data(), { ...opts, mode: 'replace' });
    expect(eggsOf(without.settings)).toBeUndefined();
    expect(without.settings).toEqual([setting('locale', 'zh-TW')]);
  });
});
