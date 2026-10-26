// 作答頁中文的依詞換行（M3 驗收第 8 輪，作答組）：題幹、選項、是非題的敘述、回饋、解說與名詞卡內文。
// 斷行單位用名詞頁同一套 termProse（features/term-page/prose.ts，design-system.md 第 22 節的第 4 種切詞：以說明頁的 prose-units 為準，
// 名詞整塊不斷、否定詞黏著後面的詞、「的」「地」「得」不落在行首、整塊的單位不超過欄寬、段落最後一段至少 4 個漢字），外層是全站的 .ll-phrased
// （keep-all，只在 <wbr>、標點與空格處換行，03-core-utils.css；一段比一行還寬時才在行尾斷，不會撐破窄欄）。這裡只做四件事：
// 1. keep 清單（整塊不拆的詞）：名詞資料的名稱（名稱、教材用語、現行用語與別名）加上這一題自己的詞（questionWords）：
//    prose-units 在這一題任何一段文字裡切出的三、四個字的整塊單位。Segmenter 把「咖啡機」一律切成「咖啡｜機」，解說裡 prose-units 把它黏成一塊，
//    題幹的「一台義式咖啡機」超過 6 個字被拆回去，原本 320 加 200% 會斷成「咖啡／機」；同一題裡同一個詞的切法一致。
// 2. termProse 沒有整塊的字（虛詞、被拆回的單字）怎麼斷：依 Segmenter 的詞，兩個字以上的詞一段；相鄰的單字連成一段（最多 4 個字，
//    Segmenter 常把「店裡」「義式」切成單字，和章節頁 chapter/prose.ts「相鄰的單字黏在一起」同一條），連接詞「與和及或之占並」自己一段；
//    「的」「地」「得」黏著前面（不落在行首，第 8 輪定案）；否定詞「不」「沒」「未」「別」黏著後面（phrase.ts 的 phraseBreak 同一組）；
//    標點與閉引號後面的單字（「。這三樣」「」把資產」「」混在一起了。」）在最窄的欄放得下時黏著後面的段，行尾不留一個「這」「把」「混」。
// 3. 標點黏著前後：閉標點不落在行首、開括號不留在行尾；不換行空白（U+00A0、U+202F）與 U+2060 的前後不斷。Markup 在段與段之間放 <wbr>。
// 4. 一段不超過 fit 個字寬（欄位在 320 寬加 200% 字級時一行放得下的字數）：超過的依詞再分（「資產負債表上，」→「資產負債表」「上，」），
//    不然行尾硬斷會把「，」斷到下一行行首。
// 為什麼不用 web-ui 的 phraseParts（第 8 輪審查建議的 Phrased）：它是給名稱與短說明句的，括號與引號裡整段不斷、單字黏著前後的詞，
// 題庫裡切出 653 段十個字以上（最長是 60 個字的括號說明），keep-all 下 320 加 200%（題幹一行約 6.4 個字、選項約 5.8 個字）只能在行尾硬斷
// （實測「店裡有一台義／式咖啡機」「都是店裡擁／有、」），375 的題幹第二行只排到約 55%（.local-reports/m3-final/quiz/fix9/probe-wrap.mts）。
// 由關卡與錯題本頁面（pages/Level.tsx、pages/Review.tsx）靜態 import，以 phraseModule 傳給 TermsProvider（terms.tsx 的說明）：
// 它和名詞頁的切詞是頁面的靜態依賴，殼層依路徑預先載入的第一波一起讀。檔案不放在 features/quiz：那裡的模組都被 vite.config.ts 的 quiz 群組抓走，
// 群組會連名詞頁的切詞一起抓，名詞頁反而要載作答頁的 chunk。2026-10-26（M3 收尾 QA）起它明確列在 quiz-view 群組（作答頁第一波本來就要的 chunk），
// 底下的 termProse 與 prose-units 由先宣告的 prose 群組拿走；原本三者各在一個 chunk，作答頁第一波為了切詞多三個請求
// 純函式（不碰 React 與 DOM）。不是中文、或瀏覽器沒有 Segmenter 時回 null，Markup 照原本的寫法輸出。單元測試在 apps/web/test/quiz-phrase.test.ts。
import { proseUnits } from '../../components/prose-units.ts';
import { termProse } from '../term-page/prose.ts';

const HAN = /\p{Script=Han}/u;
const HAN_ONLY = /^\p{Script=Han}+$/u;
/** 不落在行首的標點（閉括號、句讀、刪節號、百分號） */
const CLOSE = /^[、，。：；？！）」』”’〉》】…%,.:;?!)\]]/u;
/** 不留在行尾的開括號與開引號 */
const OPEN = /[「『“‘（〈《【([]$/u;
/** 不換行空白與字元連接符：前後都不斷 */
const GLUE = /[\u00A0\u202F\u2060]/u;
/** 前後都可以斷的單字連接詞（章節頁 chapter/prose.ts 的 CONNECTORS，「的」另外處理） */
const CONNECTORS = '與和及或之占並';
/** 黏著前面、不落在行首的助詞（第 8 輪定案：「的」「地」「得」） */
const TRAILING = '的地得';
/** 黏著後面的否定詞（phrase.ts 的 phraseBreak、prose-units 的 PREFIXES 同一組） */
const NEGATIONS = '不沒未別';
/** 子句結尾的標點與閉引號：後面的單字黏著再後面的段 */
const CLAUSE_END = /[。？！；：，、」』）]$/u;
/** 相鄰的單字最多連成幾個字 */
const MAX_LONE_RUN = 4;
/** 這一題自己的詞：termProse 整塊單位的字數範圍 */
const WORD_MIN = 3;
const WORD_MAX = 4;

/** 「的」開頭的段（「的確」除外）：前面不斷。名詞卡、選項引用等佔位符後面緊接「的」時，Markup 的接縫也靠它（M3 收尾第 9 輪：
 *  375 加 200% 的解說「……占實收資本比率／的分母都是股本」） */
const LEAD_DE = /^的(?!確)/u;

/** 兩段之間可不可以換行：後一段不是閉標點或「的」開頭、前一段不是開括號結尾，接縫兩邊都不是不換行空白 */
export function canBreak(before: string, after: string): boolean {
  if (before === '' || after === '') return false;
  if (GLUE.test(before.at(-1)!) || GLUE.test(after[0]!)) return false;
  return !OPEN.test(before) && !CLOSE.test(after) && !LEAD_DE.test(after);
}

let segmenter: Intl.Segmenter | null | undefined;
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

/** 整塊的單位是不是以單獨成詞的「的」「地」「得」開頭（「的風險」是，「的確」「得到」「地方」不是） */
function leadsWithParticle(seg: Intl.Segmenter, text: string): boolean {
  if (!TRAILING.includes(text[0]!)) return false;
  for (const { segment } of seg.segment(text)) return segment.length === 1;
  return false;
}

type Kind = 'keep' | 'word' | 'lone' | 'connector' | 'other';
interface Unit {
  text: string;
  kind: Kind;
  /** 否定詞：後面的段黏上來 */
  sticky?: boolean;
  /** 標點後面的單字（「。這」「」把」「」混」）：後面的段放得下時黏上來，行尾不留一個字 */
  lead?: boolean;
}

/** 大約幾個字寬：漢字與全形標點 1，其他 0.55 */
const emWidth = (s: string) => [...s].reduce((w, ch) => w + (ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.55), 0);

/** 太寬的段再分（不再拆開的小塊依序接起來）：Segmenter 的詞，標點黏著前後、「的」「地」「得」黏著前面、相鄰的單字連成一塊（最多 4 個字） */
function atomsOf(seg: Intl.Segmenter, text: string): string[] {
  const out: string[] = [];
  let loneRun = false;
  for (const { segment } of seg.segment(text)) {
    const last = out.at(-1);
    const lone = segment.length === 1 && HAN.test(segment) && !CONNECTORS.includes(segment);
    const join = last !== undefined && (!canBreak(last, segment) || TRAILING.includes(segment) || (lone && loneRun && last.length < MAX_LONE_RUN));
    if (join) {
      out[out.length - 1] = last + segment;
      loneRun = lone && loneRun && !TRAILING.includes(segment);
    } else {
      out.push(segment);
      loneRun = lone;
    }
  }
  return out;
}

/** 一段文字切成不再拆開的段（段與段之間放 <wbr>）。fit：一段最多幾個字寬，是這個欄位在最窄的情況（320 寬加 200% 字級）一行放得下的字數
 *  （標點與括號也算一個字）：外層 .ll-phrased 是 keep-all 加 overflow-wrap: anywhere，一段比一行寬時瀏覽器在行尾硬斷，會把「，」「。」斷到下一行行首，
 *  所以整塊單位加上黏著的標點、助詞超過 fit 時再依詞分開（「資產負債表上，」→「資產負債表」「上，」）；tail：這段是不是段落的最後一段（後面還接佔位符時不湊最後一段的 4 個漢字）；
 *  before：這段前面緊接的文字（例如解說裡選項引用的閉引號「」」後面接「把資產想得太窄」），是子句結尾時開頭的單字照樣黏著後面。不是中文時回 null */
export function phraseRuns(text: string, names: readonly string[], fit: number, tail = true, before = ''): string[] | null {
  if (!HAN.test(text)) return null;
  const pieces = termProse(text, { names, maxEm: fit, tailEm: tail ? fit : 0 });
  const seg = getSegmenter();
  if (!pieces || !seg) return null;
  const units: Unit[] = [];
  const add = (u: Unit) => {
    const last = units.at(-1);
    if (!last) {
      units.push(u.kind === 'lone' && CLAUSE_END.test(before) ? { ...u, lead: true } : u);
      return;
    }
    // 「的」「地」「得」開頭（單字的助詞，或 termProse 的整塊單位以它開頭，例如段落最後一段的「的風險。」）：黏著前一段
    const trailing = (u.kind === 'lone' ? TRAILING.includes(u.text) : u.kind === 'keep' && leadsWithParticle(seg, u.text)) && !/\s$/u.test(last.text);
    const loneRun =
      u.kind === 'lone' && last.kind === 'lone' && !trailing && last.sticky !== true && last.text.length < MAX_LONE_RUN && !NEGATIONS.includes(u.text);
    const lead = last.lead === true && emWidth(last.text + u.text) <= fit;
    if (!loneRun && !trailing && !lead && last.sticky !== true && canBreak(last.text, u.text)) {
      units.push(u.kind === 'lone' && CLAUSE_END.test(last.text) ? { ...u, lead: true } : u);
      return;
    }
    // 黏上之後：單字串照樣可以再接單字；開括號接上的段沿用後一段的種類；其他（黏上標點、助詞、否定詞之後）不再當單字串
    last.kind = loneRun ? 'lone' : last.kind === 'other' && OPEN.test(last.text) ? u.kind : last.kind === 'keep' ? 'keep' : 'word';
    last.text += u.text;
    last.sticky = u.sticky;
    if (!loneRun) last.lead = false;
  };
  for (const [t, keep] of pieces) {
    if (keep) {
      add({ text: t, kind: 'keep' });
      continue;
    }
    for (const { segment, isWordLike } of seg.segment(t)) {
      if (!isWordLike || !HAN_ONLY.test(segment)) {
        // 標點、空白、拉丁字母與數字：一段（空白本來就能換行；標點由 canBreak 黏著前後）
        add({ text: segment, kind: 'other' });
        continue;
      }
      if (segment.length > 1) {
        add({ text: segment, kind: 'word' });
        continue;
      }
      if (CONNECTORS.includes(segment)) add({ text: segment, kind: 'connector' });
      else add({ text: segment, kind: 'lone', ...(NEGATIONS.includes(segment) ? { sticky: true } : {}) });
    }
  }
  const runs: string[] = [];
  for (const { text: t } of units) {
    if (emWidth(t) <= fit) {
      runs.push(t);
      continue;
    }
    // 太寬：依詞分成放得下的幾段。一塊本身就比 fit 寬、開頭是四個字以上的詞時（「資產負債表的」），和章節頁 chapter/prose.ts 一樣
    // 從第 2 個字後切開（「資產」「負債表的」）；其他放不下的（很長的金額）只能留給瀏覽器在行尾斷
    const atoms = atomsOf(seg, t).flatMap((a) => (emWidth(a) > fit && /^\p{Script=Han}{4}/u.test(a) ? [a.slice(0, 2), a.slice(2)] : [a]));
    let cur = '';
    for (const atom of atoms) {
      if (cur !== '' && emWidth(cur + atom) > fit) {
        runs.push(cur);
        cur = atom;
      } else cur += atom;
    }
    if (cur !== '') runs.push(cur);
  }
  return runs;
}

/** 這一題自己的詞（給 keep 清單）：題目裡每一段文字（佔位符除外）由 prose-units 切出的整塊單位裡，三、四個字的純中文單位。
 *  同一個詞在別段被拆開時照樣整塊不斷（解說的「咖啡機」讓題幹的「一台義式咖啡機」不斷成「咖啡／機」）。用 proseUnits 不用 termProse：
 *  比較快，結果有快取（之後 phraseRuns 的 termProse 切同一段文字時直接用），第一題畫出來之前要把整題的文字都切過一次 */
export function questionWords(q: object): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (!HAN.test(v)) return;
      for (const part of v.split(/\{\{[^}]*\}\}/)) {
        if (!HAN.test(part)) continue;
        const pieces = proseUnits(part) ?? [];
        for (const [t, keep] of pieces) if (keep && t.length >= WORD_MIN && t.length <= WORD_MAX && HAN_ONLY.test(t)) out.add(t);
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(q);
  return [...out];
}

/** 傳給 TermsProvider 的切詞模組（一般物件，不用 import * 的 namespace：namespace 物件要 rolldown 的 runtime 組出來） */
export const phraseModule = { canBreak, phraseRuns, questionWords };
export type PhraseModule = typeof phraseModule;
