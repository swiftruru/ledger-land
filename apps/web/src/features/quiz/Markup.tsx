// 題目文字的渲染（05 第 10 節）：數值佔位符換成格式化字串、{{option:o_x}} 換成加引號的選項文字（<q class="ll-optref">）、{{term:tm_x}} 做成 TermChip（|plain 只輸出文字）。
// 純文字的部分在 placeholders.ts；這裡只負責 React 節點與名詞卡的開啟。
// 中文依詞換行（M3 驗收第 8 輪，features/quiz-phrase/quiz-phrase.ts）：題幹、選項、是非題敘述、回饋、解說與名詞卡內文的中文切成不再拆開的段，段與段之間放 <wbr>，
// 外層加全站的 .ll-phrased（keep-all，只在 <wbr>、標點與空格處換行；一段比一行還寬時才在行尾斷，不會撐破窄欄）。佔位符也照段處理：
// 選項引用整塊可以在裡面換行（裡面的選項文字一樣依詞切），數字和後面的字不斷開。<wbr> 與外層 span 不改 textContent（可讀名稱與 E2E 的文字比對不受影響）。
// 英文（TermsProvider 的 phrase 是 null）照原字輸出，解說裡引號括住的短詞包 .ll-nowrap（第 7 輪的寫法）。
import { Fragment, createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { TermChip } from '@ledgerland/web-ui';
import { formatValuePlaceholder, inlineTermLabel, nestOptionQuotes, splitMarkup, splitParagraphs, type ValueContext } from './placeholders.ts';
import { useTerms, type QuizPhrase } from './terms.tsx';

export interface MarkupProps {
  text: string;
  ctx?: ValueContext;
  /** 本題的選項文字（short 優先），給 {{option:…}} 用 */
  options?: ReadonlyMap<string, string>;
  /** 題幹或選項裡出現名詞時只顯示文字（避免在 label 裡放按鈕）；回饋與解說可以做成 chip */
  plainTerms?: boolean;
  /** 中文依詞換行時一段最多幾個字寬（標點也算一個字）：這個欄位在最窄的情況（320 寬加 200% 字級）一行放得下的字數，無條件捨去。
   *  題幹 6.4 與解說 6.5、回饋區選項說明 6.2 給 6，選項 5.8 與回饋區選項說明的標題 5.5 給 5；預設 6（名詞卡內文 8.5 也用 6，和名詞頁同一個寬度） */
  fit?: number;
}

/** 這一題自己的詞（features/quiz-phrase/quiz-phrase.ts 的 questionWords）：關卡與錯題本在題目卡外面提供，題幹、選項、回饋與解說共用同一份 keep 清單 */
const WordsContext = createContext<readonly string[]>([]);

export function QuestionWords({ q, children }: { q: object; children: ReactNode }) {
  const { phrase } = useTerms();
  const words = useMemo(() => (phrase ? phrase.mod.questionWords(q) : []), [q, phrase]);
  return <WordsContext.Provider value={words}>{children}</WordsContext.Provider>;
}

function TermChipInline({ id, label }: { id: string; label: string }) {
  const { openTerm } = useTerms();
  const ref = useRef<HTMLButtonElement>(null);
  // 行內 chip 依 WCAG 2.5.8 的行內例外不放大到 44px（07 第 8.4 節的例外，2026-10-24 規劃者決定）
  return <TermChip ref={ref} label={label} inline onClick={() => openTerm(id, ref)} />;
}

/** 解說與回饋裡引號括住的短詞（「花過錢」「欠別人錢」，引號裡 4 個字以內）整塊不換行（.ll-nowrap，全站換行規則，M3 驗收第 7 輪）：
 *  不斷成「花／過錢」。長的引文照一般規則換行；題幹與選項（plainTerms）不包：選項卡在文字放大 200% 時一行只放得下約 5 個字。
 *  只包引號裡的字，引號留在 span 外面（第 7 輪 handoff：Chromium 的 text-spacing-trim 在 nowrap 的 span 裡不作用，「落在行首時會多半個字的空白；
 *  開引號後、閉引號前本來就不能換行，引號仍黏著詞）。依詞換行時（中文）不用這個：引號名稱由 termProse 整塊處理 */
const QUOTED = /([「『])([^「」『』]{1,4})([」』])/;
const NUMERIC: readonly string[] = ['money', 'percent', 'number', 'date'];
/** 數字後面緊接、要黏在數字上的字：閉標點（「，」「。」），或隔一個空白的「的」（「NT$25,000 的收入」，空白本來就能換行） */
const CLOSING = /^(?:[、，。：；？！）」』…%]+|\s?的(?!確))/u;
function pushText(nodes: ReactNode[], text: string, key: number) {
  if (!QUOTED.test(text)) {
    nodes.push(text);
    return;
  }
  // split 帶三個捕捉群組：每 4 段是「前文、開引號、詞、閉引號」，詞（j % 4 === 2）包成 .ll-nowrap
  text.split(QUOTED).forEach((part, j) => {
    if (part === '') return;
    nodes.push(
      j % 4 === 2 ? (
        <span key={`${key}.${j}`} className="ll-nowrap">
          {part}
        </span>
      ) : (
        part
      ),
    );
  });
}

/** 依詞換行時的數字：千分位逗號後面分組，每組 .ll-nowrap（後面緊接的閉標點黏在最後一組）。組與組之間沒有一般的換行點，
 *  一般寬度整串不斷；只有一行放不下整串時（320 寬加 200% 的「NT$1,800,000」），外層 .ll-phrased 的 overflow-wrap: anywhere 才在組與組之間斷
 *  （「NT$1,800,／000」），不會從數字中間斷，也不撐出水平捲動 */
function numberGroups(label: string, tail: string): ReactNode {
  const groups = label.split(/(?<=,)/);
  return groups.map((g, j) => (
    <span key={j} className="ll-nowrap">
      {g}
      {j === groups.length - 1 ? tail : null}
    </span>
  ));
}

/** 段裡面的標點接縫（「（賣出）的」「多少」的」）：keep-all 只擋字與字之間，閉標點後面照樣可以換行，「的」會落到行首，所以整段包 .ll-nowrap
 *  （開頭的開括號、開引號留在外面：Chromium 在 nowrap 裡不套用 text-spacing-trim，換到行首時會多半個字的空白）。段都不超過 fit，放得下一行 */
const INNER_BREAK = /[、，。：；？！）」』”’〉》】][^、，。：；？！）」』”’〉》】]/u;
const LEAD_OPEN = /^[「『（“‘〈《【]+/u;
function runNode(r: string, key: number): ReactNode {
  // 文字裡直接寫的金額（選項文字、回饋區選項說明的標題）和佔位符的數字一樣分組
  if (/\d,\d/.test(r)) return <span key={`n${key}`}>{numberGroups(r, '')}</span>;
  if (!INNER_BREAK.test(r)) return r;
  const open = LEAD_OPEN.exec(r)?.[0] ?? '';
  return (
    <Fragment key={`n${key}`}>
      {open}
      <span className="ll-nowrap">{r.slice(open.length)}</span>
    </Fragment>
  );
}

/** 切好的段（快取：同一段文字在同一題會重畫很多次） */
const runsCache = new Map<string, readonly string[] | null>();
function runsOf(text: string, phrase: QuizPhrase, words: readonly string[], fit: number, tail: boolean, before: string): readonly string[] | null {
  const names = [...phrase.names, ...words].filter((n) => text.includes(n));
  const last = before.at(-1) ?? '';
  const key = `${fit}${tail ? 't' : ''}${last}\u0000${text}\u0000${names.join('\u0001')}`;
  let hit = runsCache.get(key);
  if (hit === undefined) {
    hit = phrase.mod.phraseRuns(text, names, fit, tail, last);
    runsCache.set(key, hit);
  }
  return hit;
}

/** 依詞換行的節點：段與段之間（接縫可以換行時）放 <wbr>；佔位符的前後一樣看接縫 */
function phraser(canBreak: (before: string, after: string) => boolean, fit = Infinity) {
  const nodes: ReactNode[] = [];
  let prev = '';
  let key = 0;
  /** 剛放進去的名詞卡（label 是卡上的字）：後面緊接「的」時要和它包在一起 */
  let chip: { node: ReactNode; label: string } | null = null;
  const gap = (next: string) => {
    if (canBreak(prev, next)) nodes.push(<wbr key={`w${key++}`} />);
  };
  return {
    nodes,
    /** 目前最後一段的文字（下一段文字判斷開頭的單字要不要黏著後面） */
    prev: () => prev,
    runs(runs: readonly string[]) {
      for (const r of runs) {
        // 名詞卡後面緊接「的」（M3 收尾第 9 輪：375 加 200% 的「……比率／的分母都是股本」）：名詞卡（ll-chip--inline）是 inline-block 的整塊，瀏覽器在它後面一定可以換行，
        // <wbr> 與 U+2060 都擋不住，所以把卡片和「的」包進同一個 .ll-nowrap。只包 320 寬加 200% 時連同「的」一行放得下的卡片：卡片的圖示、間距與內距約 2 個字寬，
        // 字數最多 fit - 3（解說 3 個字：「存貨」「股本」）；更長的卡片包起來會撐破欄寬，照舊可能在卡片後面換行
        if (chip && /^的(?!確)/u.test(r) && [...chip.label].length <= fit - 3) {
          nodes.pop();
          nodes.push(
            <span key={`c${key++}`} className="ll-nowrap">
              {chip.node}的
            </span>,
          );
          if (r.length > 1) nodes.push(runNode(r.slice(1), key++));
        } else {
          gap(r);
          nodes.push(runNode(r, key++));
        }
        prev = r;
        chip = null;
      }
    },
    /** first、last：節點文字的頭尾（判斷接縫）；last 是空字串時後面不放 <wbr>（數字和後面的量詞不斷開）；isChip：名詞卡 */
    node(first: string, last: string, node: ReactNode, isChip = false) {
      gap(first);
      nodes.push(node);
      prev = last;
      chip = isChip ? { node, label: last } : null;
    },
  };
}

export function Markup({ text, ctx = {}, options, plainTerms = false, fit = 6 }: MarkupProps) {
  const { locale, labelOf, phrase } = useTerms();
  const words = useContext(WordsContext);
  const segments = splitMarkup(text);
  const nodes: ReactNode[] = [];
  const p = phrase ? phraser(phrase.mod.canBreak, fit) : null;
  const phrased = (t: string, tail: boolean, after = ''): readonly string[] => (phrase ? runsOf(t, phrase, words, fit, tail, after) : null) ?? [t];
  // 數字後面緊接的閉標點（「NT$900,000，」）黏在數字的最後一組裡（見下面的 numberGroups），keep-all 的行尾硬斷不會把「，」斷到下一行行首
  const numTail = new Map<number, string>();
  if (p)
    segments.forEach((s, i) => {
      const next = segments[i + 1];
      const m = s.kind === 'placeholder' && NUMERIC.includes(s.type) && next?.kind === 'text' ? CLOSING.exec(next.text) : null;
      if (m) numTail.set(i, m[0]);
    });
  let before = '';
  segments.forEach((s, i) => {
    const prev = before;
    before += s.kind === 'text' ? s.text : 'x';
    if (s.kind === 'text') {
      const cut = numTail.get(i - 1)?.length ?? 0;
      const rest = s.text.slice(cut);
      if (p) {
        if (rest !== '') p.runs(phrased(rest, i === segments.length - 1, p.prev()));
      } else if (plainTerms) nodes.push(s.text);
      else pushText(nodes, s.text, i);
      return;
    }
    let node: ReactNode;
    let label: string;
    switch (s.type) {
      case 'money':
      case 'percent':
      case 'number':
      case 'date':
        label = formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale);
        node = (
          <span key={i} className="ll-num">
            {p ? numberGroups(label, numTail.get(i) ?? '') : label}
          </span>
        );
        // 數字和後面的字（「元」「張」）不斷開：後面不放 <wbr>；後面黏著的是閉標點時，標點後面照常可以換行
        if (p) p.node(label, numTail.get(i) ?? '', node);
        else nodes.push(node);
        return;
      case 'option': {
        // 選項引用包在 <q>：引號由 CSS 依語言給（中文「」、英文英式的 ‘ ’，feedback.css 的 .ll-optref），字重 600，讀者看得出選項在哪裡結束；
        // 選項自己帶的引號換成第二層（nestOptionQuotes）。只有解說用到選項引用，樣式跟著 FeedbackView 載入。依詞換行時引用裡的選項文字一樣切
        const quoted = nestOptionQuotes(options?.get(s.ref) ?? s.ref, locale);
        if (p && phrase) {
          // 引號是產生的內容（「」各佔一個字），引用裡的段少算一個字
          const inner = phraser(phrase.mod.canBreak);
          inner.runs(runsOf(quoted, phrase, words, fit - 1, true, '') ?? [quoted]);
          p.node(
            '「',
            '」',
            <q key={i} className="ll-optref">
              {inner.nodes}
            </q>,
          );
        } else
          nodes.push(
            <q key={i} className="ll-optref">
              {quoted}
            </q>,
          );
        return;
      }
      case 'term': {
        // 英文句中的名詞首字母轉小寫（縮寫保留），chip 與 |plain 一樣（placeholders.ts 的 inlineTermLabel）
        const found = labelOf(s.ref);
        label = found === undefined ? s.ref : inlineTermLabel(found, locale, prev);
        node = plainTerms || s.options.includes('plain') ? <span key={i}>{label}</span> : <TermChipInline key={i} id={s.ref} label={label} />;
        break;
      }
      default:
        label = s.ref;
        node = <span key={i}>{s.ref}</span>;
    }
    if (p) p.node(label, label, node, s.type === 'term' && !plainTerms && !s.options.includes('plain'));
    else nodes.push(node);
  });
  return p ? <span className="ll-phrased">{p.nodes}</span> : <>{nodes}</>;
}

/** 多段長文（名詞定義）：空行分段，每段一個 <p>，段內照常換成格式化數值與名詞 chip */
export function MarkupParagraphs({ text, className, ...rest }: MarkupProps & { className?: string }) {
  return (
    <>
      {splitParagraphs(text).map((para, i) => (
        <p key={i} className={className}>
          <Markup text={para} {...rest} />
        </p>
      ))}
    </>
  );
}
