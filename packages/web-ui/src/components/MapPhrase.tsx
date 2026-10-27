// 地圖標題的子句換行（M3 驗收第 7 輪，07 第 3.5 節）：章名、關卡名稱、海峽說明卡在「：」「，」「、」「；」後面與開括號前面切成子句，
// 放得進一行的子句包成 inline-block（.ll-phrased__clause，08-map-components.css）：整段移到下一行，標題只在標點後面換行
// （「延伸區：不列入／期中考，想多學再來」「資產負債表：結帳／那天的全貌」原本在片語中間斷）。
// 只包一定放得進一行的子句：7 個字以內（320 寬加 200% 的關卡列一行約 7 個字），或是接在「：」後面（「綜合挑戰：」單獨一行讀起來是標籤）；
// 更長的子句照樣跟在前一個子句後面、字照全站規則逐字換行，不會因為整段換行而留下「流動、」這種很短的一行。
// tail 接在最後一個子句裡（章名結尾的兩個字與箭頭，算 2 個字）。不是中文、或只有一個子句時照原字。
// 2026-10-27 起中文逐字換行：這裡不再切詞、不在詞之間放 <wbr>（切詞工具已刪）；子句是標題的排版，不是段落的換行規則，所以留著。
import type { ReactNode } from 'react';

const CJK = /[㐀-鿿豈-﫿]/;
const CLAUSE_MAX = 7;
/** 子句的邊界：「：」「，」「、」「；」後面，以及開括號前面 */
const CLAUSE_EDGE = /(?<=[：，、；])|(?=[（(])/u;

export function phrased(text: string, tail?: ReactNode): ReactNode {
  if (!CJK.test(text)) return tail ? [text, tail] : text;
  const clauses = text.split(CLAUSE_EDGE).filter((c) => c !== '');
  if (clauses.length < 2) return tail ? [text, tail] : text;
  return clauses.flatMap((c, i) => {
    const last = i === clauses.length - 1;
    const keep = c.length + (last && tail ? 2 : 0) <= CLAUSE_MAX || /：$/.test(clauses[i - 1] ?? '');
    return [
      i ? <wbr key={`w${i}`} /> : null,
      <span key={i} className={keep ? 'll-phrased__clause' : undefined}>
        {c}
        {last && tail}
      </span>,
    ];
  });
}
