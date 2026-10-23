// 關卡結果頁（03 第 2.10 節、17 第 5.3 節）：正確率、星星、「答錯的題目已放進錯題本」、回到地圖（帶 ?from=<levelId>）、再挑戰。
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from 'react-router';
import { formatPercent, localePath, type Locale } from '@ledgerland/i18n';
import type { LevelScore } from '@ledgerland/quiz';
import { Button, Card, Stars } from '@ledgerland/web-ui';

export interface ResultViewProps {
  locale: Locale;
  levelId: string;
  title: string;
  score: LevelScore;
  wrongCount: number;
  onRetry: () => void;
  /** 完成前已經是最佳成績時仍顯示本次成績；bestStars 給「最佳」標示 */
  bestStars?: 0 | 1 | 2 | 3;
}

export function ResultView({ locale, levelId, title, score, wrongCount, onRetry, bestStars }: ResultViewProps) {
  const { t } = useLingui();
  const ratio = formatPercent(score.ratio, locale, { digits: 0 });
  const scoredCount = score.scoredCount;
  return (
    <Card as="section" className="ll-result" aria-labelledby="ll-result-title">
      <h2 id="ll-result-title" tabIndex={-1} data-testid="result-title">
        <Trans id="level.result.title" comment="關卡結果頁的標題">
          完成了！
        </Trans>
      </h2>
      <p className="ll-muted">{title}</p>
      <div className="ll-row">
        <Stars value={score.stars} size={28} />
        <span className="ll-num" data-testid="result-ratio">
          {t({
            id: 'level.result.ratio',
            message: `正確率 ${ratio}（計分題 ${scoredCount} 題）`,
            comment: '結果頁的正確率；ratio 已格式化成百分比、scoredCount 是計分題數',
          })}
        </span>
      </div>
      {bestStars !== undefined && bestStars > score.stars && (
        <p className="ll-muted ll-small">
          {t({
            id: 'level.result.bestKept',
            message: `保留你之前的最佳成績（${bestStars} 顆星）。`,
            comment: '這次成績沒有超過之前時的說明；bestStars 是之前的顆數',
          })}
        </p>
      )}
      <p>
        {wrongCount > 0
          ? t({ id: 'level.result.wrongAdded', message: `答錯的題目已放進錯題本（${wrongCount} 題）。`, comment: '結果頁：有答錯時的說明；wrongCount 是題數' })
          : t({ id: 'level.result.allCorrect', message: '計分題全部答對，沒有題目進錯題本。', comment: '結果頁：全對時的說明' })}
      </p>
      <div className="ll-row ll-actions">
        <Link className="ll-btn ll-btn--primary" to={localePath(locale, `/play/?from=${encodeURIComponent(levelId)}`)}>
          <Trans id="level.result.backToMap" comment="結果頁回到闖關地圖的按鈕">
            回到地圖
          </Trans>
        </Link>
        <Button onClick={onRetry}>
          <Trans id="level.result.retry" comment="結果頁重玩同一關的按鈕">
            再挑戰
          </Trans>
        </Button>
      </div>
    </Card>
  );
}
