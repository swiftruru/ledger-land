// content:i18n-report（05 第 6 節）：列出每個 complete 語系缺翻譯的內容欄位；已發布的項目缺字讓 CI 失敗，草稿只列報表。
// 報表寫到 .local-reports/i18n/content-report.json（gitignored）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, BASE_LOCALE } from '@ledgerland/i18n';
import { loadContentFiles } from './lib/content-files.mjs';
import { ROOT, fail } from './lib/fs.mjs';

const bundle = loadContentFiles();
const report = [];
function scan(file, status, value, path) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((v, i) => scan(file, status, v, [...path, String(i)]));
  const keys = Object.keys(value);
  const localized = keys.length && keys.every((k) => LOCALES.some((l) => l.code === k)) && keys.every((k) => typeof value[k] === 'string');
  if (localized) {
    for (const l of LOCALES)
      if (l.code !== BASE_LOCALE && l.status === 'complete' && !value[l.code]) report.push({ file, status, path: path.join('.'), locale: l.code });
    return;
  }
  for (const k of keys) scan(file, status, value[k], [...path, k]);
}
for (const x of [...bundle.terms, ...bundle.chapters]) if (x.data) scan(x.file, x.data.status, x.data, []);
mkdirSync(join(ROOT, '.local-reports/i18n'), { recursive: true });
writeFileSync(join(ROOT, '.local-reports/i18n/content-report.json'), JSON.stringify(report, null, 2));
const publishedMissing = report.filter((r) => r.status === 'published');
for (const r of publishedMissing) fail(`content:i18n-report：已發布的 ${r.file} 缺 ${r.locale} 的 ${r.path}`);
console.log(
  `content:i18n-report：${report.length} 個缺翻譯欄位（已發布 ${publishedMissing.length}、草稿 ${report.length - publishedMissing.length}），報表在 .local-reports/i18n/content-report.json`,
);
