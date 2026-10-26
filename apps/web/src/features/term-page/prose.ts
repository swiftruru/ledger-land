// 名詞頁長文的中文換行（M3 驗收第 7 輪：375 的「現時經／濟資源」「存貨與設／備」「有形資／產」「顯／示」，名詞自己的名稱在定義裡被拆開）。
// 斷行單位以說明頁同一套 components/prose-units.ts 為準（design-system.md 第 22 節的第 2 種切詞：兩字以上的詞與黏起來的單字整塊不斷，
// 虛詞與標點前後照全站規則換行），名詞頁再多做六件事，結果仍是 [文字, 是否整塊不斷]，TermProse.tsx 把整塊的包成 span.ll-nowrap（全站 class，不另寫 CSS）：
// 1. 名詞自己的名稱（名稱、教材用語、現行用語）整塊不斷：Segmenter 把「營業利益率」切成兩個詞，原本可以排成「營業／利益率」；
// 2. 會計的複合名詞（前一個詞接中心詞：流動負債、應收帳款、營業活動、現金股利，最多 5 個字）整塊不斷，中心詞和章節頁 features/chapter/prose.ts 的 HEADS 同一類；
// 3. 數字和後面的量詞不斷（「第 2 層」「為 0 時」「365 天」）；拉丁字母與數字的一串（「2026-10-24」「N/A」）不斷；圈號黏著前面的詞（「步驟③」）；
// 4. 段落最後一段至少 4 個漢字一起換行，最後一行不會只剩「很重。」「的債。」兩個字（前面的整塊單位太寬時拆回 Segmenter 的詞再湊）；
// 5. 整塊的單位不超過欄寬：名詞頁最窄的欄是 320 寬加 200% 字級（內文 7.5 個字寬、公式框 6.8、解鎖任務卡的標題 5.9），
//    放不下 prose-units 的 8 個字寬引號名稱（「相對股本的報酬率」），超過 maxEm 的引號名稱改成名稱裡的詞各自不斷，不撐破版面；
// 6. 助詞「的」「地」「得」不落在行首（第 8 輪：固定資產 375 的定義排成「公司為了長期營業使用而持有／的有形資產」，第一行只排到 72%）：
//    prose-units 第 9 輪起把助詞黏到前面的詞，但這裡拆開太寬的單位、湊複合名詞與最後一段時會再把它分出來，所以最後把單獨成詞的
//    「的」「地」「得」（和 prose-units 同一組後置詞，加上 Segmenter 的「的是」）併回前一塊的結尾，只在助詞後面斷（「持有的／有形資產」）；前一塊加上去超過 maxEm 時拆出前一塊後段的詞一起帶（「它是／杜邦分析的」），段落最後一段也不從助詞開始。
// 不是中文或沒有 Segmenter 時回 null（照原字）。純函式，單元測試在 apps/web/test/term-prose.test.ts。
import { SUFFIXES, proseUnits } from '../../components/prose-units.ts';

export type TermProsePiece = readonly [text: string, keep: boolean];
export interface TermProseOptions {
  /** 名詞自己的名稱：整塊不斷 */
  names?: readonly string[];
  /** 整塊不斷的單位最多幾個字寬（預設 6：公式框在 320 寬加 200% 時約 6.8 個字寬） */
  maxEm?: number;
  /** 最後一段（含結尾標點）最多幾個字寬（預設等於 maxEm，0 表示不併最後一段） */
  tailEm?: number;
}

/** 段落最後一段至少幾個漢字一起換行；湊不到時至少 3 個才併 */
const TAIL_HAN = 4;
const TAIL_MIN_HAN = 3;
/** 複合名詞最多幾個漢字 */
const COMPOUND_HAN = 5;
/** 會計的中心詞：前面接一個詞時一起換行（流動負債、應收帳款、營業活動、現金流量、本期淨利） */
const HEADS = new Set(
  '資產 負債 權益 資本 盈餘 股利 股本 費用 收入 成本 利益 淨利 損益 帳款 票據 款項 存貨 流量 活動 比率 週轉率 報酬率 倍數 資金 借款 設備 折舊 稅額'.split(' '),
);
/** 最後一段不從這些單字開頭（湊到 3 個字之後） */
const PARTICLES = '的與和及或之在是了也而';
const HAN = /^\p{Script=Han}+$/u;
const HAN_G = /\p{Script=Han}/gu;
/** 拉丁字母與數字的一串（日期、N/A、130%、1.66）、或一個字 */
const ATOM = /[A-Za-z0-9][A-Za-z0-9.,%/-]*|[\s\S]/gu;
/** 數字和後面的一個量詞（「第 2 層」「0 時」「365 天」「54 條」） */
const NUM_COUNTER = /(?:第\s?)?\d[\d,.]*%?\s?\p{Script=Han}/gu;
const QUOTED = /^「(.+)」$/su;
/** 否定的字頭 */
const NEGATIONS = '未不非無';
/** 圈號（①到⑳） */
const CIRCLED = /^[\u2460-\u24ff]$/u;
/** 不落在行首的助詞與後置詞（單獨成詞時）：prose-units 的 SUFFIXES（第 9 輪 handoff 改成直接匯入，不各寫一份）；Segmenter 把「顯示的是」切成「顯示」「的是」，
 *  「的是」一樣不落在行首。「的確」「地區」「得到」「同時」是詞，不算 */
const LEAD_PARTICLE = new RegExp(`^(?:[${SUFFIXES}]|的是)$`, 'u');
/** 單位結尾黏著的助詞（連同前面的一個空格：「intensity 的」） */
const SUFFIX_END = new RegExp(`(\\s?)([${SUFFIXES}])$`, 'u');

interface Tok {
  s: number;
  e: number;
  keep: boolean;
}

let segmenter: Intl.Segmenter | undefined;
const words = (s: string) => [...(segmenter ??= new Intl.Segmenter('zh-Hant', { granularity: 'word' })).segment(s)];

/** 大約幾個字寬：漢字、全形標點與圈號 1，空白 0.3，拉丁字母、數字與半形符號 0.55 */
export function emWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch === ' ' ? 0.3 : ch.codePointAt(0)! >= 0x2400 ? 1 : 0.55;
  return w;
}
const hanCount = (s: string) => s.match(HAN_G)?.length ?? 0;

/** 拆開一個整塊單位時用的段：Segmenter 的詞，再併兩種不該拆的：
 *  1. 會計複合名詞（兩字以上的詞接中心詞，最多 COMPOUND_HAN 個字），不從「營業／成本」「應收／帳款」中間拆（第 9 輪：最後一段原本會拆成「營業」「成本的做法。」）；
 *  2. 連續的單字實詞（prose-units 黏在一起的「入」「帳」），不拆成「可以入／帳的科目。」。助詞與虛詞（PARTICLES、SUFFIXES）不併 */
function wordParts(s: string): { index: number; segment: string }[] {
  const out: { index: number; segment: string; singles: boolean }[] = [];
  const lone = (w: string) => w.length === 1 && HAN.test(w) && !PARTICLES.includes(w) && !SUFFIXES.includes(w);
  for (const { index, segment } of words(s)) {
    const last = out.at(-1);
    if (
      last &&
      ((last.singles && lone(segment)) ||
        (!last.singles && HAN.test(last.segment) && last.segment.length >= 2 && HEADS.has(segment) && last.segment.length + segment.length <= COMPOUND_HAN))
    ) {
      last.segment += segment;
      last.singles &&= lone(segment);
    } else out.push({ index, segment, singles: lone(segment) });
  }
  return out;
}

/** 一段不整塊的文字切成 token：拉丁字母與數字一串一個（maxEm 以內整塊），其餘一個字一個 */
function atoms(text: string, offset: number, maxEm: number, out: Tok[]): void {
  for (const m of text.matchAll(ATOM)) {
    const s = offset + m.index;
    out.push({ s, e: s + m[0].length, keep: m[0].length > 1 && emWidth(m[0]) <= maxEm });
  }
}

/** prose-units 的一個單位切成 token：maxEm 以內的整塊單位一個 token。超過 maxEm 的整塊單位拆開：
 *  結尾黏著助詞的（prose-units 第 9 輪：「銷管費用」的、intensity 的）先拆下助詞，前面照這裡的規則切，單獨的助詞再由 termProse 併回前一塊
 *  （開引號不算寬度，「銷管費用」的仍是一塊）；連同空格的「 的」整塊不斷（空格前本來就不能換行，助詞跟著前面的字）。
 *  引號名稱照名稱裡的詞重切，其他的拆回 Segmenter 的詞（兩字以上的詞仍整塊） */
function unitTokens(u: string, s: number, keep: boolean, maxEm: number, out: Tok[]): void {
  if (!keep) return atoms(u, s, maxEm, out);
  if (emWidth(u) <= maxEm) {
    out.push({ s, e: s + u.length, keep: true });
    return;
  }
  const sx = SUFFIX_END.exec(u);
  if (sx && sx.index > 0 && words(u).at(-1)!.segment === sx[2]) {
    unitTokens(u.slice(0, sx.index), s, true, maxEm, out);
    out.push({ s: s + sx.index, e: s + u.length, keep: sx[1] !== '' });
    return;
  }
  const q = QUOTED.exec(u);
  if (q) {
    out.push({ s, e: s + 1, keep: false });
    tokensOf(q[1]!, s + 1, maxEm, out);
    out.push({ s: s + u.length - 1, e: s + u.length, keep: false });
    return;
  }
  for (const w of words(u)) {
    if (HAN.test(w.segment) && w.segment.length > 1 && emWidth(w.segment) <= maxEm) out.push({ s: s + w.index, e: s + w.index + w.segment.length, keep: true });
    else atoms(w.segment, s + w.index, maxEm, out);
  }
}

/** text 從 offset 起的一段切成 token（prose-units 的單位各自交給 unitTokens） */
function tokensOf(text: string, offset: number, maxEm: number, out: Tok[]): void {
  const units = proseUnits(text);
  if (!units) return atoms(text, offset, maxEm, out);
  let at = 0;
  for (const [u, keep] of units) {
    unitTokens(u, offset + at, keep, maxEm, out);
    at += u.length;
  }
}

/** 名詞頁的一段文字切成 [文字, 是否整塊不斷]。不是中文或沒有 Segmenter 時回 null */
export function termProse(text: string, { names = [], maxEm = 6, tailEm = maxEm }: TermProseOptions = {}): readonly TermProsePiece[] | null {
  if (!proseUnits(text)) return null;
  const toks: Tok[] = [];
  tokensOf(text, 0, maxEm, toks);
  const str = (t: Tok) => text.slice(t.s, t.e);
  /** Segmenter 的詞界：名稱與數字量詞只在詞界上併，不把「允許」拆成「允」「許」 */
  const bounds = new Set(words(text).map((w) => w.index));
  bounds.add(text.length);

  /** [s, e) 碰到的 token 併成一個整塊的單位。併起來超過 maxEm 時只把 [s, e) 本身變成一塊（兩邊剩下的字各自成 token） */
  const merge = (s: number, e: number) => {
    if (!bounds.has(s) || !bounds.has(e)) return;
    const i = toks.findIndex((t) => t.e > s);
    let j = i;
    while (j + 1 < toks.length && toks[j + 1]!.s < e) j++;
    if (i < 0 || (i === j && toks[i]!.keep)) return;
    const a = toks[i]!;
    const b = toks[j]!;
    if (emWidth(text.slice(a.s, b.e)) <= maxEm && !/^\s|\s$/u.test(text.slice(a.s, b.e))) {
      toks.splice(i, j - i + 1, { s: a.s, e: b.e, keep: true });
      return;
    }
    const rest = (rs: number, re: number, was: Tok): Tok[] => (rs < re ? [{ s: rs, e: re, keep: was.keep && hanCount(text.slice(rs, re)) > 1 }] : []);
    toks.splice(i, j - i + 1, ...rest(a.s, s, a), { s, e, keep: true }, ...rest(e, b.e, b));
  };
  // 名稱比 maxEm 寬時（「不動產、廠房及設備」）照頓號分段，各段整塊
  const parts = [...new Set(names)].flatMap((n) => (emWidth(n) > maxEm ? n.split('、') : [n]));
  for (const name of parts)
    if (name.length > 1 && hanCount(name) > 0 && emWidth(name) <= maxEm)
      for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) merge(at, at + name.length);
  for (const m of text.matchAll(NUM_COUNTER)) merge(m.index, m.index + m[0].length);
  // 圈號黏著前面的詞（「步驟③」，不單獨落在一行）
  for (let k = toks.length - 1; k > 0; k--) {
    const a = toks[k - 1]!;
    if (CIRCLED.test(str(toks[k]!)) && a.keep && a.e === toks[k]!.s && emWidth(text.slice(a.s, toks[k]!.e)) <= maxEm)
      toks.splice(k - 1, 2, { s: a.s, e: toks[k]!.e, keep: true });
  }
  // 複合名詞：前一塊的最後一個詞接著中心詞（都是漢字），合起來最多 COMPOUND_HAN 個字。prose-units 黏起來的單位只取相鄰的那個詞
  // （「每一元營業」「收入」→「每一元」「營業收入」；「現金」「流量先扣掉」→「現金流量」「先扣掉」）
  const piece = (ps: number, pe: number): Tok[] => (pe > ps ? [{ s: ps, e: pe, keep: pe - ps > 1 }] : []);
  for (let k = toks.length - 1; k > 0; k--) {
    const a = toks[k - 1]!;
    const b = toks[k]!;
    if (!a.keep || !b.keep || a.e !== b.s || !HAN.test(str(a)) || !HAN.test(str(b))) continue;
    const head = words(str(b))[0]!.segment;
    const last = words(str(a)).at(-1)!.segment;
    if (!HEADS.has(head) || last.length < 2 || last.length + head.length > COMPOUND_HAN) continue;
    // 前一塊只剩一個字時一起帶上（「未分配」「盈餘」→「未分配盈餘」，不留下單獨的「未」）
    const cut = a.e - last.length === a.s + 1 && last.length + head.length < COMPOUND_HAN ? a.s : a.e - last.length;
    const end = b.s + head.length;
    toks.splice(k - 1, 2, ...piece(a.s, cut), { s: cut, e: end, keep: true }, ...piece(end, b.e));
  }

  // 否定的字頭黏著後面的詞：prose-units 把它黏在前面的單字動詞上時（「流進未」「分配盈餘」）移到後面（「流進」「未分配盈餘」）
  for (let k = toks.length - 1; k > 0; k--) {
    const a = toks[k - 1]!;
    const b = toks[k]!;
    const last = str(a).at(-1)!;
    if (
      a.keep &&
      b.keep &&
      a.e === b.s &&
      a.e - a.s > 2 &&
      NEGATIONS.includes(last) &&
      HAN.test(str(b)) &&
      words(str(a)).at(-1)!.segment === last &&
      emWidth(str(b)) + 1 <= maxEm
    )
      toks.splice(k - 1, 2, { s: a.s, e: a.e - 1, keep: true }, { s: a.e - 1, e: b.e, keep: true });
  }

  // 助詞不落在行首：以助詞開頭的 token 併到前一塊的結尾。整個 token 併得下時整個併（「顯示」「的是」→「顯示的是」；
  // 段落最後一段用 tailEm），否則只把助詞的第一個字併過去（「持有」「的」→「持有的」），前一塊加上去超過 maxEm 時拆出它的最後一個詞
  // （「它是杜邦分析」「的」→「它是」「杜邦分析的」，複合名詞不拆）。前一塊是空白時也併（「ROA」「 的」：空白前本來就不能換行，助詞跟著前面的字）
  // 寬度不算開頭的開引號與開括號：TermProse 把它放在 span 外面，和引號名稱（「銷管費用」的）的上限一致
  const leads = (t: Tok | undefined) => t !== undefined && LEAD_PARTICLE.test(words(str(t))[0]?.segment ?? '');
  const span = (s: number, e: number) => emWidth(text.slice(s, e).replace(/^[「『（]/u, ''));
  const glueParticles = () => {
    for (let k = toks.length - 1; k > 0; k--) {
      const a = toks[k - 1]!;
      const b = toks[k]!;
      if (a.e !== b.s || !leads(b)) continue;
      if (span(a.s, b.e) <= (k === toks.length - 1 && b.keep ? Math.max(maxEm, tailEm) : maxEm)) {
        toks.splice(k - 1, 2, { s: a.s, e: b.e, keep: true });
        continue;
      }
      const p = b.s + 1;
      const rest: Tok[] = p < b.e ? [{ s: p, e: b.e, keep: b.keep && b.e - p > 1 }] : [];
      if (span(a.s, p) <= maxEm) {
        toks.splice(k - 1, 2, { s: a.s, e: p, keep: true }, ...rest);
        continue;
      }
      // 前一塊從最前面的段界開始找，帶得動的最長一段和助詞一起（「它是杜邦分析」「的」→「它是」「杜邦分析的」）
      const cut = (a.keep ? wordParts(str(a)) : []).map((w) => a.s + w.index).find((c) => c > a.s && hanCount(text.slice(c, p)) > 1 && span(c, p) <= maxEm);
      if (cut !== undefined) toks.splice(k - 1, 2, { s: a.s, e: cut, keep: cut - a.s > 1 }, { s: cut, e: p, keep: true }, ...rest);
    }
  };
  glueParticles();

  // 段落最後一段：從結尾往前併到至少 TAIL_HAN 個漢字（連同結尾標點最多 tailEm 個字寬）。
  // 前面的整塊漢字單位太寬時拆開（「公司欠股東」→「公司」「欠」「股東」）再湊，這時湊到 TAIL_MIN_HAN 個就停，
  // 拆開的單位沒有用到的前半段再併回一塊（「這一列一直是」→「這一列」「一直是 0。」）。
  // 拆的時候不拆複合名詞（wordParts，第 9 輪）：「營業成本的做法。」超過 tailEm 時是「營業成本的／做法。」，不是「營業／成本的做法。」。
  // 實測（.local-reports/m3-final/glossary/fix9/compare.mjs）：320、375、1280 的最後一行不到 3 個字和第 8 輪一樣，複合名詞被拆開的行從 12 減到 8（320）；
  // 只有 320 寬加 200% 的欄（一行 7 個字）多出最後一行「做法。」這種 3 個字寬的行，比例上不是孤行
  let i = tailEm > 0 ? toks.length : 0;
  let han = 0;
  let split: Tok | undefined;
  // 湊到字數時最後一段的開頭是助詞（拆開的「公司欠股東的」剩下「的負債。」）就再往前拿一塊（「股東的負債。」）
  while (i > 0 && (han < (split ? TAIL_MIN_HAN : TAIL_HAN) || leads(toks[i]))) {
    const t = toks[i - 1]!;
    // 已經有 3 個字時，不再往前拿單字的虛詞（「法律上／的所有權。」不如「法律上的／所有權。」）
    if (han >= TAIL_MIN_HAN && PARTICLES.includes(str(t))) break;
    if (emWidth(text.slice(t.s, toks.at(-1)!.e)) > tailEm) {
      const ws = t.keep && !split && HAN.test(str(t)) ? wordParts(str(t)) : [];
      if (ws.length < 2) break;
      split = t;
      toks.splice(i - 1, 1, ...ws.map((w) => ({ s: t.s + w.index, e: t.s + w.index + w.segment.length, keep: w.segment.length > 1 })));
      i += ws.length - 1;
      continue;
    }
    han += hanCount(str(t));
    i--;
  }
  // 最後一段不從空白、標點或開括號開始（開括號換行時本來就跟著後面的字；頓號、句號不能落在行首）
  while (i < toks.length && !/[\p{Script=Han}A-Za-z0-9]/u.test(str(toks[i]!))) i++;
  if (han >= TAIL_MIN_HAN && i < toks.length - 1) {
    toks.splice(i, toks.length - i, { s: toks[i]!.s, e: toks.at(-1)!.e, keep: true });
    const k = split ? toks.findIndex((t) => t.s === split!.s) : -1;
    if (k >= 0 && k < i - 1) toks.splice(k, i - k, { s: split!.s, e: toks[i]!.s, keep: true });
  }

  // 最後一段寬度不夠、只能從助詞開始時，助詞照上面的規則併到前一塊
  glueParticles();

  // 相鄰的可斷 token 併成一段文字
  const out: [string, boolean][] = [];
  for (const t of toks) {
    const last = out.at(-1);
    if (last && !last[1] && !t.keep) last[0] += str(t);
    else out.push([str(t), t.keep]);
  }
  return out;
}
