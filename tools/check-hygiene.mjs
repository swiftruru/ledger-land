// hygiene（09 第 10.2 節）：git ls-files 不得出現 references/、.xlsx、.pdf、.DS_Store、01、13、AI 設定路徑；.gitignore 仍含排除規則；
// 另外檢查公開內容沒有出現深色色票的來源名稱（16 第 0 節，名稱本身不寫在這裡，以 base64 比對）
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './lib/fs.mjs';

const FORBIDDEN =
  /(^|\/)(\.claude\/|CLAUDE\.md$|CLAUDE\.local\.md$|AGENTS\.md$|GEMINI\.md$|\.mcp\.json$|\.cursor|\.windsurf|\.clinerules|\.roo\/|\.kiro\/|\.continue\/|\.junie\/|\.aider|\.DS_Store$|\.pnpm-store\/|\.cache\/|node_modules\/|\.wrangler\/|\.dev\.vars|\.env)|^references\/|^prototypes\/|^docs\/plan\/01-materials\.md$|^docs\/plan\/13-material-questions\.md$|^docs\/plan\/15-ai-workflow\.md$|^\.github\/(copilot-instructions\.md$|instructions\/|prompts\/|chatmodes\/)|\.(xlsx|xls|pdf|pptx|docx)$/;
const REQUIRED_IGNORES = [
  'references/',
  '.DS_Store',
  'docs/plan/01-materials.md',
  'docs/plan/13-material-questions.md',
  'docs/plan/15-ai-workflow.md',
  '**/.claude/',
  '**/CLAUDE.md',
  '**/CLAUDE.local.md',
  '**/AGENTS.md',
  '.mcp.json',
  '/prototypes/',
  '.pnpm-store/',
  '.cache/',
  'node_modules/',
  'dist/',
];
let ok = true;
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const hits = tracked.filter((p) => FORBIDDEN.test(p));
if (hits.length) {
  for (const h of hits) fail(`check:hygiene：被追蹤的禁止路徑 ${h}`);
  ok = false;
}
const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n');
if (gitignore[0] !== 'references/') {
  fail('check:hygiene：.gitignore 第一行必須是 references/');
  ok = false;
}
for (const r of REQUIRED_IGNORES)
  if (!gitignore.includes(r)) {
    fail(`check:hygiene：.gitignore 少了 ${r}`);
    ok = false;
  }
// 深色色票來源名稱（base64 編碼，避免這個檔案本身出現名稱）
const banned = ['RHJhY3VsYQ==', 'QnVmZnk=', 'TW9yYml1cw=='].map((b) => Buffer.from(b, 'base64').toString('utf8').toLowerCase());
for (const p of tracked) {
  if (/\.(png|jpg|jpeg|webp|ico|woff2?|mp4)$/i.test(p) || p === 'pnpm-lock.yaml') continue;
  let text;
  try {
    text = readFileSync(join(ROOT, p), 'utf8').toLowerCase();
  } catch {
    continue;
  }
  for (const b of banned)
    if (text.includes(b)) {
      fail(`check:hygiene：${p} 含深色色票來源的名稱，公開內容不得出現`);
      ok = false;
    }
}
if (ok) console.log(`check:hygiene：${tracked.length} 個被追蹤的檔案沒有禁止路徑；.gitignore 規則齊全；沒有色票來源名稱`);
