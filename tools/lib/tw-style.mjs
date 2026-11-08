// 台灣用語與破折號的規則表（09 第 10.2 節）：check-tw-style.mjs 掃整個 repo 的檔案，Excel 匯入（import-run.mjs）掃候選的文字欄位，兩邊共用這一份。
// 破折號（em dash、en dash、全形「—」）一律不允許；常見的非台灣用語列為錯誤。同一段文字同時出現非台灣用語與台灣寫法（用語對照、審稿範例）或明說「中國用語」時，
// 視為在討論那個詞，不算違規。

export const DASH_RE = /[–—―]/;

/** 非台灣用語對台灣寫法 */
export const NON_TW_MAP = Object.freeze({
  軟件: '軟體',
  信息: '資訊',
  默認: '預設',
  設置: '設定',
  視頻: '影片',
  屏幕: '螢幕',
  網絡: '網路',
  服務器: '伺服器',
  文件夾: '資料夾',
  打印: '列印',
  質量: '品質',
  鼠標: '滑鼠',
  加載: '載入',
  調用: '呼叫',
  函數: '函式',
  接口: '介面',
  兼容: '相容',
  回調: '回呼',
  異步: '非同步',
  併發: '並行',
  數據庫: '資料庫',
  內存: '記憶體',
  硬盤: '硬碟',
  程序員: '工程師',
});
export const NON_TW_WORDS = Object.freeze(Object.keys(NON_TW_MAP));
/** 有例外寫法的詞：用戶端是台灣用語 */
export const NON_TW_WITH_EXCEPTIONS = Object.freeze([{ word: '用戶', allow: ['用戶端'], instead: '使用者' }]);

export const isDiscussing = (line, w) => line.includes('中國用語') || line.includes(NON_TW_MAP[w]);

/**
 * 一段文字的台灣用語問題：回傳 [{ word, instead }]（破折號的 word 是 '破折號'）；沒有問題是空陣列
 * @param {string} text
 */
export function twStyleHits(text) {
  /** @type {{ word: string; instead: string }[]} */
  const out = [];
  if (DASH_RE.test(text)) out.push({ word: '破折號', instead: '逗號、冒號、括號或分句' });
  for (const w of NON_TW_WORDS) if (text.includes(w) && !isDiscussing(text, w)) out.push({ word: w, instead: NON_TW_MAP[w] });
  for (const { word, allow, instead } of NON_TW_WITH_EXCEPTIONS) {
    let stripped = text;
    for (const a of allow) stripped = stripped.split(a).join('');
    if (stripped.includes(word) && !text.includes(instead) && !text.includes('中國用語')) out.push({ word, instead });
  }
  return out;
}
