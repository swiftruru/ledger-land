// 說明頁長段落的中文換行（M3 驗收第 7 輪，pages-b）：Trans 的 render，把 prose-units.ts 決定的「不斷開的單位」包成 span.ll-nowrap
// （web-ui 的全站 class），行尾不停在詞的中間（第 5 輪的「進度消／失」「加入主／畫面」）；詞與詞之間照常換行，每行最多短一個詞，
// 不會像第 6 輪的 keep-all 那樣每行都停在逗號。規則與量測見 prose-units.ts。
// 用法：`<Trans id="…" render={ProseWords}>…</Trans>`；訊息裡已經包 .ll-nowrap 的元素（介面名稱、網址、「我的 › 備份」連結）整塊保留。
// 英文或不支援 Segmenter 時照原字。<span> 不改 textContent（E2E 的文字比對、可讀名稱不受影響）。
import { Fragment, cloneElement, isValidElement, type ReactNode } from 'react';
import type { TransRenderProps } from '@lingui/react';
import { proseUnits } from './prose-units.ts';

/** 整塊不斷的單位頭尾的引號與括號放在 span 外面（第 7 輪 handoff：Chromium 的 text-spacing-trim 在 nowrap 的 span 裡不作用，
 *  「落在行首時多半個字的空白）；開括號後、閉括號前本來就不能換行，引號仍黏著名稱 */
const EDGE = /^([「『（]?)(.*?)([」』）]?)$/su;

function wrapText(text: string, key: string): ReactNode {
  const units = proseUnits(text);
  if (!units) return text;
  return units.map(([t, keep], i) => {
    if (!keep) return <Fragment key={`${key}.${i}`}>{t}</Fragment>;
    const [, open = '', core = t, close = ''] = EDGE.exec(t) ?? [];
    return (
      <Fragment key={`${key}.${i}`}>
        {open}
        <span className="ll-nowrap">{core}</span>
        {close}
      </Fragment>
    );
  });
}

function wrapNode(node: ReactNode, key: string): ReactNode {
  if (typeof node === 'string') return wrapText(node, key);
  if (Array.isArray(node)) return node.map((n: ReactNode, i) => wrapNode(n, `${key}.${i}`));
  if (isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    const { className, children } = node.props;
    if (children == null || (className ?? '').split(' ').includes('ll-nowrap')) return node;
    return cloneElement(node, undefined, wrapNode(children, key));
  }
  return node;
}

/** Trans 的 render：翻譯裡的中文字串依詞包成不斷開的 span，元素裡的字也一樣（已經是 .ll-nowrap 的元素原樣保留） */
export function ProseWords({ translation }: TransRenderProps) {
  return <>{wrapNode(translation, 'w')}</>;
}
