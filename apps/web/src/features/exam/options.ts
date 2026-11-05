// 苦練區「抽幾題」的選項（M4c 第二批，2026-11-05）：隨機練習與模擬考共用。網址參數 n 是 20、30、50 或 all；不合法就用呼叫端給的預設。
export const COUNT_OPTIONS = [20, 30, 50, 'all'] as const;
export type CountOption = (typeof COUNT_OPTIONS)[number];

/** 隨機練習的預設題數（M4c 第一批固定抽 20 題） */
export const DEFAULT_RANDOM_COUNT: CountOption = 20;

export function parseCount(raw: string | null | undefined, fallback: CountOption): CountOption {
  if (raw === 'all') return 'all';
  const n = Number(raw);
  return COUNT_OPTIONS.find((c) => c === n) ?? fallback;
}

/** 實際要抽的題數：all 是全部，其餘不超過題組的題數 */
export const limitOf = (count: CountOption, total: number): number => (count === 'all' ? total : Math.min(count, total));

/** 模擬考（M4c 第二批的第二次交付）：預設 30 題；每題秒數由學生在開頭自己選（維護者 2026-11-05 的決定），0 是不限時 */
export const DEFAULT_MOCK_COUNT: CountOption = 30;
export const SECONDS_OPTIONS = [0, 45, 60, 90] as const;
export type SecondsOption = (typeof SECONDS_OPTIONS)[number];
export const DEFAULT_MOCK_SECONDS: SecondsOption = 60;

export function parseSeconds(raw: string | null | undefined, fallback: SecondsOption): SecondsOption {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return SECONDS_OPTIONS.find((s) => s === n) ?? fallback;
}

/** 模擬考的設定：範圍是 all 或講義 ID */
export interface MockSettings {
  scope: string;
  count: CountOption;
  seconds: SecondsOption;
}
export const DEFAULT_MOCK_SETTINGS: MockSettings = { scope: 'all', count: DEFAULT_MOCK_COUNT, seconds: DEFAULT_MOCK_SECONDS };

/** 存在 localStorage 的寫法：scope|count|seconds；讀不懂的欄位用預設 */
export const encodeMockSettings = (s: MockSettings): string => `${s.scope}|${s.count}|${s.seconds}`;
export function parseMockSettings(raw: string | null | undefined): MockSettings {
  const [scope, count, seconds] = (raw ?? '').split('|');
  return {
    scope: scope && /^(all|d[1-9]\d*)$/.test(scope) ? scope : DEFAULT_MOCK_SETTINGS.scope,
    count: parseCount(count, DEFAULT_MOCK_COUNT),
    seconds: parseSeconds(seconds, DEFAULT_MOCK_SECONDS),
  };
}
