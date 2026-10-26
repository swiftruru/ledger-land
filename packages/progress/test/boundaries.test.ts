// 模組邊界（06 第 8.2 節、14 第 5.2 節）：儲存 runtime 要用到的檔案在執行期不得載入 zod 或任何 schema 定義，
// 這樣 apps/web 的進度 chunk 才不會把 zod 連進地圖與作答頁的第二波請求。這裡直接讀原始碼檢查 import 陳述式，
// 建置後的 chunk 內容另外以 vite build 的 //#region 清單核對。
import { readFileSync } from 'node:fs';
import { CROCKFORD } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { generateDeviceId } from '../src/index.ts';

/** 執行期會被 IndexedDB 實作、記憶體實作與作答 store 載入的檔案 */
const RUNTIME_FILES = ['model.ts', 'store.ts', 'derive.ts', 'merge.ts', 'migrations.ts', 'session.ts', 'time.ts', 'util.ts', 'result.ts'] as const;
/** 真的需要 zod 的檔案：schema 定義、備份匯入驗證、作答工作階段暫存的驗證 */
const SCHEMA_FILES = ['schemas.ts', 'backup.ts', 'session-schemas.ts'] as const;

function source(file: string): string {
  return readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
}

/** 去掉註解後的 import 陳述式（含多行） */
function imports(file: string): string[] {
  const text = source(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  return text.match(/^import[\s\S]*?from\s+'[^']+';/gm) ?? [];
}

/** 會在執行期載入值的 import（import type 會被編譯器拿掉，不算） */
function valueImportsOf(file: string, specifier: string): string[] {
  return imports(file).filter((stmt) => stmt.includes(`'${specifier}'`) && !/^import type /.test(stmt));
}

describe('runtime 與 schema 的邊界', () => {
  it.each(RUNTIME_FILES)('%s 不 import zod，也不從 content-schema 載入值', (file) => {
    expect(valueImportsOf(file, 'zod')).toEqual([]);
    expect(valueImportsOf(file, '@ledgerland/content-schema')).toEqual([]);
  });

  it.each(RUNTIME_FILES)('%s 對 schema 檔只做 import type', (file) => {
    expect(valueImportsOf(file, './schemas.ts')).toEqual([]);
    expect(valueImportsOf(file, './session-schemas.ts')).toEqual([]);
  });

  it('zod 只出現在 schema 檔', () => {
    const all = [...RUNTIME_FILES, ...SCHEMA_FILES, 'index.ts'];
    const withZod = all.filter((f) => imports(f).some((s) => /from 'zod'/.test(s)));
    expect(withZod.sort()).toEqual([...SCHEMA_FILES].sort());
  });

  it('model.ts 另抄的 Crockford 字母表與 content-schema 的 CROCKFORD 一致', () => {
    expect(CROCKFORD).toHaveLength(32);
    for (let i = 0; i < CROCKFORD.length; i++) {
      // 固定回傳落在第 i 格的亂數，8 碼都應該是同一個字母
      expect(generateDeviceId(() => (i + 0.5) / CROCKFORD.length)).toBe(`d_${CROCKFORD[i]!.repeat(8)}`);
    }
  });
});
