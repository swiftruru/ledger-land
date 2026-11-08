// 範本的工作表 → 題目與名詞的 JSON 候選（08 第 9、10.2 節，M6）。純函式：不讀檔不寫檔、不跑整包驗證（那在 import-run.mjs）。
// 兩段：sheetRows 把一張表（二維陣列）依欄位定義轉成「列」（Excel 列號加 key 對值），assemble 把題目列、選項列、分類項目列、名詞列組成 JSON，
// 並處理列的身分規則：id 空白是新增（工具產生 ID）、#example 略過、#new:暱稱 給新題目配選項、有 id 時 baseRev 要等於目前的 rev。
// 修改既有項目時以「表格的欄位覆蓋 JSON 的對應欄位」，表格沒有的欄位原樣保留（QUESTION_PRESERVED_FIELDS、TERM_PRESERVED_FIELDS）。
import { uniqueId } from './content-new.mjs';
import { colLetter } from './ooxml.mjs';
import {
  EXAMPLE_PREFIX,
  FIRST_DATA_ROW,
  ITEM_COLUMNS,
  NEW_PREFIX,
  OPTION_COLUMNS,
  QUESTION_COLUMNS,
  SHEET,
  TEMPLATE_VERSION,
  TERM_COLUMNS,
  TEXT_TYPES,
  stripQuotePrefix,
  topField,
} from './sheet-template.mjs';

/**
 * @typedef {{ severity: 'error' | 'warning'; code: string; sheet: string; row: number | null; column: string | null; field: string | null; message: string; suggestion?: string }} SheetIssue
 * @typedef {{ row: number; cells: Map<string, { value: unknown; column: string }> }} SheetRow
 * @typedef {{ sheet: string; row: number; column: string | null; field: string | null }} Where
 */

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** 一張表的二維陣列 → 列；第 1 列的 key 要和欄位定義一致（少欄是錯誤，多欄警告並略過）；整列空白略過 */
export function sheetRows(raw, columns, sheetName) {
  /** @type {SheetIssue[]} */
  const issues = [];
  /** @type {SheetRow[]} */
  const rows = [];
  const header = (raw[0] ?? []).map((v) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v)));
  const index = new Map();
  header.forEach((k, j) => {
    if (k === '') return;
    if (index.has(k)) issues.push(issue('error', 'sheet.columns', sheetName, 1, colLetter(j + 1), k, `第 1 列的欄位 key「${k}」重複`, '刪掉重複的那一欄。'));
    else index.set(k, j);
  });
  const known = new Set(columns.map((c) => c.key));
  for (const c of columns)
    if (!index.has(c.key))
      issues.push(
        issue(
          'error',
          'sheet.columns',
          sheetName,
          1,
          null,
          c.key,
          `第 1 列少了欄位 key「${c.key}」`,
          '請重新下載範本，把資料貼回新範本再匯入；不要改第 1 列。',
        ),
      );
  for (const [k, j] of index)
    if (!known.has(k))
      issues.push(
        issue(
          'warning',
          'sheet.columns',
          sheetName,
          1,
          colLetter(j + 1),
          k,
          `第 1 列的欄位 key「${k}」不在範本裡，這一欄會略過`,
          '確認不是打錯；不需要的欄可以刪掉。',
        ),
      );
  if (issues.some((i) => i.severity === 'error')) return { rows, issues };
  for (let r = FIRST_DATA_ROW - 1; r < raw.length; r++) {
    const line = raw[r] ?? [];
    if (line.every(isBlank)) continue;
    const cells = new Map();
    for (const c of columns) {
      const j = index.get(c.key);
      cells.set(c.key, { value: line[j], column: colLetter(j + 1) });
    }
    rows.push({ row: r + 1, cells });
  }
  return { rows, issues };
}

/** CSV 一個檔一張表：依第 1 列的 key 判斷是哪一張 */
export function detectSheet(headerRow) {
  const keys = new Set((headerRow ?? []).map((v) => String(v ?? '').trim()));
  if (keys.has('optionId')) return SHEET.options;
  if (keys.has('itemId')) return SHEET.items;
  if (keys.has('teacherLabel')) return SHEET.terms;
  if (keys.has('type') && keys.has('chapterId')) return SHEET.questions;
  if (keys.has('templateVersion')) return SHEET.about;
  return null;
}

/** 說明表的 templateVersion；沒有說明表（CSV）回 null */
export function templateVersionOf(aboutRows) {
  if (!aboutRows) return null;
  const row = aboutRows.find((r) => String(r?.[0] ?? '').trim() === 'templateVersion');
  if (!row) return null;
  const v = Number(row[1]);
  return Number.isFinite(v) ? v : null;
}

/**
 * @param {'error' | 'warning'} severity
 * @param {string} code
 * @param {string} sheet
 * @param {number | null} row
 * @param {string | null} column
 * @param {string | null} field
 * @param {string} message
 * @param {string} [suggestion]
 * @returns {SheetIssue}
 */
export function issue(severity, code, sheet, row, column, field, message, suggestion) {
  return { severity, code, sheet, row, column, field, message, ...(suggestion ? { suggestion } : {}) };
}

/**
 * 一格的值依欄位定義轉換。回傳 { ok: true, value }（空白是 undefined）或 { ok: false, message }
 * @param {{ kind: string; key: string }} column
 * @param {unknown} raw
 */
export function convertCell(column, raw) {
  if (isBlank(raw)) return { ok: true, value: undefined };
  const s = typeof raw === 'string' ? stripQuotePrefix(raw).trim() : raw;
  switch (column.kind) {
    case 'text':
      return { ok: true, value: String(s) };
    case 'int': {
      const n = typeof s === 'number' ? s : Number(s);
      if (!Number.isInteger(n)) return { ok: false, message: `「${String(raw)}」不是整數` };
      return { ok: true, value: n };
    }
    case 'bool': {
      if (typeof s === 'boolean') return { ok: true, value: s };
      if (typeof s === 'number')
        return s === 1 ? { ok: true, value: true } : s === 0 ? { ok: true, value: false } : { ok: false, message: `「${s}」不是 TRUE 或 FALSE` };
      const t = String(s).toLowerCase();
      if (['true', '是', 'y', 'yes', '1'].includes(t)) return { ok: true, value: true };
      if (['false', '否', 'n', 'no', '0'].includes(t)) return { ok: true, value: false };
      return { ok: false, message: `「${String(raw)}」不是 TRUE 或 FALSE` };
    }
    case 'json': {
      try {
        const v = JSON.parse(String(s));
        if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, message: 'JSON 要是物件，例如 {"loan": 240000}' };
        return { ok: true, value: v };
      } catch {
        return { ok: false, message: `不是合法的 JSON：${String(raw).slice(0, 40)}` };
      }
    }
    case 'csv':
      return {
        ok: true,
        value: String(s)
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean),
      };
    case 'semicolon':
      return {
        ok: true,
        value: String(s)
          .split(/[;；]/)
          .map((x) => x.trim())
          .filter(Boolean),
      };
    default:
      return { ok: false, message: `不認得的欄位種類 ${column.kind}` };
  }
}

/** 各題型專屬的頂層欄位：換題型時把不屬於新題型的欄位拿掉（Zod 的 strict 才不會抱怨多餘的鍵） */
const TYPE_FIELDS = {
  single_choice: ['prompt', 'options', 'correctOptionId', 'ratioRef', 'distractorExprs', 'ratioTable'],
  pick_statement: ['prompt', 'options', 'correctOptionId', 'ratioRef', 'distractorExprs', 'ratioTable'],
  ratio_interpret: ['prompt', 'options', 'correctOptionId', 'ratioRef', 'distractorExprs', 'ratioTable'],
  multi_choice: ['prompt', 'options', 'correctOptionIds', 'scoringMode'],
  true_false: ['statement', 'correct', 'feedbackTrue', 'feedbackFalse', 'misconceptionId'],
  judgment: ['prompt', 'options', 'viewpoint', 'attribution'],
  classify: ['prompt', 'dimension', 'items', 'correctCategories'],
};
const ALL_TYPE_FIELDS = new Set(Object.values(TYPE_FIELDS).flat());

const setLocalized = (data, field, loc, value) => {
  const cur = data[field] && typeof data[field] === 'object' ? { ...data[field] } : {};
  if (value === undefined) delete cur[loc];
  else cur[loc] = value;
  if (Object.keys(cur).length === 0) delete data[field];
  else data[field] = cur;
};
const setOrDelete = (data, field, value) => {
  if (value === undefined) delete data[field];
  else data[field] = value;
};

/**
 * 組題目與名詞的候選。
 * @param {{ questions?: SheetRow[]; options?: SheetRow[]; items?: SheetRow[]; terms?: SheetRow[] }} rows 各表的列（沒有那張表就省略）
 * @param {{
 *   existingQuestions: Map<string, { file: string; data: any }>;
 *   existingTerms: Map<string, { file: string; data: any }>;
 *   taken: Set<string>;
 *   stepToStory: Map<string, string>;
 *   random?: () => number;
 * }} ctx
 */
export function assemble(rows, ctx) {
  /** @type {SheetIssue[]} */
  const issues = [];
  const random = ctx.random ?? Math.random;
  let examples = 0;
  const err = (sheet, r, key, code, message, suggestion) =>
    issues.push(issue('error', code, sheet, r.row, r.cells.get(key)?.column ?? null, key, message, suggestion));
  const warn = (sheet, r, key, code, message, suggestion) =>
    issues.push(issue('warning', code, sheet, r.row, r.cells.get(key)?.column ?? null, key, message, suggestion));

  /** 一列的所有欄依定義轉換；轉不過去的格回報並視為空白 */
  const readRow = (sheet, r, columns) => {
    const out = {};
    for (const c of columns) {
      const cell = r.cells.get(c.key);
      const conv = convertCell(c, cell?.value);
      if (conv.ok) out[c.key] = conv.value;
      else err(sheet, r, c.key, 'cell.format', conv.message, '照欄位說明修正這一格的格式。');
    }
    return out;
  };

  // 題目列
  /** @type {Map<string, any>} 題目 id（新題目是產生後的 id）對候選 */
  const questions = new Map();
  /** @type {Map<string, string>} #new:暱稱 對產生的 id */
  const aliases = new Map();
  const existingPrompts = new Map();
  for (const { data } of ctx.existingQuestions.values()) {
    const p = data.type === 'true_false' ? data.statement : data.prompt;
    if (p?.['zh-TW']) existingPrompts.set(p['zh-TW'], data.id);
  }
  for (const r of rows.questions ?? []) {
    const rawId = r.cells.get('id')?.value;
    const idText = isBlank(rawId) ? '' : String(stripQuotePrefix(String(rawId))).trim();
    if (idText.startsWith(EXAMPLE_PREFIX)) {
      examples++;
      continue;
    }
    const v = readRow(SHEET.questions, r, QUESTION_COLUMNS);
    const type = v.type;
    if (type !== undefined && !TEXT_TYPES.includes(type)) {
      err(
        SHEET.questions,
        r,
        'type',
        'sheet.type',
        `題型「${type}」不能用表格維護（只有 ${TEXT_TYPES.join('、')}）`,
        '含 scenario 或 compute 的計算題請直接維護 JSON（08 第 9 節）。',
      );
      continue;
    }
    let existing;
    let id;
    let alias;
    let conflict = false;
    if (idText === '' || idText.startsWith(NEW_PREFIX)) {
      id = uniqueId('question', ctx.taken, random);
      if (idText !== '') {
        alias = idText;
        if (aliases.has(alias)) err(SHEET.questions, r, 'id', 'row.aliasDuplicate', `暫時代號 ${alias} 重複`, '每個新題目用不同的 #new:暱稱。');
        aliases.set(alias, id);
      }
      if (v.baseRev !== undefined) warn(SHEET.questions, r, 'baseRev', 'row.baseRevIgnored', '新增的列不需要 baseRev，這一格會略過', '新增時 baseRev 留空。');
    } else {
      id = idText;
      existing = ctx.existingQuestions.get(id);
      if (!existing) {
        err(SHEET.questions, r, 'id', 'row.unknownId', `找不到題目 ${id}`, '新增請把 id 留空；修改請用匯出範本裡的 id，不要自己打。');
        continue;
      }
      if (questions.has(id)) {
        err(SHEET.questions, r, 'id', 'row.duplicateId', `題目 ${id} 在表格裡出現兩次`, '刪掉其中一列。');
        continue;
      }
      if (v.baseRev === undefined) {
        err(
          SHEET.questions,
          r,
          'baseRev',
          'row.baseRevMissing',
          `修改既有題目要填 baseRev（目前是 ${existing.data.rev}）`,
          '從匯出的範本複製 baseRev，或重新下載範本再改。',
        );
        conflict = true;
      } else if (v.baseRev !== existing.data.rev) {
        err(
          SHEET.questions,
          r,
          'baseRev',
          'row.conflict',
          `這一列在我匯出之後已被修改（表格的 baseRev ${v.baseRev}，目前的 rev ${existing.data.rev}），這一列不匯入`,
          '重新下載範本，把修改搬到新的那一列再匯入。',
        );
        conflict = true;
      }
      if (['published', 'retired'].includes(existing.data.status) && v.status === 'draft') {
        err(
          SHEET.questions,
          r,
          'status',
          'row.statusBackwards',
          `已發布過的題目不能改回 draft（目前是 ${existing.data.status}）`,
          '要停用請改成 retired；要修改內容直接改欄位，rev 會由工具加一。',
        );
        conflict = true;
      }
    }
    const data = existing ? structuredClone(existing.data) : { id, rev: 1, revKind: 'text', status: 'draft' };
    data.id = id;
    const effectiveType = type ?? data.type;
    // 換題型：把不屬於新題型的專屬欄位拿掉
    if (effectiveType && data.type && data.type !== effectiveType) for (const f of ALL_TYPE_FIELDS) if (!TYPE_FIELDS[effectiveType].includes(f)) delete data[f];
    const promptField = effectiveType === 'true_false' ? 'statement' : 'prompt';
    for (const c of QUESTION_COLUMNS) {
      if (c.key === 'id' || c.key === 'baseRev') continue;
      const value = v[c.key];
      const top = topField(c.key);
      if (c.types && effectiveType && !c.types.includes(effectiveType)) {
        if (value !== undefined)
          err(
            SHEET.questions,
            r,
            c.key,
            'sheet.notForType',
            `${c.key} 只給 ${c.types.join('、')} 題型，這一題是 ${effectiveType}`,
            c.key === 'scoringMode' ? '只有 multi_choice 要選判分方式，其他題型請留空（08 第 10.2 節）。' : '這一格請留空。',
          );
        if (ALL_TYPE_FIELDS.has(top)) delete data[top];
        continue;
      }
      switch (c.key) {
        case 'labRef.step':
          if (value === undefined) delete data.labRef;
          else {
            const story = ctx.stepToStory.get(value);
            if (!story) err(SHEET.questions, r, c.key, 'ref.step', `找不到實驗室步驟 ${value}`, '填故事步驟的 ID（st_ 開頭）；沒有對應的步驟就留空。');
            data.labRef = { story: story ?? '', step: value };
          }
          break;
        case 'prompt.zh-TW':
        case 'prompt.en':
          setLocalized(data, promptField, c.key.split('.')[1], value);
          break;
        case 'tags':
        case 'termRefs':
          data[c.key] = value ?? [];
          break;
        case 'type':
          if (value !== undefined) data.type = value;
          break;
        default: {
          const [, loc] = c.key.split('.');
          if (loc) setLocalized(data, top, loc, value);
          else setOrDelete(data, top, value);
        }
      }
    }
    if (effectiveType === 'judgment') data.attribution = 'site';
    const prompt = data[promptField]?.['zh-TW'];
    if (!existing && prompt && existingPrompts.has(prompt))
      warn(
        SHEET.questions,
        r,
        'prompt.zh-TW',
        'row.duplicatePrompt',
        `題幹和既有題目 ${existingPrompts.get(prompt)} 完全相同，可能是用舊範本重複新增`,
        '如果是同一題，請用匯出範本裡那一列修改，不要新增。',
      );
    questions.set(id, {
      kind: 'question',
      id,
      alias,
      isNew: !existing,
      row: r.row,
      sheet: SHEET.questions,
      data,
      existing,
      conflict,
      optionRows: new Map(),
      itemRows: new Map(),
      optionsFromSheet: false,
      itemsFromSheet: false,
    });
  }

  const resolveQuestion = (sheet, r, raw) => {
    const text = isBlank(raw) ? '' : String(stripQuotePrefix(String(raw))).trim();
    if (text.startsWith(EXAMPLE_PREFIX)) return 'example';
    const id = text.startsWith(NEW_PREFIX) ? aliases.get(text) : text;
    const q = id ? questions.get(id) : undefined;
    if (!q) {
      err(
        sheet,
        r,
        'questionId',
        'row.orphan',
        `questionId「${text}」不在題目表裡`,
        '選項與分類項目要和題目列一起匯入；新題目請在題目列的 id 與這裡都填同一個 #new:暱稱。',
      );
      return null;
    }
    return q;
  };

  // 選項列：依 questionId 分組、依 order 排序；有選項列的題目整組取代 options
  const optionGroups = new Map();
  for (const r of rows.options ?? []) {
    const q = resolveQuestion(SHEET.options, r, r.cells.get('questionId')?.value);
    if (q === 'example') {
      examples++;
      continue;
    }
    if (!q) continue;
    const v = readRow(SHEET.options, r, OPTION_COLUMNS);
    if (!optionGroups.has(q.id)) optionGroups.set(q.id, []);
    optionGroups.get(q.id).push({ r, v });
  }
  for (const [qid, group] of optionGroups) {
    const q = questions.get(qid);
    const type = q.data.type;
    group.sort((a, b) => (a.v.order ?? Number.MAX_SAFE_INTEGER) - (b.v.order ?? Number.MAX_SAFE_INTEGER) || a.r.row - b.r.row);
    const options = [];
    const answers = [];
    const seen = new Set();
    for (const { r, v } of group) {
      let oid = v.optionId;
      if (oid === undefined) oid = uniqueId('option', ctx.taken, random);
      else if (seen.has(oid)) {
        err(SHEET.options, r, 'optionId', 'row.duplicateId', `選項 ${oid} 在同一題出現兩次`, '刪掉其中一列，或把新選項的 optionId 留空讓工具產生。');
        continue;
      }
      seen.add(oid);
      const o = { id: oid };
      for (const c of OPTION_COLUMNS) {
        if (['questionId', 'optionId', 'order', 'isAnswer'].includes(c.key)) continue;
        const [top, loc] = c.key.split('.');
        const value = v[c.key];
        if (c.types && type && !c.types.includes(type)) {
          if (value !== undefined) err(SHEET.options, r, c.key, 'sheet.notForType', `${c.key} 只給 ${c.types.join('、')} 題型`, '這一格請留空。');
          continue;
        }
        if (type === 'judgment' && top === 'feedback') continue; // judgment 用 upside 與 downside，不用 feedback
        if (loc) setLocalized(o, top, loc, value);
        else setOrDelete(o, top, value);
      }
      options.push(o);
      q.optionRows.set(oid, r.row);
      if (v.isAnswer === true) answers.push({ oid, r });
      else if (v.isAnswer !== undefined && type === 'judgment')
        warn(SHEET.options, r, 'isAnswer', 'ans.judgmentAnswer', 'judgment 沒有標準答案，isAnswer 會略過', 'judgment 的 isAnswer 請留空。');
    }
    q.data.options = options;
    q.optionsFromSheet = true;
    if (type === 'multi_choice') q.data.correctOptionIds = answers.map((a) => a.oid);
    else if (type !== 'judgment') {
      if (answers.length === 1) q.data.correctOptionId = answers[0].oid;
      else if (answers.length === 0) {
        const first = group[0]?.r;
        if (first) err(SHEET.options, first, 'isAnswer', 'ans.singleCorrect', `題目 ${qid} 沒有任何選項標為正解`, '把正解那一列的 isAnswer 改成 TRUE。');
        delete q.data.correctOptionId;
      } else {
        err(
          SHEET.options,
          answers[1].r,
          'isAnswer',
          'ans.singleCorrect',
          `這一題是${type === 'single_choice' ? '單選' : type}題，但有 ${answers.length} 個選項都標為正解`,
          '單選題只保留一個正解；如果兩個以上的選項都正確，請把題型改成 multi_choice 並選擇判分方式；如果沒有標準答案，改成 judgment。',
        );
        q.data.correctOptionId = answers[0].oid;
      }
    }
  }

  // 分類項目列
  const itemGroups = new Map();
  for (const r of rows.items ?? []) {
    const q = resolveQuestion(SHEET.items, r, r.cells.get('questionId')?.value);
    if (q === 'example') {
      examples++;
      continue;
    }
    if (!q) continue;
    const v = readRow(SHEET.items, r, ITEM_COLUMNS);
    if (!itemGroups.has(q.id)) itemGroups.set(q.id, []);
    itemGroups.get(q.id).push({ r, v });
  }
  for (const [qid, group] of itemGroups) {
    const q = questions.get(qid);
    if (q.data.type !== 'classify') {
      err(
        SHEET.items,
        group[0].r,
        'questionId',
        'sheet.notForType',
        `題目 ${qid} 是 ${q.data.type}，不是 classify，不該有分類項目`,
        '分類項目只給 classify 題。',
      );
      continue;
    }
    group.sort((a, b) => (a.v.order ?? Number.MAX_SAFE_INTEGER) - (b.v.order ?? Number.MAX_SAFE_INTEGER) || a.r.row - b.r.row);
    const items = [];
    const categories = {};
    for (const { r, v } of group) {
      const iid = v.itemId ?? uniqueId('item', ctx.taken, random);
      const it = { id: iid };
      if (v.account !== undefined) it.account = v.account;
      if (v.ratio !== undefined) it.ratio = v.ratio;
      if (v['text.zh-TW'] !== undefined || v['text.en'] !== undefined) {
        it.text = {};
        if (v['text.zh-TW'] !== undefined) it.text['zh-TW'] = v['text.zh-TW'];
        if (v['text.en'] !== undefined) it.text.en = v['text.en'];
      }
      if (v.allowContra !== undefined) it.allowContra = v.allowContra;
      if (v.correctCategory !== undefined) categories[iid] = v.correctCategory;
      items.push(it);
      q.itemRows.set(iid, r.row);
    }
    q.data.items = items;
    q.itemsFromSheet = true;
    if (Object.keys(categories).length) q.data.correctCategories = categories;
    else delete q.data.correctCategories;
  }

  // 名詞列
  const terms = new Map();
  for (const r of rows.terms ?? []) {
    const rawId = r.cells.get('id')?.value;
    const idText = isBlank(rawId) ? '' : String(stripQuotePrefix(String(rawId))).trim();
    if (idText.startsWith(EXAMPLE_PREFIX)) {
      examples++;
      continue;
    }
    const v = readRow(SHEET.terms, r, TERM_COLUMNS);
    let existing;
    let id;
    let conflict = false;
    if (idText === '') {
      id = uniqueId('term', ctx.taken, random);
      if (v.baseRev !== undefined) warn(SHEET.terms, r, 'baseRev', 'row.baseRevIgnored', '新增的列不需要 baseRev，這一格會略過', '新增時 baseRev 留空。');
    } else {
      id = idText;
      existing = ctx.existingTerms.get(id);
      if (!existing) {
        err(SHEET.terms, r, 'id', 'row.unknownId', `找不到名詞 ${id}`, '新增請把 id 留空；修改請用匯出範本裡的 id。');
        continue;
      }
      if (terms.has(id)) {
        err(SHEET.terms, r, 'id', 'row.duplicateId', `名詞 ${id} 在表格裡出現兩次`, '刪掉其中一列。');
        continue;
      }
      if (v.baseRev === undefined) {
        err(
          SHEET.terms,
          r,
          'baseRev',
          'row.baseRevMissing',
          `修改既有名詞要填 baseRev（目前是 ${existing.data.rev}）`,
          '從匯出的範本複製 baseRev，或重新下載範本再改。',
        );
        conflict = true;
      } else if (v.baseRev !== existing.data.rev) {
        err(
          SHEET.terms,
          r,
          'baseRev',
          'row.conflict',
          `這一列在我匯出之後已被修改（表格的 baseRev ${v.baseRev}，目前的 rev ${existing.data.rev}），這一列不匯入`,
          '重新下載範本，把修改搬到新的那一列再匯入。',
        );
        conflict = true;
      }
      if (['published', 'retired'].includes(existing.data.status) && v.status === 'draft') {
        err(SHEET.terms, r, 'status', 'row.statusBackwards', `已發布過的名詞不能改回 draft（目前是 ${existing.data.status}）`, '要停用請改成 retired。');
        conflict = true;
      }
    }
    const data = existing ? structuredClone(existing.data) : { id, rev: 1, revKind: 'text', status: 'draft' };
    data.id = id;
    for (const c of TERM_COLUMNS) {
      if (c.key === 'id' || c.key === 'baseRev') continue;
      const value = v[c.key];
      const [top, loc] = c.key.split('.');
      switch (c.key) {
        case 'currentTwLabel':
        case 'ifrsEnglish':
          data[top] = value ?? null;
          break;
        case 'aliases.zh-TW':
        case 'aliases.en':
          data.aliases = { 'zh-TW': [], en: [], ...(data.aliases ?? {}) };
          data.aliases[loc] = value ?? [];
          break;
        case 'flags':
        case 'pendingRefs':
          data[top] = value ?? [];
          break;
        default:
          if (loc) setLocalized(data, top, loc, value);
          else setOrDelete(data, top, value);
      }
    }
    terms.set(id, { kind: 'term', id, isNew: !existing, row: r.row, sheet: SHEET.terms, data, existing, conflict, optionRows: new Map(), itemRows: new Map() });
  }

  return { questions: [...questions.values()], terms: [...terms.values()], issues, examples };
}

/** 候選寫入的檔案路徑（題目依章節分資料夾；章節空白時先放 _unknown，Zod 會報 chapterId） */
export function candidateFile(c) {
  if (c.kind === 'term') return `content/terms/${c.id}.json`;
  return `content/questions/${c.data.chapterId ?? '_unknown'}/${c.id}.json`;
}

export { TEMPLATE_VERSION };
