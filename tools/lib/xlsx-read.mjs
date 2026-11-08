// 最小的 xlsx 讀取器（08 第 9、10.6、10.7 節）：只讀儲存格的值，不執行公式。公式格只取 Excel 存檔時的快取值 <v>，沒有快取值就回報問題
// （由程式產生、從未用 Excel 開啟存檔的檔案）。支援 Excel 與 Numbers 存檔會出現的形狀：共用字串（含富文字 <r><t>）、inlineStr、str（公式的字串結果）、
// 布林、數字、錯誤（t="e"，回報問題）、空格與只有樣式的格（略過）。日期在 xlsx 裡就是數字，這裡照數字回傳（範本沒有日期欄）。
// 用 zip-read.mjs 取 zip 項目，正規式分段解 XML（和 handout-pptx.mjs 一樣，不加依賴）。
import { decodeXml, parseRef } from './ooxml.mjs';
import { readZipTexts } from './zip-read.mjs';

/** @typedef {string | number | boolean | null} CellValue */
/** @typedef {{ sheet: string; ref: string; code: 'noCachedValue' | 'errorValue' | 'unknownType'; message: string }} ReadProblem */
/** @typedef {{ name: string; rows: CellValue[][] }} ReadSheet rows[r][c] 是 0 起算的列與欄；沒有值的格是 null，列尾不補 null */

/** 一個 <si> 或 <is> 裡的文字：所有 <t> 直接相接（富文字分成多個 <r><t>），<rPh>（注音）略過 */
function richText(xml) {
  const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let s = '';
  for (const m of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) if (m[1] !== undefined) s += decodeXml(m[1]);
  return s;
}

/** sharedStrings.xml → string[] */
export function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) out.push(m[1] === undefined ? '' : richText(m[1]));
  return out;
}

/** 讀一個開頭標籤的屬性 */
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = decodeXml(m[2]);
  return out;
}

/**
 * 一張工作表的 XML → 二維陣列與問題清單
 * @param {string} xml
 * @param {string[]} sst
 * @param {string} sheetName
 * @returns {{ rows: CellValue[][]; problems: ReadProblem[] }}
 */
export function parseSheet(xml, sst, sheetName) {
  /** @type {CellValue[][]} */
  const rows = [];
  /** @type {ReadProblem[]} */
  const problems = [];
  const data = /<sheetData>([\s\S]*?)<\/sheetData>|<sheetData\/>/.exec(xml);
  if (!data) throw new Error(`xlsx：工作表「${sheetName}」沒有 sheetData`);
  const body = data[1] ?? '';
  // 每一格：<c r="A1" t="s" s="1"><v>0</v></c>、<c r="B1"><f>…</f><v>…</v></c>、<c r="C1" t="inlineStr"><is><t>…</t></is></c>、<c r="D1" s="2"/>
  for (const m of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const a = attrs(m[1]);
    if (!a.r) continue;
    const { col, row } = parseRef(a.r);
    const inner = m[2] ?? '';
    const t = a.t ?? 'n';
    const vMatch = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
    const v = vMatch ? decodeXml(vMatch[1]) : undefined;
    const hasFormula = /<f\b/.test(inner);
    /** @type {CellValue} */
    let value = null;
    if (t === 'inlineStr') {
      const is = /<is>([\s\S]*?)<\/is>/.exec(inner);
      value = is ? richText(is[1]) : '';
    } else if (v === undefined) {
      if (hasFormula)
        problems.push({ sheet: sheetName, ref: a.r, code: 'noCachedValue', message: '這一格是公式，但檔案裡沒有計算結果；請用 Excel 開啟後重新存檔' });
      continue; // 只有樣式的空格
    } else if (t === 's') {
      const i = Number(v);
      value = sst[i] ?? '';
    } else if (t === 'str') value = v;
    else if (t === 'b') value = v === '1' || v.toLowerCase() === 'true';
    else if (t === 'n') value = Number(v);
    else if (t === 'e') {
      problems.push({ sheet: sheetName, ref: a.r, code: 'errorValue', message: `這一格是錯誤值 ${v}；請改成文字或數字` });
      continue;
    } else {
      problems.push({ sheet: sheetName, ref: a.r, code: 'unknownType', message: `不認得的儲存格型別 ${t}` });
      continue;
    }
    while (rows.length < row) rows.push([]);
    const r = rows[row - 1];
    while (r.length < col - 1) r.push(null);
    r[col - 1] = value;
  }
  return { rows, problems };
}

/**
 * workbook.xml 與 rels → 依顯示順序的 [{ name, path }]
 * @param {string} workbookXml
 * @param {string} relsXml
 */
export function sheetList(workbookXml, relsXml) {
  const targets = new Map();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    if (a.Id && a.Target && (a.Type ?? '').endsWith('/worksheet')) targets.set(a.Id, a.Target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const out = [];
  for (const m of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    const rid = a['r:id'];
    const path = rid ? targets.get(rid) : undefined;
    if (!a.name || !path) throw new Error(`xlsx：workbook.xml 的工作表「${a.name ?? '?'}」在 rels 找不到對應的檔案`);
    out.push({ name: a.name, path });
  }
  return out;
}

/**
 * 讀一個 .xlsx（Buffer）。
 * @param {Buffer} buf
 * @returns {{ sheets: ReadSheet[]; problems: ReadProblem[] }}
 */
export function readWorkbook(buf) {
  const zip = readZipTexts(
    buf,
    (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(n),
  );
  const workbookXml = zip.get('xl/workbook.xml');
  const relsXml = zip.get('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) throw new Error('xlsx：不是 .xlsx（找不到 xl/workbook.xml 或它的 rels）');
  const sst = parseSharedStrings(zip.get('xl/sharedStrings.xml') ?? '');
  const sheets = [];
  const problems = [];
  for (const { name, path } of sheetList(workbookXml, relsXml)) {
    const xml = zip.get(path);
    if (xml === undefined) throw new Error(`xlsx：工作表「${name}」的檔案 ${path} 不在 zip 裡`);
    const parsed = parseSheet(xml, sst, name);
    sheets.push({ name, rows: parsed.rows });
    problems.push(...parsed.problems);
  }
  return { sheets, problems };
}
