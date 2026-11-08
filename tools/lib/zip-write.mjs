// 最小的 zip 寫入器（和 zip-read.mjs 對稱）：給 xlsx-write.mjs 寫範本、給測試組 pptx 與 xlsx。
// 只寫 store（0）與 deflate（8），沒有 ZIP64（單檔與總量都在 4 GB 以下）、沒有加密；檔名一律 UTF-8（通用旗標 bit 11）。
// CRC32 用 node:zlib 內建的 crc32（Node 22.2 起）；壓縮用 deflateRawSync。不加依賴。
import { crc32, deflateRawSync } from 'node:zlib';

const LFH_SIG = 0x04034b50;
const CDFH_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const VERSION = 20;
const FLAG_UTF8 = 0x0800;

/** DOS 時間與日期（zip 檔頭的格式）；固定一個時間讓輸出可重現（2026-01-01 00:00:00） */
function dosDateTime(date = new Date(Date.UTC(2026, 0, 1))) {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

/**
 * 把多個項目寫成一個 zip。
 * @param {{ name: string; data: Buffer | string; deflate?: boolean }[]} entries data 是字串時以 UTF-8 編碼；deflate 預設 true
 * @param {{ date?: Date }} [options] 檔頭的時間戳，預設固定值（輸出可重現）
 * @returns {Buffer}
 */
export function writeZip(entries, options = {}) {
  const { time, day } = dosDateTime(options.date);
  /** @type {Buffer[]} */
  const parts = [];
  /** @type {Buffer[]} */
  const central = [];
  let offset = 0;
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.name)) throw new Error(`writeZip：項目名稱重複 ${e.name}`);
    seen.add(e.name);
    const name = Buffer.from(e.name, 'utf8');
    const raw = typeof e.data === 'string' ? Buffer.from(e.data, 'utf8') : e.data;
    const deflate = e.deflate ?? true;
    const data = deflate ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);
    const method = deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LFH_SIG, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(CDFH_SIG, 0);
    cd.writeUInt16LE(VERSION, 4);
    cd.writeUInt16LE(VERSION, 6);
    cd.writeUInt16LE(FLAG_UTF8, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(day, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cdBuf, eocd]);
}
