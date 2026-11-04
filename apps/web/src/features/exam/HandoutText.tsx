// 講義原文的顯示（M4c）：逐字照講義，只把換行切成段落；不用 innerHTML。文字一律是中文，英文站也標 lang="zh-TW" 給螢幕閱讀器。
import type { ReactNode } from 'react';

export function HandoutText({ text, className, as: Tag = 'div' }: { text: string; className?: string; as?: 'div' | 'span' }) {
  const paragraphs = text.split('\n').filter((p) => p.trim() !== '');
  const body: ReactNode =
    Tag === 'span' || paragraphs.length <= 1 ? (
      paragraphs.join(' ')
    ) : (
      <>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </>
    );
  return (
    <Tag lang="zh-TW" className={`ll-handout-text${className ? ` ${className}` : ''}`}>
      {body}
    </Tag>
  );
}
