// 台灣用語與破折號掃描（09 第 10.2 節的 lint 工作）：docs、content、兩份 Lingui catalog、README 等。
// 破折號（em dash、en dash、全形「—」）一律不允許；常見的非台灣用語列為錯誤。英文介面字串與內容用英式拼字（D11）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, walk } from './lib/fs.mjs';

const DASH = /[–—―]/;
/** 非台灣用語與台灣寫法；同一行同時出現兩者（用語對照表、審稿範例）或明說「中國用語」時視為討論該詞，不算違規 */
const NON_TW_MAP = {
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
};
const NON_TW = Object.keys(NON_TW_MAP);
const NON_TW_WITH_EXCEPTIONS = [{ word: '用戶', allow: ['用戶端'] }];
const isDiscussing = (line, w) => line.includes('中國用語') || line.includes(NON_TW_MAP[w]);
const US_SPELLING = [/\bcolor\b/i, /\borganization\b/i, /\banalyze\b/i, /\bcenter\b/i, /\bfavorite\b/i, /\blicense\b(?!d)/];
/** 英式拼字只檢查介面字串的 en catalog 與 content 的 en 欄位；程式碼裡的 color 等屬性名不算 */
const targets = [
  ...walk(join(ROOT, 'docs'), { ext: ['.md'] }).filter((f) => !/01-materials|13-material-questions|15-ai-workflow/.test(f)),
  ...walk(join(ROOT, 'content'), { ext: ['.json', '.md'] }),
  join(ROOT, 'README.md'),
  join(ROOT, 'CONTRIBUTING.md'),
  join(ROOT, 'SECURITY.md'),
  join(ROOT, 'NOTICE'),
  join(ROOT, 'apps/web/src/locales/zh-TW/messages.po'),
  join(ROOT, 'apps/web/src/locales/en/messages.po'),
  join(ROOT, 'packages/web-ui/src/locales/zh-TW/messages.po'),
  join(ROOT, 'packages/web-ui/src/locales/en/messages.po'),
  ...walk(join(ROOT, 'apps/web/src'), { ext: ['.tsx', '.ts'] }),
  ...walk(join(ROOT, 'packages/web-ui/src'), { ext: ['.tsx', '.ts'] }),
];
let ok = true;
let scanned = 0;
for (const f of targets) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  scanned++;
  const rel = f.replace(ROOT + '/', '');
  text.split('\n').forEach((line, i) => {
    if (DASH.test(line)) {
      fail(`check:tw：${rel}:${i + 1} 有破折號`);
      ok = false;
    }
    for (const w of NON_TW)
      if (line.includes(w) && !isDiscussing(line, w)) {
        fail(`check:tw：${rel}:${i + 1} 非台灣用語「${w}」`);
        ok = false;
      }
    for (const { word, allow } of NON_TW_WITH_EXCEPTIONS) {
      let stripped = line;
      for (const a of allow) stripped = stripped.split(a).join('');
      if (stripped.includes(word) && !line.includes('使用者') && !line.includes('中國用語')) {
        fail(`check:tw：${rel}:${i + 1} 非台灣用語「${word}」`);
        ok = false;
      }
    }
    if (f.endsWith('locales/en/messages.po') && line.startsWith('msgstr')) {
      for (const re of US_SPELLING)
        if (re.test(line)) {
          fail(`check:tw：${rel}:${i + 1} 英文介面字串請用英式拼字：${line.trim()}`);
          ok = false;
        }
    }
    if (/content\/.*\.json$/.test(f) && /"en":\s*"/.test(line)) {
      for (const re of US_SPELLING)
        if (re.test(line)) {
          fail(`check:tw：${rel}:${i + 1} 英文內容請用英式拼字：${line.trim().slice(0, 80)}`);
          ok = false;
        }
    }
  });
}
if (ok) console.log(`check:tw：${scanned} 個檔案沒有破折號與非台灣用語`);
