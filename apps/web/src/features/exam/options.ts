// 苦練區「抽幾題」的選項（M4c 第二批，2026-11-05）：隨機練習用。網址參數 n 是 20、30、50 或 all；不合法就用呼叫端給的預設。
// 模擬考有自己的題數選項（MOCK_COUNT_OPTIONS，2026-11-07）。
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
export const limitOf = (count: number | 'all', total: number): number => (count === 'all' ? total : Math.min(count, total));

/** 模擬考（M4c 第二批的第二次交付）：題數是 40、50、100（維護者 2026-11-07 的決定：像一場考試的份量，不放 20、30 與全部；
 *  只考一份講義時超過該份題數的選項抽全份，見 limitOf），預設 40；
 *  每題秒數由學生在開頭自己選（維護者 2026-11-05 的決定），0 是不限時 */
export const MOCK_COUNT_OPTIONS = [40, 50, 100] as const;
export type MockCountOption = (typeof MOCK_COUNT_OPTIONS)[number];
export const DEFAULT_MOCK_COUNT: MockCountOption = 40;

export function parseMockCount(raw: string | null | undefined, fallback: MockCountOption): MockCountOption {
  const n = Number(raw);
  return MOCK_COUNT_OPTIONS.find((c) => c === n) ?? fallback;
}
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
  count: MockCountOption;
  seconds: SecondsOption;
}
export const DEFAULT_MOCK_SETTINGS: MockSettings = { scope: 'all', count: DEFAULT_MOCK_COUNT, seconds: DEFAULT_MOCK_SECONDS };

/** 存在 localStorage 的寫法：scope|count|seconds；讀不懂的欄位用預設（以前存的 20 與 all 也是） */
export const encodeMockSettings = (s: MockSettings): string => `${s.scope}|${s.count}|${s.seconds}`;
export function parseMockSettings(raw: string | null | undefined): MockSettings {
  const [scope, count, seconds] = (raw ?? '').split('|');
  return {
    scope: scope && /^(all|d[1-9]\d*)$/.test(scope) ? scope : DEFAULT_MOCK_SETTINGS.scope,
    count: parseMockCount(count, DEFAULT_MOCK_COUNT),
    seconds: parseSeconds(seconds, DEFAULT_MOCK_SECONDS),
  };
}
