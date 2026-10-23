// 決定性工具（04 第 1 節）：雜湊前用鍵排序的 canonical JSON；排序不依賴物件鍵的插入順序，也不用 localeCompare。

/**
 * 鍵排序、決定性的 JSON 文字。物件鍵依 UTF-16 code unit 排序；值為 undefined 的鍵省略（陣列裡的 undefined 與 JSON.stringify 相同，寫成 null）。
 * NaN、Infinity、bigint、函式與 symbol 不能表示，視為程式錯誤而 throw；bigint 請先以 ratToExact 之類轉成字串。
 */
export function canonicalJson(value: unknown): string {
  const out = encode(value);
  if (out === undefined) throw new TypeError('canonicalJson：最外層的值不能是 undefined');
  return out;
}

function encode(value: unknown): string | undefined {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`canonicalJson：不能表示 ${String(value)}`);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'undefined':
      return undefined;
    case 'bigint':
      throw new TypeError('canonicalJson：bigint 不能直接序列化，請先轉成字串');
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJson：不能表示 ${typeof value}`);
  }
  if (Array.isArray(value)) return `[${value.map((v: unknown) => encode(v) ?? 'null').join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort(compareCodeUnits);
  const parts: string[] = [];
  for (const k of keys) {
    const v = encode(obj[k]);
    if (v !== undefined) parts.push(`${JSON.stringify(k)}:${v}`);
  }
  return `{${parts.join(',')}}`;
}

export type SortKey = number | string | bigint | boolean;

/** 不受語系影響的字串比較：逐 code unit */
export function compareCodeUnits(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareKey(a: SortKey, b: SortKey): -1 | 0 | 1 {
  if (typeof a !== typeof b) throw new TypeError(`stableSortBy：鍵的型別不一致（${typeof a} 與 ${typeof b}）`);
  if (typeof a === 'number' && (Number.isNaN(a) || Number.isNaN(b as number))) throw new TypeError('stableSortBy：鍵不能是 NaN');
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 穩定排序：依 keyOf 回傳的鍵（單一鍵或多個鍵的陣列，前面的鍵優先）由小到大；鍵相同時維持原順序。
 * 回傳新陣列，不修改輸入。
 */
export function stableSortBy<T>(items: readonly T[], keyOf: (item: T) => SortKey | readonly SortKey[]): T[] {
  const decorated = items.map((item, index) => {
    const k = keyOf(item);
    return { item, index, keys: Array.isArray(k) ? (k as readonly SortKey[]) : [k as SortKey] };
  });
  decorated.sort((x, y) => {
    const n = Math.min(x.keys.length, y.keys.length);
    for (let i = 0; i < n; i++) {
      const c = compareKey(x.keys[i] as SortKey, y.keys[i] as SortKey);
      if (c !== 0) return c;
    }
    if (x.keys.length !== y.keys.length) return x.keys.length - y.keys.length;
    return x.index - y.index;
  });
  return decorated.map((d) => d.item);
}
