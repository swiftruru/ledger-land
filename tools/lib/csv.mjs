// CSV 的解析與輸出（08 第 10.2、10.6 節）：RFC 4180（雙引號包欄、欄內的雙引號寫兩個、欄內可含換行、CRLF 或 LF）。
// 編碼：先當 UTF-8（去 BOM，嚴格模式），失敗改 Big5（Node 內建 TextDecoder，官方二進位是 full ICU；cp950 不是合法 label），兩者都失敗就丟錯。
// 輸出一律 UTF-8 加 BOM、CRLF（Excel 直接開不會變亂碼）。不加依賴。

/**
 * 解析 CSV 文字成二維陣列；最後一個空行略過；欄位都是字串
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) throw new Error('csv：有一個雙引號沒有關起來（檔案結尾還在引號裡）');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** 一個欄位的輸出：含逗號、雙引號、換行或頭尾空白時用雙引號包住 */
function csvField(v) {
  const s = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 二維陣列 → CSV 文字（CRLF，不含 BOM）
 * @param {(string | number | boolean | null | undefined)[][]} rows
 */
export function toCsv(rows) {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** CSV 檔案的 Buffer：UTF-8 加 BOM */
export function csvBuffer(rows) {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(toCsv(rows), 'utf8')]);
}

/**
 * 解碼 CSV 的位元組：UTF-8 優先，失敗改 Big5
 * @param {Buffer | Uint8Array} buf
 * @returns {{ text: string; encoding: 'utf-8' | 'big5' }}
 */
export function decodeCsvBuffer(buf) {
  // UTF-16 的 BOM（Excel「Unicode 文字」另存的是 tab 分隔的 UTF-16）：Big5 解碼器不會丟錯但會解出垃圾，先擋下
  if (buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)))
    throw new Error('csv：檔案是 UTF-16（Excel 的「Unicode 文字」格式）；請在 Excel 用「CSV UTF-8（逗號分隔）」另存，或改存成 .xlsx');
  try {
    return { text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf), encoding: 'utf-8' };
  } catch {
    // 不是合法的 UTF-8，試 Big5
  }
  try {
    return { text: new TextDecoder('big5', { fatal: true }).decode(buf), encoding: 'big5' };
  } catch {
    throw new Error('csv：檔案不是 UTF-8 也不是 Big5；請在 Excel 用「CSV UTF-8（逗號分隔）」另存，或改存成 .xlsx');
  }
}
