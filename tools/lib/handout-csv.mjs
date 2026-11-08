// 老師的 CSV → 講義題庫的題（08 的講義題庫一節，2026-11-08）。格式是國北護 iClass（FormosaSoft ee-class 3.0）「線上測驗匯入」的第 4 版 CSV：
// 第 1 列 `version: 4`，第 2 列標題（題組、類別、題型、題目、答案、解說、難易度、選項1 到 選項20；標題格裡還有換行與說明文字），第 3 列起資料；
// 題型 1 是非（答案 1 是、2 否，選項全空）、2 單選（答案是選項編號）、3 複選（答案 "1,2"）、4 填充（答案寫在題目的 [*…*] 裡）、5 問答、6 說明、7 題組。
// 「我的題庫」版的標題只在前兩欄的說明文字不同，這裡只認標題開頭的欄名，兩種都收。
// 這裡只收是非與單選；複選（全選才對，苦練區的多個答案是「任一正確」）、填充、問答、說明、題組一律略過並列在報告。
// 純函式：吃 parseCsv 的二維陣列，回題目、問題（SheetIssue 格式，和 M6 匯入同一套）與略過的列；不讀檔。
import { createHash } from 'node:crypto';
import { HANDOUT_LETTERS, HANDOUT_MAX_OPTIONS, HANDOUT_MIN_OPTIONS } from '@ledgerland/content-schema';
import { tidy } from './handout-pptx.mjs';
import { issue } from './sheet-import.mjs';

/** @typedef {import('./sheet-import.mjs').SheetIssue} SheetIssue */
/** @typedef {{ row: number; type: number; category: string; topic: string; scenario: string; question: string; options: { letter: string; text: string }[]; answer: string[]; explanation: string }} CsvQuestion */

export const EE_CLASS_VERSION = 4;
export const OPTION_COLUMNS = 20;
/** 題型代號與名稱（ee-class 第 4 版） */
export const EE_CLASS_TYPES = { 1: '是非', 2: '單選', 3: '複選', 4: '填充', 5: '問答', 6: '說明', 7: '題組' };
const SUPPORTED_TYPES = new Set([1, 2]);
const REQUIRED_COLUMNS = ['題型', '題目', '答案', '選項1', '選項2'];
const TOPIC_MAX = 24;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
/** 標題格只認欄名：取第一行、去掉括號與冒號之後的說明，例如「題型: \n(1)是非…」→「題型」、「類別 \n(格式相容欄位…)」→「類別」 */
export const headerName = (cell) =>
  String(cell ?? '')
    .split('\n')[0]
    .replace(/[(（:：].*$/, '')
    .replace(/\s+/g, '')
    .trim();

/** 題目文字的鍵：情境與題幹 NFKC 後去空白再 sha256，取前 12 碼；題目文字改了就是新題，選項與解析改了不是 */
export function csvQuestionKey(scenario, question) {
  const text = `${scenario}\u0000${question}`.normalize('NFKC').replace(/[\s　]+/g, '');
  return `k${createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12)}`;
}

/** 題幹開頭的一句當 topic（清單與標題用）：到第一個句號或問號為止，最多 TOPIC_MAX 字，截斷加省略號 */
export function topicOf(question) {
  const firstLine = question.split('\n').find((l) => l.trim() !== '') ?? question;
  const m = /^(.*?[。？?！!])/.exec(firstLine);
  const sentence = (m ? m[1] : firstLine).trim();
  const chars = [...sentence];
  return chars.length > TOPIC_MAX ? `${chars.slice(0, TOPIC_MAX).join('')}…` : sentence;
}

/** 題目欄有「情境：…問題：…」時拆成兩段；沒有就整段是題幹、情境空字串 */
export function splitStem(text) {
  const t = tidy(text);
  const m = /^情境[：:]([\s\S]*?)(?:^|\n)問題[：:]([\s\S]*)$/m.exec(t);
  if (!m) return { scenario: '', question: t };
  return { scenario: tidy(m[1]), question: tidy(m[2]) };
}

/**
 * 解析 ee-class 第 4 版 CSV 的二維陣列
 * @param {string[][]} rows parseCsv 的結果
 * @param {string} sheet 報告裡的檔名
 * @returns {{ version: number | null; items: CsvQuestion[]; issues: SheetIssue[]; skipped: { row: number; type: number; name: string }[] }}
 */
export function parseEeClassCsv(rows, sheet) {
  /** @type {SheetIssue[]} */
  const issues = [];
  /** @type {CsvQuestion[]} */
  const items = [];
  const skipped = [];
  const headerIndex = rows.findIndex((r) => {
    const names = new Set(r.map(headerName));
    return names.has('題型') && names.has('題目');
  });
  if (headerIndex < 0) {
    issues.push(
      issue('error', 'csv.header', sheet, 1, null, null, '找不到標題列（要有「題型」與「題目」兩欄）', '請用 iClass 的「匯入題目」範本，不要改標題列。'),
    );
    return { version: null, items, issues, skipped };
  }
  let version = null;
  for (let i = 0; i < headerIndex; i++) {
    const m = /^version\s*[:：]\s*(\d+)/i.exec(String(rows[i]?.[0] ?? '').trim());
    if (m) version = Number(m[1]);
  }
  if (version !== null && version !== EE_CLASS_VERSION)
    issues.push(
      issue(
        'warning',
        'csv.version',
        sheet,
        1,
        'A',
        'version',
        `檔案的 version 是 ${version}，這裡依第 ${EE_CLASS_VERSION} 版的欄位讀`,
        '欄位對得上就沒事；對不上請改用新版範本。',
      ),
    );

  const col = new Map();
  rows[headerIndex].forEach((cell, j) => {
    const name = headerName(cell);
    if (name && !col.has(name)) col.set(name, j);
  });
  for (const name of REQUIRED_COLUMNS)
    if (!col.has(name))
      issues.push(
        issue('error', 'csv.columns', sheet, headerIndex + 1, null, name, `標題列少了「${name}」欄`, '請用 iClass 的「匯入題目」範本，不要改標題列。'),
      );
  if (issues.some((i) => i.severity === 'error')) return { version, items, issues, skipped };

  const letter = (j) => String.fromCharCode(65 + j);
  const cellOf = (r, name) => {
    const j = col.get(name);
    return j === undefined ? '' : String(r[j] ?? '');
  };
  const columnOf = (name) => {
    const j = col.get(name);
    return j === undefined ? null : letter(j);
  };
  const seenKeys = new Map();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(isBlank)) continue;
    const row = i + 1;
    const typeRaw = cellOf(r, '題型').trim();
    const type = Number(typeRaw);
    if (!Number.isInteger(type) || !(type in EE_CLASS_TYPES)) {
      issues.push(
        issue(
          'error',
          'csv.type',
          sheet,
          row,
          columnOf('題型'),
          '題型',
          `題型「${typeRaw}」不是 1 到 7`,
          '題型只能填 1 是非、2 單選、3 複選、4 填充、5 問答、6 說明、7 題組。',
        ),
      );
      continue;
    }
    if (!SUPPORTED_TYPES.has(type)) {
      skipped.push({ row, type, name: EE_CLASS_TYPES[type] });
      continue;
    }
    const errorsBefore = issues.filter((x) => x.severity === 'error').length;
    const stemRaw = cellOf(r, '題目');
    if (isBlank(stemRaw))
      issues.push(issue('error', 'csv.question', sheet, row, columnOf('題目'), '題目', '題目是空的', '填題幹；有情境就寫成「情境：…」換行「問題：…」。'));
    const explanation = tidy(cellOf(r, '解說'));
    if (explanation === '')
      issues.push(issue('error', 'csv.explanation', sheet, row, columnOf('解說'), '解說', '解說是空的', '苦練區每一題都要有解析，請填解說。'));
    const difficulty = cellOf(r, '難易度').trim();
    if (difficulty !== '' && !['1', '2', '3'].includes(difficulty))
      issues.push(
        issue('warning', 'csv.difficulty', sheet, row, columnOf('難易度'), '難易度', `難易度「${difficulty}」不是 1 到 3，這一欄不會進題庫`, '可以留空。'),
      );

    // 選項：單選要連續 2 到 5 個；是非不填選項（有填就警告並略過）
    const optionCells = [];
    for (let k = 1; k <= OPTION_COLUMNS; k++) optionCells.push(cellOf(r, `選項${k}`));
    let lastFilled = -1;
    optionCells.forEach((v, k) => {
      if (!isBlank(v)) lastFilled = k;
    });
    /** @type {{ letter: string; text: string }[]} */
    let options = [];
    if (type === 1) {
      if (lastFilled >= 0)
        issues.push(issue('warning', 'csv.options', sheet, row, columnOf('選項1'), '選項', '是非題的選項欄有字，會略過', '是非題的選項 1 到 20 留空。'));
      options = [
        { letter: 'A', text: '是' },
        { letter: 'B', text: '否' },
      ];
    } else {
      const count = lastFilled + 1;
      const gap = optionCells.findIndex((v, k) => k < lastFilled && isBlank(v));
      if (gap >= 0)
        issues.push(
          issue(
            'error',
            'csv.options',
            sheet,
            row,
            columnOf(`選項${gap + 1}`),
            `選項${gap + 1}`,
            `選項 ${gap + 1} 是空的，但後面還有選項`,
            '選項要從選項 1 起連續填，不能跳格。',
          ),
        );
      else if (count < HANDOUT_MIN_OPTIONS)
        issues.push(issue('error', 'csv.options', sheet, row, columnOf('選項1'), '選項', `單選題只有 ${count} 個選項`, `至少 ${HANDOUT_MIN_OPTIONS} 個。`));
      else if (count > HANDOUT_MAX_OPTIONS)
        issues.push(
          issue(
            'error',
            'csv.options',
            sheet,
            row,
            columnOf(`選項${HANDOUT_MAX_OPTIONS + 1}`),
            '選項',
            `單選題有 ${count} 個選項`,
            `苦練區最多 ${HANDOUT_MAX_OPTIONS} 個（${HANDOUT_LETTERS.join('、')}）。`,
          ),
        );
      else options = optionCells.slice(0, count).map((v, k) => ({ letter: HANDOUT_LETTERS[k], text: tidy(v) }));
    }

    // 答案：是非 1 是、2 否；單選是選項編號
    const answerRaw = cellOf(r, '答案').trim();
    /** @type {string[]} */
    let answer = [];
    if (type === 1) {
      if (answerRaw === '1') answer = ['A'];
      else if (answerRaw === '2') answer = ['B'];
      else
        issues.push(issue('error', 'csv.answer', sheet, row, columnOf('答案'), '答案', `是非題的答案「${answerRaw}」不是 1 或 2`, '1 是「是」、2 是「否」。'));
    } else if (options.length) {
      const n = Number(answerRaw);
      if (!/^\d+$/.test(answerRaw) || n < 1 || n > options.length)
        issues.push(
          issue(
            'error',
            'csv.answer',
            sheet,
            row,
            columnOf('答案'),
            '答案',
            `答案「${answerRaw}」不是 1 到 ${options.length} 的選項編號`,
            '單選題的答案填正確選項的編號，例如 3。',
          ),
        );
      else answer = [HANDOUT_LETTERS[n - 1]];
    }
    if (issues.filter((x) => x.severity === 'error').length > errorsBefore) continue;

    const { scenario, question } = splitStem(stemRaw);
    const key = csvQuestionKey(scenario, question);
    const dup = seenKeys.get(key);
    if (dup) {
      const same = JSON.stringify([dup.options, dup.answer, dup.explanation]) === JSON.stringify([options, answer, explanation]);
      if (same)
        issues.push(issue('warning', 'csv.duplicate', sheet, row, columnOf('題目'), '題目', `和第 ${dup.row} 列是同一題，這一列略過`, '刪掉其中一列。'));
      else
        issues.push(
          issue(
            'error',
            'csv.duplicate',
            sheet,
            row,
            columnOf('題目'),
            '題目',
            `和第 ${dup.row} 列的題目文字相同，但選項、答案或解說不同`,
            '同一題只留一列；真的是兩題就把題目文字改到不同。',
          ),
        );
      continue;
    }
    const item = { row, type, category: cellOf(r, '類別').trim(), topic: topicOf(question), scenario, question, options, answer, explanation };
    seenKeys.set(key, item);
    items.push(item);
  }
  return { version, items, issues, skipped };
}
