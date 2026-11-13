// 每天練了幾題的長條圖（2026-11-13，練習紀錄頁）：一天一根堆疊長條，下面是答對、上面是答錯。自己用 HTML 與 CSS 畫，不引進圖表套件；
// 文字是頁面的字級（不隨圖縮放），顏色只用 tokens 的狀態色（答對 success、答錯 danger）。
// 答對與答錯不只靠顏色分：答錯那一段有斜線紋、永遠在上面，兩段之間留 2px 的空隙，上面有帶文字的圖例
// （淺色主題這兩個顏色在紅綠色覺異常下的色差是 6.2，低於 8，所以一定要有第二種標示）。
// 整張圖是一張 role="img" 的圖加一句摘要；每天的詳細數字在頁面下面的表格（鍵盤與螢幕閱讀器看表格）。
// 滑鼠移過或手指點一天，圖下面的一行字換成那一天的數字（預設是今天）；感應的範圍是整個繪圖區，不是 44px 不到的長條。
import { useLingui } from '@lingui/react/macro';
import { useState, type PointerEvent } from 'react';
import { formatMonthDay, formatNumber } from '@ledgerland/i18n';
import { useLocale } from '../../lib/useLocale.ts';
import { axisTop, type DayRow } from './history.ts';

export interface DayChartProps {
  /** 要畫的那幾天，由早到晚，一天一列（沒練的日子是 0） */
  days: readonly DayRow[];
  today: string;
}

const pct = (value: number, top: number): string => `${(value / top) * 100}%`;

export function DayChart({ days, today }: DayChartProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const n = (x: number) => formatNumber(x, locale);
  const [picked, setPicked] = useState<string | null>(null);
  const last = days[days.length - 1];
  if (!last) return null;
  const max = Math.max(...days.map((d) => d.answered));
  const top = axisTop(Math.max(1, max));
  const shown = days.find((d) => d.day === picked) ?? last;
  // 橫軸的日期：14 天以內隔一天標一個，再多就每 5 天標一個；都從最後一天（今天）往回數
  const every = days.length > 14 ? 5 : 2;
  const nameOf = (day: string): string =>
    day === today ? t({ id: 'exam.history.today', message: '今天', comment: '練習紀錄：圖表橫軸與說明裡的「今天」' }) : formatMonthDay(day, locale);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * days.length);
    const d = days[Math.max(0, Math.min(days.length - 1, i))];
    if (d) setPicked(d.day);
  };
  const active = days.filter((d) => d.answered > 0).length;
  const name = nameOf(shown.day);
  return (
    <figure className="ll-daychart" data-testid="exam-daychart">
      <ul className="ll-daychart__legend">
        <li>
          <span className="ll-daychart__key ll-daychart__seg--ok" aria-hidden="true" />
          {t({ id: 'exam.history.legend.correct', message: '答對', comment: '練習紀錄圖表的圖例：答對的題數' })}
        </li>
        <li>
          <span className="ll-daychart__key ll-daychart__seg--no" aria-hidden="true" />
          {t({ id: 'exam.history.legend.wrong', message: '答錯', comment: '練習紀錄圖表的圖例：答錯的題數' })}
        </li>
      </ul>
      <div
        className="ll-daychart__plot"
        role="img"
        aria-label={t({
          id: 'exam.history.chart.label',
          message: `近 ${n(days.length)} 天每天練了幾題的長條圖：有練習的有 ${n(active)} 天，最多的一天 ${n(max)} 題。每天的數字在下面的表格。`,
          comment: '練習紀錄圖表的可讀名稱；days 是天數、active 是有練習的天數、max 是最多的一天的題數（都已格式化）',
        })}
      >
        <div className="ll-daychart__axis ll-num" aria-hidden="true">
          {[top, top / 2, 0].map((v) => (
            <span key={v} style={{ bottom: pct(v, top) }}>
              {n(v)}
            </span>
          ))}
        </div>
        <div className="ll-daychart__cols" aria-hidden="true" onPointerMove={pick} onPointerDown={pick}>
          <i className="ll-daychart__line" style={{ bottom: '50%' }} />
          <i className="ll-daychart__line" style={{ bottom: '100%' }} />
          {days.map((d) => (
            <div key={d.day} className="ll-daychart__col" data-day={d.day} data-picked={d.day === shown.day ? 'true' : undefined}>
              {d.answered - d.correct > 0 && <span className="ll-daychart__seg ll-daychart__seg--no" style={{ height: pct(d.answered - d.correct, top) }} />}
              {d.correct > 0 && <span className="ll-daychart__seg ll-daychart__seg--ok" style={{ height: pct(d.correct, top) }} />}
            </div>
          ))}
        </div>
        <div className="ll-daychart__xs ll-num" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.day} className="ll-daychart__x" data-today={d.day === today ? 'true' : undefined}>
              {(days.length - 1 - i) % every === 0 && <span>{nameOf(d.day)}</span>}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="ll-daychart__readout ll-num" data-testid="exam-daychart-readout">
        {shown.answered === 0
          ? t({ id: 'exam.history.readout.none', message: `${name}：沒有練習`, comment: '練習紀錄圖表下面的一行：選到的那一天沒有作答；name 是日期或「今天」' })
          : t({
              id: 'exam.history.readout',
              message: `${name}：練了 ${n(shown.answered)} 題，答對 ${n(shown.correct)} 題、答錯 ${n(shown.answered - shown.correct)} 題`,
              comment: '練習紀錄圖表下面的一行：選到的那一天的數字；name 是日期或「今天」，數字都已格式化',
            })}
      </figcaption>
    </figure>
  );
}
