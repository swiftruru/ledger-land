// oxlint-disable vitest/no-standalone-expect -- 性質測試用 @fast-check/vitest 的 test.prop，expect 在它的回呼裡
import { describe, expect, it } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { base64urlDecode, base64urlEncode, canonicalJson, clonePlain, utf8ByteLength, utf8Decode, utf8Encode } from '../src/index.ts';

describe('util', () => {
  it('canonical JSON 鍵排序、略過 undefined、拒絕 NaN', () => {
    expect(canonicalJson({ b: 1, a: [undefined, { z: 0, y: -0 }], c: undefined })).toBe('{"a":[null,{"y":0,"z":0}],"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
  });
  test.prop([fc.uint8Array({ maxLength: 64 })])('base64url round-trip', (bytes) => {
    const s = base64urlEncode(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(base64urlDecode(s)).toEqual(bytes);
  });
  test.prop([fc.string({ unit: 'grapheme', maxLength: 40 })])('utf8 round-trip 與位元組數', (text) => {
    const bytes = utf8Encode(text);
    expect(bytes.length).toBe(utf8ByteLength(text));
    expect(utf8Decode(bytes)).toBe(text);
  });
  it('base64url 與 utf8 的壞輸入', () => {
    expect(base64urlDecode('a')).toBeUndefined();
    expect(base64urlDecode('a+b/')).toBeUndefined();
    expect(base64urlDecode('')).toEqual(new Uint8Array());
    expect(utf8Decode(Uint8Array.from([0xff]))).toBeUndefined();
    expect(utf8Decode(Uint8Array.from([0xe4, 0xb8]))).toBeUndefined();
    expect(utf8Decode(Uint8Array.from([0xed, 0xa0, 0x80]))).toBeUndefined();
  });
  it('clonePlain 深層複製並丟掉 undefined', () => {
    const src = { a: [1, { b: 2 }], c: undefined, d: null };
    const out = clonePlain(src);
    expect(out).toEqual({ a: [1, { b: 2 }], d: null });
    expect(out.a).not.toBe(src.a);
  });
});
