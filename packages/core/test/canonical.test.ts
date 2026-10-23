// 決定性工具的單元測試：canonical JSON 的鍵排序與 undefined 處理、穩定排序。
import { describe, expect, it } from 'vitest';
import { CORE_ERROR_CODES, canonicalJson, compareCodeUnits, coreError, err, isErr, isOk, mapResult, ok, stableSortBy, unwrap } from '../src/index.ts';

describe('canonicalJson', () => {
  it('鍵排序且不依賴插入順序', () => {
    const a = { b: 1, a: [3, { z: 'z', y: 'y' }], c: null };
    const b = { c: null, a: [3, { y: 'y', z: 'z' }], b: 1 };
    expect(canonicalJson(a)).toBe('{"a":[3,{"y":"y","z":"z"}],"b":1,"c":null}');
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
  it('省略 undefined 的鍵，陣列裡的 undefined 寫成 null，-0 寫成 0', () => {
    expect(canonicalJson({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(canonicalJson([undefined, 1])).toBe('[null,1]');
    expect(canonicalJson({ x: -0 })).toBe('{"x":0}');
    expect(canonicalJson('中文"引號"')).toBe(JSON.stringify('中文"引號"'));
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(null)).toBe('null');
  });
  it('鍵依 code unit 排序，不受語系影響', () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3, _: 4, '10': 5, '9': 6 })).toBe('{"10":5,"9":6,"B":2,"_":4,"a":3,"b":1}');
    expect(compareCodeUnits('a', 'B')).toBe(1);
    expect(compareCodeUnits('a', 'a')).toBe(0);
  });
  it('不能表示的值是程式錯誤', () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(TypeError);
    expect(() => canonicalJson(Symbol('x'))).toThrow(TypeError);
  });
});

describe('stableSortBy', () => {
  it('依鍵排序、相同鍵維持原順序、不改輸入', () => {
    const items = [
      { id: 'c', order: 2 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'd', order: 1 },
    ];
    const copy = [...items];
    expect(stableSortBy(items, (x) => x.order).map((x) => x.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(items).toEqual(copy);
  });
  it('多個鍵依序比較，短的鍵陣列排前面', () => {
    const items = [
      { g: 'x', n: 2 },
      { g: 'x', n: 1 },
      { g: 'w', n: 9 },
    ];
    expect(stableSortBy(items, (x) => [x.g, x.n]).map((x) => x.n)).toEqual([9, 1, 2]);
    expect(stableSortBy([[1, 2], [1], [0, 5]] as number[][], (x) => x).map((x) => x.length)).toEqual([2, 1, 2]);
    expect(stableSortBy([3n, 1n, 2n], (x) => x)).toEqual([1n, 2n, 3n]);
    expect(stableSortBy([true, false], (x) => x)).toEqual([false, true]);
  });
  it('鍵型別不一致或 NaN 是程式錯誤', () => {
    expect(() => stableSortBy([1, 'a'] as (number | string)[], (x) => x)).toThrow(TypeError);
    expect(() => stableSortBy([1, Number.NaN], (x) => x)).toThrow(TypeError);
  });
});

describe('Result 與 CoreError', () => {
  it('ok、err、isOk、isErr、mapResult、unwrap', () => {
    const good = ok(3);
    const bad = err(coreError('entry.unbalanced', { diff: 5 }, { diff: 5 }));
    expect(isOk(good) && good.value).toBe(3);
    expect(isErr(bad) && bad.error.code).toBe('entry.unbalanced');
    expect(mapResult(good, (v) => v * 2)).toEqual({ ok: true, value: 6 });
    expect(mapResult(bad, (v: number) => v * 2)).toBe(bad);
    expect(unwrap(good)).toBe(3);
    expect(() => unwrap(bad)).toThrow(/unwrap/);
  });
  it('coreError 的 message key 是 core.error.<code>，額外欄位附在本體', () => {
    const e = coreError('balance.negative', { account: 'cash', after: -5 }, { account: 'cash', after: -5, range: [0, 10] });
    expect(e.message).toEqual({ key: 'core.error.balance.negative', params: { account: 'cash', after: -5 } });
    expect(e.range).toEqual([0, 10]);
    expect(coreError('param.type').message).toEqual({ key: 'core.error.param.type' });
    expect(new Set(CORE_ERROR_CODES).size).toBe(CORE_ERROR_CODES.length);
    expect(CORE_ERROR_CODES.length).toBe(46);
  });
});
