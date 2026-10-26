// 已經切好詞的文字（web-ui 的 phraseParts 切出的詞）：詞與詞之間放 <wbr>，外層是全站的 .ll-phrased（keep-all，只在 <wbr>、標點與空格處換行）。
// 獨立成一個模組、不 import 切詞程式：首頁在首次載入的 chunk，關卡名與章名由懶載入的 home-quest.ts 先切好（titleParts），
// 首頁只用這裡的 PhrasedParts（M3 驗收第 9 輪）。Phrased.tsx（切詞加 <wbr>）也用這裡的 withWbr。
import { Fragment, type ReactNode } from 'react';

/** 切好的詞，詞與詞之間放 <wbr>（不改 textContent，可讀名稱與 E2E 的文字比對不受影響） */
export function withWbr(parts: readonly ReactNode[]) {
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {p}
    </Fragment>
  ));
}

/** parts 是 undefined（英文、不支援 Segmenter、資料還在讀）時照原字 */
export function PhrasedParts({ text, parts }: { text: string; parts: readonly string[] | undefined }) {
  return parts ? <span className="ll-phrased">{withWbr(parts)}</span> : <>{text}</>;
}
