// 設定與備份頁的說明句：中文只在詞與詞之間、標點與空格處換行（M3 驗收第 5 輪：1280 的「也不影響星／星。」、「或備份／碼轉移。」，
// 375 的「剩／餘時間」「折／射」）。web-ui 的 phraseParts（Intl.Segmenter，名詞卡同一套）切成詞、詞之間放 <wbr>，外層 .ll-phrased 是 keep-all
// （字與字之間不斷；規則在 web-ui 的 03-core-utils.css，全站一套，design-system.md 第 22 節），一個詞比一行還長時才由 overflow-wrap: anywhere 在行尾硬斷。
// 這是已經切好詞的句子專用的組合（每個詞之間都有 <wbr>，標點跟著前一個詞），不是第 7 輪禁止的「沒切詞的文字加 keep-all」。只用 keep-all（只在標點處斷）的話，375 的窄欄會排成
// 五行、右邊參差不齊；在詞之間斷，每一行都接近排滿。<wbr> 不改 textContent，可讀名稱與 E2E 的文字比對不受影響。
// 不是中文（英文介面）或瀏覽器沒有 Segmenter 時照原字（仍是 keep-all，只在標點與空格處換行）。
// 只給完整顯示的短說明句：單字詞會黏著前後的詞，散文裡可能黏成十個字的長串。貨幣符號和後面的數字不斷（「NT$1,200」整串留在同一行）。
// 會被截斷的摘錄（收藏卡）不要用。切詞在 web-ui 的 components/phrase.ts（獨立小模組，設定與備份頁不必載入名詞卡）。
// Segmenter 會把複合的介面名詞切成兩個詞（「作答／紀錄」，第 6 輪看圖驗收：備份頁 375 斷在兩行）：這種詞在訊息裡用 Lingui rich text
// 包成 <0>…</0>（元素是 span.ll-nowrap），Trans 的 render 交給 PhrasedRich：字串照切詞，標籤包住的部分整塊不切。
import { Children, Fragment } from 'react';
import type { TransRenderProps } from '@lingui/react';
import { phraseParts, punctTail } from '@ledgerland/web-ui';
import { withWbr } from './PhrasedParts.tsx';

/** 一段字串切成詞，詞與詞之間放 <wbr>（不是中文或不支援 Segmenter 時照原字）。keep：整塊不拆的詞（Segmenter 會把「股東權益」切成兩個詞）。
 *  詞尾的標點連同前一個字包成 .ll-nowrap（第 9 輪 handoff：375 加 200% 的設定頁「只是不唸出來／。」，緊急換行時句號不單獨落到行首） */
function parts(text: string, keep?: readonly string[]) {
  const ps = phraseParts(text, keep);
  return ps
    ? withWbr(
        ps.map((p, i) => {
          const m = punctTail(p);
          return m ? (
            <Fragment key={i}>
              {m[0]}
              <span className="ll-nowrap">{m[1]}</span>
            </Fragment>
          ) : (
            p
          );
        }),
      )
    : text;
}

/** block：自己排成一個區塊（開關的說明行；text-wrap: pretty 由 html 繼承，最後一行不會只剩「星星。」）。放在 p 裡時不加，維持行內。
 *  NavRow、NavCard 的 description 與 EmptyState 的說明可以直接傳 <Phrased text={…} />（只在懶載入的頁面用，首次載入的 chunk 不要匯入） */
export function Phrased({ text, block = false, keep }: { text: string; block?: boolean; keep?: readonly string[] }) {
  return <span className={block ? 'll-phrased ll-phrased--block' : 'll-phrased'}>{parts(text, keep)}</span>;
}

/** Lingui rich text 版：`<Trans id="…" render={PhrasedRich}>…<span className="ll-nowrap">作答紀錄</span>…</Trans>`。
 *  翻譯裡的字串照切詞放 <wbr>；元素（不斷開的名詞）原樣放進去，外層 keep-all，它和後面黏著的字（「作答紀錄都保留」）之間也不斷，
 *  前面接標點（「合併：」）時照常可以在標點後換行。英文的翻譯沒有標籤，等於整句照原字 */
export function PhrasedRich({ translation, keep }: TransRenderProps & { keep?: readonly string[] }) {
  return <span className="ll-phrased">{Children.map(translation, (node) => (typeof node === 'string' ? <>{parts(node, keep)}</> : node))}</span>;
}
