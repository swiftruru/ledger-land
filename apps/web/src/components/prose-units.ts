// 中文的「不斷開的單位」（M3 驗收第 7 輪，pages-b）。全站預設是逐字換行（word-break: normal、line-break: strict、text-wrap: pretty，
// web-ui 的 03-core-utils.css）：每行排滿、句號逗號不落在行首，但詞會被拆在兩行（「加入主／畫面」「進度消／失」）。
// 這裡決定哪些字要整塊不斷：Intl.Segmenter 切出的兩字以上中文詞；被切成單字的實詞黏到相鄰的中文（「主畫面」「備份碼」「錯題本」「貼上」）；
// 引號裡的短介面名稱整個不斷（「匯出到 App」「掃描課堂 QR」）。單字的虛詞（都、讓、的、後）與標點前後照常可以換行，所以每行最多短一個詞。
// 和 web-ui 的 phraseParts（Phrased、名詞卡名稱）的差別：phraseParts 連虛詞也黏在前後的詞上，給短說明句與名稱用；
// 長段落黏成長串時 375 寬每行平均只排到 85%，這裡的單位比較細（實測 93% 以上，.local-reports/m3-final/pages-b/r7/probe-wrap.mts）。
// 兩種用法：
// - 懶載入的頁面（說明頁、安裝圖解、實驗室）：ProseWords.tsx 在畫面上把單位包成 span.ll-nowrap。
// - 首次載入的橫幅（不能多帶切詞的程式，/en/ 首次載入 JS 已到預算上限）：joinWords 在中文訊息裡事先插入看不見的 U+2060（word joiner），
//   空格換成不斷行空格（U+00A0）。英文訊息不動。單元測試（test/prose-units.test.ts）檢查這些訊息和 joinWords 的結果一致，改字後照錯誤訊息貼上。
// 一個單位超過 6 個字（引號裡的名稱是 8 個字寬）就不整塊（照逐字換行），窄欄或放大字級時不會撐破版面。
// 第 8 輪：否定詞「不」「沒」「未」「別」黏到後面的詞（隱私說明 1280 的「只有不／收集個資」），前面照常可以換行，行尾不會停在否定詞；
// 前面是單字的動詞時也黏上（「存不進去」「看不到」）。說明文字直接提到、沒有加引號的按鈕名稱（UNQUOTED_NAMES）和引號名稱一樣整塊不斷
// （匯入提示卡 320 的「選擇／備份檔」）。
// 第 9 輪：助詞與後置詞（SUFFIXES：的、地、得、了、著、過、嗎、呢、吧、啊、時）黏到前面的詞，後面照常可以換行，行首不會是「的」「了」「時」；
// 前面是英文（「Safari 的」）或閉引號、閉括號（「匯出到 App」的）時一起黏上。「也」和否定詞一樣黏到後面的詞（聲明卡 1280 的行尾「章節也／一樣」），
// 但不往前黏。Segmenter 把助詞和下一個字切成一個詞的（NOT_WORDS：「的是」「了一」）先拆開。
// 第 9 輪 handoff：「每」「最」和「也」一樣黏到後面的詞（關卡面板學習目標的「每／一層」「最／底下是」）；單字的動詞接「不」開頭的詞時
// 拆回去也黏著（「本益比算／不出來」）；Segmenter 切成兩個單字的會計用語（web-ui phrase.ts 的 KNOWN_WORDS，名詞卡名稱同一份：「沖減」「營收」「籌資」）先併成一個詞（「採沖／減」「衝營／收」）。
// SUFFIXES 與 NOT_WORDS 也給名詞頁的 term-page/prose.ts 用（同一組，不各寫一份）。

// 只匯入切詞的小模組（不經過 web-ui 的總入口，單元測試與 prose chunk 不必載入元件）
import { KNOWN_WORDS } from '@ledgerland/web-ui/phrase';

const HAN = /[⺀-鿿豈-﫿]/;
/** 單字的虛詞（介詞、連詞、副詞、代名詞）：前後都可以換行，不黏在相鄰的詞上 */
const PARTICLES = '是在都就和與及或把被讓從到會要很更再又還才只能可這那你我他她它有為對給跟向而並但卻所以之於後前等各該將如若因占其此且由';
/** 單字的助詞與後置詞：黏到前面的詞（行首不是「的」），後面可以換行（第 9 輪） */
export const SUFFIXES = '的地得了著過嗎呢吧啊時';
/** 黏到後面的詞（行尾不停在「不」「也」「每」「最」），前面可以換行 */
const PREFIXES = '不沒未別也每最';
/** 其中的否定詞：前面是單字的實詞時也黏上（「存不進去」）；「也」不往前黏 */
const NEGATIONS = '不沒未別';
/** 助詞前面可以一起黏上的閉引號、閉括號與英文字（「匯出到 App」的、Safari 的） */
const CLOSERS = /^[」』）)]$/;
const LATIN = /^[A-Za-z0-9]/;
/** 說明文字直接提到的按鈕名稱（沒有加引號，和下面的按鈕同名）：整塊不斷，和引號名稱同一種處理 */
const UNQUOTED_NAMES = ['貼上備份碼', '選擇備份檔'];
/** 超過這個字數的單位不整塊保護（照逐字換行） */
const MAX_UNIT = 6;
/** 引號裡的介面名稱：中文字與 U+2400 以上的全形符號（全形括號、圈號數字）算 1、其他字算 0.55，8 個字寬以內整個不斷
 *  （第 8 輪：「步驟③（勾稽點 C）」原本量成 7.75，畫面上約 9 個字寬） */
const MAX_QUOTED_EM = 8;
const NAMES = new RegExp(`「[^「」]{1,16}」|${UNQUOTED_NAMES.join('|')}`, 'g');
export const WORD_JOINER = '⁠';

type Kind = 'word' | 'single' | 'particle' | 'prefix' | 'suffix' | 'other';
export type ProseUnit = [text: string, keep: boolean];

let segmenter: Intl.Segmenter | null | undefined;
const cache = new Map<string, readonly ProseUnit[] | null>();

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

const emWidth = (s: string) => [...s].reduce((w, ch) => w + (ch >= '\u2400' ? 1 : 0.55), 0);

/** 後面的中文要黏上來：單字的否定詞，或 Segmenter 切成一個詞、結尾是否定詞的副詞（「也不」「並不」「還沒」「尚未」） */
const NEG_END = /[不沒未]$/;
const NEG_HEAD = /^[不沒未]/;
const sticky = (text: string, kind: Kind) => kind === 'prefix' || (kind === 'word' && NEG_END.test(text));

/** Segmenter 把助詞和後面的字切成一個詞、但其實不是詞的（「沿用的是」「列了一長串」「用到時會」）：拆成助詞與後面的字，助詞黏回前面的詞 */
export const NOT_WORDS: ReadonlySet<string> = new Set(['的是', '了一', '時會', '時計']);

function* segments(seg: Intl.Segmenter, text: string): Generator<{ segment: string; isWordLike: boolean }> {
  const all = [...seg.segment(text)];
  for (let i = 0; i < all.length; i++) {
    const { segment, isWordLike = false } = all[i]!;
    const pair = segment + (all[i + 1]?.segment ?? '');
    if (isWordLike && pair.length === 2 && KNOWN_WORDS.has(pair)) {
      yield { segment: pair, isWordLike };
      i++;
    } else if (isWordLike && NOT_WORDS.has(segment)) {
      yield { segment: segment[0]!, isWordLike };
      yield { segment: segment.slice(1), isWordLike };
    } else yield { segment, isWordLike };
  }
}

/** 一段沒有引號名稱的文字切成單位；afterName：前面緊接著引號名稱（out 的最後一個單位），開頭的助詞黏到名稱上（「匯出到 App」的） */
function wordUnits(seg: Intl.Segmenter, text: string, out: ProseUnit[], afterName = false): void {
  // 單字的實詞黏到相鄰的中文：「加入」「主」「畫面」→「加入主畫面」、「錯」「題」「本」→「錯題本」、「貼」「上」→「貼上」。
  // 前面的虛詞不黏上來，助詞黏到前面的詞（「瀏覽的／頁面路徑」可以在「的」後面斷，不會黏成「的頁面路徑」，也不會排成「瀏覽／的頁面」）。
  // 否定詞與「也」黏到後面的任何中文（「不收集」「不把」「也一樣」），否定詞前面只黏單字（「存不進去」）；
  // 前面是兩字以上的詞或虛詞時可以斷（「只有／不收集」「它／不使用」）
  const groups: { text: string; kind: Kind }[][] = [];
  let prev: Kind | undefined;
  let prevText = '';
  let prevSticky = false;
  for (const { segment, isWordLike } of segments(seg, text)) {
    const kind: Kind =
      !isWordLike || !HAN.test(segment)
        ? 'other'
        : segment.length >= 2
          ? 'word'
          : PREFIXES.includes(segment)
            ? 'prefix'
            : SUFFIXES.includes(segment)
              ? 'suffix'
              : PARTICLES.includes(segment)
                ? 'particle'
                : 'single';
    let glue = false;
    if (prev === undefined) {
      if (afterName && kind === 'suffix' && out.length) {
        out[out.length - 1]![0] += segment;
        prev = 'other';
        prevText = segment;
        continue;
      }
    } else if (kind === 'suffix') {
      // 助詞黏到前面的中文、閉引號、閉括號或英文字；「Safari 的」連同中間的空格（橫幅訊息裡是不斷行空格）
      if (prev !== 'other' || CLOSERS.test(prevText) || LATIN.test(prevText)) glue = true;
      else if (/^[ \u00a0]$/.test(prevText) && groups.length >= 2) {
        const before = groups[groups.length - 2]!;
        if (before.length === 1 && before[0]!.kind === 'other' && LATIN.test(before[0]!.text)) {
          before.push(...groups.pop()!);
          glue = true;
        }
      }
    } else if (prev !== 'other' && kind !== 'other') {
      glue =
        prevSticky ||
        (kind === 'prefix'
          ? prev === 'single' && NEGATIONS.includes(segment)
          : kind === 'single'
            ? prev !== 'particle' && prev !== 'suffix'
            : prev === 'single');
    }
    const last = groups[groups.length - 1];
    if (last && glue) last.push({ text: segment, kind });
    else groups.push([{ text: segment, kind }]);
    prev = kind;
    prevText = segment;
    prevSticky = sticky(segment, kind);
  }
  // 黏起來超過 6 個字寬（「我列了一長串問題」）就拆回原本的片段：兩字以上的詞仍整塊，單字前後可以斷，
  // 否定詞仍黏著後面那一段、助詞仍黏著前面那一段。結尾的助詞不算在 6 個字裡（「說明裡寫清楚了」「基本功練起來吧」整塊），
  // 和英文或閉引號黏在一起的助詞整組不拆
  for (const group of groups) {
    const joined = group.map((g) => g.text).join('');
    const width = emWidth(joined) - (group[group.length - 1]!.kind === 'suffix' ? 1 : 0);
    if (group.length > 1 && (width <= MAX_UNIT || group.some((g) => g.kind === 'other'))) {
      out.push([joined, true]);
      continue;
    }
    for (let i = 0; i < group.length; i++) {
      const g = group[i]!;
      const next = group[i + 1];
      // 黏到後面的：否定詞與「也」「每」「最」，以及單字的動詞接「不」開頭的詞（「算不出來」「看不到」）
      if (next && (sticky(g.text, g.kind) || (g.kind === 'single' && NEG_HEAD.test(next.text))) && g.text.length + next.text.length <= MAX_UNIT) {
        out.push([g.text + next.text, true]);
        i++;
      } else if (i > 0 && g.kind === 'suffix') {
        const last = out[out.length - 1]!;
        last[0] += g.text;
        last[1] = true;
      } else out.push([g.text, g.kind === 'word' && g.text.length <= MAX_UNIT]);
    }
  }
}

/** 字串切成 [文字, 是否整塊不斷] 的單位；不是中文或沒有 Segmenter 時回 null */
export function proseUnits(text: string): readonly ProseUnit[] | null {
  if (!HAN.test(text)) return null;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const seg = getSegmenter();
  let units: ProseUnit[] | null = null;
  if (seg) {
    const raw: ProseUnit[] = [];
    let at = 0;
    for (const m of text.matchAll(NAMES)) {
      if (m[0].startsWith('「') && emWidth(m[0].slice(1, -1)) > MAX_QUOTED_EM) continue;
      // at > 0：這段緊接在上一個引號名稱後面
      if (m.index > at) wordUnits(seg, text.slice(at, m.index), raw, at > 0);
      raw.push([m[0], true]);
      at = m.index + m[0].length;
    }
    if (at < text.length) wordUnits(seg, text.slice(at), raw, at > 0);
    // 相鄰的可斷單位併成一段文字，少一點節點
    units = [];
    for (const u of raw) {
      const last = units[units.length - 1];
      if (last && !last[1] && !u[1]) last[0] += u[0];
      else units.push(u);
    }
    if (!units.some((u) => u[1])) units = null;
  }
  cache.set(text, units);
  return units;
}

/** 漢字（不含中文標點）；前面是英文字或閉括號時也插 U+2060（「Safari的」「）的」，瀏覽器在這兩種字之間可以換行） */
const IDEOGRAPH = /\p{Script=Han}/u;
const JOIN_AFTER = /[A-Za-z0-9）)]/;

/** 首次載入的橫幅訊息用：整塊不斷的單位裡，相鄰的兩個中文字之間插入 U+2060、空格換成 U+00A0（已經處理過的字先還原再算） */
export function joinWords(text: string): string {
  const plain = text.replaceAll(WORD_JOINER, '');
  const units = proseUnits(plain);
  if (!units) return plain;
  return units
    .map(([t, keep]) => {
      if (!keep) return t;
      let out = '';
      const chars = [...t.replace(/ /g, ' ')];
      chars.forEach((ch, i) => {
        const before = chars[i - 1];
        if (before && HAN.test(ch) && (HAN.test(before) || (IDEOGRAPH.test(ch) && JOIN_AFTER.test(before)))) out += WORD_JOINER;
        out += ch;
      });
      return out;
    })
    .join('');
}
