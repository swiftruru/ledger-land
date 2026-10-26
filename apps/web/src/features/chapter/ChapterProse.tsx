// 章節摘要與學習目標的文字：prose.ts 切出的單位與詞。兩個詞以上的單位包成 span.ch-u，兩個字以上的詞包成 span.ch-w
// （超過 4 個字寬的長詞是 span.ch-l）；chapter.css 依欄寬決定哪一層不拆（欄寬至少 12 個字：單位不拆；至少 4.5 個字：短詞不拆；
// 至少 6.5 個字：長詞也不拆；更窄時照一般規則斷，不撐破版面）。
// 長詞裡如果有幾個小詞（名詞「本期淨利、」是「本期」「淨利、」），小詞再各自包成 span.ch-w：欄寬在 4.5 到 6.5 個字之間時
// （320 加 200% 的目標欄）長詞可以拆，但只在小詞之間斷，不斷成「本期淨／利」「期初存／貨」。
// 開頭的全形左括號、引號放在 span 外面：Chromium 在 white-space: nowrap 的 span 裡不套用 text-spacing-trim（base.css 的 trim-start），
// 換到行首的「（N/A）」會多出半個字寬的空白（第 4 輪驗收修過的問題）。左括號後面本來就不能換行（line-break），放在外面一樣跟著下一個字。
// 只加 span，textContent 不變，可讀名稱與 E2E 的文字比對不受影響。
import { Fragment, useMemo } from 'react';
import { emWidth, proseUnits, type ProsePiece } from './prose.ts';

const LEADING_OPEN = /^[「『“‘（(［[【〈《]+/u;

/** 開頭的左括號、引號的長度 */
const leadOf = (text: string) => LEADING_OPEN.exec(text)?.[0].length ?? 0;

/** 拿掉開頭 n 個字（開頭的括號一定在第一個小詞裡，後面還有字） */
function dropLead(words: ProsePiece, n: number): ProsePiece {
  return n === 0 ? words : [words[0]!.slice(n), ...words.slice(1)].filter((w) => w !== '');
}

const classOf = (text: string) => (emWidth(text) > 4 ? 'ch-l' : 'ch-w');
const wraps = (text: string) => text.length >= 2 && text.trim() === text;

/** 長詞裡的小詞 */
function Word({ text }: { text: string }) {
  return wraps(text) ? <span className={classOf(text)}>{text}</span> : <>{text}</>;
}

function Piece({ words, lead = true }: { words: ProsePiece; lead?: boolean }) {
  const text = words.join('');
  const n = lead ? leadOf(text) : 0;
  const rest = text.slice(n);
  if (!wraps(rest)) return <>{text}</>;
  const inner = dropLead(words, n);
  const cls = classOf(rest);
  return (
    <>
      {text.slice(0, n)}
      <span className={cls}>{cls === 'ch-l' && inner.length > 1 ? inner.map((w, i) => <Word key={i} text={w} />) : rest}</span>
    </>
  );
}

export function ChapterProse({ text }: { text: string }) {
  const units = useMemo(() => proseUnits(text), [text]);
  if (!units) return <>{text}</>;
  return (
    <>
      {units.map((pieces, i) => {
        if (pieces.length === 1)
          return (
            <Fragment key={i}>
              <Piece words={pieces[0]!} />
            </Fragment>
          );
        const n = leadOf(pieces[0]!.join(''));
        return (
          <Fragment key={i}>
            {pieces[0]!.join('').slice(0, n)}
            <span className="ch-u">
              <Piece words={dropLead(pieces[0]!, n)} lead={false} />
              {pieces.slice(1).map((p, j) => (
                <Piece key={j} words={p} />
              ))}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}
