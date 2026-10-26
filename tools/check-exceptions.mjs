// 例外清單檢查（09 第 2.2 節）：pnpm-workspace.yaml 的 minimumReleaseAgeExclude、trustPolicyExclude、overrides 與 auditConfig.ignoreGhsas 都要在 tools/ 的紀錄檔有對應條目；
// 紀錄檔多出來的條目、過期（expires 已過）的條目都讓檢查失敗，提醒移除。也檢查 lockfile 的 typescript 版本（09 第 2.3 節）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail, readJson } from './lib/fs.mjs';
import { readLinkExceptions, validateLinkExceptions } from './lib/link-exceptions.mjs';

const yaml = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
// 取出某個頂層 key 底下的縮排區塊（到下一個頂層 key 或檔尾為止；JavaScript 沒有 \Z，用 (?![\s\S]) 表示檔尾）
function blockUnder(key) {
  const m = yaml.match(new RegExp(`^${key}:\\s*(\\[\\])?\\s*$([\\s\\S]*?)(?=^\\S|(?![\\s\\S]))`, 'm'));
  return m ? { empty: !!m[1], body: m[2] } : null;
}
function listUnder(key) {
  const b = blockUnder(key);
  if (!b || b.empty) return [];
  return [...b.body.matchAll(/^\s+-\s*'?"?([^'"\n]+)'?"?\s*$/gm)].map((x) => x[1].trim());
}
function mapUnder(key) {
  const b = blockUnder(key);
  if (!b || b.empty) return {};
  const out = {};
  for (const x of b.body.matchAll(/^\s+'?"?([^'":\n]+)'?"?\s*:\s*'?"?([^'"\n]+)'?"?\s*$/gm)) out[x[1].trim()] = x[2].trim();
  return out;
}

const today = new Date().toISOString().slice(0, 10);
let ok = true;
const releaseAge = readJson(join(ROOT, 'tools/release-age-exceptions.json'));
const trust = readJson(join(ROOT, 'tools/trust-policy-exceptions.json'));

function compare(label, yamlEntries, records, keyField) {
  const recorded = new Set(records.map((r) => r[keyField]));
  for (const e of yamlEntries)
    if (!recorded.has(e)) {
      fail(`check:exceptions：${label} 有 ${e}，但紀錄檔沒有對應條目`);
      ok = false;
    }
  for (const r of records) {
    if (!yamlEntries.includes(r[keyField])) {
      fail(`check:exceptions：紀錄檔有 ${r[keyField]}，但 pnpm-workspace.yaml 的 ${label} 沒有，請移除紀錄`);
      ok = false;
    }
    if (!r.reason || !r.added) {
      fail(`check:exceptions：${r[keyField]} 缺 reason 或 added`);
      ok = false;
    }
    if (r.expires && r.expires < today) {
      fail(`check:exceptions：${r[keyField]} 已於 ${r.expires} 到期，請移除`);
      ok = false;
    }
  }
}
compare('minimumReleaseAgeExclude', listUnder('minimumReleaseAgeExclude'), releaseAge.exceptions, 'entry');
for (const r of releaseAge.exceptions)
  if (!r.advisory || !r.expires) {
    fail(`check:exceptions：minimumReleaseAgeExclude 的 ${r.entry} 必須有 advisory 與 expires`);
    ok = false;
  }
compare('trustPolicyExclude', listUnder('trustPolicyExclude'), trust.exceptions, 'entry');
const overrides = mapUnder('overrides');
compare('overrides', Object.keys(overrides), trust.overrides, 'entry');
for (const r of trust.overrides)
  if (overrides[r.entry] && overrides[r.entry] !== r.pinnedTo) {
    fail(`check:exceptions：overrides 的 ${r.entry} 是 ${overrides[r.entry]}，紀錄寫 ${r.pinnedTo}`);
    ok = false;
  }
// pnpm audit 忽略的公告：每一條都要有紀錄與到期日（忽略不是修好，到期要重新看）
compare('auditConfig.ignoreGhsas', listUnder('auditConfig'), trust.auditIgnores ?? [], 'entry');
for (const r of trust.auditIgnores ?? [])
  if (!r.expires) {
    fail(`check:exceptions：auditConfig.ignoreGhsas 的 ${r.entry} 必須有 expires`);
    ok = false;
  }

// check:links 的例外清單（站規 4.1）：格式與日期在這裡一併檢查；數量比對與用不到的例外由 check:links 負責
let linkProblems;
try {
  linkProblems = validateLinkExceptions(readLinkExceptions(ROOT));
} catch (e) {
  linkProblems = [`tools/link-exceptions.json 無法讀取：${e.message}`];
}
for (const p of linkProblems) {
  fail(`check:exceptions：${p}`);
  ok = false;
}

// lockfile 的 typescript 必須是 6.0.3
const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
const tsVersions = [...lock.matchAll(/^\s{2}typescript@([0-9.]+):/gm)].map((m) => m[1]);
if (tsVersions.length === 0 || tsVersions.some((v) => v !== '6.0.3')) {
  fail(`check:exceptions：lockfile 的 typescript 版本是 ${tsVersions.join(', ') || '無'}，必須是 6.0.3`);
  ok = false;
}
if (ok) console.log('check:exceptions：例外清單與紀錄一致，沒有過期條目；check:links 的例外清單格式正確；lockfile 的 typescript 是 6.0.3');
