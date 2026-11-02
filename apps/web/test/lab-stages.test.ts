// 實驗室的階段機（features/lab/stages.ts，03 第 3.1、3.3、3.11 節）：練習 10 個階段含預測，第一次練時預測沒完成不能越過階段 2、階段選單只能跳回走過的階段，
// 跳到最後只給練過的步驟再回來時；示範 9 個階段沒有預測、沒有關卡，隨時可以跳到最後
import { describe, expect, it } from 'vitest';
import {
  DEMO_STAGES,
  PREDICT_STAGE,
  STAGE_COUNT,
  STAGES,
  canGoTo,
  canJumpTo,
  canSkipToEnd,
  nextStage,
  prevStage,
  stagesOf,
  statementForStage,
} from '../src/features/lab/stages.ts';

const open = { mode: 'practice', predictRequired: false, predictDone: false } as const;
const locked = { mode: 'practice', predictRequired: true, predictDone: false } as const;
const passed = { mode: 'practice', predictRequired: true, predictDone: true } as const;
const demo = { mode: 'demo', predictRequired: false, predictDone: false } as const;

describe('stages', () => {
  it('練習 10 個階段，第 2 個是預測；示範 9 個、沒有預測', () => {
    expect(STAGE_COUNT).toBe(10);
    expect(STAGES[PREDICT_STAGE]).toBe('predict');
    expect(DEMO_STAGES).toHaveLength(9);
    expect(DEMO_STAGES).not.toContain('predict');
    expect(DEMO_STAGES[1]).toBe('effects');
    expect(stagesOf('demo')).toBe(DEMO_STAGES);
    expect(stagesOf('practice')).toBe(STAGES);
  });

  it('不需要預測時任何方向都能走；越界不行', () => {
    expect(canGoTo(0, 9, open)).toBe(true);
    expect(canGoTo(5, 2, open)).toBe(true);
    expect(canGoTo(9, 10, open)).toBe(false);
    expect(canGoTo(0, -1, open)).toBe(false);
    expect(nextStage(9, open)).toBeNull();
    expect(prevStage(0)).toBeNull();
    expect(prevStage(3)).toBe(2);
  });

  it('預測沒完成：從階段 1 或 2 不能往前越過預測，往回可以；完成後可以', () => {
    expect(canGoTo(0, 1, locked)).toBe(true);
    expect(canGoTo(1, 2, locked)).toBe(false);
    expect(canGoTo(0, 5, locked)).toBe(false);
    expect(canGoTo(1, 0, locked)).toBe(true);
    expect(nextStage(1, locked)).toBeNull();
    expect(nextStage(1, passed)).toBe(2);
    // 第一次練（預測過了也一樣）沒有跳到最後的捷徑；練過的再回來才有，最後一個階段沒有
    expect(canSkipToEnd(1, locked)).toBe(false);
    expect(canSkipToEnd(1, passed)).toBe(false);
    expect(canSkipToEnd(0, open)).toBe(false);
    expect(canSkipToEnd(0, { ...open, revisit: true })).toBe(true);
    expect(canSkipToEnd(5, { ...open, revisit: true })).toBe(true);
    expect(canSkipToEnd(9, { ...open, revisit: true })).toBe(false);
  });

  it('階段選單：第一次練只能跳回走過的階段；練過的再回來與示範照 canGoTo', () => {
    // 走到階段 4 之後（reached 4）：可以跳回 0 到 4，不能跳到 5 以後；預測沒完成時連 2 都不行
    expect(canJumpTo(4, 2, passed, 4)).toBe(true);
    expect(canJumpTo(4, 4, passed, 4)).toBe(true);
    expect(canJumpTo(4, 5, passed, 4)).toBe(false);
    expect(canJumpTo(4, 9, passed, 4)).toBe(false);
    expect(canJumpTo(1, 2, locked, 1)).toBe(false);
    expect(canJumpTo(1, 0, locked, 1)).toBe(true);
    // 練過的再回來：reached 不管用
    expect(canJumpTo(0, 9, { ...open, revisit: true }, 0)).toBe(true);
    // 示範：隨時可跳
    expect(canJumpTo(0, 8, demo, 0)).toBe(true);
    expect(canJumpTo(0, 9, demo, 0)).toBe(false);
  });

  it('示範：9 個階段內任何方向都能走、隨時可以跳到最後；predictRequired 不影響', () => {
    expect(canGoTo(0, 8, demo)).toBe(true);
    expect(canGoTo(0, 9, demo)).toBe(false);
    expect(canGoTo(0, 5, { ...demo, predictRequired: true })).toBe(true);
    expect(nextStage(8, demo)).toBeNull();
    expect(canSkipToEnd(0, demo)).toBe(true);
    expect(canSkipToEnd(7, demo)).toBe(true);
    expect(canSkipToEnd(8, demo)).toBe(false);
  });

  it('損益表、現金流量表、資產負債表進入時自動切到對應的表（示範少一個階段，位置往前一格）', () => {
    expect(statementForStage(4)).toBe('is');
    expect(statementForStage(5)).toBe('cf');
    expect(statementForStage(6)).toBe('bs');
    expect(statementForStage(3)).toBeNull();
    expect(statementForStage(8)).toBeNull();
    expect(statementForStage(3, 'demo')).toBe('is');
    expect(statementForStage(4, 'demo')).toBe('cf');
    expect(statementForStage(5, 'demo')).toBe('bs');
    expect(statementForStage(6, 'demo')).toBeNull();
  });
});
