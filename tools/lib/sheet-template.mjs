// Excel 範本的欄位定義與產生器（08 第 10.2 節，M6）：五張工作表（說明、題目、選項、分類項目、名詞）加一張「清單」給下拉選單。
// 欄位表是匯出（contentToRows）與匯入（sheet-to-content.mjs）的共同依據；表格沒有的欄位列在 *_PRESERVED_FIELDS，修改既有項目時原樣保留。
// 純函式：不讀檔不寫檔；content-template.mjs 負責讀內容、寫 xlsx 或 CSV。
import { columnRange } from './xlsx-write.mjs';

export const TEMPLATE_VERSION = 1;
export const SHEET = Object.freeze({ about: '說明', questions: '題目', options: '選項', items: '分類項目', terms: '名詞', lists: '清單' });
/** 表格可維護的題型（08 第 3.6 節「表格可維護」欄標「可以」的） */
export const TEXT_TYPES = Object.freeze(['single_choice', 'true_false', 'pick_statement', 'ratio_interpret', 'judgment', 'classify', 'multi_choice']);
export const LOCALES = Object.freeze(['zh-TW', 'en']);
/** 資料從第幾列開始（第 1 列 key、第 2 列說明） */
export const FIRST_DATA_ROW = 3;
/** 下拉清單涵蓋到第幾列 */
export const LAST_VALIDATED_ROW = 5000;
/** 範例列的 id 前綴 */
export const EXAMPLE_PREFIX = '#example';
/** 新題目在選項表裡用來配對的暫時代號前綴 */
export const NEW_PREFIX = '#new:';

/**
 * @typedef {'text' | 'int' | 'bool' | 'json' | 'csv' | 'semicolon'} CellKind
 * @typedef {{ key: string; label: string; kind: CellKind; list?: string; types?: readonly string[]; width?: number; note?: string }} Column
 *   key：第 1 列的欄位 key（也是 JSON 路徑，語系欄位用 .zh-TW 與 .en）；label：第 2 列的中文說明；kind：轉換方式；
 *   list：下拉清單的來源（清單工作表的欄）；types：只適用的題型（其他題型要留空）；note：說明表的補充
 */

const lt = (key, label, width = 40, extra = {}) =>
  LOCALES.map((loc) => ({
    key: `${key}.${loc}`,
    label: `${label}（${loc === 'zh-TW' ? '中文' : '英文'}）`,
    kind: /** @type {const} */ ('text'),
    width,
    ...extra,
  }));

/** @type {readonly Column[]} */
export const QUESTION_COLUMNS = Object.freeze([
  { key: 'id', label: '題目 ID：空白代表新增（工具產生）；#example 開頭的列是範例會略過；新題目要配選項時填 #new:暱稱', kind: 'text', width: 14 },
  { key: 'baseRev', label: '匯出時的 rev，用來偵測衝突；新增時空白', kind: 'int', width: 8 },
  { key: 'status', label: '狀態（下拉）：draft 草稿、published 已發布、retired 下架', kind: 'text', list: 'status', width: 11 },
  { key: 'type', label: '題型（下拉）', kind: 'text', list: 'type', width: 16 },
  { key: 'chapterId', label: '章節 ID（下拉，對照見清單表）', kind: 'text', list: 'chapter', width: 11 },
  { key: 'objectiveId', label: '學習目標 ID（下拉，要屬於同一章，對照見清單表）', kind: 'text', list: 'objective', width: 12 },
  { key: 'difficulty', label: '難度 1 到 3（下拉）', kind: 'int', list: 'difficulty', width: 6 },
  { key: 'scored', label: '計分（下拉）：judgment 一律 FALSE；pendingRefs 有值時也要 FALSE', kind: 'bool', list: 'bool', width: 8 },
  { key: 'tags', label: '標籤，半形逗號分隔（小寫英文與底線）', kind: 'csv', width: 24 },
  { key: 'termRefs', label: '作答後出現的名詞卡 ID，半形逗號分隔；文字裡用到 {{term:tm_x}} 的都要列', kind: 'csv', width: 24 },
  { key: 'pendingRefs', label: '待確認編號（T 加兩位數），半形逗號分隔；有值時 scored 必須是 FALSE；一般留空', kind: 'csv', width: 10 },
  { key: 'labRef.step', label: '實驗室的步驟 ID（st_ 開頭）；故事 ID 由工具依步驟補上；留空代表沒有', kind: 'text', width: 11 },
  { key: 'ratioRef', label: '指標參照，例如 roa@excel', kind: 'text', types: ['ratio_interpret'], width: 14 },
  { key: 'vars', label: '題目自帶的數字，JSON 物件文字，例如 {"loan": 240000}；題幹以 {{money:vars.loan}} 引用', kind: 'json', width: 24 },
  ...lt('prompt', '題幹；true_false 是要判斷的敘述', 48),
  ...lt('explanation', '解說；用 {{option:o_xxxx}} 引用選項', 48),
  ...lt('hint', '提示（選填）', 30),
  { key: 'correct', label: '敘述是否正確（下拉）', kind: 'bool', list: 'bool', types: ['true_false'], width: 8 },
  ...lt('feedbackTrue', '答「對」時的回饋', 36, { types: ['true_false'] }),
  ...lt('feedbackFalse', '答「不對」時的回饋', 36, { types: ['true_false'] }),
  { key: 'misconceptionId', label: '這題對應的迷思 ID（mc_ 開頭，要在該學習目標的迷思清單裡）', kind: 'text', types: ['true_false'], width: 10 },
  ...lt('viewpoint', '解說觀點（網站觀點）', 36, { types: ['judgment'] }),
  {
    key: 'dimension',
    label: '分類的維度（下拉）：element、current、cf_activity、ratio_category',
    kind: 'text',
    list: 'dimension',
    types: ['classify'],
    width: 14,
  },
  {
    key: 'scoringMode',
    label:
      '判分方式（下拉），只給 multi_choice、必填、沒有預設值：any_correct 任一正確答案即可（學習端提示「這題有不只一個合理答案，選出任一個即可。」）；all_correct 須完整選出所有正確答案（提示「選出所有正確答案（可複選）。」）',
    kind: 'text',
    list: 'scoringMode',
    types: ['multi_choice'],
    width: 12,
  },
  { key: 'authorNotes', label: '作者備註（不翻譯、學生看不到；不得寫教材頁碼或檔名）', kind: 'text', width: 24 },
]);

/** @type {readonly Column[]} */
export const OPTION_COLUMNS = Object.freeze([
  { key: 'questionId', label: '所屬題目的 ID（新題目填題目列的 #new:暱稱）', kind: 'text', width: 14 },
  { key: 'optionId', label: '選項 ID（o_ 開頭）：空白代表新增；已發布題目的選項 ID 不可改、刪除後不可重用', kind: 'text', width: 9 },
  { key: 'order', label: '編輯時的排列順序（作答時一律打散）', kind: 'int', width: 6 },
  ...lt('text', '選項文字', 40),
  ...lt('short', '選項的簡短版（選填），給解說的 {{option:o_xxxx}} 用', 24),
  ...lt('feedback', '選了這個選項的回饋（judgment 以外都要）', 44),
  ...lt('upside', '好處（只給 judgment）', 36, { types: ['judgment'] }),
  ...lt('downside', '代價（只給 judgment）', 36, { types: ['judgment'] }),
  { key: 'misconceptionId', label: '干擾選項對應的迷思 ID（mc_ 開頭，選填）', kind: 'text', width: 10 },
  { key: 'pin', label: '填 last 代表固定在最後、不參與打散（「以上皆是」這類）；一題最多一個', kind: 'text', list: 'pin', width: 6 },
  {
    key: 'isAnswer',
    label: '是不是正解（下拉）：單選題剛好一個 TRUE；multi_choice 至少兩個 TRUE 且至少一個 FALSE；judgment 留空',
    kind: 'bool',
    list: 'bool',
    width: 9,
  },
]);

/** @type {readonly Column[]} */
export const ITEM_COLUMNS = Object.freeze([
  { key: 'questionId', label: '所屬 classify 題目的 ID', kind: 'text', width: 14 },
  { key: 'itemId', label: '項目 ID（it_ 開頭）：空白代表新增', kind: 'text', width: 9 },
  { key: 'order', label: '排列順序', kind: 'int', width: 6 },
  { key: 'account', label: '科目 ID（和 ratio、text 三選一）', kind: 'text', width: 20 },
  { key: 'ratio', label: '指標 ID（只給 ratio_category 維度）', kind: 'text', width: 20 },
  ...lt('text', '自訂文字項目（不對應科目或指標時）', 28),
  { key: 'allowContra', label: '抵銷科目要標 TRUE 才能出題', kind: 'bool', list: 'bool', width: 9 },
  { key: 'correctCategory', label: '自訂文字項目的正解類別（科目與指標項目由核心推導，留空）', kind: 'text', width: 14 },
]);

/** @type {readonly Column[]} */
export const TERM_COLUMNS = Object.freeze([
  { key: 'id', label: '名詞 ID：空白代表新增（工具產生）；#example 開頭的列是範例會略過', kind: 'text', width: 13 },
  { key: 'baseRev', label: '匯出時的 rev，用來偵測衝突；新增時空白', kind: 'int', width: 8 },
  { key: 'status', label: '狀態（下拉）', kind: 'text', list: 'status', width: 11 },
  { key: 'category', label: '類別（下拉）：statement、account、ratio、concept、process、other', kind: 'text', list: 'category', width: 11 },
  ...lt('label', '主要顯示', 24),
  { key: 'teacherLabel', label: '教材原字', kind: 'text', width: 16 },
  { key: 'currentTwLabel', label: '現行台灣用語；沒有就留空（寫入 null）', kind: 'text', width: 16 },
  { key: 'ifrsEnglish', label: 'IFRS 英文用語；IFRS 沒有對應就留空（寫入 null，此時要有 ifrsNote）', kind: 'text', width: 24 },
  { key: 'aliases.zh-TW', label: '中文別名，分號分隔', kind: 'semicolon', width: 20 },
  { key: 'aliases.en', label: '英文別名，分號分隔', kind: 'semicolon', width: 20 },
  { key: 'enUsVariant', label: '美式拼字（選填）', kind: 'text', width: 14 },
  {
    key: 'flags',
    label: '旗標，半形逗號分隔：japanese、old_name、typo_fixed、unused、not_ifrs_line、ifrs_treatment_differs、simplified',
    kind: 'csv',
    width: 18,
  },
  { key: 'confidence', label: '信心（下拉）：high、medium、pending', kind: 'text', list: 'confidence', width: 10 },
  { key: 'pendingRefs', label: '設計說明的編號（T 加兩位數），半形逗號分隔', kind: 'csv', width: 10 },
  { key: 'ifrsBasis', label: '英文用語依據的準則，例如 IAS 1.27（選填）', kind: 'text', width: 12 },
  ...lt('note', '用語本身的說明（選填）', 32),
  ...lt('definition', '原創定義', 48),
  ...lt('example', '例子（選填）', 40),
  ...lt('misconception', '常見誤解（選填）', 40),
  ...lt('formula', '公式文字（選填）', 28),
  ...lt('ifrsNote', 'IFRS 說明（ifrsEnglish 空白或旗標含 not_ifrs_line、ifrs_treatment_differs 時必填）', 40),
  { key: 'accountRef', label: '對應的科目 ID（選填）', kind: 'text', width: 16 },
  { key: 'ratioRef', label: '對應的指標 ID（選填）', kind: 'text', width: 16 },
  { key: 'related', label: '相關名詞 ID，半形逗號分隔', kind: 'csv', width: 28 },
  { key: 'authorNotes', label: '作者備註（不翻譯、學生看不到）', kind: 'text', width: 24 },
]);

/** 表格沒有、修改既有項目時原樣保留的欄位（schema 加新欄位時 sheet-template.test.ts 會要求決定進表格還是進這裡） */
export const QUESTION_PRESERVED_FIELDS = Object.freeze([
  'rev',
  'revKind',
  'supersededBy',
  'retiredNote',
  'updatedAt',
  'display',
  'ratioTable',
  'distractorExprs',
  'attribution',
]);
export const TERM_PRESERVED_FIELDS = Object.freeze(['rev', 'revKind', 'supersededBy', 'retiredNote', 'updatedAt', 'labRefs', 'unlock']);

/** 第 1 列 key 對應的 JSON 頂層欄位名（prompt.zh-TW → prompt；labRef.step → labRef） */
export const topField = (key) => key.split('.')[0];

const SHEETS_SPEC = Object.freeze([
  { name: SHEET.questions, columns: QUESTION_COLUMNS },
  { name: SHEET.options, columns: OPTION_COLUMNS },
  { name: SHEET.items, columns: ITEM_COLUMNS },
  { name: SHEET.terms, columns: TERM_COLUMNS },
]);
export const DATA_SHEETS = SHEETS_SPEC;

/** 匯出時避免被試算表當成公式（08 第 10.7 節）：以 = + - @ 開頭的文字前面加單引號；匯入時 stripQuotePrefix 去掉 */
export const quoteFormulaLike = (s) => (typeof s === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s);
export const stripQuotePrefix = (s) => (typeof s === 'string' && s.startsWith("'") ? s.slice(1) : s);

/** 清單工作表的欄：每個下拉來源一欄代號，旁邊一欄說明（給人看） */
const LIST_LABELS = {
  status: { draft: '草稿', published: '已發布', retired: '下架' },
  type: {
    single_choice: '情境單選',
    true_false: '是非',
    pick_statement: '選報表',
    ratio_interpret: '指標判讀',
    judgment: '取捨思辨（不計分）',
    classify: '分類',
    multi_choice: '多正解選擇',
  },
  scoringMode: { any_correct: '任一正確答案即可', all_correct: '須完整選出所有正確答案' },
  dimension: { element: '會計要素', current: '流動與非流動', cf_activity: '現金流量活動', ratio_category: '指標類別' },
  category: { statement: '報表與報表列', account: '科目', ratio: '指標', concept: '觀念', process: '流程', other: '其他' },
  confidence: { high: '高', medium: '中', pending: '待確認' },
};

/**
 * 清單工作表：回傳 { rows, ranges }；ranges[list] 是該清單在這張表的範圍（給資料驗證）
 * @param {{ chapters: any[]; objectives: any[] }} content 已排序的章節與學習目標（data）
 */
export function buildLists(content) {
  /** @type {{ list: string; header: string[]; rows: (string | number)[][] }[]} */
  const blocks = [];
  const codes = (list) => Object.entries(LIST_LABELS[list]).map(([k, v]) => [k, v]);
  blocks.push({ list: 'status', header: ['status', '狀態'], rows: codes('status') });
  blocks.push({ list: 'type', header: ['type', '題型'], rows: codes('type') });
  blocks.push({
    list: 'chapter',
    header: ['chapterId', '章節'],
    rows: content.chapters.map((c) => [c.id, `${c.order}. ${c.title['zh-TW']}${c.status === 'published' ? '' : `（${LIST_LABELS.status[c.status]}）`}`]),
  });
  blocks.push({
    list: 'objective',
    header: ['objectiveId', '章節 ID', '學習目標'],
    rows: content.objectives.map((o) => [o.id, o.chapterId, `${o.order}. ${o.statement['zh-TW']}`]),
  });
  blocks.push({
    list: 'difficulty',
    header: ['difficulty', '難度'],
    rows: [
      [1, '入門'],
      [2, '基本'],
      [3, '進階'],
    ],
  });
  blocks.push({
    list: 'bool',
    header: ['bool', '布林'],
    rows: [
      ['TRUE', '是'],
      ['FALSE', '否'],
    ],
  });
  blocks.push({ list: 'scoringMode', header: ['scoringMode', '判分方式'], rows: codes('scoringMode') });
  blocks.push({ list: 'dimension', header: ['dimension', '分類維度'], rows: codes('dimension') });
  blocks.push({ list: 'category', header: ['category', '名詞類別'], rows: codes('category') });
  blocks.push({ list: 'confidence', header: ['confidence', '信心'], rows: codes('confidence') });
  blocks.push({ list: 'pin', header: ['pin', '固定位置'], rows: [['last', '固定在最後']] });
  const height = Math.max(...blocks.map((b) => b.rows.length)) + 1;
  /** @type {(string | number | null)[][]} */
  const rows = Array.from({ length: height }, () => []);
  /** @type {Record<string, { sheet: string; range: string }>} */
  const ranges = {};
  /** @type {number[]} */
  const widths = [];
  let col = 0;
  for (const b of blocks) {
    b.header.forEach((h, j) => (rows[0][col + j] = h));
    b.rows.forEach((r, i) => r.forEach((v, j) => (rows[i + 1][col + j] = v)));
    const n = b.rows.length;
    ranges[b.list] = { sheet: SHEET.lists, range: `$${colLetterOf(col + 1)}$2:$${colLetterOf(col + 1)}$${n + 1}` };
    b.header.forEach((_, j) => widths.push(j === 0 ? 14 : 40));
    col += b.header.length + 1;
    widths.push(2);
  }
  for (const r of rows) while (r.length < col) r.push(null);
  return { rows, ranges, widths };
}

function colLetterOf(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** 說明工作表 */
export function buildAbout({ generatedAt, contentCommit }) {
  const rows = [
    ['templateVersion', TEMPLATE_VERSION],
    ['generatedAt', generatedAt],
    ['contentCommit', contentCommit ?? ''],
    [],
    ['填寫規則'],
    ['第 1 列是機器讀的欄位 key，請不要改；第 2 列是說明；第 3 列起是資料。'],
    ['id 空白代表新增，由匯入工具產生 ID，匯入後請重新下載範本再繼續編輯。'],
    ['id 有值代表修改；baseRev 要等於目前的 rev，不然會回報「匯出後已被修改」的衝突，這一列不匯入。'],
    ['表格裡少一列絕不代表下架；要下架請把 status 改成 retired。'],
    ['id 以 #example 開頭的列是範例，匯入時略過。'],
    ['新題目要配選項或分類項目時，題目列的 id 與選項列的 questionId 都填同一個 #new:暱稱。'],
    ['表格沒有的欄位（例如 ratioTable、display）在修改既有項目時原樣保留；只有表格有的欄位被清空才算刪除。'],
    ['金額、百分比、日期不要寫死在文字裡，用佔位符（例如 {{money:vars.loan}}）；年份用 {{raw:2026}}。'],
    ['不要在任何欄位寫教材的頁碼、檔名或投影片標題。'],
    ['下拉選單寫入的是代號；代號與中文名稱的對照在「清單」工作表。'],
    [],
    ['工作表', '欄位 key', '說明', '適用題型'],
  ];
  for (const s of SHEETS_SPEC) for (const c of s.columns) rows.push([s.name, c.key, c.label, c.types ? c.types.join('、') : '']);
  return { name: SHEET.about, rows, widths: [14, 24, 90, 24], freezeRows: 0, mutedRows: [] };
}

/** 一張資料表的前兩列 */
export function headerRows(columns) {
  return [columns.map((c) => c.key), columns.map((c) => c.label)];
}

/** 一張資料表的資料驗證：有 list 的欄從第 3 列到第 5000 列 */
export function sheetValidations(columns, ranges) {
  const out = [];
  columns.forEach((c, j) => {
    if (!c.list) return;
    const r = ranges[c.list];
    if (!r) throw new Error(`sheet-template：清單表沒有 ${c.list}`);
    out.push({ sqref: columnRange(j + 1, FIRST_DATA_ROW, LAST_VALIDATED_ROW), ...r });
  });
  return out;
}

const joinCsv = (xs) => (Array.isArray(xs) && xs.length ? xs.join(', ') : '');
const joinSemicolon = (xs) => (Array.isArray(xs) && xs.length ? xs.join('; ') : '');
const text = (lt, loc) => (lt && typeof lt === 'object' ? (lt[loc] ?? '') : '');

/**
 * 一題（表格可維護的題型）→ 題目列、選項列、分類項目列（值的順序依 *_COLUMNS）
 * @param {any} q
 * @returns {{ question: any[]; options: any[][]; items: any[][] }}
 */
export function questionToRows(q) {
  const promptField = q.type === 'true_false' ? 'statement' : 'prompt';
  const cell = (key) => {
    switch (key) {
      case 'id':
        return q.id;
      case 'baseRev':
        return q.rev;
      case 'labRef.step':
        return q.labRef?.step ?? '';
      case 'vars':
        return q.vars ? JSON.stringify(q.vars) : '';
      case 'tags':
      case 'termRefs':
      case 'pendingRefs':
        return joinCsv(q[key]);
      case 'prompt.zh-TW':
      case 'prompt.en':
        return text(q[promptField], key.split('.')[1]);
      default: {
        const [top, loc] = key.split('.');
        const v = loc ? text(q[top], loc) : q[top];
        return v === undefined || v === null ? '' : v;
      }
    }
  };
  const question = QUESTION_COLUMNS.map((c) => quoteFormulaLike(cell(c.key)));
  const correct = new Set(q.type === 'multi_choice' ? q.correctOptionIds : q.correctOptionId ? [q.correctOptionId] : []);
  const options = (q.options ?? []).map((o, i) =>
    OPTION_COLUMNS.map((c) => {
      switch (c.key) {
        case 'questionId':
          return q.id;
        case 'optionId':
          return o.id;
        case 'order':
          return i + 1;
        case 'isAnswer':
          return q.type === 'judgment' ? '' : correct.has(o.id);
        default: {
          const [top, loc] = c.key.split('.');
          const v = loc ? text(o[top], loc) : o[top];
          return quoteFormulaLike(v === undefined || v === null ? '' : v);
        }
      }
    }),
  );
  const items = (q.items ?? []).map((it, i) =>
    ITEM_COLUMNS.map((c) => {
      switch (c.key) {
        case 'questionId':
          return q.id;
        case 'itemId':
          return it.id;
        case 'order':
          return i + 1;
        case 'correctCategory':
          return q.correctCategories?.[it.id] ?? '';
        case 'allowContra':
          return it.allowContra === undefined ? '' : it.allowContra;
        default: {
          const [top, loc] = c.key.split('.');
          const v = loc ? text(it[top], loc) : it[top];
          return quoteFormulaLike(v === undefined || v === null ? '' : v);
        }
      }
    }),
  );
  return { question, options, items };
}

/** 一個名詞 → 名詞列 */
export function termToRow(t) {
  return TERM_COLUMNS.map((c) => {
    switch (c.key) {
      case 'id':
        return t.id;
      case 'baseRev':
        return t.rev;
      case 'aliases.zh-TW':
      case 'aliases.en':
        return joinSemicolon(t.aliases?.[c.key.split('.')[1]]);
      case 'flags':
      case 'pendingRefs':
      case 'related':
        return joinCsv(t[c.key]);
      default: {
        const [top, loc] = c.key.split('.');
        const v = loc ? text(t[top], loc) : t[top];
        return quoteFormulaLike(v === undefined || v === null ? '' : v);
      }
    }
  });
}

/** 範例列：空範本用，ID 以 #example 開頭；數字一律用佔位符，文字是自己編的 */
export function exampleRows(content) {
  const ch = content.chapters[0];
  const obj = content.objectives.find((o) => o.chapterId === ch?.id) ?? content.objectives[0];
  const chapterId = ch?.id ?? 'ch_000000';
  const objectiveId = obj?.id ?? 'obj_000000';
  const base = (id, type, extra) => ({
    id,
    rev: 1,
    status: 'draft',
    type,
    chapterId,
    objectiveId,
    difficulty: 1,
    scored: type !== 'judgment',
    tags: ['extension'],
    termRefs: [],
    explanation: { 'zh-TW': '（解說：說明為什麼，連到名詞卡）', en: '(Explanation: say why and link to a term card)' },
    ...extra,
  });
  const opt = (id, zh, en, fbZh, fbEn) => ({ id, text: { 'zh-TW': zh, en }, feedback: { 'zh-TW': fbZh, en: fbEn } });
  const questions = [
    base(`${EXAMPLE_PREFIX}-single`, 'single_choice', {
      vars: { cash: 35000 },
      prompt: {
        'zh-TW': '小安的店月底帳上剩 {{money:vars.cash}} 現金。這個數字會出現在哪一張報表？',
        en: 'An’s shop has {{money:vars.cash}} in cash at month end. Which statement shows this figure?',
      },
      options: [
        opt('o_ex01', '資產負債表', 'Balance sheet', '答對了。現金是資產，列在資產負債表。', 'Correct. Cash is an asset and sits on the balance sheet.'),
        opt(
          'o_ex02',
          '損益表',
          'Income statement',
          '損益表列的是收入與費用，不列現金餘額。',
          'The income statement lists revenue and expenses, not the cash balance.',
        ),
        opt(
          'o_ex03',
          '現金流量表的期末現金',
          'Closing cash on the cash flow statement',
          '方向對了，期末現金也會出現在現金流量表，但這一題問的是「餘額」所在的主表。',
          'Close: closing cash does appear there too, but the question asks for the main statement that reports the balance.',
        ),
      ],
      correctOptionId: 'o_ex01',
    }),
    base(`${EXAMPLE_PREFIX}-tf`, 'true_false', {
      statement: { 'zh-TW': '賒銷會讓本期的營業收入增加。', en: 'A credit sale increases revenue for the period.' },
      correct: true,
      feedbackTrue: { 'zh-TW': '對。收入在賺到時認列，不等收到現金。', en: 'Right. Revenue is recognised when earned, not when the cash arrives.' },
      feedbackFalse: { 'zh-TW': '再想想：權責發生制下，收入在賺到時就認列。', en: 'Think again: under the accrual basis revenue is recognised when earned.' },
    }),
    base(`${EXAMPLE_PREFIX}-multi`, 'multi_choice', {
      scoringMode: 'any_correct',
      prompt: { 'zh-TW': '下列哪一個做法能讓店裡的現金馬上增加？', en: 'Which of these would increase the shop’s cash straight away?' },
      options: [
        opt('o_ex11', '向銀行借一筆短期借款', 'Take a short-term bank loan', '說得通，借款讓現金增加。', 'That works: the loan brings in cash.'),
        opt('o_ex12', '請股東增資', 'Ask the owners for more capital', '說得通，增資讓現金增加。', 'That works too: new capital brings in cash.'),
        opt('o_ex13', '多提列折舊', 'Record more depreciation', '折舊沒有現金進出。', 'Depreciation moves no cash.'),
      ],
      correctOptionIds: ['o_ex11', 'o_ex12'],
    }),
    base(`${EXAMPLE_PREFIX}-judgment`, 'judgment', {
      prompt: { 'zh-TW': '店裡多了一筆閒置的現金，你會怎麼處理？', en: 'The shop has some idle cash. What would you do with it?' },
      options: [
        {
          id: 'o_ex21',
          text: { 'zh-TW': '還掉一部分借款', en: 'Repay part of the loan' },
          upside: { 'zh-TW': '利息負擔變輕。', en: 'Less interest to pay.' },
          downside: { 'zh-TW': '週轉金變少。', en: 'Less working cash on hand.' },
        },
        {
          id: 'o_ex22',
          text: { 'zh-TW': '留著備用', en: 'Keep it as a reserve' },
          upside: { 'zh-TW': '臨時支出有著落。', en: 'Unexpected outlays are covered.' },
          downside: { 'zh-TW': '錢沒有在賺錢。', en: 'The money earns nothing.' },
        },
        {
          id: 'o_ex23',
          text: { 'zh-TW': '發股利給股東', en: 'Pay a dividend' },
          upside: { 'zh-TW': '股東拿到回報。', en: 'Owners get a return.' },
          downside: { 'zh-TW': '公司的權益縮小。', en: 'Equity shrinks.' },
        },
      ],
      viewpoint: { 'zh-TW': '三種做法都有道理，重點是說清楚取捨。', en: 'All three are defensible; what matters is stating the trade-off.' },
      attribution: 'site',
    }),
    base(`${EXAMPLE_PREFIX}-classify`, 'classify', {
      prompt: { 'zh-TW': '把下列項目分到所屬的會計要素。', en: 'Sort these items into their accounting elements.' },
      dimension: 'element',
      items: [
        { id: 'it_ex01', account: 'cash' },
        { id: 'it_ex02', account: 'accounts_payable' },
        { id: 'it_ex03', text: { 'zh-TW': '這個月賣出商品收到的錢', en: 'Money received for goods sold this month' } },
      ],
      correctCategories: { it_ex03: 'revenue' },
    }),
  ];
  const term = {
    id: `${EXAMPLE_PREFIX}-term`,
    rev: 1,
    status: 'draft',
    category: 'concept',
    label: { 'zh-TW': '（名詞）', en: '(Term)' },
    teacherLabel: '（教材用語）',
    currentTwLabel: null,
    ifrsEnglish: '(IFRS English)',
    aliases: { 'zh-TW': ['別名一', '別名二'], en: ['Alias'] },
    flags: [],
    confidence: 'high',
    pendingRefs: [],
    definition: { 'zh-TW': '（原創定義）', en: '(Original definition)' },
  };
  return { questions, term };
}

/**
 * 組出整份範本的工作簿結構（給 xlsx-write 或 CSV 輸出）。
 * @param {{ chapters: any[]; objectives: any[]; questions: any[]; terms: any[] }} content 已排序、只含 data 的清單
 * @param {{ filled?: boolean; chapterId?: string; generatedAt: string; contentCommit?: string }} options
 */
export function buildTemplate(content, options) {
  const chapters = [...content.chapters].sort((a, b) => a.order - b.order);
  const chapterOrder = new Map(chapters.map((c, i) => [c.id, i]));
  const objectives = [...content.objectives].sort((a, b) => (chapterOrder.get(a.chapterId) ?? 0) - (chapterOrder.get(b.chapterId) ?? 0) || a.order - b.order);
  const lists = buildLists({ chapters, objectives });
  const about = buildAbout({ generatedAt: options.generatedAt, contentCommit: options.contentCommit });

  const qRows = [];
  const oRows = [];
  const iRows = [];
  const tRows = [];
  if (options.filled) {
    const questions = content.questions
      .filter((q) => TEXT_TYPES.includes(q.type) && (!options.chapterId || q.chapterId === options.chapterId))
      .sort((a, b) => (chapterOrder.get(a.chapterId) ?? 0) - (chapterOrder.get(b.chapterId) ?? 0) || a.id.localeCompare(b.id));
    for (const q of questions) {
      const r = questionToRows(q);
      qRows.push(r.question);
      oRows.push(...r.options);
      iRows.push(...r.items);
    }
    for (const t of [...content.terms].sort((a, b) => a.id.localeCompare(b.id))) tRows.push(termToRow(t));
  } else {
    const ex = exampleRows({ chapters, objectives });
    for (const q of ex.questions) {
      const r = questionToRows(q);
      qRows.push(r.question);
      oRows.push(...r.options);
      iRows.push(...r.items);
    }
    tRows.push(termToRow(ex.term));
  }
  const dataSheet = (name, columns, rows) => ({
    name,
    rows: [...headerRows(columns), ...rows],
    widths: columns.map((c) => c.width ?? 16),
    freezeRows: 2,
    mutedRows: [0],
    validations: sheetValidations(columns, lists.ranges),
  });
  return {
    sheets: [
      about,
      dataSheet(SHEET.questions, QUESTION_COLUMNS, qRows),
      dataSheet(SHEET.options, OPTION_COLUMNS, oRows),
      dataSheet(SHEET.items, ITEM_COLUMNS, iRows),
      dataSheet(SHEET.terms, TERM_COLUMNS, tRows),
      { name: SHEET.lists, rows: lists.rows, widths: lists.widths, freezeRows: 1, mutedRows: [] },
    ],
  };
}
