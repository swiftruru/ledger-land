// 最小的 zip 讀取器（只讀，不寫）：給 tools/handout-extract.mjs 讀 pptx（OOXML 就是 zip）。
// 只支援 store（0）與 deflate（8）兩種方法、沒有 ZIP64 與加密；pptx 都在這個範圍。不驗 CRC：讀錯會在 XML 解析階段失敗。
// 不加依賴：中央目錄自己走，解壓用 node:zlib 的 inflateRawSync。
import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

/**
 * 列出 zip 的所有項目（中央目錄），依目錄順序
 * @param {Buffer} buf
 * @returns {{ name: string; method: number; compressedSize: number; size: number; offset: number }[]}
 */
export function listZipEntries(buf) {
  // EOCD 在檔尾；最後可能有註解（最長 65535），從尾端往前找簽章
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip：找不到中央目錄結尾（EOCD）');
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const out = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CDFH_SIG) throw new Error(`zip：中央目錄第 ${i} 筆簽章不對`);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    out.push({ name, method, compressedSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/**
 * 讀一個項目的內容
 * @param {Buffer} buf
 * @param {{ name: string; method: number; compressedSize: number; size: number; offset: number }} entry
 * @returns {Buffer}
 */
export function readZipEntry(buf, entry) {
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== LFH_SIG) throw new Error(`zip：${entry.name} 的本地檔頭簽章不對`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`zip：${entry.name} 用了不支援的壓縮方法 ${entry.method}`);
}

/**
 * 讀整個 zip 成 Map（名稱到文字），只保留 keep 回傳 true 的項目；pptx 的 XML 都是 UTF-8
 * @param {Buffer} buf
 * @param {(name: string) => boolean} [keep]
 * @returns {Map<string, string>}
 */
export function readZipTexts(buf, keep = () => true) {
  const out = new Map();
  for (const e of listZipEntries(buf)) {
    if (e.name.endsWith('/') || !keep(e.name)) continue;
    out.set(e.name, readZipEntry(buf, e).toString('utf8'));
  }
  return out;
}
