/// <reference types="node" />
// 找到老師教材資料夾（只讀，永遠不進 repo；04 第 18.3 節）。
// 環境變數 LL_REFERENCES_DIR 優先，否則用 repo 根目錄的 references/；都不存在就回傳 null，本機測試整個略過。
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');

export function resolveReferencesDir(): string | null {
  const fromEnv = process.env['LL_REFERENCES_DIR'];
  const candidate = fromEnv !== undefined && fromEnv !== '' ? resolve(fromEnv) : join(REPO_ROOT, 'references');
  if (!existsSync(candidate)) return null;
  if (!statSync(candidate).isDirectory()) return null;
  return candidate;
}

export type ExcelLabel = 'S0' | 'S1' | 'S2' | 'S3';

export interface ExcelFile {
  readonly label: ExcelLabel;
  readonly path: string;
  readonly fileName: string;
}

/** 02-excel-statements/*.xlsx，依檔名開頭「財務報表-0」到「-3」排成 S0 到 S3；找不到資料夾時回傳空陣列 */
export function excelFiles(): ExcelFile[] {
  const dir = resolveReferencesDir();
  if (dir === null) return [];
  const folder = join(dir, '02-excel-statements');
  if (!existsSync(folder)) return [];
  const out: ExcelFile[] = [];
  for (const name of readdirSync(folder)) {
    const fileName = name.normalize('NFC');
    if (!fileName.endsWith('.xlsx') || fileName.startsWith('~$') || fileName.startsWith('.')) continue;
    const m = fileName.match(/^財務報表-([0-3])\b/u);
    if (m === null) continue;
    out.push({ label: `S${m[1] as string}` as ExcelLabel, path: join(folder, name), fileName });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
