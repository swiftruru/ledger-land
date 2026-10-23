// 關卡介紹表單（17 第 3.3 節）：從節點彈出的底部表單，原生 dialog（焦點鎖定、Esc），關閉後焦點回到節點。
// 歷史紀錄（返回關閉）由頁面負責；站內連結由父層以 localePath 產生並帶結尾斜線，透過 onNavigate 走站內導覽。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { Button } from './Button.tsx';
import { XIcon } from './icons.tsx';
import { LevelCode } from './LevelCode.tsx';
import { Stars } from './Stars.tsx';

export interface LevelSheetData {
  levelId: string;
  title: string;
  /** 副標：第 3 章 損益表 */
  subtitle: string;
  /** 學習目標 1 到 3 行 */
  objectives: readonly string[];
  /** 最佳成績；沒挑戰過時省略 */
  best?: { stars: 0 | 1 | 2 | 3; accuracyText: string };
  startHref: string;
  chapterHref?: string;
  /** 還沒完成前一關時顯示「建議先完成『○○』，也可以直接開始」 */
  suggestedPrevTitle?: string;
  /** 還在載入關卡名稱與目標時為 true */
  loading?: boolean;
}

export interface LevelSheetProps {
  open: boolean;
  onClose: () => void;
  level: LevelSheetData | null;
  onNavigate: (href: string) => void;
  /** 關閉後要把焦點還給的元素（開啟它的節點） */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function LevelSheet({ open, onClose, level, onNavigate, returnFocusTo }: LevelSheetProps) {
  const { t } = useLingui();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // 由 open 變 false 觸發的 d.close() 也會（非同步）發 close 事件；父層已經把 open 設為 false，那一次不再回呼 onClose
  const openRef = useRef(open);
  const titleId = useId();
  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      const el = returnFocusTo?.current ?? opener.current;
      if (el && el.isConnected && el !== document.body) el.focus({ preventScroll: true });
      else if (d.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      opener.current = null;
    }
  }, [open, returnFocusTo]);
  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(href);
  };
  const played = !!level?.best;
  return (
    <dialog
      ref={ref}
      className="ll-sheet ll-sheet--level"
      aria-labelledby={titleId}
      aria-modal="true"
      data-testid="level-sheet"
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {level && (
        <div className="ll-sheet__body">
          {level.suggestedPrevTitle && (
            <p className="ll-levelsheet__suggest">
              {t({
                id: 'map.sheet.suggestPrev',
                message: `建議先完成『${level.suggestedPrevTitle}』，也可以直接開始`,
                comment: '還沒完成前一關時的提示；title 是前一關的名稱',
              })}
            </p>
          )}
          <div className="ll-sheet__head">
            <div>
              <h2 id={titleId} className="ll-sheet__title">
                {level.loading ? t({ id: 'map.sheet.loading', message: '載入關卡中', comment: '關卡介紹還在載入時的標題' }) : level.title}
              </h2>
              <p className="ll-sheet__subtitle">{level.subtitle}</p>
            </div>
            <button
              type="button"
              className="ll-iconbtn"
              onClick={onClose}
              aria-label={t({ id: 'ui.close', message: '關閉', comment: '對話框關閉按鈕的可讀名稱' })}
            >
              <XIcon />
            </button>
          </div>
          {level.objectives.length > 0 && (
            <section className="ll-sheet__section">
              <h3>
                <Trans id="map.sheet.objectives" comment="關卡介紹表單的學習目標段落標題">
                  學習目標
                </Trans>
              </h3>
              <ul className="ll-levelsheet__objectives">
                {level.objectives.slice(0, 3).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="ll-sheet__section">
            <h3>
              <Trans id="map.sheet.best" comment="關卡介紹表單的最佳成績段落標題">
                最佳成績
              </Trans>
            </h3>
            {level.best ? (
              <p className="ll-levelsheet__best">
                <Stars value={level.best.stars} />
                <span className="ll-num">{level.best.accuracyText}</span>
              </p>
            ) : (
              <p className="ll-muted">
                <Trans id="map.sheet.notPlayed" comment="還沒挑戰過這一關時的文字">
                  還沒挑戰過
                </Trans>
              </p>
            )}
          </section>
          <LevelCode levelId={level.levelId} className="ll-sheet__section" />
          <div className="ll-row ll-actions">
            <a className="ll-btn ll-btn--primary" href={level.startHref} onClick={go(level.startHref)}>
              {played
                ? t({ id: 'map.sheet.retry', message: '再挑戰', comment: '已挑戰過的關卡的主要按鈕' })
                : t({ id: 'map.sheet.start', message: '開始', comment: '還沒挑戰過的關卡的主要按鈕' })}
            </a>
            {level.chapterHref && (
              <a className="ll-btn" href={level.chapterHref} onClick={go(level.chapterHref)}>
                {t({ id: 'map.sheet.chapterInfo', message: '章節資訊', comment: '到章節頁的次要按鈕' })}
              </a>
            )}
            <Button onClick={onClose}>
              <Trans id="ui.close" comment="對話框關閉按鈕的可讀名稱">
                關閉
              </Trans>
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
