// 故事每一步的階段與前進規則（03 第 3.1、3.3、3.11 節）：純函式，沒有 DOM。
// 兩種模式（2026-11-02 維護者）：練習 10 個階段含預測；示範 9 個階段沒有預測、沒有關卡，隨時可以跳到任何階段，給老師投影與先看一遍用。
// 練習只由「下一步」推進；「上一步」只切換畫面；第一次練這一步時預測沒完成不能越過階段 2，階段選單也只能跳回走過的階段（canJumpTo）。
// 「跳到最後一個階段」在示範永遠有；練習只給練過的步驟再回來時用，而且放在階段選單裡，不在操作列上（維護者 2026-11-01：
// 「直接看結果」放在「下一步」旁邊像是主要動作，第一次走的人會按下去然後整步被跳過）。
export const STAGES = ['card', 'predict', 'effects', 'equation', 'income', 'cashflow', 'balance', 'checks', 'ratios', 'insight'] as const;
export type StageId = (typeof STAGES)[number];
/** 示範模式的階段：少掉預測 */
export const DEMO_STAGES: readonly StageId[] = STAGES.filter((s) => s !== 'predict');
export type LabMode = 'demo' | 'practice';
/** 練習模式的階段數（示範少一個） */
export const STAGE_COUNT = STAGES.length;
/** 預測在練習模式裡的位置 */
export const PREDICT_STAGE = 1;

export function stagesOf(mode: LabMode): readonly StageId[] {
  return mode === 'demo' ? DEMO_STAGES : STAGES;
}

export interface StageGate {
  readonly mode: LabMode;
  /** 預測要先完成才能前進（第一次練這一步）；示範模式沒有預測，這個值不用 */
  readonly predictRequired: boolean;
  readonly predictDone: boolean;
  /** 練過的步驟再回來：才有跳到最後一個階段的捷徑 */
  readonly revisit?: boolean;
}

/** 能不能從 from 走到 to（任何方向）：往回永遠可以；示範往前也永遠可以；練習往前要過得了預測關卡 */
export function canGoTo(from: number, to: number, gate: StageGate): boolean {
  if (to < 0 || to >= stagesOf(gate.mode).length) return false;
  if (to <= from) return true;
  if (gate.mode === 'demo') return true;
  if (gate.predictRequired && !gate.predictDone && from <= PREDICT_STAGE && to > PREDICT_STAGE) return false;
  return true;
}

export function nextStage(from: number, gate: StageGate): number | null {
  return canGoTo(from, from + 1, gate) ? from + 1 : null;
}

export function prevStage(from: number): number | null {
  return from > 0 ? from - 1 : null;
}

/** 「跳到最後一個階段」：示範隨時有；練習只在練過的步驟再回來時才有（第一次練要一個階段一個階段看） */
export function canSkipToEnd(from: number, gate: StageGate): boolean {
  const last = stagesOf(gate.mode).length - 1;
  if (from >= last) return false;
  if (gate.mode === 'demo') return true;
  return gate.revisit === true && canGoTo(from, last, gate);
}

/** 階段選單能不能直接跳到 to（03 第 3.1 節）：示範與練過的步驟照 canGoTo；第一次練只能跳回這次走過的階段（reached 是走到最遠的階段），
 * 往前只能靠「下一步」一階段一階段看（2026-11-02 維護者：記下預測後選單仍能往前跳，和「第一次練要逐階段看」矛盾） */
export function canJumpTo(from: number, to: number, gate: StageGate, reached: number): boolean {
  if (!canGoTo(from, to, gate)) return false;
  if (gate.mode === 'practice' && gate.revisit !== true) return to <= reached;
  return true;
}

/** 階段「損益表、現金流量表、資產負債表」進入時自動切到對應的表（02 第 3.4 節）；其他階段不切 */
export function statementForStage(stage: number, mode: LabMode = 'practice'): 'is' | 'cf' | 'bs' | null {
  const id = stagesOf(mode)[stage];
  if (id === 'income') return 'is';
  if (id === 'cashflow') return 'cf';
  if (id === 'balance') return 'bs';
  return null;
}
