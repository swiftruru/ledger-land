// docs:examples（08 第 5.8 節、10 M0b 完成標準）：抽出 docs/ 中所有 ```json 程式碼區塊（```jsonc 的節錄不抽），全部要能解析；
// 依 id 前綴或形狀選出對應的 Zod schema 驗證（名詞 tm_、章節 ch_ 加 order、題目 q_ 加 type、故事 story_、步驟 st_、
// 範本 tpl.、指標含 versions、科目含 element 與 normalSide、版面含 statements、政策含 switches）。只存在本機的 01、13、15 不在範圍內。
// 失敗時列出檔案、行號、欄位與原因；改文件還是改 schema 由維護者決定。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Account, Chapter, Layout, PolicyDefinition, Question, RatioDefinition, Story, StoryStep, Term, TransactionTemplate } from '@ledgerland/content-schema';
import { ROOT, fail, walk } from './lib/fs.mjs';

/** 依 id 前綴或形狀選 schema；選不到就回傳 null（例如編譯後的快照、設定檔） */
function pickSchema(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const id = typeof data.id === 'string' ? data.id : '';
  if (id.startsWith('tm_')) return { name: 'Term', schema: Term };
  if (id.startsWith('ch_') && 'order' in data) return { name: 'Chapter', schema: Chapter };
  if (id.startsWith('q_') && 'type' in data) return { name: 'Question', schema: Question };
  if (id.startsWith('story_')) return { name: 'Story', schema: Story };
  if (id.startsWith('st_')) return { name: 'StoryStep', schema: StoryStep };
  if (id.startsWith('tpl.')) return { name: 'TransactionTemplate', schema: TransactionTemplate };
  if ('versions' in data && 'termRef' in data) return { name: 'RatioDefinition', schema: RatioDefinition };
  if ('element' in data && 'normalSide' in data) return { name: 'Account', schema: Account };
  if ('statements' in data && 'options' in data) return { name: 'Layout', schema: Layout };
  if ('switches' in data && 'disabledAccounts' in data) return { name: 'PolicyDefinition', schema: PolicyDefinition };
  return null;
}

const files = walk(join(ROOT, 'docs'), { ext: ['.md'] }).filter((f) => !/01-materials|13-material-questions|15-ai-workflow/.test(f));
let blocks = 0;
let validated = 0;
let failed = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const rel = f.replace(ROOT + '/', '');
  // 只抽 ```json 圍欄；```jsonc 是刻意節錄的範例（省略必填欄位），不驗證
  for (const m of text.matchAll(/```json[ \t]*\n([\s\S]*?)```/g)) {
    blocks++;
    const line = text.slice(0, m.index).split('\n').length;
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      fail(`docs:examples：${rel}:${line} 的 JSON 範例無法解析：${String(e).split('\n')[0]}`);
      continue;
    }
    const picked = pickSchema(data);
    if (!picked) continue;
    const { name, schema } = picked;
    validated++;
    const r = schema.safeParse(data);
    if (!r.success) {
      failed++;
      for (const i of r.error.issues)
        fail(`docs:examples：${rel}:${line} 的範例 ${data.id ?? '(無 id)'} 不符合 ${name} schema：${i.path.join('.') || '(root)'} ${i.message}`);
    }
  }
}
if (process.exitCode) console.error(`docs:examples：${validated} 個範例中有 ${failed} 個不符合 schema（見上方清單）`);
else console.log(`docs:examples：${files.length} 個文件、${blocks} 個 JSON 區塊都能解析，${validated} 個實體範例通過 schema`);
