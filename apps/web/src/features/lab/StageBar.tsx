// 階段操作列（03 第 3.11 節）：固定在畫面底部（Tab bar 上方）、避開安全區域；「上一步、下一步」與階段選單。
// 階段選單的最後兩項是「跳到最後一個階段」（示範隨時有；練習只在練過的步驟再回來時有。2026-11-01 維護者回饋：原本放在操作列上的
// 「直接看結果」像主要動作，第一次走的人會按下去，整步被跳過）與「改用示範／改用練習」（切換模式，回到交易卡）。
// 進度文字「階段 5／10：損益表」（示範是 9 個）；換階段時焦點留在「下一步」上，方便連續按 Enter；方向鍵左右切換階段（焦點不在輸入框時）由父層處理。
import { useLingui } from '@lingui/react/macro';
import { Button, CaretLeftIcon, CaretRightIcon, IconButton, MenuButton, MenuItem, PlayIcon, RetryIcon } from '@ledgerland/web-ui';
import { useRef } from 'react';
import { stagesOf, type LabMode, type StageId } from './stages.ts';

export function useStageNames(): Record<StageId, string> {
  const { t } = useLingui();
  return {
    card: t({ id: 'lab.stage.card', message: '交易卡', comment: '階段名稱' }),
    predict: t({ id: 'lab.stage.predict', message: '預測', comment: '階段名稱' }),
    effects: t({ id: 'lab.stage.effects', message: '科目變動', comment: '階段名稱' }),
    equation: t({ id: 'lab.stage.equation', message: '恆等式天平', comment: '階段名稱' }),
    income: t({ id: 'lab.stage.income', message: '損益表', comment: '階段名稱' }),
    cashflow: t({ id: 'lab.stage.cashflow', message: '現金流量表', comment: '階段名稱' }),
    balance: t({ id: 'lab.stage.balance', message: '資產負債表', comment: '階段名稱' }),
    checks: t({ id: 'lab.stage.checks', message: '勾稽燈號', comment: '階段名稱' }),
    ratios: t({ id: 'lab.stage.ratios', message: '指標變化', comment: '階段名稱' }),
    insight: t({ id: 'lab.stage.insight', message: '管理意涵', comment: '階段名稱' }),
  };
}

/** 模式名稱（故事頁的按鈕、步驟頁的標示與選單共用） */
export function useModeNames(): Record<LabMode, string> {
  const { t } = useLingui();
  return {
    demo: t({ id: 'lab.mode.demo', message: '示範', comment: '模式名稱：沒有預測、可以隨時跳階段' }),
    practice: t({ id: 'lab.mode.practice', message: '練習', comment: '模式名稱：有預測與揭曉' }),
  };
}

export interface StageBarProps {
  mode: LabMode;
  stage: number;
  canPrev: boolean;
  canNext: boolean;
  canSkip: boolean;
  /** 最後一個階段的「下一步」是完成（文字不同） */
  isLast: boolean;
  /** 哪些階段可以直接跳過去（練習時預測沒完成不能越過階段 2） */
  canJumpTo: (stage: number) => boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onJump: (stage: number) => void;
  /** 換成另一種模式（示範與練習互換） */
  onSwitchMode: () => void;
  finishLabel?: string;
}

export function StageBar({
  mode,
  stage,
  canPrev,
  canNext,
  canSkip,
  isLast,
  canJumpTo,
  onPrev,
  onNext,
  onSkip,
  onJump,
  onSwitchMode,
  finishLabel,
}: StageBarProps) {
  const { t } = useLingui();
  const names = useStageNames();
  const modes = useModeNames();
  const stages = stagesOf(mode);
  const barRef = useRef<HTMLDivElement>(null);
  // 換階段後焦點留在「下一步」（方便連續按 Enter；按「上一步」或跳階段時也移回來）
  const focusNext = () => barRef.current?.querySelector<HTMLButtonElement>('[data-testid="lab-next"]')?.focus({ preventScroll: true });
  const prev = () => {
    onPrev();
    focusNext();
  };
  const jump = (i: number) => {
    onJump(i);
    focusNext();
  };
  const skip = () => {
    onSkip();
    focusNext();
  };
  const progress = t({
    id: 'lab.stage.progress',
    message: `階段 ${stage + 1}／${stages.length}：${names[stages[stage]!]}`,
    comment: '階段進度文字；數字與名稱已代入',
  });
  const other = mode === 'demo' ? modes.practice : modes.demo;
  return (
    <div ref={barRef} className="ll-lab-stagebar" data-testid="lab-stagebar" data-stage={stage}>
      <div className="ll-lab-stagebar__row">
        <span className="ll-lab-stagebar__item">
          <IconButton
            icon={<CaretLeftIcon />}
            label={t({ id: 'lab.stage.prev', message: '上一步', comment: '階段操作列的按鈕' })}
            variant="quiet"
            onClick={prev}
            disabled={!canPrev}
            id="ll-lab-prev"
          />
        </span>
        <MenuButton label={progress} variant="quiet" align="start" side="up" className="ll-lab-stagebar__jump">
          {stages.map((id, i) => (
            <MenuItem key={id} onClick={() => jump(i)} disabled={!canJumpTo(i)}>
              {i + 1}. {names[id]}
            </MenuItem>
          ))}
          {canSkip && (
            <MenuItem icon={<PlayIcon />} onClick={skip} data-testid="lab-skip">
              {t({ id: 'lab.stage.skip', message: '跳到最後一個階段', comment: '階段選單：直接切到最後一個階段（示範隨時有；練習只在練過的步驟再回來時有）' })}
            </MenuItem>
          )}
          <MenuItem icon={<RetryIcon />} onClick={onSwitchMode} data-testid="lab-switch-mode">
            {t({ id: 'lab.stage.switchMode', message: `改用${other}`, comment: '階段選單最後一項：換成另一種模式（示範或練習），模式名稱已代入' })}
          </MenuItem>
        </MenuButton>
        <span className="ll-lab-stagebar__item is-next">
          <Button variant="primary" size="md" iconEnd={<CaretRightIcon />} onClick={onNext} disabled={!canNext} data-testid="lab-next">
            {isLast
              ? (finishLabel ?? t({ id: 'lab.stage.finish', message: '完成這一步', comment: '最後一個階段的主按鈕' }))
              : t({ id: 'lab.stage.next', message: '下一步', comment: '階段操作列的按鈕' })}
          </Button>
        </span>
      </div>
    </div>
  );
}
