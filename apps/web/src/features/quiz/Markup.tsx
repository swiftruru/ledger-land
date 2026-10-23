// 題目文字的渲染（05 第 10 節）：數值佔位符換成格式化字串、{{option:o_x}} 換成選項文字、{{term:tm_x}} 做成 TermChip（|plain 只輸出文字）。
// 純文字的部分在 placeholders.ts；這裡只負責 React 節點與名詞卡的開啟。
import { useRef, type ReactNode } from 'react';
import { TermChip } from '@ledgerland/web-ui';
import { formatValuePlaceholder, splitMarkup, type ValueContext } from './placeholders.ts';
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
  return <TermChip ref={ref} label={label} onClick={() => openTerm(id, ref)} />;
}

export function Markup({ text, ctx = {}, options, plainTerms = false }: MarkupProps) {
  const { locale, labelOf } = useTerms();
  const nodes: ReactNode[] = [];
  splitMarkup(text).forEach((s, i) => {
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
        nodes.push(<span key={i}>{options?.get(s.ref) ?? s.ref}</span>);
        return;
      case 'term': {
        const label = labelOf(s.ref) ?? s.ref;
        if (plainTerms || s.options.includes('plain')) nodes.push(<span key={i}>{label}</span>);
        else nodes.push(<TermChipInline key={i} id={s.ref} label={label} />);
        return;
      }
      default:
        nodes.push(<span key={i}>{s.ref}</span>);
    }
  });
  return <>{nodes}</>;
}
