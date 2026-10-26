// 關卡結果頁（03 第 2.10 節、17 第 5.3 節、站規 2.4.2）：手機是滿版舞台（鈴看起來 120px、三顆 56px 星排成弧形依序點亮、「完成了！」、
// 成績小卡兩欄：正確率、計分題數；有資料時新收名詞與用時各是一整列的橫條，左邊圖示加標籤、右邊數字），兩顆動作固定在 Tab bar 上方的底部區：
// primary「回到地圖」（帶 ?from=<levelId>）、secondary「再挑戰」（沒有星星時對調）；600px 以上是一張置中的結果卡（鈴同樣大），兩顆並排各半。
// 舞台窄到放不下兩欄（文字放大 200%、320px）時成績小卡改一欄。減少動態時星星同時出現。版面在 web-ui 的 15-quiz-session.css。
// 章節完成不在這裡慶祝（只在地圖章末區顯示徽章加 Toast，2026-10-24 的決定），也不加彩帶粒子。
// 鈴的表情跟著成績（M3 驗收第 2 輪）：一顆星以上揮手加笑眼與星光（joy）；沒有星星時雙手交握、微笑、不閃光，
// 標題改成「這次還沒拿到星星」、下面加一行鼓勵，兩顆按鈕對調（M3 驗收第 5 輪）：primary「再挑戰」在上、secondary「回到地圖」在下，
// 畫面要玩家再試一次，主按鈕就不把人帶走。位置、間距與底部固定的規則不變。
// 說明句裡的「錯題本」「計分題」與鼓勵句的「再挑戰」「星星」包成全站的不換行 span（.ll-nowrap，03-core-utils.css）：換行照全站規則（逐字換行加 line-break: strict），專有名詞不會從中間拆開。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatNumber, formatPercent, localePath, type Locale } from '@ledgerland/i18n';
import type { LevelScore } from '@ledgerland/quiz';
import { Button, CardsIcon, RetryIcon, Stars, TimerIcon } from '@ledgerland/web-ui';
import { MapIcon, MapMarker } from '@ledgerland/web-ui/map';
import { splitSeconds, usedSecondsOf } from './timer.ts';

/** 鈴的 svg 尺寸：viewBox 上下有留白，可見的帽頂到鞋底約是尺寸的 0.79，看起來 120px（15-quiz-session.css 把留白收掉） */
const BELL = 152;

export interface ResultViewProps {
  locale: Locale;
  levelId: string;
  title: string;
  score: LevelScore;
  wrongCount: number;
  onRetry: () => void;
  /** 完成前已經是最佳成績時仍顯示本次成績；bestStars 給「最佳」標示 */
  bestStars?: 0 | 1 | 2 | 3;
  /** 整關不計分（level.unscored）：標題改成「已讀完這一關」，不顯示星星、正確率與錯題本的說明 */
  unscored?: boolean;
  /** 這一關的用時（計時有開才傳；03 第 2.10 節「結果頁另外記錄用時」）：不含暫停與看回饋的時間，時間到之後繼續累計 */
  timeUsedMs?: number;
  /** 這一輪新收進圖鑑的名詞數（有資料、大於 0 才傳） */
  newTerms?: number;
}

export function ResultView({ locale, levelId, title, score, wrongCount, onRetry, bestStars, unscored = false, timeUsedMs, newTerms }: ResultViewProps) {
  const { t } = useLingui();
  const noStars = !unscored && score.stars === 0;
  const mapHref = localePath(locale, `/play/?from=${encodeURIComponent(levelId)}`);
  const backToMap = (
    <Button variant={noStars ? 'secondary' : 'primary'} size="lg" icon={<MapIcon />} href={mapHref}>
      <Trans id="level.result.backToMap" comment="結果頁回到闖關地圖的按鈕">
        回到地圖
      </Trans>
    </Button>
  );
  const again = (
    <Button variant={noStars ? 'primary' : 'secondary'} size="lg" icon={<RetryIcon />} onClick={onRetry}>
      {unscored ? (
        <Trans id="level.result.readAgain" comment="不計分關卡的結果頁：再看一次這一關的按鈕">
          再看一次
        </Trans>
      ) : (
        <Trans id="level.result.retry" comment="結果頁重玩同一關的按鈕">
          再挑戰
        </Trans>
      )}
    </Button>
  );
  // 主要的在前：一般是「回到地圖」，沒有星星時是「再挑戰」
  const actions = (
    <div className="ll-result__actions">
      {noStars ? again : backToMap}
      {noStars ? backToMap : again}
    </div>
  );
  if (unscored)
    return (
      <section className="ll-result ll-result--unscored" aria-labelledby="ll-result-title" data-testid="result">
        <div className="ll-result__stage">
          <div className="ll-result__bell" aria-hidden="true">
            <MapMarker pose="clasp" expression="joy" size={BELL} />
          </div>
          <h2 id="ll-result-title" className="ll-result__title" tabIndex={-1} data-testid="result-title">
            <Trans id="level.result.unscoredTitle" comment="整關不計分（取捨題）的結果頁標題">
              已讀完這一關
            </Trans>
          </h2>
          <p className="ll-result__level">{title}</p>
          <p className="ll-result__note">
            <Trans id="level.result.unscoredNote" comment="整關不計分的結果頁說明：沒有星星，也不進錯題本（「錯題本」包在不換行的標籤裡）">
              這一關的題目沒有標準答案，不算星星，也不會進<span className="ll-nowrap">錯題本</span>。
            </Trans>
          </p>
        </div>
        {actions}
      </section>
    );
  const ratio = formatPercent(score.ratio, locale, { digits: 0 });
  const scored = formatNumber(score.scoredCount, locale);
  const wrongN = formatNumber(wrongCount, locale);
  return (
    <section className={`ll-result${noStars ? ' ll-result--nostars' : ''}`} aria-labelledby="ll-result-title" data-testid="result">
      <div className="ll-result__stage">
        <div className="ll-result__bell" aria-hidden="true" data-testid="result-bell" data-mood={noStars ? 'encourage' : 'joy'}>
          {noStars ? <MapMarker pose="clasp" expression="smile" size={BELL} /> : <MapMarker pose="wave" expression="joy" size={BELL} />}
        </div>
        <Stars value={score.stars} size={56} className="ll-result__stars" />
        <h2 id="ll-result-title" className="ll-result__title" tabIndex={-1} data-testid="result-title">
          {noStars ? (
            <Trans id="level.result.title.noStar" comment="關卡結果頁的標題：這一輪沒有拿到星星（下面接一行鼓勵與「再挑戰」主按鈕）">
              這次還沒拿到星星
            </Trans>
          ) : (
            <Trans id="level.result.title" comment="關卡結果頁的標題">
              完成了！
            </Trans>
          )}
        </h2>
        <p className="ll-result__level">{title}</p>
        {noStars && (
          <p className="ll-result__cheer" data-testid="result-cheer">
            <Trans
              id="level.result.cheerLine"
              comment="結果頁沒有拿到星星（正確率很低）時，標題下面的一行鼓勵（「再挑戰」是按鈕的名稱、「星星」是成績，都包在不換行的標籤裡）"
            >
              看過解說<span className="ll-nowrap">再挑戰</span>一次，<span className="ll-nowrap">星星</span>就會亮起來。
            </Trans>
          </p>
        )}
        {bestStars !== undefined && bestStars > score.stars && (
          <p className="ll-result__best">
            {t({
              id: 'level.result.bestKept',
              message: `保留你之前的最佳成績（${bestStars} 顆星）。`,
              comment: '這次成績沒有超過之前時的說明；bestStars 是之前的顆數',
            })}
          </p>
        )}
        <dl className="ll-result__stats">
          <div className="ll-result__stat" data-testid="result-ratio">
            <dt>{t({ id: 'level.result.stat.ratio', message: '正確率', comment: '結果頁成績小卡：正確率的標籤' })}</dt>
            <dd>
              <span className="ll-result__num ll-num">{ratio}</span>
            </dd>
          </div>
          <div className="ll-result__stat" data-testid="result-scored">
            <dt>{t({ id: 'level.result.stat.scored', message: '計分題', comment: '結果頁成績小卡：計分題數的標籤' })}</dt>
            <dd>
              <Trans id="level.result.stat.scoredValue" comment="結果頁成績小卡：計分題數；n 是已格式化的題數（數字放大、單位小字）">
                <span className="ll-result__num ll-num">{scored}</span> 題
              </Trans>
            </dd>
          </div>
          {newTerms !== undefined && newTerms > 0 && <NewTerms n={newTerms} locale={locale} />}
          {timeUsedMs !== undefined && <TimeUsed ms={timeUsedMs} locale={locale} />}
        </dl>
        <p className="ll-result__note">
          {wrongCount > 0 ? (
            <Trans id="level.result.wrongAddedNote" comment="結果頁：有答錯時的說明；wrongN 是已格式化的題數（「錯題本」包在不換行的標籤裡）">
              答錯的題目已放進<span className="ll-nowrap">錯題本</span>（{wrongN} 題）。
            </Trans>
          ) : (
            <Trans id="level.result.allCorrectNote" comment="結果頁：全對時的說明（「計分題」「錯題本」包在不換行的標籤裡）">
              <span className="ll-nowrap">計分題</span>全部答對，沒有題目進<span className="ll-nowrap">錯題本</span>。
            </Trans>
          )}
          {/* 兩句之間：英文要空格，中文的句號後面不加 */}
          {timeUsedMs !== undefined && (
            <>
              {locale === 'en' ? ' ' : ''}
              {t({ id: 'level.result.timeNote', message: '計時不影響星星。', comment: '結果頁有用時時的補充說明' })}
            </>
          )}
        </p>
      </div>
      {actions}
    </section>
  );
}

function NewTerms({ n, locale }: { n: number; locale: Locale }) {
  const { t } = useLingui();
  const count = formatNumber(n, locale);
  return (
    <div className="ll-result__stat ll-result__stat--row" data-testid="result-terms">
      <dt>
        <span className="ll-result__stat-icon" aria-hidden="true">
          <CardsIcon />
        </span>
        {t({ id: 'level.result.stat.terms', message: '新收名詞', comment: '結果頁成績小卡：這一輪新收進圖鑑的名詞數的標籤' })}
      </dt>
      <dd>
        <Trans id="level.result.stat.termsValue" comment="結果頁成績小卡：新收名詞數；count 是已格式化的個數（數字放大、單位小字）">
          <span className="ll-result__num ll-num">{count}</span> 個
        </Trans>
      </dd>
    </div>
  );
}

/** 結果頁的用時：「3 分 12 秒」（數字放大、單位小字）；不到一分鐘只寫秒。計時不影響星星（03 第 2.10 節） */
function TimeUsed({ ms, locale }: { ms: number; locale: Locale }) {
  const { t } = useLingui();
  const { minutes, seconds } = splitSeconds(usedSecondsOf(ms));
  const m = formatNumber(minutes, locale);
  const s = formatNumber(seconds, locale);
  return (
    <div className="ll-result__stat ll-result__stat--row" data-testid="result-time">
      <dt>
        <span className="ll-result__stat-icon" aria-hidden="true">
          <TimerIcon />
        </span>
        {t({ id: 'level.result.stat.time', message: '用時', comment: '結果頁成績小卡：這一關用時的標籤（計時有開才顯示）' })}
      </dt>
      <dd>
        {minutes > 0 ? (
          <Trans id="level.result.stat.timeValue" comment="結果頁成績小卡的用時；m、s 是已格式化的分與秒（數字放大、單位小字）">
            <span className="ll-result__num ll-num">{m}</span> 分 <span className="ll-result__num ll-num">{s}</span> 秒
          </Trans>
        ) : (
          <Trans id="level.result.stat.timeSeconds" comment="結果頁成績小卡的用時，不到一分鐘；s 是已格式化的秒數（數字放大、單位小字）">
            <span className="ll-result__num ll-num">{s}</span> 秒
          </Trans>
        )}
      </dd>
    </div>
  );
}
