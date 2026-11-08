// 最小的 xlsx 寫入器（08 第 10.2、10.6 節，2026-11-08 的決定：不加依賴，自己寫 OOXML）：給 content:template 產生帶下拉清單的範本。
// 寫出 [Content_Types].xml、_rels/.rels、xl/workbook.xml、xl/_rels/workbook.xml.rels、xl/styles.xml、xl/sharedStrings.xml 與每張工作表。
// 支援：字串（共用字串表）、數字、布林、空格；欄寬；凍結前 n 列；指定幾列用「灰色小字」樣式（範本第 1 列的欄位 key）；
// 資料驗證下拉清單（type="list"，formula1 可以是常數清單或另一張工作表的範圍）。<dataValidations> 放在 <sheetData> 之後、<pageMargins> 之前
// （CT_Worksheet 的順序，ISO/IEC 29500 第 18.3.1.99 節）。不設 showDropDown（設了反而隱藏箭頭）。
import { cellRef, colLetter, encodeXml, quoteSheetName } from './ooxml.mjs';
import { writeZip } from './zip-write.mjs';

/** @typedef {string | number | boolean | null | undefined} CellValue */
/**
 * 下拉清單：values 是常數清單（寫成 "甲,乙,丙"，總長有 255 字元的限制，長清單請改用範圍）；sheet 加 range 是另一張工作表的範圍，例如 range '$A$2:$A$9'
 * @typedef {{ sqref: string; values: string[] } | { sqref: string; sheet: string; range: string }} Validation
 */
/**
 * @typedef {object} SheetSpec
 * @property {string} name
 * @property {CellValue[][]} rows
 * @property {number[]} [widths] 每一欄的寬度（字元數），省略的欄用預設
 * @property {number} [freezeRows] 凍結前幾列
 * @property {number[]} [mutedRows] 用灰色小字的列（0 起算）
 * @property {Validation[]} [validations]
 */

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL_OFFICE_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const REL_WORKSHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
const REL_SST = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings';
const CT_WORKBOOK = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
const CT_WORKSHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const CT_STYLES = 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml';
const CT_SST = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml';
const CT_RELS = 'application/vnd.openxmlformats-package.relationships+xml';

/** 工作表名稱的限制（Excel）：1 到 31 個字元，不含 : \ / ? * [ ] */
export function checkSheetName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 31) throw new Error(`xlsx：工作表名稱要 1 到 31 個字元：「${String(name)}」`);
  if (/[:\\/?*[\]]/.test(name)) throw new Error(`xlsx：工作表名稱不能含 : \\ / ? * [ ]：「${name}」`);
}

/** 樣式索引：0 一般（自動換行、靠上），1 灰色小字（範本第 1 列的欄位 key） */
const STYLE_NORMAL = 0;
const STYLE_MUTED = 1;

function stylesXml() {
  return (
    XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><sz val="9"/><color rgb="FF808080"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

/** 共用字串表：同一字串只存一次 */
class SharedStrings {
  constructor() {
    /** @type {Map<string, number>} */
    this.index = new Map();
    /** @type {string[]} */
    this.list = [];
  }
  add(s) {
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.index.set(s, i);
      this.list.push(s);
    }
    return i;
  }
  xml() {
    const items = this.list.map((s) => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${encodeXml(s)}</t></si>`).join('');
    return XML_HEAD + `<sst xmlns="${NS_MAIN}" count="${this.list.length}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

/**
 * 一格的 XML；空值不輸出
 * @param {string} ref
 * @param {CellValue} v
 * @param {number} style
 * @param {SharedStrings} sst
 */
function cellXml(ref, v, style, sst) {
  const s = style === STYLE_NORMAL ? '' : ` s="${style}"`;
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return `<c r="${ref}" t="b"${s}><v>${v ? 1 : 0}</v></c>`;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`xlsx：${ref} 的數字不是有限值`);
    return `<c r="${ref}"${s}><v>${v}</v></c>`;
  }
  if (typeof v === 'string') {
    if (v === '') return '';
    return `<c r="${ref}" t="s"${s}><v>${sst.add(v)}</v></c>`;
  }
  throw new TypeError(`xlsx：${ref} 的值型別不支援（${typeof v}）`);
}

function validationXml(v) {
  const formula1 = 'values' in v ? `"${v.values.join(',')}"` : `${quoteSheetName(v.sheet)}!${v.range}`;
  if ('values' in v) {
    if (v.values.some((x) => /[",]/.test(x))) throw new Error(`xlsx：常數清單的值不能含逗號或雙引號（${v.sqref}）`);
    if (formula1.length > 255) throw new Error(`xlsx：常數清單超過 255 字元（${v.sqref}），請改用另一張工作表的範圍`);
  }
  return (
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="warning" sqref="${encodeXml(v.sqref)}"` +
    ` errorTitle="${encodeXml('不在清單裡')}" error="${encodeXml('這個值不在下拉清單裡；按「是」保留，匯入時會檢查。')}">` +
    `<formula1>${encodeXml(formula1)}</formula1></dataValidation>`
  );
}

/**
 * @param {SheetSpec} sheet
 * @param {SharedStrings} sst
 */
function worksheetXml(sheet, sst) {
  const muted = new Set(sheet.mutedRows ?? []);
  const rowsXml = [];
  let maxCol = 0;
  sheet.rows.forEach((row, i) => {
    const style = muted.has(i) ? STYLE_MUTED : STYLE_NORMAL;
    const cells = row.map((v, j) => cellXml(cellRef(j + 1, i + 1), v, style, sst)).filter(Boolean);
    maxCol = Math.max(maxCol, row.length);
    if (cells.length) rowsXml.push(`<row r="${i + 1}">${cells.join('')}</row>`);
  });
  const lastRef = cellRef(Math.max(1, maxCol), Math.max(1, sheet.rows.length));
  const freeze = sheet.freezeRows ?? 0;
  const pane = freeze > 0 ? `<pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>` : '';
  const widths = sheet.widths ?? [];
  const cols = widths.length
    ? `<cols>${widths.map((w, j) => (w === undefined ? '' : `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`)).join('')}</cols>`
    : '';
  const validations = sheet.validations?.length
    ? `<dataValidations count="${sheet.validations.length}">${sheet.validations.map(validationXml).join('')}</dataValidations>`
    : '';
  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${rowsXml.join('')}</sheetData>` +
    validations +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>'
  );
}

/**
 * 寫出一個 .xlsx（Buffer）。
 * @param {{ sheets: SheetSpec[] }} workbook
 * @returns {Buffer}
 */
export function writeWorkbook(workbook) {
  if (!workbook.sheets?.length) throw new Error('xlsx：至少要有一張工作表');
  const names = new Set();
  for (const s of workbook.sheets) {
    checkSheetName(s.name);
    if (names.has(s.name.toLowerCase())) throw new Error(`xlsx：工作表名稱重複（不分大小寫）：「${s.name}」`);
    names.add(s.name.toLowerCase());
  }
  const sst = new SharedStrings();
  const sheetXmls = workbook.sheets.map((s) => worksheetXml(s, sst));
  const sheetRels = workbook.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${i + 1}.xml"/>`);
  const n = workbook.sheets.length;
  const workbookXml =
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView/></bookViews><sheets>` +
    workbook.sheets.map((s, i) => `<sheet name="${encodeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';
  const workbookRels =
    XML_HEAD +
    `<Relationships xmlns="${NS_PKG_REL}">${sheetRels.join('')}` +
    `<Relationship Id="rId${n + 1}" Type="${REL_STYLES}" Target="styles.xml"/>` +
    `<Relationship Id="rId${n + 2}" Type="${REL_SST}" Target="sharedStrings.xml"/>` +
    '</Relationships>';
  const rootRels =
    XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${REL_OFFICE_DOC}" Target="xl/workbook.xml"/></Relationships>`;
  const contentTypes =
    XML_HEAD +
    `<Types xmlns="${NS_CT}">` +
    `<Default Extension="rels" ContentType="${CT_RELS}"/><Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="${CT_WORKBOOK}"/>` +
    workbook.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT_WORKSHEET}"/>`).join('') +
    `<Override PartName="/xl/styles.xml" ContentType="${CT_STYLES}"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT_SST}"/>` +
    '</Types>';
  return writeZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: stylesXml() },
    { name: 'xl/sharedStrings.xml', data: sst.xml() },
    ...sheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml })),
  ]);
}

/** 給呼叫端算下拉清單範圍用：某一欄從 fromRow 到 toRow 的 sqref，例如 columnRange(3, 3, 5000) → "C3:C5000" */
export function columnRange(col, fromRow, toRow) {
  return `${colLetter(col)}${fromRow}:${colLetter(col)}${toRow}`;
}
