// 講義題庫的抽題（tools/lib/handout-pptx.mjs 與 zip-read.mjs）：在測試裡組一個最小的 pptx（zip），驗投影片順序、題目欄位、B/C 都對、不是題目的投影片、
// 形狀不對的投影片會丟錯、比對重複用的鍵。文字全是自己編的句子，不含講義內容。
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeXml, dedupeKey, extractQuestion, parseSlide, slideOrder, textOfBody } from '../lib/handout-pptx.mjs';
import { listZipEntries, readZipEntry, readZipTexts } from '../lib/zip-read.mjs';

/** 最小的 zip 寫入（只給測試）：store 或 deflate，CRC 填 0（讀取端不驗） */
function zip(entries: { name: string; data: string; deflate?: boolean }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.from(e.data, 'utf8');
    const data = e.deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(e.deflate ? 8 : 0, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, eocd]);
}

const sp = (text: string) => `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Shape"/></p:nvSpPr><p:txBody>${text}</p:txBody></p:sp>`;
const run = (t: string) => `<a:r><a:rPr lang="zh-TW"/><a:t>${t}</a:t></a:r>`;
const para = (inner: string) => `<a:p><a:pPr/>${inner}<a:endParaRPr/></a:p>`;
const cell = (t: string) => `<a:tc><a:txBody>${para(run(t))}</a:txBody><a:tcPr/></a:tc>`;
const table = (rows: [string, string][]) =>
  `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid/>${rows.map(([l, t]) => `<a:tr h="1">${cell(l)}${cell(t)}</a:tr>`).join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
const questionSlide = (q: { topic: string; scenario: string; question: string; options: [string, string, string]; answer: string; explanation: string }) =>
  `<?xml version="1.0"?><p:sld><p:cSld><p:spTree>${sp(para(run('?')))}${sp(para(`${run(`練習題：${q.topic}`)}`))}${sp(para(run('情境與問題')))}` +
  `${sp(para(`${run(`情境：${q.scenario}`)}<a:br></a:br><a:br></a:br>${run(`問題：${q.question}`)}`))}` +
  `${table([
    ['A', q.options[0]],
    ['B', q.options[1]],
    ['C', q.options[2]],
  ])}` +
  `${sp(para(`${run(`解答：${q.answer}　`)}${run(q.explanation)}`))}${sp(para(run('‹#›')))}</p:spTree></p:cSld></p:sld>`;
const plainSlide = (title: string) => `<?xml version="1.0"?><p:sld><p:cSld><p:spTree>${sp(para(run(title)))}</p:spTree></p:cSld></p:sld>`;

const Q1 = {
  topic: '判斷月底的現金',
  scenario: '小芽的飲料攤月底盤點，帳上寫 &lt;3&gt; 杯沒賣完 &amp; 兩筆未收款。',
  question: '要先看哪一張表？',
  options: ['資產負債表：看期末有多少現金。', '損益表：看這個月賺多少。', '現金流量表：看現金怎麼進出。'] as [string, string, string],
  answer: 'A',
  explanation: '期末現金是資產負債表上的餘額；B 看的是損益，C 看的是過程。',
};
const Q2 = { ...Q1, topic: '兩個都說得通', answer: 'B/C都對', explanation: 'B 與 C 都有道理。' };

describe('zip-read', () => {
  it('讀中央目錄與 store、deflate 兩種項目', () => {
    const buf = zip([
      { name: 'a.txt', data: 'hello' },
      { name: 'dir/b.txt', data: '中文內容', deflate: true },
    ]);
    const entries = listZipEntries(buf);
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'dir/b.txt']);
    expect(readZipEntry(buf, entries[0]!).toString()).toBe('hello');
    expect(readZipEntry(buf, entries[1]!).toString()).toBe('中文內容');
    expect([...readZipTexts(buf, (n) => n.startsWith('dir/')).keys()]).toEqual(['dir/b.txt']);
  });
});

describe('handout-pptx', () => {
  it('textOfBody：段落與 <a:br> 都是換行，實體解碼，去頭尾空白', () => {
    expect(decodeXml('a &amp; b &lt;c&gt; &#x4e2d;&#25991;')).toBe('a & b <c> 中文');
    expect(textOfBody(`${para(`${run('一')}<a:br/>${run('二　')}`)}${para(run(' 三'))}`)).toBe('一\n二\n三');
  });

  it('slideOrder 依 presentation.xml 的順序，不是檔名的數字', () => {
    const pres = '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>';
    const rels =
      '<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>';
    expect(slideOrder(pres, rels)).toEqual(['ppt/slides/slide2.xml', 'ppt/slides/slide1.xml']);
  });

  it('extractQuestion：題目投影片的欄位逐字保留；不是題目回 null；B/C 都對是兩個字母', () => {
    const q = extractQuestion(parseSlide(questionSlide(Q1)));
    expect(q).toEqual({
      topic: Q1.topic,
      scenario: '小芽的飲料攤月底盤點，帳上寫 <3> 杯沒賣完 & 兩筆未收款。',
      question: Q1.question,
      options: [
        { letter: 'A', text: Q1.options[0] },
        { letter: 'B', text: Q1.options[1] },
        { letter: 'C', text: Q1.options[2] },
      ],
      answer: ['A'],
      explanation: Q1.explanation,
    });
    expect(extractQuestion(parseSlide(plainSlide('第一章')))).toBeNull();
    expect(extractQuestion(parseSlide(questionSlide(Q2)))?.answer).toEqual(['B', 'C']);
  });

  it('形狀不對（少表、字母順序錯、沒有問題）會丟錯並說明原因', () => {
    const noTable = questionSlide(Q1).replace(/<p:graphicFrame>[\s\S]*<\/p:graphicFrame>/, '');
    expect(() => extractQuestion(parseSlide(noTable))).toThrow(/選項表/);
    const badLetters = questionSlide(Q1).replace('<a:t>B</a:t>', '<a:t>D</a:t>');
    expect(() => extractQuestion(parseSlide(badLetters))).toThrow(/字母/);
    const noQuestion = questionSlide({ ...Q1, question: '' }).replace('問題：', '');
    expect(() => extractQuestion(parseSlide(noQuestion))).toThrow(/問題/);
  });

  it('dedupeKey：空白與全半形不影響，答案不算在內', () => {
    const a = extractQuestion(parseSlide(questionSlide(Q1)))!;
    const b = extractQuestion(parseSlide(questionSlide({ ...Q1, answer: 'C', scenario: `${Q1.scenario} ` })))!;
    expect(dedupeKey(a)).toBe(dedupeKey(b));
    const c = extractQuestion(parseSlide(questionSlide({ ...Q1, question: '要先看哪一張表呢？' })))!;
    expect(dedupeKey(a)).not.toBe(dedupeKey(c));
  });

  it('整份 pptx：從 zip 讀到題目', () => {
    const buf = zip([
      {
        name: 'ppt/presentation.xml',
        data: '<p:presentation><p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId3"/></p:sldIdLst></p:presentation>',
        deflate: true,
      },
      {
        name: 'ppt/_rels/presentation.xml.rels',
        data: '<Relationships><Relationship Id="rId2" Type="x/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="x/slide" Target="slides/slide2.xml"/></Relationships>',
      },
      { name: 'ppt/slides/slide1.xml', data: plainSlide('封面'), deflate: true },
      { name: 'ppt/slides/slide2.xml', data: questionSlide(Q1), deflate: true },
    ]);
    const texts = readZipTexts(buf);
    const order = slideOrder(texts.get('ppt/presentation.xml')!, texts.get('ppt/_rels/presentation.xml.rels')!);
    const found = order.map((f, i) => ({ slide: i + 1, q: extractQuestion(parseSlide(texts.get(f)!)) })).filter((x) => x.q);
    expect(found.map((x) => x.slide)).toEqual([2]);
    expect(found[0]!.q!.topic).toBe(Q1.topic);
  });
});
