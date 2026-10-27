// 題目文字的渲染（05 第 10 節）：數值佔位符換成格式化字串、{{option:o_x}} 換成加引號的選項文字（<q class="ll-optref">）、{{term:tm_x}} 做成 TermChip（|plain 只輸出文字）。
// 純文字的部分在 placeholders.ts；這裡只負責 React 節點與名詞卡的開啟。
// 換行照全站規則（07 第 3.5 節，2026-10-27 起）：中文逐字換行、標點不落行首、段落齊行；英文只在空格換行。不再切詞、不加 <wbr>。
import { useRef, type ReactNode } from 'react';
import { TermChip } from '@ledgerland/web-ui';
import { formatValuePlaceholder, inlineTermLabel, nestOptionQuotes, splitMarkup, splitParagraphs, type ValueContext } from './placeholders.ts';
import { useTerms } from './terms.tsx';

export interface MarkupProps {
  text: string;
  ctx?: ValueContext;
  /** 本題的選項文字（short 優先），給 {{option:…}} 用 */
  options?: ReadonlyMap<string, string>;
  /** 題幹或選項裡出現名詞時只顯示文字（避免在 label 裡放按鈕）；回饋與解說可以做成 chip */
  plainTerms?: boolean;
}

function TermChipInline({ id, label }: { id: string; label: string }) {
  const { openTerm } = useTerms();
  const ref = useRef<HTMLButtonElement>(null);
  // 行內 chip 依 WCAG 2.5.8 的行內例外不放大到 44px（07 第 8.4 節的例外，2026-10-24 規劃者決定）
  return <TermChip ref={ref} label={label} inline onClick={() => openTerm(id, ref)} />;
}

export function Markup({ text, ctx = {}, options, plainTerms = false }: MarkupProps) {
  const { locale, labelOf } = useTerms();
  const segments = splitMarkup(text);
  const nodes: ReactNode[] = [];
  let before = '';
  segments.forEach((s, i) => {
    const prev = before;
    before += s.kind === 'text' ? s.text : 'x';
    if (s.kind === 'text') {
      nodes.push(s.text);
      return;
    }
    switch (s.type) {
      case 'money':
      case 'percent':
      case 'number':
      case 'date':
        nodes.push(
          <span key={i} className="ll-num">
            {formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale)}
          </span>,
        );
        return;
      case 'option':
        // 選項引用包在 <q>：引號由 CSS 依語言給（中文「」、英文英式的 ‘ ’，feedback.css 的 .ll-optref），字重 600，讀者看得出選項在哪裡結束；
        // 選項自己帶的引號換成第二層（nestOptionQuotes）。只有解說用到選項引用，樣式跟著 FeedbackView 載入
        nodes.push(
          <q key={i} className="ll-optref">
            {nestOptionQuotes(options?.get(s.ref) ?? s.ref, locale)}
          </q>,
        );
        return;
      case 'term': {
        // 英文句中的名詞首字母轉小寫（縮寫保留），chip 與 |plain 一樣（placeholders.ts 的 inlineTermLabel）
        const found = labelOf(s.ref);
        const label = found === undefined ? s.ref : inlineTermLabel(found, locale, prev);
        nodes.push(plainTerms || s.options.includes('plain') ? <span key={i}>{label}</span> : <TermChipInline key={i} id={s.ref} label={label} />);
        return;
      }
      default:
        nodes.push(<span key={i}>{s.ref}</span>);
    }
  });
  return <>{nodes}</>;
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
