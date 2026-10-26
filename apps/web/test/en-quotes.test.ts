// 英文介面的引號（M3 驗收第 9 輪定案）：英式，第一層用單引號 ‘ ’，引號裡再引用時才用 “ ”；不用 ASCII 的雙引號。
// 同一個介面名稱（‘Export to app’）在安裝教學、Safari 分頁提示與匯入提示卡要用同一種引號。
// 檢查 apps/web 與 web-ui 兩份 en catalog 的每一則 msgstr，以及 content/ 每個英文欄位（題目、解說、名詞、章節、學習目標；第 9 輪交辦處理全站掃過一次，
// 只改了引號字元，字句不變）。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CATALOGS = ['../src/locales/en/messages.po', '../../../packages/web-ui/src/locales/en/messages.po'];
const CONTENT = new URL('../../../content/', import.meta.url);

function messages(): [id: string, text: string][] {
  const out: [string, string][] = [];
  for (const path of CATALOGS) {
    const po = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const m of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) out.push([m[1]!, JSON.parse(`"${m[2]!}"`) as string]);
  }
  return out;
}

const LETTER = /\p{L}/u;

/** 第一層（不在 ‘ ’ 裡）出現 “ 的位置；’ 夾在兩個字母之間（it’s、Safari’s）是撇號，不算閉引號 */
function outerDoubleQuote(text: string): number {
  const chars = [...text];
  let open = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === '‘') open++;
    else if (ch === '’' && open > 0 && !(LETTER.test(chars[i - 1] ?? '') && LETTER.test(chars[i + 1] ?? ''))) open--;
    else if (ch === '“' && open === 0) return i;
  }
  return -1;
}

describe('英文 catalog 的引號', () => {
  it('判斷第一層引號的規則', () => {
    expect(outerDoubleQuote('Tap ‘Export to app’.')).toBe(-1);
    expect(outerDoubleQuote('Tap “Export to app”.')).toBe(4);
    expect(outerDoubleQuote('Safari’s rules, then tap ‘Add’.')).toBe(-1);
    expect(outerDoubleQuote('He said ‘tap “Add” first’.')).toBe(-1);
  });

  const all = messages();
  it('至少讀到兩份 catalog 的訊息', () => {
    expect(all.length).toBeGreaterThan(500);
  });

  it('第一層引號是英式單引號 ‘ ’，不是 “ ”', () => {
    const bad = all.filter(([, text]) => outerDoubleQuote(text) >= 0).map(([id, text]) => `${id}: ${text}`);
    expect(bad, '把第一層的 “ ” 改成 ‘ ’（寫進自己分組的 strings JSON 再 i18n-sync）').toEqual([]);
  });

  it('不用 ASCII 的雙引號當引號', () => {
    const bad = all.filter(([, text]) => text.includes('"')).map(([id, text]) => `${id}: ${text}`);
    expect(bad).toEqual([]);
  });
});

/** content/ 裡每個 en 與 zh-TW 欄位：[檔案與路徑, 文字] */
function contentTexts(): [where: string, text: string][] {
  const out: [string, string][] = [];
  const visit = (v: unknown, where: string): void => {
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${where}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if ((k === 'en' || k === 'zh-TW') && typeof x === 'string') out.push([`${where}.${k}`, x]);
        else visit(x, `${where}.${k}`);
      }
  };
  for (const entry of readdirSync(CONTENT, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'published.lock.json') continue;
    const file = `${entry.parentPath}/${entry.name}`;
    visit(JSON.parse(readFileSync(file, 'utf8')), file.slice(file.indexOf('content/')));
  }
  return out;
}

describe('content 的引號', () => {
  const texts = contentTexts();
  const all = texts.filter(([where]) => where.endsWith('.en'));
  it('讀到題目、名詞與章節的英文', () => {
    expect(all.length).toBeGreaterThan(1000);
  });

  it('第一層引號是 ‘ ’，不用 ASCII 的雙引號或第一層的 “ ”', () => {
    const bad = all.filter(([, text]) => text.includes('"') || outerDoubleQuote(text) >= 0).map(([where, text]) => `${where}: ${text}`);
    expect(bad).toEqual([]);
  });

  it('解說的選項引用 {{option:…}} 外面不再寫引號：引號由 CSS 加（feedback.css 的 .ll-optref），自己寫會變成兩層', () => {
    const bad = texts.filter(([, text]) => /[「‘“"]\{\{option:[^}]+\}\}|\{\{option:[^}]+\}\}[」’”"]/.test(text)).map(([where]) => where);
    expect(bad).toEqual([]);
  });
});
