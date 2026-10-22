// 回饋面板（07 第 8.3 節）：按「確認答案」後焦點移到這裡的標題；標題前有 ✓ 或 ✕ 圖示與文字，不只靠顏色（16 第 4.3 節）
import { Trans } from '@lingui/react/macro';
import { useEffect, useRef, type ReactNode } from 'react';

export interface FeedbackPanelProps {
  correct: boolean;
  children?: ReactNode;
  /** 顯示時把焦點移到標題（預設 true） */
  focusOnMount?: boolean;
}

export function FeedbackPanel({ correct, children, focusOnMount = true }: FeedbackPanelProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <div className={`ll-feedback ${correct ? 'll-feedback--ok' : 'll-feedback--no'}`}>
      <h2 ref={ref} tabIndex={-1} className="ll-feedback__title">
        <span className="ll-feedback__icon" aria-hidden="true">
          {correct ? '✓' : '✕'}
        </span>
        {correct ? (
          <Trans id="quiz.feedback.correct" comment="答對時的回饋標題">
            答對了！
          </Trans>
        ) : (
          <Trans id="quiz.feedback.wrong" comment="答錯時的回饋標題">
            再想想
          </Trans>
        )}
      </h2>
      {children}
    </div>
  );
}
