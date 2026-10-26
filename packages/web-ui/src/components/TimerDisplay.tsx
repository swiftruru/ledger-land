// 作答頁的倒數文字與暫停按鈕（03 第 2.10 節）：文字「剩 4 分 30 秒」、隨時可暫停；時間到只顯示「時間到了，你可以繼續作答」（暫停中仍可按「繼續」）。
// 螢幕閱讀器：倒數文字不是 live region，所以不會每秒播報，但瀏覽模式讀得到（「剩 4 分 30 秒」「已暫停」）；
// 只在剩 1 分鐘與時間到時用 role="status" 各提醒一次。重新整理後還原、或提醒設定晚讀到時，已經剩不到一分鐘就播實際剩下的秒數。
// 暫停鈕是 Button quiet sm（PauseIcon、PlayIcon）的一般動作按鈕：文字（暫停、繼續）本身就是狀態，不加 aria-pressed（「繼續，已按下」語意相反，quiz-23）。
// 外觀是一顆膠囊（11-quiz-timer.css）：時鐘圖示、剩餘時間、已暫停的小標與暫停鈕；時間到改成 warning 色；根元素有 :focus-visible 的焦點框。
// 時間到又暫停時按「繼續」，按鈕會消失：焦點先移到計時區（tabIndex -1、時間到時有名稱），不掉到 body。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@ledgerland/i18n';
import { Button } from './Button.tsx';
import { PauseIcon, PlayIcon, TimerIcon } from './icons.tsx';
import { useUiLocale } from './NumberInput.tsx';

export interface TimerDisplayProps {
  /** 剩餘整秒；0 代表時間到 */
  remainingSeconds: number;
  paused: boolean;
  /** 按暫停或繼續 */
  onToggle: () => void;
  /** 關閉剩 1 分鐘與時間到的播報（設定裡可關） */
  silent?: boolean;
  className?: string;
}

const WARN_SECONDS = 60;

export function TimerDisplay({ remainingSeconds, paused, onToggle, silent, className }: TimerDisplayProps) {
  const { t } = useLingui();
  const locale = useUiLocale();
  const secs = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  const expired = secs === 0;
  const m = formatNumber(minutes, locale);
  const s = formatNumber(seconds, locale);
  const [live, setLive] = useState('');
  const announced = useRef<{ warn: boolean; expired: boolean }>({ warn: false, expired: false });
  // 這次掛載上一次看到的剩餘秒數：從 60 秒以上跨進一分鐘內才播「剩 1 分鐘」，一開始就在一分鐘內（還原、設定晚讀到）播實際秒數
  const prevSecs = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = prevSecs.current;
    prevSecs.current = secs;
    if (silent) return;
    if (expired && !announced.current.expired) {
      announced.current.expired = true;
      setLive(t({ id: 'timer.expired', message: '時間到了，你可以繼續作答', comment: '計時結束的提示（不送出、不影響星星）' }));
    } else if (!expired && secs <= WARN_SECONDS && !announced.current.warn) {
      announced.current.warn = true;
      const crossed = before !== null && before > WARN_SECONDS;
      setLive(
        crossed
          ? t({ id: 'timer.oneMinute', message: '剩 1 分鐘', comment: '剩一分鐘時的螢幕閱讀器提醒（只播一次）' })
          : t({ id: 'timer.remainingSeconds', message: `剩 ${s} 秒`, comment: '不到一分鐘時的倒數文字；seconds 是已格式化的數字' }),
      );
    }
  }, [expired, secs, silent, t, s]);
  const expiredLabel = t({ id: 'timer.expired', message: '時間到了，你可以繼續作答', comment: '計時結束的提示（不送出、不影響星星）' });
  const showToggle = !expired || paused;
  const toggle = () => {
    // 時間到又暫停時按「繼續」，按鈕會被移除：同一個事件裡先把焦點移到計時區
    const hides = expired && paused;
    onToggle();
    if (hides) rootRef.current?.focus();
  };
  return (
    <div
      ref={rootRef}
      className={`ll-timer${paused ? ' ll-timer--paused' : ''}${expired ? ' ll-timer--expired' : ''}${showToggle ? '' : ' ll-timer--static'}${className ? ` ${className}` : ''}`}
      data-testid="timer"
      data-paused={paused}
      data-expired={expired}
      tabIndex={-1}
      {...(expired ? { role: 'group', 'aria-label': expiredLabel } : {})}
    >
      <span className="ll-timer__text">
        <span className="ll-timer__glyph" aria-hidden="true">
          <TimerIcon />
        </span>
        <span className="ll-timer__value">
          {expired ? (
            <Trans id="timer.expired">時間到了，你可以繼續作答</Trans>
          ) : minutes > 0 ? (
            <Trans id="timer.remaining" comment="倒數文字；minutes、seconds 是已格式化的數字">
              剩 {m} 分 {s} 秒
            </Trans>
          ) : (
            <Trans id="timer.remainingSeconds" comment="不到一分鐘時的倒數文字；seconds 是已格式化的數字">
              剩 {s} 秒
            </Trans>
          )}
        </span>
        {paused && (
          <span className="ll-timer__paused">
            <Trans id="timer.pausedLabel" comment="計時暫停中的狀態文字">
              已暫停
            </Trans>
          </span>
        )}
      </span>
      <span role="status" aria-live="polite" className="ll-timer__live">
        {live}
      </span>
      {/* 時間到之後不必再暫停，但切到背景自動暫停的話要能按「繼續」，結果頁的用時才會接著算 */}
      {showToggle && (
        <Button variant="quiet" size="sm" icon={paused ? <PlayIcon /> : <PauseIcon />} className="ll-timer__toggle" onClick={toggle}>
          {paused
            ? t({ id: 'timer.resume', message: '繼續', comment: '計時暫停後的繼續按鈕' })
            : t({ id: 'timer.pause', message: '暫停', comment: '計時的暫停按鈕' })}
        </Button>
      )}
    </div>
  );
}
