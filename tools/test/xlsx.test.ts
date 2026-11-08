// xlsx 讀寫（tools/lib/xlsx-write.mjs、xlsx-read.mjs、ooxml.mjs）：寫出再讀回；XML 的形狀（資料驳證的位置與 formula1 的寫法、凍結、共用字串）；
// 讀 Excel 存檔會出現的形狀（inlineStr、富文字、公式快取值、沒有快取值、錯誤值、絕對路徑的 rels）。
import { describe, expect, it } from 'vitest';
import { cellRef, colIndex, colLetter, decodeXml, encodeXml, parseRef, quoteSheetName } from '../lib/ooxml.mjs';
import { parseSharedStrings, parseSheet, readWorkbook, sheetList } from '../lib/xlsx-read.mjs';
import { checkSheetName, columnRange, writeWorkbook } from '../lib/xlsx-write.mjs';
import { readZipTexts } from '../lib/zip-read.mjs';

describe('ooxml 小工具', () => {
  it('欄字母與欄號互換', () => {
    expect(colLetter(1)).toBe('A');
    expect(colLetter(26)).toBe('Z');
    expect(colLetter(27)).toBe('AA');
    expect(colLetter(702)).toBe('ZZ');
    expect(colLetter(703)).toBe('AAA');
    for (const n of [1, 26, 27, 52, 53, 702, 703, 16384]) expect(colIndex(colLetter(n))).toBe(n);
    expect(cellRef(3, 12)).toBe('C12');
    expect(parseRef('$C$12')).toEqual({ col: 3, row: 12 });
    expect(() => parseRef('12C')).toThrow(/看不懂/);
    expect(() => colLetter(0)).toThrow(/1 起算/);
  });
  it('XML 實體編碼與解碼', () => {
    expect(encodeXml('a<b>&"c\'\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&apos;');
    expect(decodeXml('&lt;&#x4e2d;&#25991;&amp;&unknown;')).toBe('<中文&&unknown;');
  });
  it('工作表名稱的引用一律加單引號，名稱內的單引號寫兩個', () => {
    expect(quoteSheetName('清單')).toBe("'清單'");
    expect(quoteSheetName("it's")).toBe("'it''s'");
  });
});

describe('writeWorkbook 與 readWorkbook', () => {
  const workbook = {
    sheets: [
      {
        name: '題目',
        freezeRows: 2,
        mutedRows: [0],
        widths: [12, 8, 40],
        rows: [
          ['id', 'baseRev', 'prompt.zh-TW'],
          ['編號', '匯出時的版本', '題幹 <含 & 符號>'],
          ['q_abc', 3, ' 開頭有空白\n第二行 '],
          [null, undefined, ''],
          ['#example', 1, true],
          ['q_def', 2.5, false],
        ],
        validations: [
          { sqref: columnRange(1, 3, 1000), sheet: '清單', range: '$A$2:$A$4' },
          { sqref: 'B3:B1000', values: ['draft', 'published', 'retired'] },
        ],
      },
      { name: '清單', rows: [['status'], ['draft'], ['published'], ['retired']] },
    ],
  };

  it('寫出再讀回得到同樣的值；空列與空格不佔位，列尾不補 null', () => {
    const buf = writeWorkbook(workbook);
    const { sheets, problems } = readWorkbook(buf);
    expect(problems).toEqual([]);
    expect(sheets.map((s) => s.name)).toEqual(['題目', '清單']);
    expect(sheets[0].rows).toEqual([
      ['id', 'baseRev', 'prompt.zh-TW'],
      ['編號', '匯出時的版本', '題幹 <含 & 符號>'],
      ['q_abc', 3, ' 開頭有空白\n第二行 '],
      [],
      ['#example', 1, true],
      ['q_def', 2.5, false],
    ]);
    expect(sheets[1].rows).toEqual([['status'], ['draft'], ['published'], ['retired']]);
  });

  it('工作表 XML：dataValidations 在 sheetData 之後、pageMargins 之前；formula1 用單引號引用工作表；凍結兩列；第 1 列灰字', () => {
    const zip = readZipTexts(writeWorkbook(workbook));
    const xml = zip.get('xl/worksheets/sheet1.xml')!;
    const order = ['<sheetViews>', '<cols>', '<sheetData>', '</sheetData>', '<dataValidations', '<pageMargins'].map((t) => xml.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(xml).toContain('<formula1>&apos;清單&apos;!$A$2:$A$4</formula1>');
    expect(xml).toContain('<formula1>&quot;draft,published,retired&quot;</formula1>');
    expect(xml).toContain('sqref="A3:A1000"');
    expect(xml).not.toContain('showDropDown');
    expect(xml).toContain('<pane ySplit="2" topLeftCell="A3"');
    expect(xml).toContain('<c r="A1" t="s" s="1">');
    expect(xml).toContain('<c r="A3" t="s">');
    expect(xml).toContain('<col min="3" max="3" width="40" customWidth="1"/>');
    expect(zip.get('xl/sharedStrings.xml')).toContain('<t xml:space="preserve"> 開頭有空白\n第二行 </t>');
    expect(zip.get('xl/workbook.xml')).toContain('<sheet name="題目" sheetId="1" r:id="rId1"/>');
    expect(zip.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
  });

  it('工作表名稱與驗證清單的限制', () => {
    expect(() => checkSheetName('a/b')).toThrow(/不能含/);
    expect(() => checkSheetName('x'.repeat(32))).toThrow(/31/);
    expect(() => writeWorkbook({ sheets: [] })).toThrow(/至少/);
    expect(() =>
      writeWorkbook({
        sheets: [
          { name: 'A', rows: [] },
          { name: 'a', rows: [] },
        ],
      }),
    ).toThrow(/重複/);
    expect(() => writeWorkbook({ sheets: [{ name: 'A', rows: [], validations: [{ sqref: 'A1', values: ['a,b'] }] }] })).toThrow(/逗號/);
    expect(() => writeWorkbook({ sheets: [{ name: 'A', rows: [], validations: [{ sqref: 'A1', values: Array(60).fill('abcd') }] }] })).toThrow(/255/);
  });
});

describe('讀 Excel 存檔的形狀', () => {
  const sst = parseSharedStrings(
    '<sst count="3" uniqueCount="3"><si><t>純文字</t></si><si><r><rPr><b/></rPr><t>富</t></r><r><t xml:space="preserve"> 文字</t></r></si><si><t>a</t><rPh sb="0" eb="1"><t>注音</t></rPh><phoneticPr fontId="1"/></si></sst>',
  );
  it('共用字串：純文字、富文字相接、注音略過', () => {
    expect(sst).toEqual(['純文字', '富 文字', 'a']);
  });

  it('各種儲存格型別與問題', () => {
    const xml =
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" s="3"/></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>內嵌</t></is></c><c r="B3"><v>42</v></c><c r="C3" t="b"><v>1</v></c><c r="D3" t="str"><f>CONCAT(A1,B1)</f><v>純文字富 文字</v></c></row>' +
      '<row r="4"><c r="A4"><f>SUM(B3)</f><v>42</v></c><c r="B4"><f>B3*2</f></c><c r="C4" t="e"><v>#DIV/0!</v></c><c r="D4" t="zzz"><v>1</v></c></row>' +
      '</sheetData></worksheet>';
    const { rows, problems } = parseSheet(xml, sst, '題目');
    expect(rows).toEqual([['純文字', '富 文字'], [], ['內嵌', 42, true, '純文字富 文字'], [42]]);
    expect(problems.map((p) => [p.ref, p.code])).toEqual([
      ['B4', 'noCachedValue'],
      ['C4', 'errorValue'],
      ['D4', 'unknownType'],
    ]);
    expect(problems[0].message).toContain('重新存檔');
  });

  it('workbook 與 rels：rels 的 Target 可能是絕對路徑，順序照 workbook.xml', () => {
    const list = sheetList(
      '<workbook><sheets><sheet name="第二" sheetId="2" r:id="rId2"/><sheet name="第一" sheetId="1" r:id="rId1"/></sheets></workbook>',
      '<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://x/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://x/styles" Target="styles.xml"/></Relationships>',
    );
    expect(list).toEqual([
      { name: '第二', path: 'xl/worksheets/sheet2.xml' },
      { name: '第一', path: 'xl/worksheets/sheet1.xml' },
    ]);
    expect(() => sheetList('<sheets><sheet name="x" r:id="rId9"/></sheets>', '<Relationships/>')).toThrow(/找不到/);
  });

  it('不是 xlsx 的 zip 會丟錯', () => {
    expect(() => readWorkbook(Buffer.from('not a zip'))).toThrow(/zip/);
  });
});
