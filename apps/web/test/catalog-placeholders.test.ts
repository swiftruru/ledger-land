// 兩份 catalog 的佔位符要一樣（05 第 3.4 節）：原始碼傳的是 zh-TW 那份寫的參數名稱，英文寫成別的名稱（例如 {0} 對 {max}）執行時那個位置就變成空白，
// i18n:check 只查缺字，抓不到。比的是每個 msgid 用到的參數集合，複數與選擇語法的選項文字不算參數。
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIRS = [resolve(HERE, '../src/locales'), resolve(HERE, '../../../packages/web-ui/src/locales')];

const unquote = (line: string): string => JSON.parse(line.trim()) as string;

/** 讀 .po：msgid 對 msgstr（含續行）；檔頭的空 msgid 不算 */
function readPo(file: string): Map<string, string> {
  const out = new Map<string, string>();
  let id: string | null = null;
  let str: string | null = null;
  let field: 'id' | 'str' | null = null;
  const flush = () => {
    if (id && str !== null) out.set(id, str);
    id = null;
    str = null;
    field = null;
  };
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('msgid ')) {
      flush();
      id = unquote(line.slice(6));
      field = 'id';
    } else if (line.startsWith('msgstr ')) {
      str = unquote(line.slice(7));
      field = 'str';
    } else if (line.startsWith('"')) {
      if (field === 'id') id = (id ?? '') + unquote(line);
      else if (field === 'str') str = (str ?? '') + unquote(line);
    }
  }
  flush();
  return out;
}

/** 字串裡最外層的 {...} 內容 */
function groups(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (const [i, c] of [...text].entries()) {
    if (c === '{' && depth++ === 0) start = i + 1;
    else if (c === '}' && --depth === 0) out.push([...text].slice(start, i).join(''));
  }
  return out;
}

/** 訊息用到的參數名稱：{name}，以及 {name, plural, one {...} other {...}} 的 name 與選項文字裡的參數 */
function placeholders(text: string): Set<string> {
  const names = new Set<string>();
  for (const g of groups(text)) {
    const branch = /^\s*(\w+)\s*,\s*(?:plural|select|selectordinal)\s*,(.*)$/su.exec(g);
    if (branch !== null) {
      names.add(branch[1]!);
      for (const arm of groups(branch[2]!)) for (const n of placeholders(arm)) names.add(n);
    } else names.add(g.trim());
  }
  return names;
}

describe('placeholders', () => {
  it('收參數名稱；複數的選項文字不算參數，選項裡的參數算', () => {
    expect(placeholders('最多 {max}，最少 {min}')).toEqual(new Set(['max', 'min']));
    expect(placeholders('{n, plural, one {# step of {total}} other {steps}}')).toEqual(new Set(['n', 'total']));
    expect(placeholders('沒有參數')).toEqual(new Set());
  });
});

describe('兩份 catalog 的佔位符一致', () => {
  for (const dir of LOCALE_DIRS) {
    for (const file of readdirSync(join(dir, 'zh-TW')).filter((f) => f.endsWith('.po'))) {
      it(`${dir.includes('web-ui') ? 'web-ui' : 'web'}/${file}`, () => {
        const zh = readPo(join(dir, 'zh-TW', file));
        const en = readPo(join(dir, 'en', file));
        expect(zh.size).toBeGreaterThan(0);
        const differs = [...zh].flatMap(([id, source]) => {
          const a = [...placeholders(source)].sort();
          const b = [...placeholders(en.get(id) ?? source)].sort();
          return a.join() === b.join() ? [] : [`${id}：zh-TW {${a.join('} {')}}，en {${b.join('} {')}}`];
        });
        expect(differs).toEqual([]);
      });
    }
  }
});
