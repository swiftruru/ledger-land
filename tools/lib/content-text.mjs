// 文字與結構規則（08 第 5.1 節 struct.filename、struct.levelSize 的草稿提醒；第 5.3 節 ref.orphan；第 5.5 節 ans.multiCountHint、ans.noLetterRefs、
// ans.feedbackEveryOption；第 5.7 節 style.sourceRefs、style.rawNumbers）。只處理 Zod 通過的項目（parseBundle 的輸出），不讀檔、不列印。
// style.rawNumbers 依 05 第 10.5 節第 6 條：佔位符以外的文字出現千分位數字、4 位數以上的數字、緊鄰單位的數字或全形數字就回報；
// 3 位數以下、沒有單位的整數（「第 3 步」「5 年」）允許；年份、條號用 {{raw:...}} 包住。
// style.sourceRefs 另有學習端文字的延伸（2026-10-24，12 第 16.2 節「編號只供內部追蹤，不進學習端資料」）：題目、選項、回饋、解說、名詞卡、章節、學習目標與關卡
// 與故事這些學生看得到的 LocalizedText 欄位，不得出現內部追蹤編號（T、D、W、V 加一到兩位數字，例如 T24、D10）或教材單元編號（0-1 到 0-3、slides 加數字）；
// pendingRefs、authorNotes、ratioRef 這類不給學生看的欄位不在這一條。ref.termRefsListed：題目文字裡的 {{term:tm_x}} 必須列在該題的 termRefs（08 第 5.3 節）。
import { LOCALE_CODES, levelSizeIssue } from './content-schema-bridge.mjs';

/** @typedef {import('./content-rules.mjs').RuleIssue} RuleIssue */

const PLACEHOLDER_RE = /\{\{[a-z]+:[^}]*\}\}/g;
/** 透露正解數量或自己寫判分提示（提示由介面依 scoringMode 產生） */
const MULTI_COUNT_HINT_RE =
  /選出?\s*[兩二三四五]\s*(個|項)|[兩二三四五]\s*(個|項)\s*(答案|正解|選項|都)|可複選|複選題|選出所有|全部選出|choose\s+(two|three|four|five|2|3|4|5|all)\b|select\s+(two|three|four|five|2|3|4|5|all)\b|all\s+that\s+apply|more\s+than\s+one\s+(answer|option)|不只一個(答案|正解|選項)/i;
/** 「選項 A」「(B)」「option C」這類字母引用；解說與回饋要用 {{option:o_xxxx}} */
const LETTER_REF_RE = /選項\s*[A-Ha-h](?![a-z])|[（(]\s*[A-H]\s*[)）]|\b([Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-H](?![A-Za-z])/;
/** 頁碼與教材檔名樣式（08 第 1.4、5.7 節） */
const SOURCE_REF_RES = [
  /第\s*\d+\s*頁/,
  /\b[pP]\.?\s?\d{1,3}\b(?![\d.%])/,
  /\bpages?\s+\d+/i,
  /\bslides?\s+\d+/i, // 要有空白：slides01 到 slides03 是指標登錄檔的版本名稱（04 第 12.1 節），不算出處
  /\b0-[0-3]\b/, // 教材編號，例如 0-2；指標登錄檔的版本名稱 slides02 不受影響
  /投影片\s*\d+/,
  /講義\s*(第)?\s*\d+/,
  /教材\s*(第)?\s*\d+/,
  /\.(pdf|pptx?|xlsx?|docx?)\b/i,
];
/** 學習端文字的延伸：內部追蹤編號與教材單元編號（先拿掉佔位符再比對）。
 *  前後不得緊鄰英數字，避免誤判「T 字帳」、T-account、金額與條號；slides 要緊接數字（slides03 是指標登錄檔的版本名稱，只能留在 ratioRef 這類欄位） */
const LEARNER_REF_RES = [
  { re: /(?<![A-Za-z0-9_])[TDWV]\d{1,2}(?![A-Za-z0-9_])/, why: '內部追蹤編號' },
  { re: /(?<![A-Za-z0-9_.])0-[1-3](?![0-9]|\.\d)/, why: '教材單元編號' },
  { re: /\bslides?\s*\d+/i, why: '教材單元編號' },
];
const RAW_NUMBER_RES = [
  { re: /\d{1,3}(?:,\d{3})+/, why: '帶千分位的數字' },
  { re: /\d{4,}/, why: '4 位數以上的數字' },
  { re: /\d+(?:\.\d+)?\s*(?:元|萬|億|%|％|million|billion|percent|per cent)/i, why: '緊鄰單位的數字' },
  { re: /(?:NT\$|US\$|\$|TWD)\s*\d/, why: '帶貨幣符號的數字' },
  { re: /[０-９]/, why: '全形數字' },
];

function error(rule, file, path, message) {
  return { rule, file, path, message, severity: /** @type {const} */ ('error') };
}
function warning(rule, file, path, message) {
  return { rule, file, path, message, severity: /** @type {const} */ ('warning') };
}

const LOCALE_SET = new Set(/** @type {readonly string[]} */ (LOCALE_CODES));
function isLocalized(obj) {
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every((k) => LOCALE_SET.has(k)) && keys.every((k) => typeof obj[k] === 'string');
}

/** 走訪所有 LocalizedText 欄位；visit(text, path, locale) */
function eachLocalizedText(value, path, visit) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => eachLocalizedText(v, [...path, String(i)], visit));
    return;
  }
  if (isLocalized(value)) {
    for (const [k, v] of Object.entries(value)) visit(v, [...path, k].join('.'), k);
    return;
  }
  for (const [k, v] of Object.entries(value)) eachLocalizedText(v, [...path, k], visit);
}

/** 走訪所有字串欄位（含 authorNotes 這類不翻譯的欄位） */
function eachString(value, path, visit) {
  if (typeof value === 'string') {
    visit(value, path.join('.') || '(root)');
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => eachString(v, [...path, String(i)], visit));
    return;
  }
  for (const [k, v] of Object.entries(value)) eachString(v, [...path, k], visit);
}

export function stripPlaceholders(text) {
  return text.replace(PLACEHOLDER_RE, ' ');
}

export function rawNumberHit(text) {
  const plain = stripPlaceholders(text);
  for (const { re, why } of RAW_NUMBER_RES) {
    const m = plain.match(re);
    if (m) return { why, sample: m[0] };
  }
  return null;
}

export function sourceRefHit(text) {
  for (const re of SOURCE_REF_RES) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

/** 學習端文字裡的內部追蹤編號或教材單元編號；沒有時回傳 null */
export function learnerRefHit(text) {
  const plain = stripPlaceholders(text);
  for (const { re, why } of LEARNER_REF_RES) {
    const m = plain.match(re);
    if (m) return { why, sample: m[0] };
  }
  return null;
}

/** 題目文字裡用到的 {{term:tm_x}}（含 {{term:tm_x|plain}}），回傳 [ref, path] */
function termPlaceholders(data) {
  const out = [];
  eachLocalizedText(data, [], (text, path) => {
    for (const m of text.matchAll(TERM_PLACEHOLDER_RE)) out.push([m[1].trim(), path]);
  });
  return out;
}
const TERM_PLACEHOLDER_RE = /\{\{term:([^|}]+?)(?:\|[^}]*)?\}\}/g;

export const hasMultiCountHint = (text) => MULTI_COUNT_HINT_RE.test(text);
export const hasLetterRef = (text) => LETTER_REF_RE.test(text);

/** 一筆內容（任何實體）的文字風格規則 */
function checkTextStyle(entry, issues, { rawNumbers, learner }) {
  const prefix = entry.path ? `${entry.path}.` : '';
  eachString(entry.data, [], (text, path) => {
    const hit = sourceRefHit(text);
    if (hit !== null)
      issues.push(error('style.sourceRefs', entry.file, `${prefix}${path}`, `出現頁碼或教材檔名樣式「${hit}」；內容資料不記錄教材出處（08 第 1.4 節）`));
  });
  if (learner)
    eachLocalizedText(entry.data, [], (text, path) => {
      const hit = sourceRefHit(text) === null ? learnerRefHit(text) : null; // 全欄位的規則已經報過的文字不重複報
      if (hit !== null)
        issues.push(
          error(
            'style.sourceRefs',
            entry.file,
            `${prefix}${path}`,
            `學生看得到的文字出現${hit.why}「${hit.sample}」；編號只供內部追蹤（寫在 pendingRefs、authorNotes 或 PR 說明），不進學習端資料（12 第 16.2 節），請改寫成一般說明`,
          ),
        );
    });
  if (!rawNumbers) return;
  eachLocalizedText(entry.data, [], (text, path) => {
    const hit = rawNumberHit(text);
    if (hit !== null)
      issues.push(
        error(
          'style.rawNumbers',
          entry.file,
          `${prefix}${path}`,
          `可翻譯文字寫死了${hit.why}「${hit.sample}」；金額與百分比請用佔位符，年份或條號用 {{raw:...}}（05 第 10.5 節）`,
        ),
      );
  });
}

/** 題目的解說、回饋、觀點等給學生看的文字欄位（給 ans.noLetterRefs） */
function explanatoryTexts(q) {
  const out = [];
  const push = (value, path) => eachLocalizedText(value, path, (text, p) => out.push({ text, path: p }));
  push(q.explanation, ['explanation']);
  if (q.hint) push(q.hint, ['hint']);
  if ('options' in q)
    q.options.forEach((o, i) => {
      for (const k of ['feedback', 'upside', 'downside']) if (o[k]) push(o[k], ['options', String(i), k]);
    });
  if (q.type === 'true_false') {
    push(q.feedbackTrue, ['feedbackTrue']);
    push(q.feedbackFalse, ['feedbackFalse']);
  }
  if (q.type === 'judgment') push(q.viewpoint, ['viewpoint']);
  if (q.type === 'pick_line' && q.feedbackByLine) push(q.feedbackByLine, ['feedbackByLine']);
  return out;
}

const blank = (lt) => Object.values(lt ?? {}).some((s) => typeof s !== 'string' || s.trim() === '');

function checkQuestion(entry, issues) {
  const q = entry.data;
  const listed = new Set(q.termRefs ?? []);
  for (const [ref, path] of termPlaceholders(q))
    if (!listed.has(ref))
      issues.push(
        error(
          'ref.termRefsListed',
          entry.file,
          path,
          `文字用了 {{term:${ref}}}，但 termRefs 沒有列出 ${ref}；請把它加進 termRefs（作答後的名詞列表、名詞圖鑑的收集與 firstLevel 都只看 termRefs）`,
        ),
      );
  const promptField = q.type === 'true_false' ? 'statement' : 'prompt';
  if (q.type === 'multi_choice') {
    eachLocalizedText(q.prompt, ['prompt'], (text, path) => {
      if (hasMultiCountHint(text))
        issues.push(warning('ans.multiCountHint', entry.file, path, '題幹透露了正解數量或自己寫了判分提示；提示由介面依 scoringMode 產生（08 第 3.6 節）'));
    });
  }
  for (const { text, path } of explanatoryTexts(q)) {
    if (hasLetterRef(text)) issues.push(error('ans.noLetterRefs', entry.file, path, '解說與回饋不得寫「選項 A」「(B)」之類的字母引用，請用 {{option:o_xxxx}}'));
  }
  eachLocalizedText(q[promptField], [promptField], (text, path) => {
    if (hasLetterRef(text)) issues.push(error('ans.noLetterRefs', entry.file, path, '題幹不得以字母稱呼選項，選項會打散（03 第 2.8 節）'));
  });
  if (q.status === 'published') {
    const missing = (path) => issues.push(error('ans.feedbackEveryOption', entry.file, path, '已發布的題目每個選項都要有非空白的回饋'));
    if ('options' in q)
      q.options.forEach((o, i) => {
        if (q.type === 'judgment') {
          if (blank(o.upside)) missing(`options.${i}.upside`);
          if (blank(o.downside)) missing(`options.${i}.downside`);
        } else if (blank(o.feedback)) missing(`options.${i}.feedback`);
      });
    if (q.type === 'true_false') {
      if (blank(q.feedbackTrue)) missing('feedbackTrue');
      if (blank(q.feedbackFalse)) missing('feedbackFalse');
    }
  }
}

/** struct.filename：一筆一檔的實體檔名等於 id；題目檔要放在所屬章節的資料夾；學習目標檔名等於 chapterId */
function checkFilenames(parsed, issues) {
  const base = (file) =>
    file
      .split('/')
      .pop()
      .replace(/\.json$/, '');
  const dir = (file) => file.split('/').slice(0, -1).join('/');
  const one = (list, kind, root) => {
    for (const e of list) {
      if (!e.file.startsWith(`${root}/`)) continue; // 測試或其他來源的項目不檢查
      if (base(e.file) !== e.data.id) issues.push(error('struct.filename', e.file, 'id', `${kind}檔名必須等於 id ${e.data.id}`));
    }
  };
  one(parsed.terms, '名詞', 'content/terms');
  one(parsed.chapters, '章節', 'content/chapters');
  one(parsed.levels, '關卡', 'content/levels');
  one(parsed.stories, '故事', 'content/stories');
  for (const q of parsed.questions) {
    if (!q.file.startsWith('content/questions/')) continue;
    if (base(q.file) !== q.data.id) issues.push(error('struct.filename', q.file, 'id', `題目檔名必須等於 id ${q.data.id}`));
    if (dir(q.file) !== `content/questions/${q.data.chapterId}`)
      issues.push(error('struct.filename', q.file, 'chapterId', `題目檔必須放在所屬章節的資料夾 content/questions/${q.data.chapterId}/`));
  }
  const seen = new Set();
  for (const o of parsed.objectives) {
    if (seen.has(o.file) || !o.file.startsWith('content/objectives/')) continue;
    seen.add(o.file);
    if (base(o.file) !== o.data.chapterId) issues.push(error('struct.filename', o.file, 'chapterId', `學習目標檔名必須等於 chapterId ${o.data.chapterId}`));
  }
}

/**
 * 跑全部文字與結構規則。
 * @param {import('./content-rules.mjs').ParsedBundle} parsed
 * @param {{ rawNumbers?: boolean }} [options] rawNumbers 預設開；交易範本不在 content/，不檢查
 * @returns {RuleIssue[]}
 */
export function runTextChecks(parsed, options = {}) {
  const rawNumbers = options.rawNumbers ?? true;
  /** @type {RuleIssue[]} */
  const issues = [];
  checkFilenames(parsed, issues);
  // 學習端文字的延伸只看 LocalizedText（學生看得到的欄位）；pendingRefs、authorNotes、ratioRef 是一般字串，不受影響
  for (const list of [parsed.terms, parsed.chapters, parsed.objectives, parsed.levels, parsed.stories, parsed.questions])
    for (const e of list) checkTextStyle(e, issues, { rawNumbers, learner: true });
  for (const q of parsed.questions) checkQuestion(q, issues);

  // struct.levelSize 的草稿提醒（已發布的關卡由 validateBundle 當錯誤）；ref.orphan 與未被章節列出的關卡只提醒
  const questionById = new Map(parsed.questions.map((q) => [q.data.id, q.data]));
  const chapterScope = new Map(parsed.chapters.map((c) => [c.data.id, c.data.scope]));
  const used = new Set();
  for (const l of parsed.levels) {
    for (const id of l.data.questionIds) used.add(id);
    if (l.data.status === 'published') continue;
    const members = l.data.questionIds.map((id) => questionById.get(id)).filter((q) => q !== undefined);
    if (members.length !== l.data.questionIds.length) continue;
    const msg = levelSizeIssue(members, { allowUnscored: chapterScope.get(l.data.chapterId) === 'extension' });
    if (msg !== null) issues.push(warning('struct.levelSize', l.file, 'questionIds', `${msg}（草稿先提醒，發布時是錯誤）`));
  }
  // ref.publishedClosure 的故事例外（08 第 5.3 節）：實驗室的故事到 M4a 才發布，已發布的章節、學習目標、題目引用草稿故事的步驟只警告，
  // 介面在故事發布前不顯示這個連結
  const draftStories = new Set(parsed.stories.filter((s) => s.data.status !== 'published').map((s) => s.data.id));
  const storyWarning = (file, path, story) =>
    issues.push(
      warning('ref.publishedClosure', file, path, `已發布的內容引用草稿故事 ${story} 的步驟；故事發布（M4a）前介面不顯示這個連結，發布後請確認步驟 ID 仍正確`),
    );
  for (const c of parsed.chapters)
    if (c.data.status === 'published')
      (c.data.chapterEndLinks ?? []).forEach((l, i) => draftStories.has(l.story) && storyWarning(c.file, `chapterEndLinks.${i}`, l.story));
  for (const o of parsed.objectives)
    if (o.data.status === 'published')
      (o.data.labRefs ?? []).forEach((l, i) => draftStories.has(l.story) && storyWarning(o.file, `${o.path}.labRefs.${i}`, l.story));
  for (const q of parsed.questions)
    if (q.data.status === 'published' && q.data.labRef && draftStories.has(q.data.labRef.story)) storyWarning(q.file, 'labRef', q.data.labRef.story);
  // 只算已發布章節列出的關卡：草稿章節的 levelIds 不能掩蓋「已發布章節漏列」（finding core-4）
  const listedLevels = new Set(parsed.chapters.filter((c) => c.data.status === 'published').flatMap((c) => c.data.levelIds));
  for (const l of parsed.levels)
    if (l.data.status === 'published' && !listedLevels.has(l.data.id))
      issues.push(warning('ref.orphan', l.file, 'id', `已發布的關卡 ${l.data.id} 沒有被任何章節的 levelIds 列出，地圖上不會出現`));
  for (const q of parsed.questions)
    if (q.data.status === 'published' && !used.has(q.data.id)) issues.push(warning('ref.orphan', q.file, 'id', `已發布的題目 ${q.data.id} 沒有被任何關卡使用`));
  return issues;
}
