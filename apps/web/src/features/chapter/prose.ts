// 章節摘要與學習目標的斷行單位（M3 驗收第 6 輪：375 的「認識資／產」「股東／權益」「項目變／動」、末行只剩「什麼」「交易」，
// 1280 的「算／出本益比」「它的限／制」「產業差／異」，768 的「付出的價／格」）。
// 全站的中文換行規則是 word-break: normal、line-break: strict、text-wrap: pretty（基礎組，web-ui 的 03-core-utils.css）：字與字之間都能斷，
// 句號、逗號、頓號不落在行首。這裡把不該拆開的字串切成兩層，ChapterProse 包成 span（chapter.css 依欄寬決定哪一層 nowrap）：
// - 詞（piece）：Segmenter 的詞連同黏著它的標點，最多約 6 個字寬（「資產負債表，」）。4 個字寬以內的詞在欄寬至少 4.5 個字時不拆，
//   更長的詞要欄寬至少 6.5 個字；
// - 單位（unit）：幾個詞合成一組，例如「股東權益」「本益比的分母」，最多 6 個漢字（句尾 7 個）加標點。欄寬至少 12 個字時不拆。
// 文字放大 200% 的窄欄（375 寬時一行約 8 個字、320 寬的目標欄一行只剩四、五個字）仍不在兩、三個字的詞中間斷，也不撐破卡片。
//
// 為什麼不直接用 web-ui 的 phraseParts：那是給名稱與短說明句的，單字一律黏著前後的詞、括號裡整段不斷，
// 放在散文裡會黏成「（歷史或預估每股盈餘、產業差異、一次性損益），」這種 26 個字的長串，nowrap 會撐破窄欄。
//
// 名詞（第 7 輪驗收：375 加 200% 的摘要斷成「股東／權益」）：先由左往右依最長的名詞切出來，其餘的字才交給 Segmenter（見 TERMS）。
// 5 個字以內的名詞是一個詞，文字放大的窄欄也不拆，Segmenter 切錯的地方（「分|錄過|帳」「公積從」「利害關係|人的」）也照名詞切；
// 超過 4 個字寬的名詞裡面再記下 Segmenter 的小詞（本期｜淨利、會計｜恆等式、未分配｜盈餘），欄寬不到 6.5 個字（320 加 200% 的目標欄）時
// 只在小詞之間斷，不斷成「本期淨／利」；6、7 個字的名詞（利息保障倍數、應付款項週轉率）是一個單位，裡面照樣切成詞。
// 詞（Intl.Segmenter 切出來的詞為基礎，標點逐字看）：
// - 兩個字以上的詞不拆（資產、限制、差異、價格、算出、變動）；
// - 開括號、開引號黏著後面；句號、逗號、頓號、閉括號黏著前面（瀏覽器本來就不讓它們落在行首，這裡讓它們和前面的詞一起換行）；
// - 「N/A」「NT$1,200」這類拉丁字母、數字與符號的組合不拆；
// - 相鄰的單字黏在一起（Segmenter 常把「營收」「判讀」「勾稽點」切成單字），最多 4 個字，連接詞（的、與、和、及、或、之、占、並）除外；
// - 助詞「的」「地」「得」不落在行首（第 8 輪驗收：375 加 200% 的摘要最後一行是「的關係。」）：黏著前面的詞、閉括號或符號
//   （成立的、持有的、「沒現金」的、到⑤的），拉丁字母後面空一格的也連同空格黏上（ROA 的），後面照樣可以斷。
//   Segmenter 切成「的是」「的話」時先把「的」拆下來（它問的｜是）。黏上之後最多 5 個字、5 個字寬；含名詞的詞最多 6 個字
//   （股東權益的、資產負債表的），窄欄在小詞之間斷（股東｜權益的、資產｜負債表的）。超過時照舊，「的」自己一個詞；
// - 否定與數量的字頭（未、非、不、沒、無、每、總）黏著後面的詞（未分配、非流動）；Segmenter 把否定詞切在前一個詞的尾巴
//   （是不|計分、也不|影響）時先拆下來再黏到後面（不計分）；性、率、額、類這類字尾與元、筆、張、層這類量詞，
//   還有內、時、上、人、來、章、關、區與店家的行、店、坊、社，黏著前面的詞（一次性、流量類、每一元、一年內、為零時、報表上、投資人、延伸區、
//   對得起來、這一章、第一關、機車行、水族店）；黏上之後最多 5 個字。
// 單位：
// - 頓號後面的列舉項目整個不拆（「、產業差異、」「、資本支出、」），最多 6 個字；
// - 會計的中心詞（權益、盈餘、負債、比率、倍數、恆等式……）黏著前面的詞（股東權益、每股盈餘、流動負債、權益倍數、會計恆等式）。
//   這份清單只決定斷行，不是名詞資料，不會出現在畫面上；漏列的組合最多只是在兩個詞之間換行，不會斷在詞的中間；
// - 最後一個單位不到 4 個字時，往前併到至少 4 個字（最多 7 個），最後一行不會只剩「什麼」「交易」兩個字；
// - 最後，只有一個字（不是連接詞）的單位併進後面的單位（出現在、分清楚、叫借方；Segmenter 把「會出現在」切成「會|出|現在」，
//   375 的摘要斷成「會出／現在」），放不下時不併，不搶走中心詞與句尾的單位。前面有開引號的也一樣（「有賺錢、「算不出來」，
//   不在引號裡的第一個字後面斷）。
// 不是中文（英文介面）或瀏覽器沒有 Segmenter 時回傳 undefined，照原字顯示。

const HAN = /\p{Script=Han}/u;
const HAN_G = /\p{Script=Han}/gu;
const OPEN = '「『“‘（(［[【〈《';
const CLOSE = '」』”’）)］]】〉》，。、：；？！,.:;?!…%';
const CONNECTORS = '的與和及或之占並';
/** 助詞：黏著前面的詞（成立的、清楚地、看得、走錯了、寫著），不落在行首（第 9 輪 handoff：了、著和說明頁 prose-units 的 SUFFIXES 同一組，時在下面的 SUFFIXES；「過」不放：章節文字裡常是動詞，「把分錄過到 T 字帳」） */
const PARTICLES = '的地得了著';
/** Segmenter 把「的」切在詞的開頭時（的是、的話）拆下來；「的確」是副詞，照原樣 */
const LEADING_DE = /^的(?!確)\p{Script=Han}+$/u;
/** 開頭的開引號、開括號 */
const LEADING_OPEN = /^[「『“‘（(［[【〈《]+/u;
const PREFIXES = '未非不沒無每總';
/** 否定詞：Segmenter 把它切在前一個詞的尾巴（是不|計分、也不|影響）時拆下來，改黏著後面的詞 */
const NEGATIONS = '不沒未';
const SUFFIXES = '性率額類者們度化元筆張個層列期天年種條段內時上人來章關區行店坊社';
/** 會計的中心詞：前面接一個詞時一起換行 */
const HEADS = new Set([
  '權益',
  '盈餘',
  '負債',
  '資產',
  '資本',
  '比率',
  '倍數',
  '利益',
  '淨利',
  '成本',
  '費用',
  '收入',
  '支出',
  '流量',
  '帳款',
  '款項',
  '存貨',
  '能力',
  '公積',
  '股利',
  '借款',
  '恆等式',
  '週轉率',
  '報酬率',
  '活動',
  '槓桿度',
  '結構',
  '人員',
]);
/**
 * 名詞：名詞資料（content/terms）的中文名稱、教材用語、現行用語與別名裡，出現在章節摘要、學習目標或徽章名的。
 * 兩個字的多半本來就是 Segmenter 的詞，只列它切錯的（分錄、過帳）；8 個字以上的（長期資金占固定資產比率）靠裡面的短名詞與中心詞。
 * 這份清單只決定斷行，不是名詞資料，不會出現在畫面上。test/chapter-prose.test.ts 讀 content 的名詞、章節與學習目標原始檔：
 * 名詞資料裡的名稱只要出現在章節散文、卻被切在兩個詞（6、7 個字是兩個單位）裡，測試就失敗並列出要補進來的名稱。
 */
const TERMS =
  '分錄|過帳|勾稽點|本益比|純益率|損益表|人均營收|允當比率|本期淨利|本期進貨|每股盈餘|固定資產|股東權益|信用交易|流動比率|流動負債|負債比率|' +
  '財務槓桿|現金流量|期末存貨|期初存貨|稅前利益|稅前淨利|經常利益|資本公積|資本支出|實收資本|銷貨成本|應付帳款|應收帳款|營業毛利|營業成本|' +
  '營業利益|營業活動|籌資活動|權益倍數|T 字帳|未分配盈餘|再投資比率|利害關係人|財務槓桿度|現金流量表|會計恆等式|資產負債表|資產週轉率|' +
  '營運槓桿度|利息保障倍數|現金流量比率|負債與股東權益|資本公積÷股本|應付款項週轉率';
/** 連續單字黏成一個詞最多幾個字；一般單位最多幾個漢字；句尾的單位最多幾個、至少幾個 */
const MAX_LONE_RUN = 4;
/** 詞最多幾個漢字（字頭、字尾黏上之後；Segmenter 的詞本身最長是「資產負債表」5 個字） */
const MAX_PIECE_HAN = 5;
const MAX_HAN = 6;
const TAIL_MAX_HAN = 7;
const TAIL_MIN_HAN = 4;

type Kind = 'open' | 'close' | 'space' | 'sym' | 'latin' | 'han';
interface Atom {
  readonly text: string;
  readonly kind: Kind;
  /** 漢字數 */
  readonly han: number;
  /** 名詞（TERMS）：窄欄裡再依 Segmenter 的小詞斷 */
  readonly term?: true;
}
interface Group {
  atoms: Atom[];
  han: number;
  /** 在原字串裡的起點（UTF-16） */
  start: number;
  /** 不含名詞的長詞裡，窄欄可以斷的位置（atoms 的索引）：開引號後面的第一個字和後面的詞之間（「算｜不出來」） */
  cuts?: number[];
}

/** 一個詞：依序接起來的小詞。多半只有一個；超過 4 個字寬的名詞是幾個小詞（本期｜淨利、），窄欄只在小詞之間斷 */
export type ProsePiece = readonly string[];
/** 一個斷行單位：依序接起來的詞；單位與單位之間、詞與詞之間（窄欄裡長詞的小詞之間）才能換行 */
export type ProseUnit = readonly ProsePiece[];

let segmenter: Intl.Segmenter | null | undefined;
const cache = new Map<string, readonly ProseUnit[] | null>();
/** 名詞依漢字數分兩組：一個詞（MAX_PIECE_HAN 以內）與一個單位（TAIL_MAX_HAN 以內） */
let lexicon: { words: Set<string>; units: Set<string>; maxLen: number } | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    try {
      segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;
    } catch {
      segmenter = null;
    }
  }
  return segmenter;
}

const hanCount = (s: string) => s.match(HAN_G)?.length ?? 0;
const textOf = (g: Group) => g.atoms.map((a) => a.text).join('');
const isLone = (a: Atom) => a.kind === 'han' && a.text.length === 1;
const isWord = (a: Atom) => a.kind === 'han' && a.text.length > 1;
const isParticle = (a: Atom) => isLone(a) && PARTICLES.includes(a.text);

/** 助詞黏得上前一個詞嗎：不含名詞的詞黏上之後最多 MAX_PIECE_HAN 個字、6 個字寬（是不計分的、「沒現金」的、「算不出來」的；
 *  開頭的開引號不算，ChapterProse 把它放在 span 外面），含名詞的詞最多 MAX_PIECE_HAN + 1 個字（資產負債表的，窄欄在小詞之間斷：
 *  資產｜負債表的）；gap 是中間空格的字寬 */
function particleFits(p: Group, gap = 0): boolean {
  if (p.atoms.some((a) => a.term)) return p.han + 1 <= MAX_PIECE_HAN + 1;
  return p.han + 1 <= MAX_PIECE_HAN && emWidth(textOf(p).replace(LEADING_OPEN, '')) + gap + 1 <= 6;
}

function getLexicon() {
  if (!lexicon) {
    lexicon = { words: new Set(), units: new Set(), maxLen: 0 };
    for (const t of TERMS.split('|')) {
      const han = hanCount(t);
      (han <= MAX_PIECE_HAN ? lexicon.words : lexicon.units).add(t);
      lexicon.maxLen = Math.max(lexicon.maxLen, t.length);
    }
  }
  return lexicon;
}

/** 由左往右找最長的名詞，回傳 [起點, 終點)（UTF-16；名詞都是 BMP 的字） */
function termSpans(text: string, terms: ReadonlySet<string>, maxLen: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < text.length;) {
    let len = Math.min(maxLen, text.length - i);
    while (len >= 2 && !terms.has(text.slice(i, i + len))) len--;
    if (len >= 2) {
      out.push([i, i + len]);
      i += len;
    } else i++;
  }
  return out;
}

/** 名詞先切出來（一個名詞一個 atom），名詞之間的字交給 Segmenter */
function atomsOf(text: string, seg: Intl.Segmenter): Atom[] {
  const out: Atom[] = [];
  const { words, maxLen } = getLexicon();
  let at = 0;
  for (const [s, e] of termSpans(text, words, maxLen)) {
    if (s > at) segmentInto(out, text.slice(at, s), seg);
    const term = text.slice(s, e);
    out.push({ text: term, kind: 'han', han: hanCount(term), term: true });
    at = e;
  }
  if (at < text.length) segmentInto(out, text.slice(at), seg);
  return out;
}

function segmentInto(out: Atom[], text: string, seg: Intl.Segmenter): void {
  for (const s of seg.segment(text)) {
    if (s.isWordLike) {
      const han = hanCount(s.segment);
      const neg = han === s.segment.length && han >= 2 && NEGATIONS.includes(s.segment.at(-1)!);
      if (neg) {
        out.push({ text: s.segment.slice(0, -1), kind: 'han', han: han - 1 }, { text: s.segment.at(-1)!, kind: 'han', han: 1 });
      } else if (LEADING_DE.test(s.segment)) {
        out.push({ text: '的', kind: 'han', han: 1 }, { text: s.segment.slice(1), kind: 'han', han: han - 1 });
      } else out.push({ text: s.segment, kind: han > 0 ? 'han' : 'latin', han });
      continue;
    }
    if (/^\s+$/u.test(s.segment)) {
      out.push({ text: s.segment, kind: 'space', han: 0 });
      continue;
    }
    // 標點與符號逐字看（Segmenter 有時把「），」切成一段）
    for (const ch of s.segment) {
      if (OPEN.includes(ch)) out.push({ text: ch, kind: 'open', han: 0 });
      else if (CLOSE.includes(ch)) out.push({ text: ch, kind: 'close', han: 0 });
      else if (/\s/u.test(ch)) out.push({ text: ch, kind: 'space', han: 0 });
      else if (HAN.test(ch)) out.push({ text: ch, kind: 'han', han: 1 });
      else out.push({ text: ch, kind: 'sym', han: 0 });
    }
  }
}

/** 詞的內部：a 和 b 之間不換行（標點、符號、拉丁字母，以及相鄰的單字） */
function sameWord(a: Atom, b: Atom): boolean {
  if (a.kind === 'space' || b.kind === 'space') return false;
  if (a.kind === 'open' || b.kind === 'close') return true;
  // 符號黏著前面（步驟①、資產＝）；後面接拉丁字母或數字時也黏著後面（N/A、NT$1,200）
  if (b.kind === 'sym') return true;
  // 助詞黏著前面的詞、閉括號、符號或拉丁字母（成立的、「開店了」的、步驟①到⑤的）
  if (isParticle(b)) return true;
  if (a.kind === 'sym') return b.kind === 'latin';
  if (a.kind === 'close' || b.kind === 'open') return false;
  if (a.kind === 'latin' || b.kind === 'latin') return true;
  if (isLone(a) && isLone(b)) return !CONNECTORS.includes(a.text) && !CONNECTORS.includes(b.text);
  if (isLone(a)) return PREFIXES.includes(a.text) && isWord(b);
  if (isLone(b)) return SUFFIXES.includes(b.text);
  return false;
}

/** 單位的內部：前一個詞的最後一個 atom a 和後一個詞的第一個 atom b 之間不換行（會計的中心詞） */
function sameUnit(a: Atom, b: Atom): boolean {
  return isWord(a) && isWord(b) && HEADS.has(b.text);
}

/** 頓號後面的列舉項目（「、產業差異、」「、一次性損益）」）到下一個標點為止整個不拆，最多 MAX_HAN 個字：
 *  回傳要黏著前一個詞的詞的位置 */
function listItemJoins(pieces: readonly Group[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i]!.atoms.at(-1)!.text !== '、') continue;
    let han = 0;
    let j = i + 1;
    for (; j < pieces.length; j++) {
      const p = pieces[j]!;
      if (p.atoms.some((a) => a.kind === 'space' || a.kind === 'open')) break;
      han += p.han;
      if (p.atoms.at(-1)!.kind === 'close') break;
    }
    if (j < pieces.length && j > i + 1 && han <= MAX_HAN && pieces[j]!.atoms.at(-1)!.kind === 'close') for (let k = i + 2; k <= j; k++) out.add(k);
  }
  return out;
}

/** 詞裡的小詞：超過 4 個字寬、含名詞的詞，名詞照 Segmenter 再切開，標點、字頭字尾照 sameWord 黏著（本期淨利、→ 本期｜淨利、）；
 *  Segmenter 整個不切的 4、5 個字名詞從第 2 個字後切開（資產｜負債表、期初｜存貨、營業｜毛利）；
 *  不含名詞的詞只在 cuts 的位置切開（「算｜不出來」） */
function subWords(p: Group, seg: Intl.Segmenter): ProsePiece {
  const text = textOf(p);
  if (emWidth(text) <= 4) return [text];
  if (!p.atoms.some((a) => a.term)) {
    if (!p.cuts) return [text];
    const parts = [''];
    for (const [i, a] of p.atoms.entries()) {
      if (p.cuts.includes(i)) parts.push('');
      parts[parts.length - 1] += a.text;
    }
    return parts;
  }
  const atoms: Atom[] = [];
  for (const a of p.atoms) {
    if (!a.term) {
      atoms.push(a);
      continue;
    }
    const inner: Atom[] = [];
    segmentInto(inner, a.text, seg);
    // 整個名詞黏成一個小詞（Segmenter 不切的「資產負債表」「期初存貨」，或「利害關係|人」的「人」又黏回去）時從第 2 個字後切開
    if (a.han >= 4 && inner.every((b, i) => i === 0 || sameWord(inner[i - 1]!, b)))
      atoms.push({ text: a.text.slice(0, 2), kind: 'han', han: 2 }, { text: a.text.slice(2), kind: 'han', han: a.han - 2 });
    else atoms.push(...inner);
  }
  const out: string[] = [];
  for (const [i, a] of atoms.entries()) {
    const prev = atoms[i - 1];
    if (prev && sameWord(prev, a)) out[out.length - 1] += a.text;
    else out.push(a.text);
  }
  return out;
}

/** 字串大約幾個字寬（漢字與全形標點 1、拉丁字母與數字 0.55） */
export function emWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0)! < 0x300 ? 0.55 : 1;
  return w;
}

/** 切成斷行單位，每個單位是幾個詞（依序接起來就是原字串）。不是中文或沒有 Segmenter 時回傳 undefined */
export function proseUnits(text: string): readonly ProseUnit[] | undefined {
  if (!HAN.test(text)) return undefined;
  const hit = cache.get(text);
  if (hit !== undefined) return hit ?? undefined;
  const seg = getSegmenter();
  let result: ProseUnit[] | null = null;
  if (seg) {
    // 第一層：詞
    const pieces: Group[] = [];
    let prev: Atom | undefined;
    let pos = 0;
    const atoms = atomsOf(text, seg);
    /** 拉丁字母後面空一格接助詞（ROA 的）：空格黏著前面的詞，助詞再黏上來，不斷成「ROA／的」 */
    let spaced = false;
    for (const [i, atom] of atoms.entries()) {
      const last = pieces.at(-1);
      // 單字只和單字連成一串（「能變現」，不接在「一年內」這種詞後面），最多 MAX_LONE_RUN 個；字頭、字尾黏上之後最多 MAX_PIECE_HAN 個字
      const loneOnly = last !== undefined && last.atoms.every((a) => a.kind !== 'han' || isLone(a));
      // 助詞不受這兩條限制，改看 particleFits（一年內的、股東權益的）
      const particle = isParticle(atom);
      const loneRun = !particle && prev !== undefined && isLone(prev) && isLone(atom) && (!loneOnly || last!.han + 1 > MAX_LONE_RUN);
      const tooLong = last !== undefined && (particle ? !particleFits(last) : last.han + atom.han > MAX_PIECE_HAN);
      const next = atoms[i + 1];
      const glue = spaced && particle;
      // 開引號後面只有一個字時接著後面的詞（「有｜賺錢 → 「有賺錢、「算｜不出來」 → 「算不出來」），不斷在引號裡的第一個字後面
      const quoteHead =
        last !== undefined &&
        isWord(atom) &&
        prev !== undefined &&
        isLone(prev) &&
        last.atoms.length >= 2 &&
        last.atoms.slice(0, -1).every((a) => a.kind === 'open');
      spaced =
        atom.kind === 'space' &&
        prev !== undefined &&
        prev.kind !== 'space' &&
        next !== undefined &&
        isParticle(next) &&
        particleFits(last!, emWidth(atom.text));
      if (last && prev && (glue || spaced || quoteHead || sameWord(prev, atom)) && !loneRun && !tooLong) {
        if (quoteHead) (last.cuts ??= []).push(last.atoms.length);
        last.atoms.push(atom);
        last.han += atom.han;
      } else pieces.push({ atoms: [atom], han: atom.han, start: pos });
      prev = atom;
      pos += atom.text.length;
    }
    // 第二層：單位（漢字不超過 MAX_HAN；6、7 個字的名詞裡的詞合成一個單位，不超過 TAIL_MAX_HAN）
    const items = listItemJoins(pieces);
    const { units: longTerms, maxLen } = getLexicon();
    const spans = termSpans(text, longTerms, maxLen);
    // 詞和名詞有重疊就算在名詞裡（「「資本公積÷」的引號在名詞外面）
    const spanOf = (p: Group) => spans.findIndex(([s, e]) => p.start < e && p.start + textOf(p).length > s);
    const units: { pieces: Group[]; han: number }[] = [];
    for (const [i, p] of pieces.entries()) {
      const last = units.at(-1);
      const inTerm = last !== undefined && spanOf(p) >= 0 && spanOf(p) === spanOf(last.pieces.at(-1)!);
      // 名詞後面黏著的助詞不算字數（應付款項｜週轉率的 仍是一個單位）
      const tail = isParticle(p.atoms.at(-1)!) ? 1 : 0;
      const join =
        last !== undefined &&
        (inTerm
          ? last.han + p.han - tail <= TAIL_MAX_HAN
          : (items.has(i) || sameUnit(last.pieces.at(-1)!.atoms.at(-1)!, p.atoms[0]!)) && last.han + p.han <= MAX_HAN);
      if (join) {
        last.pieces.push(p);
        last.han += p.han;
      } else units.push({ pieces: [p], han: p.han });
    }
    // 句尾：最後一個單位不到 TAIL_MIN_HAN 個字時往前併（中間是空白或前一個單位以標點結尾時不併）
    while (units.length >= 2) {
      const last = units.at(-1)!;
      const before = units.at(-2)!;
      if (last.han >= TAIL_MIN_HAN || last.han === 0) break;
      const edge = before.pieces.at(-1)!.atoms.at(-1)!;
      if (edge.kind !== 'han' && edge.kind !== 'latin') break;
      if (before.han + last.han > TAIL_MAX_HAN) break;
      before.pieces.push(...last.pieces);
      before.han += last.han;
      units.pop();
    }
    // 只有一個字（不是連接詞）的單位併進後面的單位：會|出|現在 → 出現在（Segmenter 把「出現在」切成「出|現在」）、分清楚、叫借方、
    // 是|不計分 → 是不計分。放在中心詞與句尾之後，不搶走「實收資本比率」「稅前淨利當起點」這類單位
    for (let k = units.length - 2; k >= 0; k--) {
      const u = units[k]!;
      const next = units[k + 1]!;
      // 前面可以有開引號、開括號（「有｜賺錢 → 「有賺錢、「算｜不出來」 → 「算不出來」）
      const atomsOf1 = u.pieces.length === 1 ? u.pieces[0]!.atoms : [];
      const only = atomsOf1.length >= 1 && atomsOf1.slice(0, -1).every((a) => a.kind === 'open') ? atomsOf1.at(-1)! : undefined;
      const max = k + 1 === units.length - 1 ? TAIL_MAX_HAN : MAX_HAN;
      if (!only || !isLone(only) || CONNECTORS.includes(only.text) || next.pieces[0]!.atoms[0]!.kind !== 'han' || u.han + next.han > max) continue;
      next.pieces.unshift(...u.pieces);
      next.han += u.han;
      units.splice(k, 1);
    }
    if (units.length >= 2) result = units.map((u) => u.pieces.map((p) => subWords(p, seg)));
  }
  cache.set(text, result);
  return result ?? undefined;
}
