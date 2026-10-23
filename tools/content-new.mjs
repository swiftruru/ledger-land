// content:new（08 第 4.1、5.8 節）：pnpm content:new <kind> [--chapter ch_xxxxxx] [--type single_choice] [--order n]
// kind：question、level、objective、term、chapter。用 content-schema 的 generateId 產生不與既有 ID 與 lock 衝突的 ID，
// 建立含必填欄位骨架的檔案（status draft），印出路徑。objective 會加進該章的 content/objectives/<chapterId>.json（沒有就建立）。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format as prettierFormat } from 'prettier';
import { CONTENT_DIRS, loadContentFiles } from './lib/content-files.mjs';
import { NEW_KINDS, collectIds, skeleton } from './lib/content-new.mjs';
import { ROOT, readJson } from './lib/fs.mjs';

const args = process.argv.slice(2);
const kind = /** @type {'question' | 'level' | 'objective' | 'term' | 'chapter' | undefined} */ (args.find((a) => !a.startsWith('--')));
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!kind || !NEW_KINDS.includes(kind)) {
  console.error(`用法：pnpm content:new <${NEW_KINDS.join('|')}> [--chapter ch_xxxxxx] [--type <題型>] [--order <n>]`);
  process.exit(2);
}
const chapterId = opt('chapter');
const type = opt('type');
const orderArg = opt('order');
const order = orderArg === undefined ? undefined : Number(orderArg);

const bundle = loadContentFiles();
const lockPath = join(ROOT, 'content/published.lock.json');
const lock = existsSync(lockPath) ? readJson(lockPath) : undefined;
const taken = collectIds(bundle, lock);
if (chapterId && !bundle.chapters.some((c) => c.data?.id === chapterId)) {
  console.error(`content:new：章節 ${chapterId} 不存在（content/chapters/）`);
  process.exit(1);
}
let made;
try {
  made = skeleton(kind, { chapterId, type, order }, taken);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const write = async (path, data) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, await prettierFormat(JSON.stringify(data, null, 2), { filepath: path }));
};

let rel;
if (kind === 'objective') {
  rel = `${CONTENT_DIRS.objectives}/${chapterId}.json`;
  const existing = bundle.objectives.find((f) => f.file === rel)?.data;
  const file = existing && Array.isArray(existing.items) ? existing : { chapterId, items: [] };
  if (order === undefined) made.data.order = file.items.length + 1;
  file.items.push(made.data);
  await write(join(ROOT, rel), file);
} else {
  const dir = kind === 'question' ? `${CONTENT_DIRS.questions}/${chapterId}` : CONTENT_DIRS[`${kind}s`];
  rel = `${dir}/${made.id}.json`;
  if (kind === 'level' && order === undefined) made.data.order = bundle.levels.filter((l) => l.data?.chapterId === chapterId).length + 1;
  if (kind === 'chapter' && order === undefined) made.data.order = bundle.chapters.length + 1;
  await write(join(ROOT, rel), made.data);
}
console.log(`content:new：已建立 ${kind} ${made.id}（status draft）：${rel}`);
if (kind === 'question') console.log('content:new：請把 objectiveId 改成該章的學習目標，並把題目加進關卡的 questionIds');
if (kind === 'level' || kind === 'objective') console.log(`content:new：請把 ${made.id} 加進 content/chapters/${chapterId}.json 的 ${kind}Ids`);
