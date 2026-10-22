// GitHub Actions 釘版檢查（09 第 2.5 節）：每個 uses: 都必須是完整 40 字元的 commit SHA 並附版本註解；不得用 tag 或分支
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, walk } from './lib/fs.mjs';

const files = walk(join(ROOT, '.github', 'workflows'), { ext: ['.yml', '.yaml'] });
let count = 0;
let ok = true;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\s*-?\s*uses:\s*([^\s#]+)(\s*#.*)?$/);
    if (!m) return;
    count++;
    const ref = m[1];
    const where = `${f.replace(ROOT + '/', '')}:${i + 1}`;
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;
    const at = ref.lastIndexOf('@');
    const sha = at >= 0 ? ref.slice(at + 1) : '';
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      fail(`check:actions：${where} 沒有用完整 commit SHA 釘版：${ref}`);
      ok = false;
    } else if (!m[2] || !/#\s*v?\d/.test(m[2])) {
      fail(`check:actions：${where} 缺少版本註解（例如 # v7.0.1）：${ref}`);
      ok = false;
    }
  });
  const text = readFileSync(f, 'utf8');
  if (!/^permissions:\s*\n\s+contents:\s*read/m.test(text) && !/permissions:\s*\{\s*contents:\s*read/.test(text)) {
    fail(`check:actions：${f.replace(ROOT + '/', '')} 沒有頂層的 permissions: contents: read`);
    ok = false;
  }
  for (const m of text.matchAll(/uses:\s*actions\/checkout@[^\n]*\n((?:\s+with:\n(?:\s+[^\n]*\n)*)?)/g)) {
    if (!/persist-credentials:\s*false/.test(m[1] ?? '')) {
      fail(`check:actions：${f.replace(ROOT + '/', '')} 的 actions/checkout 沒有 persist-credentials: false`);
      ok = false;
    }
  }
}
if (ok) console.log(`check:actions：${files.length} 個 workflow、${count} 個 action 都以完整 SHA 釘版`);
