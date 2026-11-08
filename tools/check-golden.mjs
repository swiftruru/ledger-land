// 黃金測試的守門（10 第 8 節、04 第 10.3 節；M4b 回報第 9 節，2026-11-08）：
// 1. 黃金資料可以由獨立的計算表腳本（packages/core/test/golden/calc-lime-leaf.mjs，只用加減法、不經過核心）逐項重現；
// 2. 黃金資料、自編故事的 fixture 與計算表都沒有引用老師的故事資料（正式故事的 ID、步驟 ID），計算表的金額也沒有一個和正式故事的事件金額相同。
// 任何一項不成立就以非 0 結束並列出原因。
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AMOUNTS, compute, diffAgainst, goldenPath } from '../packages/core/test/golden/calc-lime-leaf.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

// 1. 兩套政策的黃金資料都能重現
for (const policy of /** @type {const} */ (['teacher@1', 'ifrs@1'])) {
  const golden = JSON.parse(readFileSync(goldenPath(policy), 'utf8'));
  const diffs = diffAgainst(golden, compute(policy));
  if (diffs.length > 0) problems.push(`${policy} 的黃金資料和計算表有 ${diffs.length} 項不同：${diffs.slice(0, 5).join('；')}`);
}

// 2. 不引用正式故事
const storiesDir = join(ROOT, 'content/stories');
const officialIds = [];
const officialAmounts = new Set();
for (const f of readdirSync(storiesDir)) {
  if (!f.endsWith('.json')) continue;
  const story = JSON.parse(readFileSync(join(storiesDir, f), 'utf8'));
  officialIds.push(story.id);
  for (const st of story.steps ?? []) {
    officialIds.push(st.id);
    for (const ev of st.events ?? [])
      for (const [k, v] of Object.entries(ev.params ?? {})) if (typeof v === 'number' && /amount|price|counted|interest/i.test(k)) officialAmounts.add(v);
  }
}
const guarded = [
  'packages/core/test/golden/lime-leaf.teacher@1.json',
  'packages/core/test/golden/lime-leaf.ifrs@1.json',
  'packages/core/test/golden/calc-lime-leaf.mjs',
  'packages/core/test/fixtures/story-lime-leaf.ts',
];
for (const rel of guarded) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  for (const id of officialIds) if (text.includes(id)) problems.push(`${rel} 引用了正式故事的 ID ${id}`);
}
const moneyKeys = Object.entries(AMOUNTS).filter(([k]) => !/years/i.test(k));
for (const [k, v] of moneyKeys) if (officialAmounts.has(v)) problems.push(`計算表的金額 ${k} = ${v} 和正式故事的某個事件金額相同`);

if (problems.length > 0) {
  console.error(`check:golden：${problems.length} 個問題`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `check:golden：teacher@1 與 ifrs@1 的黃金資料都可由計算表重現；${guarded.length} 個檔案沒有引用正式故事（${officialIds.length} 個 ID、${officialAmounts.size} 個金額）`,
);
