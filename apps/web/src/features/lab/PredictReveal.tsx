// 預測揭曉卡（階段 3 的最上面，維護者 2026-11-01 實機回饋）：記下預測之後一次看到每個目標你猜的方向、實際方向、對或錯，最上面是猜對幾個；
// 錯的列附前後數字。圖示加文字加顏色（不只靠顏色），和後面階段的對錯 chip 同一套圖示。
import { useLingui } from '@lingui/react/macro';
import { formatNumber, type Locale } from '@ledgerland/i18n';
import { CheckCircleIcon, XCircleIcon, useDirectionLabels } from '@ledgerland/web-ui';
import type { PredictChoice } from './predict.ts';
import { useRatioChoiceLabels } from './PredictPanel.tsx';

export interface RevealItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'line' | 'account' | 'ratio';
  readonly chosen: PredictChoice | undefined;
  readonly answer: PredictChoice;
  readonly correct: boolean;
  readonly nearly: boolean;
  /** 前後的數字（指標沒有） */
  readonly detail?: string;
}

export interface PredictRevealProps {
  items: readonly RevealItem[];
  right: number;
  total: number;
  locale: Locale;
  /** 一句話的原因（例如這筆交易不經過損益表） */
  note?: string;
}

export function PredictReveal({ items, right, total, locale, note }: PredictRevealProps) {
  const { t } = useLingui();
  const dir = useDirectionLabels();
  const ratio = useRatioChoiceLabels();
  const choiceLabel = (kind: RevealItem['kind'], c: PredictChoice | undefined): string => {
    if (c === undefined) return t({ id: 'lab.reveal.none', message: '沒有選', comment: '揭曉卡：這個目標沒有猜' });
    if (kind === 'ratio') return ratio[c].replace(/^[▲▼＝] /, '');
    return c in dir ? dir[c as keyof typeof dir] : ratio[c];
  };
  const rightText = formatNumber(right, locale);
  const totalText = formatNumber(total, locale);
  return (
    <section className="ll-lab-reveal-card" aria-labelledby="ll-lab-reveal-title" data-testid="lab-reveal">
      <h3 id="ll-lab-reveal-title" className="ll-lab-reveal-card__title">
        {t({ id: 'lab.reveal.title', message: `揭曉：${totalText} 個猜對 ${rightText} 個`, comment: '揭曉卡的標題；兩個數字已格式化' })}
      </h3>
      {note && <p className="ll-lab-reveal-card__note">{note}</p>}
      <ul className="ll-lab-reveal-card__list">
        {items.map((i) => {
          const chosen = choiceLabel(i.kind, i.chosen);
          const answer = choiceLabel(i.kind, i.answer);
          return (
            <li key={i.id} className={`ll-lab-reveal-card__item is-${i.correct ? 'right' : 'wrong'}`} data-correct={i.correct ? 'true' : 'false'}>
              <span className="ll-lab-reveal-card__icon" aria-hidden="true">
                {i.correct ? <CheckCircleIcon /> : <XCircleIcon />}
              </span>
              <span className="ll-lab-reveal-card__body">
                <span className="ll-lab-reveal-card__label">{i.label}</span>
                <span className="ll-lab-reveal-card__text">
                  {i.correct
                    ? i.nearly
                      ? t({
                          id: 'lab.reveal.nearly',
                          message: `你猜${chosen}，幾乎不變（變動小於顯示位數），算對`,
                          comment: '揭曉卡：指標四捨五入後前後相同；chosen 是選項文字',
                        })
                      : t({ id: 'lab.reveal.right', message: `你猜${chosen}，答對了`, comment: '揭曉卡的一列；chosen 是選項文字' })
                    : t({ id: 'lab.reveal.wrong', message: `你猜${chosen}，實際是${answer}`, comment: '揭曉卡的一列；chosen 與 answer 是選項文字' })}
                </span>
                {i.detail && <span className="ll-lab-reveal-card__detail">{i.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
