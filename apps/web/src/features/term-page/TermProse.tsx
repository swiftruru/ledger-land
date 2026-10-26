// 名詞頁的長文依詞換行（規則在 prose.ts）：整塊不斷的單位包成 span.ll-nowrap（web-ui 的全站 class），其他字照全站規則換行。
// 和說明頁的 components/ProseWords.tsx 同一種畫法：整塊單位頭尾的引號與括號放在 span 外面（Chromium 的 text-spacing-trim 在 nowrap 的 span 裡
// 不作用，換到行首的「會多半個字寬的空白；開括號後、閉括號前本來就不能換行）。<span> 不改 textContent，E2E 的文字比對與可讀名稱不受影響。
import { Children, Fragment, type ReactNode } from 'react';
import type { TransRenderProps } from '@lingui/react';
import { termProse, type TermProseOptions } from './prose.ts';

const EDGE = /^([「『（]?)(.*?)([」』）]?)$/su;

/** 一段文字（定義、段落、用語、關卡名稱）；英文或不支援 Segmenter 時照原字 */
export function TermProse({ text, ...options }: { text: string } & TermProseOptions): ReactNode {
  const pieces = termProse(text, options);
  if (!pieces) return text;
  return pieces.map(([t, keep], i) => {
    if (!keep) return <Fragment key={i}>{t}</Fragment>;
    const [, open = '', core = t, close = ''] = EDGE.exec(t) ?? [];
    return (
      <Fragment key={i}>
        {open}
        <span className="ll-nowrap">{core}</span>
        {close}
      </Fragment>
    );
  });
}

/** Trans 的 render（狀態說明、按鈕這類沒有標籤的訊息）：翻譯只有文字時依詞換行，有元素時照原樣 */
export function TermProseRich({ translation, names, maxEm, tailEm }: TransRenderProps & TermProseOptions) {
  const nodes = Children.toArray(translation);
  return <>{nodes.every((n) => typeof n === 'string') ? <TermProse text={nodes.join('')} names={names} maxEm={maxEm} tailEm={tailEm} /> : translation}</>;
}
