// 匯入的整個流程（08 第 10.3、10.5 節，M6），純函式：工作表 → 候選 → 差異分類與 rev → 整包驗證（和 content:check 同一套）→ 問題對回「工作表、列、欄」→ 報告。
// 不讀檔不寫檔；content-import.mjs 負責讀 xlsx 或 CSV、印表格、寫 import-report.json 與 content/ 的檔案。
// 驗證的做法：把候選放進完整的 bundle（取代同 ID、附加新項目），跑 validateBundle、runTextChecks、runAccountingChecks 與 lock 的八條規則，
// 和匯入前的基準比對，只回報新出現的問題；候選自己的問題依 JSON 路徑對回欄，其他檔案新出現的問題（例如下架的名詞還被引用）列在報告最後、沒有列號。
import { validateBundle } from '@ledgerland/content-schema';
import { canonicalJson } from '@ledgerland/core';
import { allEntityIds, answerFields, checkLock, currentLockItems, normaliseLock } from './content-lock.mjs';
import { parseBundle, runAccountingChecks } from './content-rules.mjs';
import { runTextChecks } from './content-text.mjs';
import { colLetter } from './ooxml.mjs';
import { assemble, candidateFile, detectSheet, issue, sheetRows, templateVersionOf } from './sheet-import.mjs';
import { ITEM_COLUMNS, OPTION_COLUMNS, QUESTION_COLUMNS, SHEET, TEMPLATE_VERSION, TERM_COLUMNS, topField } from './sheet-template.mjs';
import { twStyleHits } from './tw-style.mjs';

/** @typedef {import('./sheet-import.mjs').SheetIssue} SheetIssue */

/** 常見問題的建議修正（08 第 10.3 節）：先比規則代號，再比訊息樣式；都沒有就用通用句 */
/** @type {[RegExp, string][]} */
const SUGGESTIONS = [
  [/^ref\.termRefsListed$/, '把文字裡用到的名詞 ID 加進 termRefs 欄（半形逗號分隔）。'],
  [/^ans\.noLetterRefs$/, '把「選項 A」這類寫法改成 {{option:o_xxxx}}。'],
  [/^ans\.feedbackEveryOption$/, '已發布的題目每個選項都要有回饋；補上回饋或先把 status 改成 draft。'],
  [/^ans\.multiCountHint$/, '題幹不要透露正解數量或寫判分提示，提示由介面依 scoringMode 產生。'],
  [/^style\.rawNumbers$/, '金額與百分比用佔位符（例如 {{money:vars.amount}}，數字放在 vars 欄），年份或條號用 {{raw:...}}。'],
  [/^style\.sourceRefs$/, '刪掉頁碼、教材檔名或內部編號；內容資料不記錄教材出處。'],
  [/^struct\.levelSize$/, '關卡的題數由維護者在 content/levels/ 調整，表格不用動。'],
  [/^acct\.classifyDerived$/, '確認科目或指標 ID 存在，或改用自訂文字項目並填 correctCategory。'],
  [/^id\.optionReused$/, '刪掉的選項 ID 不能再用；新選項請把 optionId 留空讓工具產生。'],
  [/^id\./, '依訊息修正 rev 或 status；rev 由工具加一，不要手動改。'],
  [/學習目標 .* 屬於章節/, '學習目標要屬於同一章：從清單表找該章的學習目標 ID。'],
  [/引用不存在的學習目標/, '從下拉選單選學習目標；新的學習目標請先由維護者建立，再重新下載範本。'],
  [/只能屬於已發布的章節|只能對應已發布的學習目標/, '已發布的題目只能放在已發布的章節與學習目標；或先把這一題的 status 改成 draft。'],
  [/沒有迷思/, '迷思 ID 要在該學習目標的迷思清單裡；不確定就留空。'],
  [/必須有 en 文字/, '補上英文欄位；或先把 status 改成 draft。'],
  [/佔位符集合必須完全相同/, '中英文要用同一組佔位符（例如都用 {{money:vars.amount}}）。'],
  [/correctOptionIds 不得重複|至少要留一個不是正解/, 'multi_choice 至少兩個 isAnswer 為 TRUE，而且至少留一個 FALSE。'],
  [/Too small: expected array to have >=2/, 'multi_choice 至少要兩個選項標 TRUE；只有一個正解請改成 single_choice。'],
  [/Invalid option: expected one of/, '從下拉選單選一個代號。'],
  [/Invalid input: expected (string|number|boolean)|Required|expected .*received undefined/, '這一格是必填，請補上。'],
  [/Unrecognized key/, '這一欄不屬於這個題型，請留空。'],
  [/ID 格式是/, '使用工具產生的 ID，不要自己打；新增請留空。'],
  [/pendingRefs 非空的題目暫不計分/, 'pendingRefs 有值時 scored 要填 FALSE。'],
  [/ratio_interpret 必須填 ratioRef/, '填指標參照，例如 roa@excel。'],
  [/正解 .* 不在 options 裡|correctOptionId 必須是 options/, '選項表要有標為正解的那一列。'],
];
const DEFAULT_SUGGESTION = '依訊息修正這一格；規則說明見 docs/plan/08-content-admin.md 第 5 節。';

export function suggestionFor(code, message) {
  for (const [re, s] of SUGGESTIONS) if (re.test(code) || re.test(message)) return s;
  return DEFAULT_SUGGESTION;
}

const columnLetterOf = (columns, key, header) => {
  const j = columns.findIndex((c) => c.key === key);
  return j < 0 ? null : (header?.get(key) ?? null);
};

/**
 * 候選的 JSON 路徑 → 工作表、列、欄
 * @param {any} c 候選
 * @param {string} path
 * @param {{ questions?: Map<string, string>; options?: Map<string, string>; items?: Map<string, string>; terms?: Map<string, string> }} headers 各表 key 對欄字母
 */
export function locate(c, path, headers) {
  const parts = path.split('.');
  if (c.kind === 'term') {
    const key = TERM_COLUMNS.some((col) => col.key === path) ? path : TERM_COLUMNS.some((col) => col.key === parts[0]) ? parts[0] : null;
    return { sheet: c.sheet, row: c.row, column: key ? columnLetterOf(TERM_COLUMNS, key, headers.terms) : null, field: key };
  }
  if (parts[0] === 'options' && /^\d+$/.test(parts[1] ?? '')) {
    const o = c.data.options?.[Number(parts[1])];
    const row = o ? (c.optionRows.get(o.id) ?? null) : null;
    const rest = parts.slice(2).join('.');
    const key =
      rest === 'id' ? 'optionId' : OPTION_COLUMNS.some((col) => col.key === rest) ? rest : OPTION_COLUMNS.some((col) => col.key === parts[2]) ? parts[2] : null;
    if (row !== null) return { sheet: SHEET.options, row, column: key ? columnLetterOf(OPTION_COLUMNS, key, headers.options) : null, field: key };
  }
  if (parts[0] === 'items' && /^\d+$/.test(parts[1] ?? '')) {
    const it = c.data.items?.[Number(parts[1])];
    const row = it ? (c.itemRows.get(it.id) ?? null) : null;
    const rest = parts.slice(2).join('.');
    const key =
      rest === 'id' ? 'itemId' : ITEM_COLUMNS.some((col) => col.key === rest) ? rest : ITEM_COLUMNS.some((col) => col.key === parts[2]) ? parts[2] : null;
    if (row !== null) return { sheet: SHEET.items, row, column: key ? columnLetterOf(ITEM_COLUMNS, key, headers.items) : null, field: key };
  }
  if ((parts[0] === 'correctOptionId' || parts[0] === 'correctOptionIds') && c.optionRows.size > 0) {
    const row = Math.min(...c.optionRows.values());
    return { sheet: SHEET.options, row, column: columnLetterOf(OPTION_COLUMNS, 'isAnswer', headers.options), field: 'isAnswer' };
  }
  if (parts[0] === 'correctCategories' && parts[1] && c.itemRows.has(parts[1]))
    return {
      sheet: SHEET.items,
      row: c.itemRows.get(parts[1]),
      column: columnLetterOf(ITEM_COLUMNS, 'correctCategory', headers.items),
      field: 'correctCategory',
    };
  let key = null;
  if (parts[0] === 'statement') key = `prompt.${parts[1] ?? 'zh-TW'}`;
  else if (parts[0] === 'labRef') key = 'labRef.step';
  else if (QUESTION_COLUMNS.some((col) => col.key === path)) key = path;
  else if (QUESTION_COLUMNS.some((col) => col.key === parts[0])) key = parts[0];
  if (key !== null && !QUESTION_COLUMNS.some((col) => col.key === key)) key = null;
  return { sheet: c.sheet, row: c.row, column: key ? columnLetterOf(QUESTION_COLUMNS, key, headers.questions) : null, field: key };
}

/** 各表第 1 列的 key 對欄字母（給 locate 用） */
function headerMap(raw, columns) {
  const map = new Map();
  (raw?.[0] ?? []).forEach((k, j) => {
    const key = String(k ?? '').trim();
    if (columns.some((c) => c.key === key)) map.set(key, colLetter(j + 1));
  });
  return map;
}

const stripManaged = (d) => {
  const { rev: _r, revKind: _k, updatedAt: _u, ...rest } = d;
  return rest;
};

/**
 * 差異分類與 rev（08 第 4.2、10.5 節）：新增、修改（文字）、修改（答案）、下架、無變動；衝突與錯誤列已在前面標好。
 * 已發布過（status 不是 draft，或 lock 有它）的項目有改變就 rev 加一；答案欄位（content-lock.mjs 的 answerFields）變了是 answer，否則 text。草稿 rev 不動。
 */
export function classifyCandidates(candidates, { compiledBefore, compiledAfter, lockIds, now }) {
  for (const c of candidates) {
    if (c.conflict) {
      c.change = 'conflict';
      continue;
    }
    if (c.isNew) {
      c.change = 'new';
      c.data.rev = 1;
      c.data.revKind = 'text';
      c.changedFields = Object.keys(stripManaged(c.data));
      if (now) c.data.updatedAt = now;
      continue;
    }
    const before = stripManaged(c.existing.data);
    const after = stripManaged(c.data);
    if (canonicalJson(before) === canonicalJson(after)) {
      c.change = 'unchanged';
      c.changedFields = [];
      continue;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    c.changedFields = [...keys].filter((k) => canonicalJson(before[k] ?? null) !== canonicalJson(after[k] ?? null));
    const everPublished = c.existing.data.status !== 'draft' || lockIds.has(c.id);
    const kind = c.kind;
    const answerBefore = answerFields(kind, c.existing.data, compiledBefore.get(c.id));
    const answerAfter = answerFields(kind, c.data, compiledAfter.get(c.id));
    const answerChanged = answerBefore !== undefined && canonicalJson(answerBefore) !== canonicalJson(answerAfter ?? null);
    if (everPublished) {
      c.data.rev = c.existing.data.rev + 1;
      c.data.revKind = answerChanged ? 'answer' : 'text';
    }
    if (now) c.data.updatedAt = now;
    c.change = c.data.status === 'retired' && c.existing.data.status !== 'retired' ? 'retire' : answerChanged ? 'answer' : 'text';
  }
  return candidates;
}

const issueKey = (i) => `${i.file}|${i.path}|${i.rule ?? ''}|${i.message}`;

/** 和 content:check 同一套檢查，回傳 { issues（含 severity）, compiled, parsed } */
function runChecks(bundle) {
  /** @type {CheckIssue[]} */
  const schema = validateBundle(bundle).map((i) => ({ ...i, severity: /** @type {const} */ ('error'), rule: i.rule ?? 'struct.schema' }));
  const parsed = parseBundle(bundle);
  const text = runTextChecks(parsed);
  const acct = runAccountingChecks(parsed);
  return {
    issues: /** @type {CheckIssue[]} */ ([...schema, ...text, ...acct.issues]),
    compiled: acct.compiled,
    parsed,
    hasErrors: schema.length > 0 || [...text, ...acct.issues].some((i) => i.severity === 'error'),
  };
}

/**
 * @typedef {object} ImportInput
 * @property {Record<string, unknown[][]>} sheets 工作表名稱對二維陣列（xlsx 的全部工作表，或 CSV 依第 1 列偵測後的表）
 * @property {any} bundle loadContentFiles() 的原始 bundle
 * @property {any} [lock] published.lock.json（可為 undefined）
 * @property {string} [now] 寫進 updatedAt 的時間；省略就不寫
 * @property {() => number} [random]
 */
/** @typedef {{ file: string; path: string; rule?: string; message: string; severity: 'error' | 'warning' }} CheckIssue */

/** Zod 的英文訊息換成中文（08 第 10.3 節：訊息一律台灣用語）；對不到的照原文 */
export function localiseMessage(message) {
  const m1 = /^Invalid option: expected one of (.+)$/.exec(message);
  if (m1) return `值不在允許的清單裡（${m1[1].replace(/"/g, '').replace(/\|/g, '、')}）`;
  if (/^Invalid input: expected \w+, received undefined$|^Required$/.test(message)) return '這一格是必填';
  const m2 = /^Invalid input: expected (\w+), received (\w+)$/.exec(message);
  if (m2) return `型別不對：要 ${m2[1]}，收到 ${m2[2]}`;
  const m3 = /^Unrecognized key: "(.+)"$/.exec(message);
  if (m3) return `多了這個題型沒有的欄位 ${m3[1]}`;
  const m4 = /^Too small: expected (\w+) to have >=(\d+) (\w+)$/.exec(message);
  if (m4) return `${m4[1] === 'array' ? '項目' : '長度'}至少要 ${m4[2]} 個`;
  const m5 = /^Too big: expected (\w+) to have <=(\d+) (\w+)$/.exec(message);
  if (m5) return `${m5[1] === 'array' ? '項目' : '長度'}最多 ${m5[2]} 個`;
  if (/^Invalid input$/.test(message)) return '格式不對';
  return message;
}

/**
 * 候選文字欄位的台灣用語與破折號（和 check:tw 同一份規則表）：只看學生看得到的 LocalizedText 與 authorNotes
 * @param {any} c
 * @param {Record<string, Map<string, string>>} headers
 * @returns {SheetIssue[]}
 */
function twIssues(c, headers) {
  /** @type {SheetIssue[]} */
  const out = [];
  const visit = (value, path) => {
    if (typeof value === 'string') {
      for (const hit of twStyleHits(value)) {
        const where = locate(c, path.join('.'), headers);
        out.push({
          severity: 'error',
          code: hit.word === '破折號' ? 'style.dash' : 'style.twTerms',
          ...where,
          message: `出現「${hit.word}」${hit.word === '破折號' ? '' : '，這是中國用語'}`,
          suggestion: `改成${hit.instead}。`,
        });
      }
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) value.forEach((v, i) => visit(v, [...path, String(i)]));
    else for (const [k, v] of Object.entries(value)) visit(v, [...path, k]);
  };
  visit(c.data, []);
  return out;
}

/**
 * 跑整個匯入流程。
 * @param {ImportInput} input
 */
export function runImport(input) {
  /** @type {SheetIssue[]} */
  const issues = [];
  const { sheets, bundle } = input;
  const lock = normaliseLock(input.lock);
  const lockIds = new Set(lock.items.map((i) => i.id));

  // 範本版本
  const templateVersion = templateVersionOf(sheets[SHEET.about]);
  if (sheets[SHEET.about] && templateVersion !== TEMPLATE_VERSION)
    issues.push(
      issue(
        'error',
        'sheet.templateVersion',
        SHEET.about,
        1,
        'B',
        'templateVersion',
        `範本版本 ${templateVersion ?? '（空白）'} 和目前的 ${TEMPLATE_VERSION} 不同`,
        '請重新執行 pnpm content:template 下載新範本，把資料貼到新範本再匯入。',
      ),
    );
  const known = new Set(/** @type {string[]} */ (Object.values(SHEET)));
  for (const name of Object.keys(sheets))
    if (!known.has(name))
      issues.push(issue('warning', 'sheet.unknown', name, null, null, null, `工作表「${name}」不是範本的工作表，會略過`, '不需要的工作表可以刪掉。'));
  if (!sheets[SHEET.questions] && !sheets[SHEET.terms])
    issues.push(
      issue(
        'error',
        'sheet.missing',
        '',
        null,
        null,
        null,
        '檔案裡沒有「題目」也沒有「名詞」工作表',
        '用 pnpm content:template 產生的範本填寫；CSV 的第 1 列要保留欄位 key。',
      ),
    );

  // 列
  const read = (name, columns) => {
    if (!sheets[name]) return undefined;
    const r = sheetRows(sheets[name], columns, name);
    issues.push(...r.issues);
    return r.rows;
  };
  const rows = {
    questions: read(SHEET.questions, QUESTION_COLUMNS),
    options: read(SHEET.options, OPTION_COLUMNS),
    items: read(SHEET.items, ITEM_COLUMNS),
    terms: read(SHEET.terms, TERM_COLUMNS),
  };
  const headers = {
    questions: headerMap(sheets[SHEET.questions], QUESTION_COLUMNS),
    options: headerMap(sheets[SHEET.options], OPTION_COLUMNS),
    items: headerMap(sheets[SHEET.items], ITEM_COLUMNS),
    terms: headerMap(sheets[SHEET.terms], TERM_COLUMNS),
  };
  if (issues.some((i) => i.severity === 'error')) return finish({ issues, candidates: [], templateVersion, examples: 0, checked: false });

  // 候選
  const existingQuestions = new Map(bundle.questions.filter((e) => e.data?.id).map((e) => [e.data.id, e]));
  const existingTerms = new Map(bundle.terms.filter((e) => e.data?.id).map((e) => [e.data.id, e]));
  const taken = new Set(lockIds);
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v.id === 'string') taken.add(v.id);
    for (const x of Object.values(v)) walk(x);
  };
  for (const list of Object.values(bundle)) walk(list);
  const stepToStory = new Map();
  for (const s of bundle.stories ?? []) for (const st of s.data?.steps ?? []) if (st?.id && s.data.id) stepToStory.set(st.id, s.data.id);
  const assembled = assemble(rows, { existingQuestions, existingTerms, taken, stepToStory, random: input.random });
  issues.push(...assembled.issues);
  const candidates = [...assembled.questions, ...assembled.terms];
  for (const c of candidates) if (c.conflict) c.change = 'conflict';
  if (candidates.length === 0) return finish({ issues, candidates, templateVersion, examples: assembled.examples, checked: false });

  // 整包驗證：基準（匯入前）與候選（匯入後）
  const before = runChecks(bundle);
  const baseline = new Set(before.issues.map(issueKey));
  const importable = candidates.filter((c) => !c.conflict);
  const replaced = new Map(importable.map((c) => [c.id, c]));
  const entriesOf = (list) => list.filter((e) => !(e.data?.id && replaced.has(e.data.id)));
  const bundleAfter = {
    ...bundle,
    questions: [...entriesOf(bundle.questions), ...importable.filter((c) => c.kind === 'question').map((c) => ({ file: candidateFile(c), data: c.data }))],
    terms: [...entriesOf(bundle.terms), ...importable.filter((c) => c.kind === 'term').map((c) => ({ file: candidateFile(c), data: c.data }))],
  };
  const after = runChecks(bundleAfter);
  classifyCandidates(importable, { compiledBefore: before.compiled, compiledAfter: after.compiled, lockIds, now: input.now });

  // lock 的八條規則（rev 已經設好之後再比，結構或會計有錯時 answerHash 不完整，略過）
  /** @type {{ file: string; path: string; rule?: string; message: string; severity: 'error' | 'warning' }[]} */
  /** @type {CheckIssue[]} */
  const lockIssues = [];
  if (!after.hasErrors) {
    const parsedAfter = parseBundle(bundleAfter);
    const files = new Map();
    for (const list of Object.values(parsedAfter)) for (const x of list) files.set(x.data.id, x.file);
    const beforeLock = checkLock(lock, currentLockItems(before.parsed, before.compiled), allEntityIds(before.parsed), new Map()).map(issueKey);
    const baseLock = new Set(beforeLock);
    for (const i of checkLock(lock, currentLockItems(parsedAfter, after.compiled), allEntityIds(parsedAfter), files))
      if (!baseLock.has(issueKey(i)) && i.rule !== 'id.lockStale') lockIssues.push({ ...i, severity: /** @type {const} */ ('error') });
  }

  // 對回工作表、列、欄
  const byFile = new Map(importable.map((c) => [candidateFile(c), c]));
  const byId = new Map(importable.map((c) => [c.id, c]));
  for (const i of [...after.issues, ...lockIssues]) {
    if (baseline.has(issueKey(i))) continue;
    const c = byFile.get(i.file) ?? byId.get(i.file) ?? byId.get(i.path);
    const code = i.rule ?? 'struct.schema';
    const message = localiseMessage(i.message);
    if (c) {
      const where = locate(c, i.path, headers);
      issues.push({ severity: i.severity, code, ...where, message, suggestion: suggestionFor(code, i.message) });
    } else
      issues.push({
        severity: i.severity,
        code,
        sheet: '',
        row: null,
        column: null,
        field: null,
        message: `${i.file} ${i.path}：${message}`,
        suggestion: suggestionFor(code, i.message),
      });
  }
  for (const c of importable) issues.push(...twIssues(c, headers));
  // 候選自己的錯誤讓它不匯入
  const rowErrors = new Set(issues.filter((i) => i.severity === 'error' && i.row !== null).map((i) => `${i.sheet}:${i.row}`));
  for (const c of importable) {
    if (rowErrors.has(`${c.sheet}:${c.row}`)) c.hasError = true;
    for (const r of [...c.optionRows.values()]) if (rowErrors.has(`${SHEET.options}:${r}`)) c.hasError = true;
    for (const r of [...c.itemRows.values()]) if (rowErrors.has(`${SHEET.items}:${r}`)) c.hasError = true;
    if (c.hasError) c.change = 'error';
  }
  return finish({ issues, candidates, templateVersion, examples: assembled.examples, checked: true });
}

function finish({ issues, candidates, templateVersion, examples, checked }) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const count = (change) => candidates.filter((c) => c.change === change).length;
  const summary = {
    errors,
    warnings,
    examples,
    new: count('new'),
    text: count('text'),
    answer: count('answer'),
    retire: count('retire'),
    conflict: count('conflict'),
    unchanged: count('unchanged'),
    error: count('error'),
  };
  const writable = checked && errors === 0 ? candidates.filter((c) => ['new', 'text', 'answer', 'retire'].includes(c.change)) : [];
  return { issues, candidates, summary, templateVersion, writable, needsConfirmation: candidates.some((c) => c.change === 'answer' || c.change === 'retire') };
}

/** CSV 檔依第 1 列的 key 放進對應的工作表（給 CLI 用；xlsx 直接用工作表名稱） */
export function sheetsFromCsv(files) {
  const sheets = {};
  const issues = [];
  for (const { name, rows } of files) {
    const which = detectSheet(rows[0]);
    if (!which)
      issues.push(
        issue(
          'error',
          'sheet.unknown',
          name,
          1,
          null,
          null,
          `看不出 ${name} 是哪一張工作表（第 1 列要有範本的欄位 key）`,
          '用 pnpm content:template --csv 產生的 CSV 填寫，不要改第 1 列。',
        ),
      );
    else if (sheets[which])
      issues.push(issue('error', 'sheet.duplicate', name, null, null, null, `${name} 和另一個檔案都是「${which}」工作表`, '同一張工作表一次只傳一個檔案。'));
    else sheets[which] = rows;
  }
  return { sheets, issues };
}

export { topField };
