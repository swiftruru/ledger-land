/// <reference types="node" />
// 極小的 xlsx 讀取器（只給 *.local.test.ts 用，04 第 18.3 節）：不加 npm 依賴，只用 node:*。
// 讀 zip 的 central directory 與 local header，用 inflateRawSync 解壓，再以字串處理解析
// xl/workbook.xml、xl/_rels/workbook.xml.rels、xl/sharedStrings.xml 與各工作表的 <c> 元素。
// 只回傳公式字串與輸入值；樣式、合併儲存格、註解一概忽略。
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

export interface Cell {
  /** 公式字串（不含開頭的等號），沒有公式的格沒有這個欄位 */
  readonly formula?: string;
  /** 輸入值：數字、文字；公式格沒有快取值時是 null；完全空白的格沒有這個欄位 */
  readonly value?: number | string | null;
}

export type Sheet = Map<string, Cell>;
export type Workbook = Map<string, Sheet>;

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** 把 zip 檔展開成「路徑 → 內容」；只支援 stored 與 deflate 兩種壓縮方式（xlsx 只會用這兩種） */
export function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('xlsx：找不到 zip 的 end of central directory');
  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) throw new Error(`xlsx：central directory 第 ${n} 筆簽章不符`);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const extraLength = buf.readUInt16LE(p + 30);
    const commentLength = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    if (buf.readUInt32LE(localOffset) !== SIG_LOCAL) throw new Error(`xlsx：${name} 的 local header 簽章不符`);
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    else throw new Error(`xlsx：${name} 使用不支援的壓縮方式 ${method}`);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** 解碼 XML 實體：具名五種與 &#十進位; 、&#x十六進位;（工作表名稱與公式裡的中文由 openpyxl 寫成數字實體） */
export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body] ?? whole;
  });
}

function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out.set(m[1] as string, decodeXml(m[2] as string));
  return out;
}

/** 串接元素內所有 <t> 的文字（rich text 會拆成多個 <r><t>） */
function textRuns(xml: string): string {
  let s = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += decodeXml(m[1] as string);
  return s;
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (xml === undefined) return [];
  const out: string[] = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) out.push(textRuns(m[1] as string));
  return out;
}

function normaliseTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  return `xl/${target}`;
}

/** 工作表名稱 → zip 內的路徑，依 workbook.xml 的順序 */
function sheetPaths(workbookXml: string, relsXml: string): Array<readonly [string, string]> {
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const a = attributes(m[0]);
    const id = a.get('Id');
    const target = a.get('Target');
    if (id !== undefined && target !== undefined) rels.set(id, normaliseTarget(target));
  }
  const out: Array<readonly [string, string]> = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const a = attributes(m[0]);
    const name = a.get('name');
    const rid = a.get('r:id');
    if (name === undefined || rid === undefined) continue;
    const path = rels.get(rid);
    if (path === undefined) throw new Error(`xlsx：工作表「${name}」的關聯 ${rid} 找不到`);
    out.push([name, path]);
  }
  return out;
}

function parseSheet(xml: string, shared: readonly string[]): Sheet {
  const cells: Sheet = new Map();
  const body = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/)?.[1] ?? '';
  for (const m of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const a = attributes(`<c ${m[1] as string}>`);
    const ref = a.get('r');
    if (ref === undefined) continue;
    const type = a.get('t') ?? 'n';
    const inner = m[2] ?? '';
    const formulaMatch = inner.match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
    const formula = formulaMatch ? decodeXml(formulaMatch[1] as string) : undefined;
    if (formulaMatch === null && /<f\b[^>]*\/>/.test(inner)) {
      throw new Error(`xlsx：${ref} 使用共用公式（<f/>），本讀取器不支援`);
    }
    let value: number | string | null | undefined;
    if (type === 'inlineStr') {
      const is = inner.match(/<is>([\s\S]*?)<\/is>/);
      value = is ? textRuns(is[1] as string) : '';
    } else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (v === null) value = formula === undefined ? undefined : null;
      else {
        const raw = decodeXml(v[1] as string);
        if (raw === '') value = null;
        else if (type === 's') value = shared[Number.parseInt(raw, 10)] ?? '';
        else if (type === 'str' || type === 'e') value = raw;
        else if (type === 'b') value = raw === '1' ? 1 : 0;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n)) throw new Error(`xlsx：${ref} 的數值「${raw}」無法解析`);
          value = n;
        }
      }
    }
    if (formula === undefined && value === undefined) continue;
    const cell: { formula?: string; value?: number | string | null } = {};
    if (formula !== undefined) cell.formula = formula;
    if (value !== undefined) cell.value = value;
    cells.set(ref, cell);
  }
  return cells;
}

/** 讀取 xlsx 檔：工作表名稱 → 儲存格位址 → { formula?, value? } */
export function readXlsx(path: string): Workbook {
  return parseXlsx(readFileSync(path));
}

export function parseXlsx(buf: Buffer): Workbook {
  const files = readZip(buf);
  const text = (name: string): string | undefined => files.get(name)?.toString('utf8');
  const workbookXml = text('xl/workbook.xml');
  const relsXml = text('xl/_rels/workbook.xml.rels');
  if (workbookXml === undefined || relsXml === undefined) throw new Error('xlsx：缺少 xl/workbook.xml 或 xl/_rels/workbook.xml.rels');
  const shared = parseSharedStrings(text('xl/sharedStrings.xml'));
  const book: Workbook = new Map();
  for (const [name, path] of sheetPaths(workbookXml, relsXml)) {
    const xml = text(path);
    if (xml === undefined) throw new Error(`xlsx：工作表「${name}」的檔案 ${path} 不在 zip 裡`);
    book.set(name, parseSheet(xml, shared));
  }
  return book;
}
