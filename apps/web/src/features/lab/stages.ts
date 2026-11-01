// 故事每一步的 10 個階段（03 第 3.3 節）與前進規則：純函式，沒有 DOM。
// 只由「下一步」推進；「上一步」只切換畫面；第一次走這一步（或單獨練習）時，預測沒完成不能越過階段 2（03 第 3.11 節）。
// 「跳到最後一個階段」只給回看走完過的步驟用（故事模式且這一步已走完），而且放在階段選單裡，不在操作列上（維護者 2026-11-01：
// 「直接看結果」放在「下一步」旁邊像是主要動作，第一次走的人會按下去然後整步被跳過）。
export const STAGES = ['card', 'predict', 'effects', 'equation', 'income', 'cashflow', 'balance', 'checks', 'ratios', 'insight'] as const;
export type StageId = (typeof STAGES)[number];
export const STAGE_COUNT = STAGES.length;
export const PREDICT_STAGE = 1;

export interface StageGate {
  /** 預測要先完成才能前進（第一次走或單獨練習） */
  readonly predictRequired: boolean;
  readonly predictDone: boolean;
  /** 回看走完過的步驟（故事模式且已走完）：才有跳到最後一個階段的捷徑 */
  readonly revisit?: boolean;
}

/** 能不能從 from 走到 to（任何方向）：往回永遠可以；往前要過得了預測關卡 */
export function canGoTo(from: number, to: number, gate: StageGate): boolean {
  if (to < 0 || to >= STAGE_COUNT) return false;
  if (to <= from) return true;
  if (gate.predictRequired && !gate.predictDone && from <= PREDICT_STAGE && to > PREDICT_STAGE) return false;
  return true;
}

export function nextStage(from: number, gate: StageGate): number | null {
  return canGoTo(from, from + 1, gate) ? from + 1 : null;
}

export function prevStage(from: number): number | null {
  return from > 0 ? from - 1 : null;
}

/** 「跳到最後一個階段」：只在回看走完過的步驟時才有（第一次走與單獨練習都要一個階段一個階段看） */
export function canSkipToEnd(from: number, gate: StageGate): boolean {
  return gate.revisit === true && from < STAGE_COUNT - 1 && canGoTo(from, STAGE_COUNT - 1, gate);
}

/** 階段 5 到 7 進入時自動切到對應的表（02 第 3.4 節）；其他階段不切 */
export function statementForStage(stage: number): 'is' | 'cf' | 'bs' | null {
  const id = STAGES[stage];
  if (id === 'income') return 'is';
  if (id === 'cashflow') return 'cf';
  if (id === 'balance') return 'bs';
  return null;
}
