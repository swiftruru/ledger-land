// 中文的詞切分（Intl.Segmenter）：名詞卡的名稱（GlossaryItem）與 apps/web 的說明句（features/me/Phrased.tsx）共用。
// 獨立成一個小模組：設定、備份頁只用到切詞，不必載入整個名詞卡（M3 驗收第 6 輪 handoff）。
export const OPEN_QUOTES = '「『“‘（(';
export const CLOSE_QUOTES = '」』”’）)';

const CJK = /[⺀-鿿豈-﫿]/;
let segmenter: Intl.Segmenter | null | undefined;
const phraseCache = new Map<string, readonly string[] | null>();

/** 單字的連接詞：前後都可以斷（「長期資金占／固定資產比率」「期末現金及／約當現金餘額」）；「的」例外，見 PARTICLE_HEAD */
const CONNECTORS = '及與和或的之占';
/** 「的」不落在行首，前面一律不斷、後面照連接詞可以斷（M3 收尾：「而持有／的有形資產」改成「而持有的／有形資產」）。
 *  也包括 Segmenter 把「的」和下一個字切成一段的（「沿用／的是」）、前面是英文或閉引號的（「repo 的」「」的」）；「的確」是詞，照常。
 *  「地」「得」不是連接詞，單字本來就黏著前後 */
const PARTICLE_HEAD = /^的(?!確)/;
const isLoneHan = (s: string) => s.length === 1 && CJK.test(s) && !CONNECTORS.includes(s);

/** 貨幣與正負號後面不斷：Segmenter 把「NT$1,200」切成 NT、$、1,200，「$」不是詞，原本會被當成可以斷的標點 */
const STICKY_SYMBOL = /[\p{Sc}+±#]$/u;
/** 不換行的空白（U+00A0、U+202F）與字元連接符（U+2060）黏著前後：Segmenter 把它切成獨立一段，原本會在它和「題」之間放 <wbr>
 *  （M3 驗收第 7 輪：「今天要複習 1／題」） */
const GLUE = /[\u00A0\u202F\u2060]/;
/** 否定詞黏著後面的詞（第 7 輪：「也不」是一個詞，原本會排成「也不／影響星星」，讀起來像「也不」單獨一句）。
 *  和 apps/web 的 prose-units.ts 同一組：單字的「不」「沒」「未」「別」，或結尾是「不」「沒」「未」的詞（「也不」「還沒」「尚未」）；
 *  「類別」「特別」不算 */
const NEGATION = /[不沒未]$|^別$/;
/** 單字的介詞與連詞「在」「從」「而」（以及單字的否定詞，和 prose-units 同一條：「只是／不唸出來。」）：前面可以斷、黏著後面的詞
 *  （M3 收尾第 9 輪：「四個勾稽點／在哪裡」「資本公積／從哪裡來」）。
 *  原本單字一律黏著前後，整個標題黏成一塊，320 寬加 200% 字級時由 overflow-wrap 在行尾硬斷成「在哪／裡」「哪裡／來」。
 *  前面至少兩個字、後面還有中文時才斷（不留孤字） */
const HEADS = '在從而';
/** 單字的後置詞「後」「時」：黏著前面的詞、後面可以斷（第 9 輪：設定頁的「開啟後／作答頁顯示」，原本黏成八個字，硬斷成「作／答頁」）。
 *  連同「後」「時」至少三個字才斷：「稅後淨利」「期後事項」不拆 */
const TAILS = '後時';
/** 英數字與符號（不含空格）：前後都是時不斷（第 9 輪：「N/A」原本切成「N/」「A」；「NT$1,200」本來就靠 STICKY_SYMBOL） */
const ASCII = /[!-~]/;
/** Segmenter 切成兩個單字的會計用語：先併成一個詞（第 9 輪 handoff：名詞卡 320 加 200% 的「籌資活動的」黏成五個字、硬斷成「籌資活動／的」，
 *  併起來之後斷成「籌資／活動的」）。apps/web 的 prose-units.ts 也用這一份。「公積」「約當」不放：它們接在前一個詞後面（資本公積、約當現金），
 *  併成詞反而多一個斷點（「資本／公積」「約當／現金」），單字黏著前後時本來就整塊 */
export const KNOWN_WORDS: ReadonlySet<string> = new Set('沖減 營收 籌資 賒銷 賒購 攤銷 勾稽 權責 淨額 銷管 收現 付現 過帳 預收 應計'.split(' '));
const isHanWord = (s: Intl.SegmentData | undefined) => s?.isWordLike === true && CJK.test(s.segment);
const hanCount = (s: string) => [...s].filter((ch) => CJK.test(ch)).length;

/** 兩個詞之間能不能斷：開括號前、頓號等標點後可以；兩個詞都是兩個字以上（或是連接詞）才可以。
 *  Segmenter 常把「約當」「權責」「增減」切成單字，單字一律黏著前後的詞，不從中間斷；貨幣符號和後面的數字、英數字串的中間不斷；
 *  不換行空白的前後、否定詞的後面、「的」的前面不斷；「的」後面只剩一個字時也不斷（第 9 輪：「小店的／帳」「誰的／錢」的孤字）。
 *  part 是目前這一段已經黏起來的字（HEADS、TAILS 用它判斷前面夠不夠長），next 是 cur 後面的那一段 */
function phraseBreak(prev: Intl.SegmentData, cur: Intl.SegmentData, next: Intl.SegmentData | undefined, part: string): boolean {
  if (GLUE.test(prev.segment.at(-1)!) || GLUE.test(cur.segment[0]!) || NEGATION.test(prev.segment) || PARTICLE_HEAD.test(cur.segment)) return false;
  if (OPEN_QUOTES.includes(cur.segment[0]!)) return true;
  if (ASCII.test(prev.segment.at(-1)!) && ASCII.test(cur.segment[0]!)) return false;
  if (!cur.isWordLike) return false;
  if (!prev.isWordLike) return !OPEN_QUOTES.includes(prev.segment.at(-1)!) && !STICKY_SYMBOL.test(prev.segment);
  if (prev.segment === '的' && isLoneHan(cur.segment) && !isHanWord(next)) return false;
  if (CONNECTORS.includes(prev.segment)) return true;
  if (CONNECTORS.includes(cur.segment)) return !isLoneHan(prev.segment);
  if ((HEADS.includes(cur.segment) || NEGATION.test(cur.segment)) && cur.segment.length === 1 && hanCount(part) >= 2 && isHanWord(next)) return true;
  if (TAILS.includes(prev.segment) && hanCount(part) >= 3 && CJK.test(cur.segment)) return true;
  return !isLoneHan(prev.segment) && !isLoneHan(cur.segment);
}

/** 詞尾的標點連同前一個字（「資產負債表：」的「表：」）：渲染時包成 .ll-nowrap，詞比一行寬、緊急換行時「：」「。」不會單獨落到下一行行首
 *  （第 9 輪 handoff：320 寬加 200% 的章名「資產負債表／：」、設定頁的「只是不唸出來／。」，現在斷成「資產負債／表：」）。沒有詞尾標點時回 undefined */
const PUNCT_TAIL = /^(.+)(.[：，、；。！？）」]+)$/u;
export const punctTail = (part: string): readonly [head: string, tail: string] | undefined => {
  const m = PUNCT_TAIL.exec(part);
  return m ? [m[1]!, m[2]!] : undefined;
};

/** 中文名稱切成詞（Intl.Segmenter）：名稱只在詞與詞之間斷行，配合 text-wrap: balance 排成「長期資金占／固定資產比率」，
 *  不切成「長期資金占固／定資產比率」或留下「比／率」的單字孤行。標點前與開括號後不斷；不支援 Segmenter 或不是中文時回 undefined（照一般斷行）。
 *  keep：整塊不拆的詞（例如名詞頁傳名詞自己的名稱與現行用語）：Segmenter 把「股東權益」切成「股東」「權益」兩個詞，這裡不在它們中間斷 */
export function phraseParts(text: string, keep?: readonly string[]): readonly string[] | undefined {
  if (!CJK.test(text)) return undefined;
  const key = keep?.length ? `${text}\u0000${keep.join('\u0000')}` : text;
  const hit = phraseCache.get(key);
  if (hit !== undefined) return hit ?? undefined;
  // keep 的詞在 text 裡出現的範圍：斷點落在範圍裡面時不斷
  const spans: [number, number][] = [];
  for (const w of keep ?? []) for (let i = w.length > 1 ? text.indexOf(w) : -1; i >= 0; i = text.indexOf(w, i + 1)) spans.push([i, i + w.length]);
  const inKeep = (at: number) => spans.some(([s, e]) => s < at && at < e);
  if (segmenter === undefined) {
    try {
      segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-Hant', { granularity: 'word' }) : null;
    } catch {
      segmenter = null;
    }
  }
  let parts: string[] | null = null;
  if (segmenter) {
    parts = [];
    const segs: Intl.SegmentData[] = [];
    for (const s of segmenter.segment(text)) {
      const last = segs.at(-1);
      if (last?.isWordLike && s.isWordLike && last.segment.length === 1 && s.segment.length === 1 && KNOWN_WORDS.has(last.segment + s.segment))
        segs[segs.length - 1] = { ...last, segment: last.segment + s.segment };
      else segs.push(s);
    }
    let depth = 0;
    segs.forEach((seg, i) => {
      const prev = segs[i - 1];
      // 括號與引號裡整段不斷，只有頓號、逗號後面可以斷（第 9 輪：320 加 200% 的章名「（獲利能力、償債能力）」整段放不進一行，硬斷時「、」單獨一行）
      if (prev !== undefined && (depth === 0 || /[、，]$/.test(prev.segment)) && !inKeep(seg.index) && phraseBreak(prev, seg, segs[i + 1], parts!.at(-1)!))
        parts!.push(seg.segment);
      else if (parts!.length === 0) parts!.push(seg.segment);
      // 英文後面空一格接「的」（「ROE 與 ROA 的差距」）：空格本身是瀏覽器的斷點，換成不換行空白，「的」不會落在行首
      else parts![parts!.length - 1] = (PARTICLE_HEAD.test(seg.segment) ? parts!.at(-1)!.replace(/ $/, '\u00A0') : parts!.at(-1)!) + seg.segment;
      for (const ch of seg.segment) {
        if (OPEN_QUOTES.includes(ch)) depth += 1;
        else if (CLOSE_QUOTES.includes(ch)) depth = Math.max(0, depth - 1);
      }
    });
    if (parts.length < 2) parts = null;
  }
  phraseCache.set(key, parts);
  return parts ?? undefined;
}
