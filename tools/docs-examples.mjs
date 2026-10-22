// docs:examples（08 第 5.8 節、10 M0b 完成標準）：抽出 docs/ 中所有 ```json 程式碼區塊，全部要能解析；
// 名詞與章節的範例（依 id 前綴 tm_、ch_ 判斷）要通過同一套 Zod schema。只存在本機的 01、13、15 不在範圍內。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chapter, Term } from '@ledgerland/content-schema';
import { ROOT, fail, walk } from './lib/fs.mjs';

const files = walk(join(ROOT, 'docs'), { ext: ['.md'] }).filter((f) => !/01-materials|13-material-questions|15-ai-workflow/.test(f));
let blocks = 0;
let validated = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const rel = f.replace(ROOT + '/', '');
  for (const m of text.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)) {
    blocks++;
    const line = text.slice(0, m.index).split('\n').length;
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      fail(`docs:examples：${rel}:${line} 的 JSON 範例無法解析：${String(e).split('\n')[0]}`);
      continue;
    }
    const id = data && typeof data === 'object' && !Array.isArray(data) ? data.id : undefined;
    const schema = typeof id === 'string' && id.startsWith('tm_') ? Term : typeof id === 'string' && id.startsWith('ch_') && 'order' in data ? Chapter : null;
    if (!schema) continue;
    validated++;
    const r = schema.safeParse(data);
    if (!r.success) for (const i of r.error.issues) fail(`docs:examples：${rel}:${line} 的範例 ${id} 不符合 schema：${i.path.join('.')} ${i.message}`);
  }
}
if (!process.exitCode) console.log(`docs:examples：${files.length} 個文件、${blocks} 個 JSON 區塊都能解析，${validated} 個名詞或章節範例通過 schema`);
