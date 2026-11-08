// 老師的 CSV（ee-class 第 4 版測驗匯入檔）→ 講義題庫的題（tools/lib/handout-csv.mjs）。
// 夾具的標題列照官方範本的欄名與說明寫法，題目文字全是自己編的，不含任何講義或考題內容。
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../lib/csv.mjs';
import { csvQuestionKey, headerName, parseEeClassCsv, splitStem, topicOf } from '../lib/handout-csv.mjs';

const HEADER = [
  '題組',
  '類別 \n(格式相容欄位，匯入線上測驗時不支援)',
  '題型: \n(1)是非\n(2)單選  \n(3)複選  \n(4)填充 \n(5)問答\n(6)說明\n(7)題組',
  '題目',
  '答案\n若為是非題: \n(1)答案為是\n(2)答案為否',
  '解說\n(說明沒有解說)',
  '難易度:\n(1)容易\n(2)適中\n(3)困難',
  '選項1\n若為填充題: \n(1)不區分英文大小寫\n(2)區分英文大小寫',
  '選項2 \n若為填充題: \n(1)不需考慮順序\n(2)需考慮順序 ',
  ...Array.from({ length: 18 }, (_, i) => `選項${i + 3}`),
];
const VERSION = ['version: 4', ...Array(26).fill('')];
/** 一列資料：題組、類別、題型、題目、答案、解說、難易度、選項 1 到 20 */
const row = (f: {
  group?: string;
  category?: string;
  type: number | string;
  stem: string;
  answer: string;
  explanation?: string;
  difficulty?: string;
  options?: string[];
}) => {
  const options = [...(f.options ?? [])];
  while (options.length < 20) options.push('');
  return [f.group ?? '', f.category ?? '', String(f.type), f.stem, f.answer, f.explanation ?? '解析在這裡。', f.difficulty ?? '2', ...options];
};
const csv = (rows: string[][]) => parseCsv(toCsv([VERSION, HEADER, ...rows]));
const single = (stem: string, answer: string, options = ['甲', '乙', '丙'], extra: Partial<Parameters<typeof row>[0]> = {}) =>
  row({ type: 2, stem, answer, options, ...extra });
const messages = (issues: { message: string }[]) => issues.map((i) => i.message);

describe('headerName、splitStem、topicOf、csvQuestionKey', () => {
  it('標題格只認欄名', () => {
    expect(HEADER.map(headerName).slice(0, 9)).toEqual(['題組', '類別', '題型', '題目', '答案', '解說', '難易度', '選項1', '選項2']);
    expect(headerName('題組 (格式相容欄位，題庫不支援)')).toBe('題組');
  });
  it('情境與問題分段；沒有分段時整段是題幹', () => {
    expect(splitStem('情境：小店月底盤點。\n\n問題：先看哪一張表？')).toEqual({ scenario: '小店月底盤點。', question: '先看哪一張表？' });
    expect(splitStem('  只有題幹。  ')).toEqual({ scenario: '', question: '只有題幹。' });
  });
  it('topic 是題幹開頭的一句，太長就截斷', () => {
    expect(topicOf('先看哪一張表？再想原因。')).toBe('先看哪一張表？');
    expect(topicOf('一'.repeat(40))).toBe(`${'一'.repeat(24)}…`);
  });
  it('鍵只看情境與題幹，空白與全半形不影響', () => {
    expect(csvQuestionKey('情境', '題幹？')).toBe(csvQuestionKey(' 情境 ', '題 幹？'));
    expect(csvQuestionKey('情境', 'Ａ')).toBe(csvQuestionKey('情境', 'A'));
    expect(csvQuestionKey('情境', '題幹？')).not.toBe(csvQuestionKey('情境', '題幹！'));
    expect(csvQuestionKey('a', 'b')).toMatch(/^k[0-9a-f]{12}$/);
  });
});

describe('parseEeClassCsv', () => {
  it('單選與是非進來，其他題型略過並列在 skipped', () => {
    const r = parseEeClassCsv(
      csv([
        single('情境：小店月底盤點。\n問題：先看哪一張表？', '3'),
        row({ type: 1, stem: '資產等於負債加權益。', answer: '1' }),
        row({ type: 1, stem: '費用增加記在貸方。', answer: '2' }),
        row({ type: 3, stem: '哪些是流動資產？', answer: '1,2', options: ['現金', '存貨', '機器'] }),
        row({ type: 4, stem: '資產等於[*負債*]加權益。', answer: '', options: ['1', '2'] }),
        row({ type: 6, stem: '以下是第二部分。', answer: '', explanation: '' }),
      ]),
      'test.csv',
    );
    expect(r.version).toBe(4);
    expect(r.issues).toEqual([]);
    expect(r.items.map((i) => [i.row, i.type, i.answer])).toEqual([
      [3, 2, ['C']],
      [4, 1, ['A']],
      [5, 1, ['B']],
    ]);
    expect(r.items[0]).toMatchObject({ scenario: '小店月底盤點。', question: '先看哪一張表？', topic: '先看哪一張表？', explanation: '解析在這裡。' });
    expect(r.items[0]!.options).toEqual([
      { letter: 'A', text: '甲' },
      { letter: 'B', text: '乙' },
      { letter: 'C', text: '丙' },
    ]);
    expect(r.items[1]!.options).toEqual([
      { letter: 'A', text: '是' },
      { letter: 'B', text: '否' },
    ]);
    expect(r.skipped).toEqual([
      { row: 6, type: 3, name: '複選' },
      { row: 7, type: 4, name: '填充' },
      { row: 8, type: 6, name: '說明' },
    ]);
  });

  it('五個選項可以，六個不行；選項跳格、答案超出範圍、空題目、空解說都指出列與欄', () => {
    const r = parseEeClassCsv(
      csv([
        single('五個選項。', '5', ['一', '二', '三', '四', '五']),
        single('六個選項。', '1', ['一', '二', '三', '四', '五', '六']),
        single('跳格。', '1', ['一', '', '三']),
        single('答案超出。', '4'),
        single('答案不是數字。', 'C'),
        single('', '1'),
        single('沒有解說。', '1', undefined, { explanation: '' }),
        single('只有一個選項。', '1', ['一']),
        row({ type: 1, stem: '是非的答案寫錯。', answer: '3' }),
        row({ type: 9, stem: '題型不對。', answer: '1' }),
      ]),
      'test.csv',
    );
    expect(r.items.map((i) => i.row)).toEqual([3]);
    expect(r.items[0]!.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r.items[0]!.answer).toEqual(['E']);
    const errors = r.issues.filter((i) => i.severity === 'error');
    expect(errors.map((i) => [i.row, i.code, i.field])).toEqual([
      [4, 'csv.options', '選項'],
      [5, 'csv.options', '選項2'],
      [6, 'csv.answer', '答案'],
      [7, 'csv.answer', '答案'],
      [8, 'csv.question', '題目'],
      [9, 'csv.explanation', '解說'],
      [10, 'csv.options', '選項'],
      [11, 'csv.answer', '答案'],
      [12, 'csv.type', '題型'],
    ]);
    expect(errors.every((i) => i.sheet === 'test.csv' && i.column && i.suggestion)).toBe(true);
    expect(messages(errors)).toContainEqual(expect.stringContaining('選項 2 是空的'));
  });

  it('同一題出現兩次：完全相同就略過（警告），選項或答案不同是錯誤', () => {
    const r = parseEeClassCsv(
      csv([single('同一題？', '1'), single('同一題？', '1'), single('同一題？', '2'), single('同 一 題？', '1', ['甲', '乙', '丁'])]),
      'test.csv',
    );
    expect(r.items.map((i) => i.row)).toEqual([3]);
    expect(r.issues.map((i) => [i.severity, i.row, i.code])).toEqual([
      ['warning', 4, 'csv.duplicate'],
      ['error', 5, 'csv.duplicate'],
      ['error', 6, 'csv.duplicate'],
    ]);
  });

  it('是非題填了選項只警告；難易度不是 1 到 3 只警告；version 不是 4 只警告', () => {
    const rows = parseCsv(
      toCsv([['version: 3', ...Array(26).fill('')], HEADER, row({ type: 1, stem: '是非。', answer: '1', options: ['是', '否'], difficulty: '5' })]),
    );
    const r = parseEeClassCsv(rows, 'test.csv');
    expect(r.version).toBe(3);
    expect(r.items).toHaveLength(1);
    expect(r.issues.map((i) => [i.severity, i.code])).toEqual([
      ['warning', 'csv.version'],
      ['warning', 'csv.difficulty'],
      ['warning', 'csv.options'],
    ]);
  });

  it('「我的題庫」版的標題（前兩欄說明不同、沒有 version 列）也讀得到；沒有標題列或少欄是錯誤', () => {
    const qbHeader = ['題組 (格式相容欄位，題庫不支援)', '類別 (匯入線上測驗時不支援)', '題型:(1)是非(2)單選(3)複選(4)填充(5)問答', ...HEADER.slice(3)];
    const r = parseEeClassCsv(parseCsv(toCsv([qbHeader, single('題庫版。', '2')])), 'qb.csv');
    expect(r.version).toBeNull();
    expect(r.issues).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.row).toBe(2);
    const noHeader = parseEeClassCsv(
      parseCsv(
        toCsv([
          ['甲', '乙'],
          ['丙', '丁'],
        ]),
      ),
      'x.csv',
    );
    expect(noHeader.issues.map((i) => i.code)).toEqual(['csv.header']);
    const missing = parseEeClassCsv(parseCsv(toCsv([HEADER.filter((h) => headerName(h) !== '答案'), single('少欄。', '1')])), 'x.csv');
    expect(missing.issues.map((i) => [i.code, i.field])).toEqual([['csv.columns', '答案']]);
    expect(missing.items).toEqual([]);
  });

  it('儲存格裡的換行與 CRLF 照 RFC 4180 讀；整列空白略過；類別欄帶出來', () => {
    const text =
      `﻿version: 4${','.repeat(26)}\r\n${HEADER.map((h) => `"${h}"`).join(',')}\r\n` +
      `,財務結構,2,"情境：甲公司。\n\n問題：負債比率看什麼？",1,"解析\n第二段。",2,總負債除以總資產,流動資產,營收${','.repeat(17)}\r\n${','.repeat(26)}\r\n`;
    const r = parseEeClassCsv(parseCsv(text), 'crlf.csv');
    expect(r.issues).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ category: '財務結構', scenario: '甲公司。', question: '負債比率看什麼？', explanation: '解析\n第二段。' });
  });
});
