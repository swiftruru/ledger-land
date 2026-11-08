// CSV（tools/lib/csv.mjs）：RFC 4180 的解析與輸出、來回；編碼偵測（UTF-8 加 BOM、Big5、兩者都不是）。
import { describe, expect, it } from 'vitest';
import { csvBuffer, decodeCsvBuffer, parseCsv, toCsv } from '../lib/csv.mjs';

describe('parseCsv', () => {
  it('引號、兩個雙引號、欄內換行與逗號、CRLF 與 LF 混用、BOM、結尾空行', () => {
    const text = '﻿id,text,note\r\nq_1,"含,逗號","兩行\n文字"\nq_2,"他說""好""",\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['id', 'text', 'note'],
      ['q_1', '含,逗號', '兩行\n文字'],
      ['q_2', '他說"好"', ''],
    ]);
  });
  it('沒有結尾換行也讀得到最後一列；空檔案是空陣列', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('')).toEqual([]);
  });
  it('引號沒關就丟錯', () => {
    expect(() => parseCsv('a,"b\n')).toThrow(/引號/);
  });
});

describe('toCsv 與 csvBuffer', () => {
  it('需要時才加引號，布林寫 TRUE 與 FALSE，空值寫空字串，來回一致', () => {
    const rows = [
      ['id', 'ok', 'text'],
      ['q_1', true, '含,逗號'],
      ['q_2', false, '他說"好"'],
      ['q_3', null, ' 頭尾空白 '],
    ];
    const text = toCsv(rows);
    expect(text).toBe('id,ok,text\r\nq_1,TRUE,"含,逗號"\r\nq_2,FALSE,"他說""好"""\r\nq_3,," 頭尾空白 "\r\n');
    expect(parseCsv(text)).toEqual([
      ['id', 'ok', 'text'],
      ['q_1', 'TRUE', '含,逗號'],
      ['q_2', 'FALSE', '他說"好"'],
      ['q_3', '', ' 頭尾空白 '],
    ]);
    const buf = csvBuffer(rows);
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe('decodeCsvBuffer', () => {
  it('UTF-8 加 BOM', () => {
    const r = decodeCsvBuffer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('中文,a', 'utf8')]));
    expect(r.encoding).toBe('utf-8');
    expect(parseCsv(r.text)).toEqual([['中文', 'a']]);
  });
  it('Big5（Windows Excel 存的 CSV）', () => {
    // 「中文」的 Big5 是 A4 A4 A4 E5；「會計」是 B7 7C AD 70
    const r = decodeCsvBuffer(Buffer.from([0xa4, 0xa4, 0xa4, 0xe5, 0x2c, 0xb7, 0x7c, 0xad, 0x70, 0x0d, 0x0a]));
    expect(r.encoding).toBe('big5');
    expect(parseCsv(r.text)).toEqual([['中文', '會計']]);
  });
  it('兩種都不是就丟錯並提示另存；UTF-16 的 BOM 另外指出', () => {
    // 0x81 0x30：Big5 的前導位元組接不合法的後續位元組，UTF-8 也不合法
    expect(() => decodeCsvBuffer(Buffer.from([0x81, 0x30]))).toThrow(/CSV UTF-8/);
    expect(() => decodeCsvBuffer(Buffer.from([0xff, 0xfe, 0x41, 0x00]))).toThrow(/UTF-16/);
    expect(() => decodeCsvBuffer(Buffer.from([0xfe, 0xff, 0x00, 0x41]))).toThrow(/UTF-16/);
  });
});
