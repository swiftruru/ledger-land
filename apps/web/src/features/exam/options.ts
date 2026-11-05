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
