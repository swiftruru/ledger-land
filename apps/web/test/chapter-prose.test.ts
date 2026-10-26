// 章節摘要與學習目標的斷行單位（features/chapter/prose.ts，M3 驗收第 6 輪）：斷行只落在單位之間。
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { proseUnits } from '../src/features/chapter/prose.ts';

/** 單位（欄寬 12 個字以上時的斷行位置） */
const unitsOf = (text: string) => proseUnits(text)!.map((u) => u.flat().join(''));
/** 詞（文字放大、欄寬 6.5 到 12 個字時的斷行位置） */
const piecesOf = (text: string) =>
  proseUnits(text)!
    .flat()
    .map((p) => p.join(''));
/** 長詞裡的小詞（欄寬 4.5 到 6.5 個字時的斷行位置） */
const wordsOf = (text: string) => proseUnits(text)!.flat(2);

/** 兩個單位之間才能換行：檢查 s 有沒有被拆在兩個單位裡 */
function splits(units: readonly string[], s: string): boolean {
  const text = units.join('');
  const at = text.indexOf(s);
  if (at < 0) throw new Error(`找不到 ${s}`);
  let pos = 0;
  for (const u of units) {
    pos += u.length;
    if (pos > at && pos < at + s.length) return true;
  }
  return false;
}

describe('proseUnits', () => {
  it('接起來就是原字串；英文與空字串回傳 undefined', () => {
    const text = '從一家剛開張的小咖啡店出發，認識資產、負債與股東權益，以及它們之間永遠成立的關係。';
    expect(unitsOf(text).join('')).toBe(text);
    expect(piecesOf(text).join('')).toBe(text);
    expect(proseUnits('Start from earnings per share on the income statement')).toBeUndefined();
    expect(proseUnits('')).toBeUndefined();
  });

  it('第 6 輪審查列出的詞不拆開：資產、股東權益、變動、算出、限制、產業差異、價格', () => {
    const cases: [string, string[]][] = [
      ['從一家剛開張的小咖啡店出發，認識資產、負債與股東權益，以及它們之間永遠成立的關係。', ['資產', '股東權益']],
      ['能用會計恆等式（資產＝負債＋股東權益）判斷一筆交易之後哪些項目變動、帳是否仍然平衡', ['會計恆等式', '股東權益', '變動']],
      ['從損益表上的每股盈餘出發，加上市場的股價，算出本益比，再練習判讀倍數高低的意義與它的限制。', ['每股盈餘', '算出', '限制', '判讀']],
      ['能說明用本益比估價的前提與限制（歷史或預估每股盈餘、產業差異、一次性損益），並分辨會計觀念練習與投資建議', ['產業差異', '一次性損益']],
      ['能用股價與每股盈餘說明本益比的意思，判讀倍數高低代表市場為每一元盈餘付出的價格', ['價格', '每股盈餘']],
      ['能分辨股本與未分配盈餘的來源', ['未分配盈餘']],
    ];
    for (const [text, words] of cases) {
      const u = unitsOf(text);
      for (const w of words) expect(splits(u, w), `${w} 在「${u.join('|')}」`).toBe(false);
    }
  });

  it('文字放大時只在詞與詞之間斷：詞本身不拆，標點黏著前面的詞', () => {
    const p = piecesOf('從一家剛開張的小咖啡店出發，認識資產、負債與股東權益，以及它們之間永遠成立的關係。');
    for (const w of ['資產、', '負債', '股東', '權益，', '出發，']) expect(splits(p, w), `${w} 在「${p.join('|')}」`).toBe(false);
    expect(p.some((x) => /^[，。、）]/.test(x))).toBe(false);
  });

  it('標點不落在行首：句號、逗號、頓號、閉括號黏著前面，開括號黏著後面；N/A 不拆', () => {
    const u = piecesOf('並分辨每股盈餘為零時本益比算不出來（N/A），為負時算出的倍數不具解釋意義');
    expect(u.some((x) => /^[，。、）]/.test(x))).toBe(false);
    expect(u.some((x) => /（$/.test(x))).toBe(false);
    expect(splits(u, '（N/A），')).toBe(false);
  });

  it('最後一個單位至少 4 個字，最後一行不會只剩「什麼」「交易」', () => {
    expect(unitsOf('能把一家小店帳上的項目分成資產、負債與股東權益，並說出每一類代表什麼').at(-1)).toBe('代表什麼');
    expect(unitsOf('能說明報表上的每個數字都來自交易紀錄，並從數字倒推公司做過哪一類交易').at(-1)).toBe('哪一類交易');
  });

  it('助詞「的」「地」「得」不落在行首：黏著前面的詞（第 8 輪驗收：375 加 200% 的最後一行是「的關係。」）', () => {
    const text = '以及它們之間永遠成立的關係。';
    expect(unitsOf(text).some((u) => u.startsWith('的'))).toBe(false);
    expect(wordsOf(text)).toContain('成立的');
    expect(piecesOf(text)).toEqual(expect.arrayContaining(['成立的', '關係。']));
    expect(wordsOf(text).some((w) => w.startsWith('的'))).toBe(false);
    // 閉括號、符號、空一格的拉丁字母後面也黏上；Segmenter 的「的是」先拆下來
    expect(wordsOf('解開「有賺錢為什麼沒現金」的謎。')).toContain('沒現金」的');
    expect(wordsOf('能依步驟①到⑤的順序')).toContain('到⑤的');
    expect(wordsOf('能說明 ROE 與 ROA 的差距')).toContain('ROA 的');
    expect(wordsOf('說明它問的是「一年內」')).toContain('它問的');
    expect(wordsOf('把每一筆交易清楚地分類')).toContain('清楚地');
    // 含名詞的詞最多 6 個字，窄欄在小詞之間斷：資產｜負債表的
    expect(proseUnits('看懂資產負債表的左右兩邊')!.flat()).toContainEqual(['資產', '負債表的']);
    expect(proseUnits('負債與股東權益的關係')!.flat()).toContainEqual(['股東', '權益的']);
    // 「的」後面照樣可以斷，不黏著後面的詞
    expect(wordsOf('剛開張的小咖啡店')).toEqual(expect.arrayContaining(['開張的', '小']));
  });

  it('單位最多 7 個漢字、詞最多 6 個字寬：欄寬 12 個字與 6.5 個字以上時 nowrap 一定放得下', () => {
    const text = '六大類財務分析指標從這一章開始。這門課把六大類分成投入、轉換、產出三段來看，這是課程的讀法；主管機關規定的財務分析格式只列類別，不分段。';
    for (const x of unitsOf(text)) expect(x.replace(/[^\p{Script=Han}]/gu, '').length).toBeLessThanOrEqual(7);
    for (const x of piecesOf(text)) expect(x.length).toBeLessThanOrEqual(6);
  });
});

describe('名詞資料裡的名稱不拆（第 7 輪驗收：375 加 200% 的摘要斷成「股東／權益」）', () => {
  const root = new URL('../../../content/', import.meta.url);
  const read = <T>(dir: string): T[] =>
    readdirSync(new URL(dir, root))
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(new URL(dir + f, root), 'utf8')) as T);
  type Zh = { 'zh-TW'?: string };
  const hanLen = (s: string) => s.match(/\p{Script=Han}/gu)?.length ?? 0;
  const names = new Set<string>();
  for (const t of read<{ label: Zh; teacherLabel?: string; currentTwLabel?: string | null; aliases?: { 'zh-TW'?: string[] } }>('terms/'))
    for (const n of [t.label['zh-TW'], t.teacherLabel, t.currentTwLabel, ...(t.aliases?.['zh-TW'] ?? [])]) if (n && hanLen(n) >= 2) names.add(n);
  const texts: string[] = [];
  for (const c of read<{ summary?: Zh; badge?: { title: Zh } }>('chapters/')) texts.push(c.summary?.['zh-TW'] ?? '', c.badge?.title['zh-TW'] ?? '');
  for (const o of read<{ items: { statement: Zh }[] }>('objectives/')) for (const it of o.items) texts.push(it.statement['zh-TW'] ?? '');

  /** parts 依序接起來是原字串：[at, at + len) 的中間有沒有 parts 的接縫 */
  function cut(parts: readonly string[], at: number, len: number): boolean {
    let pos = 0;
    for (const p of parts) {
      pos += p.length;
      if (pos > at && pos < at + len) return true;
    }
    return false;
  }

  it('章節摘要、學習目標與徽章名裡的名詞：5 個字以內在同一個詞裡，6、7 個字在同一個單位裡', () => {
    const split = new Set<string>();
    let found = 0;
    for (const text of texts) {
      const units = proseUnits(text);
      if (!units) continue;
      const pieces = units.flat().map((p) => p.join(''));
      const unitTexts = units.map((u) => u.flat().join(''));
      for (const n of names) {
        const han = hanLen(n);
        if (han > 7) continue;
        for (let at = text.indexOf(n); at >= 0; at = text.indexOf(n, at + 1)) {
          found++;
          if (cut(han <= 5 ? pieces : unitTexts, at, n.length)) split.add(`${n}（${text}）`);
        }
      }
    }
    expect(found).toBeGreaterThan(100);
    expect([...split], '被拆開的名詞：把名稱加進 prose.ts 的 TERMS').toEqual([]);
  });

  it('章節摘要、學習目標與徽章名裡沒有以助詞「的」開頭的詞（前一個詞黏上之後超過 5 個字的例外）', () => {
    const han = (s: string) => s.match(/\p{Script=Han}/gu)?.length ?? 0;
    const bad: string[] = [];
    for (const text of texts) {
      const pieces = proseUnits(text)?.flat() ?? [];
      for (const [i, p] of pieces.entries()) {
        const before = pieces[i - 1]?.join('') ?? '';
        if (p.some((w) => /^的/u.test(w)) && han(before) < 5) bad.push(`${before}｜${p.join('·')}（${text}）`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Segmenter 切錯的地方照名詞切：分錄、過帳、資本公積、利害關係人', () => {
    expect(piecesOf('能把分錄過帳到 T 字帳並算出餘額')).toEqual(expect.arrayContaining(['分錄', '過帳', 'T 字帳']));
    expect(piecesOf('能說明資本公積是什麼')).toContain('資本公積');
    expect(piecesOf('說明一個決定對不同利害關係人的得失')).toContain('利害關係人的');
  });

  it('6、7 個字的名詞是一個單位，裡面照樣切成詞（窄欄只在名詞裡的詞與詞之間斷）', () => {
    const text = '最後比較應付款項週轉率的兩種分子';
    // 後面黏著的「的」不算字數，名詞和它仍在同一個單位
    expect(unitsOf(text)).toContain('應付款項週轉率的');
    expect(piecesOf(text)).not.toContain('應付款項週轉率');
    expect(unitsOf('認識資產、負債與股東權益，以及它們之間永遠成立的關係。')).toContain('負債與股東權益，');
  });

  it('超過 4 個字寬的名詞裡面記下小詞：窄欄只在小詞之間斷（本期｜淨利、會計｜恆等式、未分配｜盈餘）', () => {
    const pieces = proseUnits('能從本期淨利、股本與每股面額算出每股盈餘，並說明它是本益比的分母')!.flat();
    expect(pieces).toContainEqual(['本期', '淨利、']);
    expect(pieces).toContainEqual(['每股', '盈餘，']);
    expect(proseUnits('能用會計恆等式檢查一張資產負債表是否平衡')!.flat()).toContainEqual(['會計', '恆等式']);
    expect(proseUnits('能說明本期淨利怎麼經由未分配盈餘，留在帳上')!.flat()).toContainEqual(['未分配', '盈餘，']);
    // 第 7 輪的「股東／權益」：「股東權益，」是一個詞，欄寬至少 6.5 個字（375 加 200% 約 7 到 9 個字）整個不拆，更窄才在小詞之間斷；
    // 後面沒有標點的「股東權益」是 4 個字寬的短詞，欄寬至少 4.5 個字就不拆
    expect(piecesOf('認識資產、負債與股東權益，以及它們之間永遠成立的關係。')).toContain('股東權益，');
    expect(proseUnits('認識資產、負債與股東權益，以及它們之間永遠成立的關係。')!.flat()).toContainEqual(['股東', '權益，']);
    expect(proseUnits('認識資產、負債與股東權益')!.flat()).toContainEqual(['股東權益']);
    // 小詞的標點仍黏著前面，不會有小詞以標點開頭
    expect(wordsOf('能用期初存貨、本期進貨與期末存貨說明營業成本怎麼算').some((w) => /^[，。、）]/.test(w))).toBe(false);
  });

  it('投資人的「人」、機車行的「行」、這一章的「章」黏著前面的詞', () => {
    expect(piecesOf('再看投資人「融資」買股票的機制')).toContain('投資人');
    expect(piecesOf('跟著一家水族店、一家民宿和一家機車行，')).toEqual(expect.arrayContaining(['水族店、', '機車行，']));
    expect(piecesOf('怎麼確定三張報表彼此對得起來？這一章看「轉換」')).toEqual(expect.arrayContaining(['對得起來？', '這一章']));
  });

  it('否定詞黏著後面的詞；只有一個字的單位併進後面（Segmenter 的「是不|計分」「出|現在」）', () => {
    expect(splits(piecesOf('本章全部是不計分的取捨思辨題'), '不計分')).toBe(false);
    expect(unitsOf('本章全部是不計分的取捨思辨題')).toContain('是不計分的');
    expect(unitsOf('以及這些事為什麼不會出現在公司的帳上。')).toContain('出現在');
    expect(unitsOf('把「算出來剛好是零」分清楚，並學會')).toContain('分清楚，');
    // 開引號後面只有一個字也一樣：不斷成「「有／賺錢」「「算／不出來」」
    expect(unitsOf('最後解開「有賺錢為什麼沒現金」的謎。')).toContain('「有賺錢');
    expect(unitsOf('這一章也要把「算不出來」的 N/A 和')).toContain('「算不出來」的');
    // 文字放大時也是一個詞；窄欄（320 加 200% 的目標欄）只在引號裡的第一個字後面斷
    expect(piecesOf('最後解開「有賺錢為什麼沒現金」的謎。')).toContain('「有賺錢');
    expect(proseUnits('能說明「算不出來」（N/A）和')!.flat()).toContainEqual(['「算', '不出來」']);
    // 中心詞與句尾的單位優先：不拆成「佔實收資本｜比率」「以稅前淨利｜當起點」
    expect(unitsOf('並知道營業利益佔實收資本比率是延伸指標')).toContain('實收資本比率');
    expect(unitsOf('以及本課為什麼以稅前淨利當起點').at(-1)).toBe('稅前淨利當起點');
  });

  it('Segmenter 整個不切的 4、5 個字名詞從第 2 個字後分成小詞：資產｜負債表、期初｜存貨、利害｜關係人', () => {
    expect(proseUnits('怎麼經由未分配盈餘留在資產負債表上，並判斷')!.flat()).toContainEqual(['資產', '負債表']);
    expect(proseUnits('能用期初存貨、本期進貨與期末存貨說明營業成本怎麼算')!.flat()).toContainEqual(['期初', '存貨、']);
    expect(proseUnits('說明一個決定對不同利害關係人的得失')!.flat()).toContainEqual(['利害', '關係人的']);
  });
});
