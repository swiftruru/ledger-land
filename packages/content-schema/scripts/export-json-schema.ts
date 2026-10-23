// 以 draft-07 輸出 JSON Schema 到 schemas/（09 第 6.2 節）；--check 時只比對，不一致就 exit 1（CI 的 schemas:check）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Account } from '../src/account.ts';
import { Chapter } from '../src/chapter.ts';
import { Layout } from '../src/layout.ts';
import { PolicyDefinition } from '../src/policy.ts';
import { Question } from '../src/question.ts';
import { RatioDefinition } from '../src/ratio.ts';
import { Story } from '../src/story.ts';
import { TransactionTemplate } from '../src/template.ts';
import { Term } from '../src/term.ts';

const outDir = fileURLToPath(new URL('../../../schemas/', import.meta.url));
const targets = {
  'term.schema.json': Term,
  'chapter.schema.json': Chapter,
  'account.schema.json': Account,
  'template.schema.json': TransactionTemplate,
  'policy.schema.json': PolicyDefinition,
  'layout.schema.json': Layout,
  'ratio.schema.json': RatioDefinition,
  'story.schema.json': Story,
  'question.schema.json': Question,
} as const;
const check = process.argv.includes('--check');
let bad = 0;
mkdirSync(outDir, { recursive: true });
for (const [name, schema] of Object.entries(targets)) {
  const json = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any', io: 'input', reused: 'ref' });
  const text = JSON.stringify({ $comment: '由 packages/content-schema 產生，不要手改；執行 pnpm schemas:build 重新產生。', ...json }, null, 2) + '\n';
  const path = `${outDir}${name}`;
  if (check) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (current !== text) {
      console.error(`schemas:check：${name} 與 Zod schema 不一致，請執行 pnpm schemas:build 並 commit`);
      bad++;
    }
  } else {
    writeFileSync(path, text);
    console.log(`schemas:build：已寫入 schemas/${name}`);
  }
}
if (check) {
  if (bad) process.exit(1);
  console.log('schemas:check：一致');
}
