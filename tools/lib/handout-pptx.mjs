// 講義 pptx 的解析（08 的講義題庫一節）：純函式，輸入是 zip 裡的 XML 文字，輸出是每一張投影片的文字與練習題的欄位；讀檔在 handout-extract.mjs。
// 題目投影片的形狀（三份講義 328 題全部一樣）：標題「練習題：<主題>」、一個「情境：…<a:br/>…問題：…」的文字框、一張 3 列 2 欄的表（字母、選項）、
// 一個「解答：X」加一個全形空白再接解析的文字框。文字逐字保留（連錯字、全形空白與破折號都不改，維護者 2026-11-04 的決定），只去每一行的頭尾空白；
// 比對重複用的正規化（NFKC、去空白）只在 dedupeKey，不回寫到資料。不用 DOM 或 XML 套件：投影片的 XML 由 Google 簡報與 PowerPoint 產生，結構固定，用正規式分段就夠。

import { decodeXml } from './ooxml.mjs';

export { decodeXml };

/** 去每一行頭尾的空白（含全形空白），去掉頭尾的空行；行內內容不動 */
function tidy(text) {
  const lines = text.split('\n').map((l) => l.replace(/^[\s　]+|[\s　]+$/g, ''));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/** 一個 txBody 的文字：段落以 \n 分隔，<a:br> 也是 \n，段內的 run 直接相接 */
export function textOfBody(xml) {
  const paragraphs = [];
  for (const m of xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    let s = '';
    for (const t of m[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\/>|<a:br\b[^>]*>(?:<\/a:br>)?/g)) {
      if (t[0].startsWith('<a:br')) s += '\n';
      else if (t[1] !== undefined) s += decodeXml(t[1]);
    }
    paragraphs.push(s);
  }
  return tidy(paragraphs.join('\n'));
}

/**
 * 依 presentation.xml 的 sldIdLst 與 rels 排出投影片檔名的順序（slideN.xml 的 N 不保證是順序）
 * @param {string} presentationXml
 * @param {string} relsXml
 * @returns {string[]} 例如 ['ppt/slides/slide1.xml', …]
 */
export function slideOrder(presentationXml, relsXml) {
  const targets = new Map();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    const type = /\bType="([^"]+)"/.exec(attrs)?.[1] ?? '';
    if (id && target && type.endsWith('/slide')) targets.set(id, target.replace(/^\/?(ppt\/)?/, 'ppt/'));
  }
  const list = /<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/.exec(presentationXml)?.[1];
  if (!list) throw new Error('presentation.xml 沒有 sldIdLst');
  const out = [];
  for (const m of list.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)) {
    const file = targets.get(m[1]);
    if (!file) throw new Error(`presentation.xml 的投影片 ${m[1]} 在 rels 找不到`);
    out.push(file);
  }
  return out;
}

/**
 * 一張投影片的內容：每個文字框的文字（依出現順序）與表格（每列每格的文字）
 * @param {string} slideXml
 * @returns {{ shapes: string[]; tables: string[][][] }}
 */
export function parseSlide(slideXml) {
  const shapes = [];
  for (const m of slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
    const body = /<p:txBody>([\s\S]*?)<\/p:txBody>/.exec(m[0]);
    if (body) shapes.push(textOfBody(body[1]));
  }
  const tables = [];
  for (const t of slideXml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)) {
    const rows = [];
    for (const r of t[1].matchAll(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g)) {
      const cells = [];
      for (const c of r[1].matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g)) {
        const body = /<a:txBody>([\s\S]*?)<\/a:txBody>/.exec(c[1]);
        cells.push(body ? textOfBody(body[1]) : '');
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return { shapes, tables };
}

const ANSWER_RE = /^解答[：:]\s*([A-C](?:\s*\/\s*[A-C])*)\s*(都對)?(?=[\s　]|$)/;

/**
 * 從一張投影片抽出練習題；不是題目投影片（沒有「解答」）回 null；是題目但形狀不對就丟錯（訊息含原因）
 * @param {{ shapes: string[]; tables: string[][][] }} slide
 * @returns {{ topic: string; scenario: string; question: string; options: { letter: string; text: string }[]; answer: string[]; explanation: string } | null}
 */
export function extractQuestion(slide) {
  const answerShape = slide.shapes.find((s) => /^解答[：:]/.test(s));
  if (!answerShape) return null;
  const problems = [];
  const title = slide.shapes.find((s) => /^練習題[：:]/.test(s));
  if (!title) problems.push('沒有「練習題：」標題');
  const topic = title ? tidy(title.replace(/^練習題[：:]/, '')) : '';
  const stem = slide.shapes.find((s) => /^情境[：:]/.test(s));
  let scenario = '';
  let question = '';
  if (!stem) problems.push('沒有「情境：」文字框');
  else {
    const lines = stem.split('\n');
    const qi = lines.findIndex((l) => /^問題[：:]/.test(l));
    if (qi < 0) problems.push('情境文字框裡沒有「問題：」');
    else {
      scenario = tidy(
        lines
          .slice(0, qi)
          .join('\n')
          .replace(/^情境[：:]/, ''),
      );
      question = tidy(
        lines
          .slice(qi)
          .join('\n')
          .replace(/^問題[：:]/, ''),
      );
    }
  }
  if (slide.tables.length !== 1) problems.push(`選項表應該剛好一張，找到 ${slide.tables.length} 張`);
  const options = [];
  const table = slide.tables[0] ?? [];
  if (slide.tables.length === 1) {
    if (table.length !== 3) problems.push(`選項表應該 3 列，找到 ${table.length} 列`);
    table.forEach((row, i) => {
      const letter = (row[0] ?? '').trim();
      const expected = 'ABC'[i];
      if (letter !== expected) problems.push(`第 ${i + 1} 列的字母是「${letter}」，應該是 ${expected}`);
      if (!row[1] || row[1].trim() === '') problems.push(`選項 ${expected} 沒有文字`);
      options.push({ letter: expected, text: tidy(row[1] ?? '') });
    });
  }
  const am = ANSWER_RE.exec(answerShape);
  let answer = [];
  let explanation = '';
  if (!am) problems.push(`解答格式看不懂：「${answerShape.slice(0, 20)}」`);
  else {
    answer = am[1].split('/').map((x) => x.trim());
    explanation = tidy(answerShape.slice(am[0].length));
    if (explanation === '') problems.push('沒有解析');
    if (new Set(answer).size !== answer.length) problems.push('解答的字母重複');
  }
  if (problems.length) throw new Error(problems.join('；'));
  return { topic, scenario, question, options, answer, explanation };
}

/** 比對重複用的鍵：情境、問題與三個選項（不含答案），NFKC 後去掉所有空白 */
export function dedupeKey(q) {
  return [q.scenario, q.question, ...q.options.map((o) => o.text)]
    .join('\u0000')
    .normalize('NFKC')
    .replace(/[\s　]+/g, '');
}
