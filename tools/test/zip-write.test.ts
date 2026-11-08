// zip 寫入器（tools/lib/zip-write.mjs）：寫出再用 zip-read.mjs 讀回；CRC32 與 node:zlib 的一致；store 與 deflate；UTF-8 檔名；輸出可重現；名稱重複丟錯。
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { listZipEntries, readZipEntry, readZipTexts } from '../lib/zip-read.mjs';
import { writeZip } from '../lib/zip-write.mjs';

describe('writeZip', () => {
  it('寫出的項目能讀回，store 與 deflate 都可以', () => {
    const big = '甲乙丙丁'.repeat(500);
    const buf = writeZip([
      { name: 'a.txt', data: 'hello', deflate: false },
      { name: '資料夾/b.xml', data: big },
      { name: 'bin', data: Buffer.from([0, 1, 2, 255]), deflate: false },
    ]);
    const entries = listZipEntries(buf);
    expect(entries.map((e) => [e.name, e.method, e.size])).toEqual([
      ['a.txt', 0, 5],
      ['資料夾/b.xml', 8, Buffer.byteLength(big)],
      ['bin', 0, 4],
    ]);
    expect(entries[1].compressedSize).toBeLessThan(entries[1].size);
    expect(readZipEntry(buf, entries[0]).toString()).toBe('hello');
    expect(readZipEntry(buf, entries[1]).toString()).toBe(big);
    expect([...readZipEntry(buf, entries[2])]).toEqual([0, 1, 2, 255]);
    expect(readZipTexts(buf, (n) => n.endsWith('.txt')).get('a.txt')).toBe('hello');
  });

  it('本地檔頭與中央目錄的 CRC32 等於 node:zlib 算的值，通用旗標標 UTF-8', () => {
    const data = Buffer.from('檔案內容 content', 'utf8');
    const buf = writeZip([{ name: 'x', data, deflate: false }]);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.readUInt16LE(6) & 0x0800).toBe(0x0800);
    expect(buf.readUInt32LE(14)).toBe(crc32(data));
    const [entry] = listZipEntries(buf);
    const cdOffset = buf.readUInt32LE(buf.length - 22 + 16);
    expect(buf.readUInt32LE(cdOffset + 16)).toBe(crc32(data));
    expect(entry.offset).toBe(0);
  });

  it('同樣的輸入產生同樣的位元組（時間戳固定）', () => {
    const a = writeZip([{ name: 'a', data: 'x' }]);
    const b = writeZip([{ name: 'a', data: 'x' }]);
    expect(a.equals(b)).toBe(true);
  });

  it('項目名稱重複就丟錯', () => {
    expect(() =>
      writeZip([
        { name: 'a', data: '1' },
        { name: 'a', data: '2' },
      ]),
    ).toThrow(/重複/);
  });
});
