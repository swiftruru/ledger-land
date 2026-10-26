// check:links 的例外清單（站規 4.1）：tools/link-exceptions.json 以「檔案加規則」為鍵，不用行號。
// 格式與日期的檢查在這裡，check:links 與 check:exceptions 共用；數量比對與過期（用不到）的例外在 check:links 裡做。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LINK_EXCEPTIONS_FILE = 'tools/link-exceptions.json';
export const LINK_RULE_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'];

/**
 * 讀例外清單；檔案不存在時視為空清單
 * @param {string} root repo 根目錄
 * @returns {any[]}
 */
export function readLinkExceptions(root) {
  const path = join(root, LINK_EXCEPTIONS_FILE);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 檢查例外清單的格式與日期，回傳問題清單（空陣列代表沒問題）
 * @param {unknown} list
 * @param {string} [today] YYYY-MM-DD，預設今天（UTC）
 * @returns {string[]}
 */
export function validateLinkExceptions(list, today = new Date().toISOString().slice(0, 10)) {
  const problems = [];
  if (!Array.isArray(list)) return [`${LINK_EXCEPTIONS_FILE} 必須是陣列`];
  const seen = new Set();
  list.forEach((entry, i) => {
    const where = `${LINK_EXCEPTIONS_FILE} 第 ${i + 1} 條`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${where} 不是物件`);
      return;
    }
    const allowed = new Set(['file', 'rule', 'count', 'reason', 'added', 'expires']);
    for (const k of Object.keys(entry)) if (!allowed.has(k)) problems.push(`${where} 有不認得的欄位 ${k}`);
    if (typeof entry.file !== 'string' || !entry.file || entry.file.startsWith('/') || entry.file.includes('\\'))
      problems.push(`${where} 的 file 必須是 repo 內的相對路徑（以 / 分隔）`);
    if (!LINK_RULE_IDS.includes(entry.rule)) problems.push(`${where} 的 rule 必須是 R1 到 R12 之一`);
    if (!Number.isInteger(entry.count) || entry.count < 1) problems.push(`${where} 的 count 必須是正整數`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) problems.push(`${where} 缺 reason`);
    if (typeof entry.added !== 'string' || !DATE.test(entry.added)) problems.push(`${where} 的 added 必須是 YYYY-MM-DD`);
    else if (entry.added > today) problems.push(`${where} 的 added（${entry.added}）在今天之後`);
    if (entry.expires !== undefined) {
      if (typeof entry.expires !== 'string' || !DATE.test(entry.expires)) problems.push(`${where} 的 expires 必須是 YYYY-MM-DD`);
      else if (entry.expires < today) problems.push(`${where}（${entry.file} ${entry.rule}）已於 ${entry.expires} 到期，請移除`);
    }
    const key = `${entry.file}\u0000${entry.rule}`;
    if (seen.has(key)) problems.push(`${where} 和前面的條目重複（${entry.file} ${entry.rule}）；同一個檔案加規則只寫一條，用 count 表示數量`);
    seen.add(key);
  });
  return problems;
}
