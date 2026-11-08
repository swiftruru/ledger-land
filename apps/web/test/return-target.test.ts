// 跨模組導覽的返回目標（features/nav/return-target.ts，02 第 5.3 節、03 第 4.1、4.6 節）：sessionStorage 的讀寫與形狀檢查、
// 交易影響題的答案換成「版面列 → 方向」、帶進預測面板只填對得上的目標。sessionStorage 用記憶體的假物件。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RETURN_TARGET_KEY,
  clearReturnTarget,
  lineChoicesOf,
  normaliseReturnTarget,
  prefillPrediction,
  readReturnTarget,
  returnTargetFor,
  writeReturnTarget,
  type ReturnTarget,
} from '../src/features/nav/return-target.ts';

function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

const g = globalThis as { sessionStorage?: Storage };
let storage: ReturnType<typeof fakeStorage>;
beforeEach(() => {
  storage = fakeStorage();
  g.sessionStorage = storage;
});
afterEach(() => {
  delete g.sessionStorage;
});

const TARGET: ReturnTarget = {
  kind: 'level',
  levelId: 'lv_gtpyj3s8',
  questionId: 'q_59v8fm8w',
  href: '/level/lv_gtpyj3s8/',
  anchor: { elementId: 'll-fb-q_59v8fm8w', offset: 12 },
  lineChoices: { bs_cash: 'up', is_gross_profit: 'unchanged' },
};

describe('讀寫', () => {
  it('寫進 ll:return，讀回同一筆；只記最近一筆', () => {
    writeReturnTarget(TARGET);
    expect(storage.map.has(RETURN_TARGET_KEY)).toBe(true);
    expect(readReturnTarget()).toEqual(TARGET);
    writeReturnTarget({ kind: 'review', questionId: 'q_x', href: '/review/' });
    expect(readReturnTarget()).toEqual({ kind: 'review', questionId: 'q_x', href: '/review/' });
    clearReturnTarget();
    expect(readReturnTarget()).toBeUndefined();
  });
  it('returnTargetFor 只認同一題', () => {
    writeReturnTarget(TARGET);
    expect(returnTargetFor('q_59v8fm8w')?.href).toBe('/level/lv_gtpyj3s8/');
    expect(returnTargetFor('q_other')).toBeUndefined();
  });
  it('沒有 sessionStorage 或壞掉的內容：當作沒有、不丟錯', () => {
    delete g.sessionStorage;
    expect(() => writeReturnTarget(TARGET)).not.toThrow();
    expect(readReturnTarget()).toBeUndefined();
    g.sessionStorage = storage;
    storage.map.set(RETURN_TARGET_KEY, '{not json');
    expect(readReturnTarget()).toBeUndefined();
    storage.map.set(RETURN_TARGET_KEY, JSON.stringify({ kind: 'lab', questionId: 'q_x', href: '/x/' }));
    expect(readReturnTarget()).toBeUndefined();
  });
  it('normalise：網址要以 / 開頭，錨點與答案形狀不對就丟掉那一部分', () => {
    expect(normaliseReturnTarget({ kind: 'level', questionId: 'q_x', href: 'https://evil.example/' })).toBeUndefined();
    expect(
      normaliseReturnTarget({
        kind: 'level',
        questionId: 'q_x',
        href: '/level/lv_x/',
        anchor: { elementId: '', offset: 1 },
        lineChoices: { bs_cash: 'sideways', is_net_income: 'down' },
      }),
    ).toEqual({ kind: 'level', questionId: 'q_x', href: '/level/lv_x/', lineChoices: { is_net_income: 'down' } });
  });
});

describe('lineChoicesOf（題目的答案換成版面列對方向）', () => {
  const q = {
    scenario: {
      targets: [
        { id: 't1', kind: 'line', line: 'bs_cash', measure: 'direction' },
        { id: 't2', kind: 'line', line: 'bs_inventory', measure: 'direction' },
        { id: 't3', kind: 'line', line: 'is_net_income', measure: 'delta' },
        { id: 't4', kind: 'account', account: 'cash', measure: 'direction' },
        { id: 't5', kind: 'ratio', ratioRef: 'current_ratio@excel', measure: 'status' },
      ],
    },
  };
  it('只收 line 加 direction 的目標，沒答的跳過', () => {
    expect(lineChoicesOf(q, { t1: 'up', t3: 12000, t4: 'down', t5: 'becomes_na' })).toEqual({ bs_cash: 'up' });
    expect(lineChoicesOf(q, { t1: 'up', t2: 'unchanged' })).toEqual({ bs_cash: 'up', bs_inventory: 'unchanged' });
  });
  it('作答頁工作階段存的介面狀態（每個目標是 { direction }）也看得懂；沒選方向的跳過', () => {
    expect(lineChoicesOf(q, { t1: { direction: 'down' }, t2: { raw: '12' }, t3: { direction: 'up' } })).toEqual({ bs_cash: 'down' });
  });
  it('沒有 scenario 或答案不是物件：空的', () => {
    expect(lineChoicesOf({}, { t1: 'up' })).toEqual({});
    expect(lineChoicesOf(q, undefined)).toEqual({});
    expect(lineChoicesOf(q, 'o_1')).toEqual({});
  });
});

describe('prefillPrediction（帶進預測面板）', () => {
  const targets = [
    { id: 'cash', kind: 'line', line: 'bs_cash' },
    { id: 'l1', kind: 'line', line: 'is_gross_profit' },
    { id: 'l5', kind: 'line', line: 'is_net_income' },
    { id: 'r-current_ratio', kind: 'ratio' },
  ] as const;
  it('列 ID 對得上的填進去，對不上的留空，指標目標不碰', () => {
    expect(prefillPrediction(targets, { bs_cash: 'up', is_net_income: 'down', bs_inventory: 'unchanged' })).toEqual({ cash: 'up', l5: 'down' });
  });
  it('沒有答案就是空的', () => {
    expect(prefillPrediction(targets, undefined)).toEqual({});
  });
});
