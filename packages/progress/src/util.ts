// 決定性工具：鍵排序的 canonical JSON（雜湊與比較用）、不受語系影響的字串比較、UTF-8 與 base64url 編解碼（不用 TextEncoder、btoa 與 Buffer）。

/** 鍵排序、決定性的 JSON 文字；值為 undefined 的鍵省略。NaN、Infinity、bigint、函式視為程式錯誤而 throw */
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

/** 不受語系影響的字串比較：逐 code unit */
export function compareCodeUnits(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareNumbers(a: number, b: number): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 字串的 UTF-8 位元組數（備份檔大小上限用） */
export function utf8ByteLength(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}

/** UTF-8 解碼；位元組序列不合法時回傳 undefined（備份碼貼錯或截斷） */
export function utf8Decode(bytes: Uint8Array): string | undefined {
  let s = '';
  for (let i = 0; i < bytes.length;) {
    const b0 = bytes[i]!;
    let cp: number;
    let extra: number;
    if (b0 < 0x80) {
      cp = b0;
      extra = 0;
    } else if ((b0 & 0xe0) === 0xc0) {
      cp = b0 & 0x1f;
      extra = 1;
    } else if ((b0 & 0xf0) === 0xe0) {
      cp = b0 & 0x0f;
      extra = 2;
    } else if ((b0 & 0xf8) === 0xf0) {
      cp = b0 & 0x07;
      extra = 3;
    } else return undefined;
    for (let k = 1; k <= extra; k++) {
      const b = bytes[i + k];
      if (b === undefined || (b & 0xc0) !== 0x80) return undefined;
      cp = (cp << 6) | (b & 0x3f);
    }
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return undefined;
    s += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return s;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url（RFC 4648 第 5 節，不補 =） */
export function base64urlEncode(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    s += B64URL[(n >> 18) & 63]! + B64URL[(n >> 12) & 63]! + B64URL[(n >> 6) & 63]! + B64URL[n & 63]!;
  }
  if (i < bytes.length) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const n = (b0 << 16) | ((b1 ?? 0) << 8);
    s += B64URL[(n >> 18) & 63]! + B64URL[(n >> 12) & 63]!;
    if (b1 !== undefined) s += B64URL[(n >> 6) & 63]!;
  }
  return s;
}

/** base64url 解碼；含非法字元或長度不合時回傳 undefined */
export function base64urlDecode(text: string): Uint8Array | undefined {
  const clean = text.replace(/=+$/, '');
  if (!/^[A-Za-z0-9_-]*$/.test(clean) || clean.length % 4 === 1) return undefined;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 6) | B64URL.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** 深層複製純資料（JSON 可表示的值），讓儲存實作回傳的資料不與內部狀態共用參照 */
export function clonePlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v: unknown) => clonePlain(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (v !== undefined) out[k] = clonePlain(v);
  return out as T;
}
