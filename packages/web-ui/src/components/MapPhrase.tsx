// 地圖元件的名稱與說明句依詞換行（全站換行規則，M3 驗收第 7 輪，design-system.md 第 22 節）：phraseParts 切詞、詞之間放 <wbr>，
// 外層加 .ll-phrased（03-core-utils.css：keep-all 只在 <wbr>、標點與空格處斷，一個詞比一行長時才在行尾斷）。
// 章名、關卡名稱、海峽說明卡與清單的章名用它，不再在地圖的 CSS 裡各寫一套 keep-all。不是中文或沒有 Segmenter 時照原字。
// 第 7 輪看圖驗收（「延伸區：不列入／期中考，想多學再來」「資產負債表：結帳／那天的全貌」）：詞與詞之間都能斷，標題就會在片語中間斷。
// 再分一層子句：「：」「，」「、」「；」後面與開括號前面切開。子句包成 inline-block（.ll-phrased__clause，08-map-components.css），
// 放得進一行的子句整段移到下一行，標題只在標點後面換行。只包一定放得進一行的子句：7 個字以內（320 寬加 200% 的關卡列一行約 7 個字），
// 或是接在「：」後面（「綜合挑戰：」單獨一行讀起來是標籤）；更長的子句照樣跟在前一個子句後面、在詞與詞之間斷，
// 不會因為整段換行而留下「流動、」這種很短的一行。tail 接在最後一個子句裡（章名結尾的兩個字與箭頭，算 2 個字）
import type { ReactNode } from 'react';
import { phraseParts, punctTail } from './phrase.ts';

const CLAUSE_MAX = 7;
/** 詞尾的標點和前一個字整塊不斷（phrase.ts 的 punctTail，第 9 輪 handoff）。一般寬度用不到緊急換行，畫面不變 */
const wbr = (parts: readonly string[]) =>
  parts.flatMap((p, i) => {
    const m = punctTail(p);
    return [
      i ? <wbr key={i} /> : null,
      m
        ? [
            m[0],
            <span key={`t${i}`} className="ll-nowrap">
              {m[1]}
            </span>,
          ]
        : p,
    ];
  });

export function phrased(text: string, tail?: ReactNode): ReactNode {
  const parts = phraseParts(text);
  if (!parts) return tail ? [text, tail] : text;
  const clauses: string[][] = [[]];
  for (const p of parts) {
    if (/^[（(]/.test(p) && clauses.at(-1)!.length) clauses.push([]);
    clauses.at(-1)!.push(p);
    if (/[：，、；]$/.test(p)) clauses.push([]);
  }
  if (!clauses.at(-1)!.length && !tail) clauses.pop();
  if (clauses.length < 2) return [...wbr(parts), tail];
  return clauses.flatMap((c, i) => {
    const last = i === clauses.length - 1;
    const keep = c.join('').length + (last && tail ? 2 : 0) <= CLAUSE_MAX || /：$/.test(clauses[i - 1]?.at(-1) ?? '');
    return [
      i ? <wbr key={`w${i}`} /> : null,
      <span key={i} className={keep ? 'll-phrased__clause' : undefined}>
        {wbr(c)}
        {last && tail}
      </span>,
    ];
  });
}
