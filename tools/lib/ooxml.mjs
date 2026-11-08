// OOXML 共用的小工具：XML 實體的編碼與解碼、儲存格參照（欄字母與列號）的換算。給 handout-pptx.mjs、xlsx-read.mjs、xlsx-write.mjs 用。
// 不用 DOM 或 XML 套件：Office 寫出的 XML 結構固定，正規式分段就夠（handout-pptx.mjs 的做法）。

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** 解 XML 實體（含十進位與十六進位的數字實體） */
export function decodeXml(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, body) => {
    if (body[0] === '#') return String.fromCodePoint(body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10));
    return body in ENTITIES ? ENTITIES[body] : m;
  });
}

/** XML 1.0 不允許的字元：控制字元（除 tab、換行、回車）與兩個非字元；用字串組，避免原始碼裡出現這些字元本身 */
// eslint-disable-next-line no-control-regex -- 就是要比對這些不允許的字元
const XML_INVALID_RE = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\ufffe\\uffff]', 'g');

/** 編成 XML 文字或屬性值：五個實體都換掉，XML 1.0 不允許的字元直接拿掉 */
export function encodeXml(text) {
  return String(text)
    .replace(XML_INVALID_RE, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 1 起算的欄號轉欄字母：1 → A、26 → Z、27 → AA */
export function colLetter(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`colLetter：欄號要是 1 起算的整數，收到 ${String(n)}`);
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** 欄字母轉 1 起算的欄號：A → 1、AA → 27 */
export function colIndex(letters) {
  if (!/^[A-Z]+$/.test(letters)) throw new RangeError(`colIndex：欄字母只能是 A 到 Z，收到「${letters}」`);
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 儲存格參照：colLetter(col) 加列號（都是 1 起算） */
export function cellRef(col, row) {
  return `${colLetter(col)}${row}`;
}

/**
 * 解儲存格參照 "C12" → { col: 3, row: 12 }（1 起算）；允許 $ 絕對符號
 * @param {string} ref
 * @returns {{ col: number; row: number }}
 */
export function parseRef(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new RangeError(`parseRef：看不懂儲存格參照「${ref}」`);
  return { col: colIndex(m[1]), row: Number(m[2]) };
}

/** 公式裡引用工作表的寫法：一律用單引號包住（名稱內的單引號寫成兩個），例如 '清單'!$A$2:$A$9 */
export function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}
