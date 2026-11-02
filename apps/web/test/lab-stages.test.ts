// 實驗室的階段機（features/lab/stages.ts，03 第 3.3、3.11 節）：往回永遠可以；第一次走或單獨練習時預測沒完成不能越過階段 2；跳到最後一個階段只給回看走完過的步驟
import { describe, expect, it } from 'vitest';
import { PREDICT_STAGE, STAGE_COUNT, STAGES, canGoTo, canSkipToEnd, nextStage, prevStage, statementForStage } from '../src/features/lab/stages.ts';

const open = { predictRequired: false, predictDone: false };
const locked = { predictRequired: true, predictDone: false };
const passed = { predictRequired: true, predictDone: true };

describe('stages', () => {
  it('10 個階段，第 2 個是預測', () => {
    expect(STAGE_COUNT).toBe(10);
    expect(STAGES[PREDICT_STAGE]).toBe('predict');
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
    // 第一次走（預測過了也一樣）與單獨練習都沒有跳到最後的捷徑；回看走完過的步驟才有，最後一個階段沒有
    expect(canSkipToEnd(1, locked)).toBe(false);
    expect(canSkipToEnd(1, passed)).toBe(false);
    expect(canSkipToEnd(0, open)).toBe(false);
    expect(canSkipToEnd(0, { ...open, revisit: true })).toBe(true);
    expect(canSkipToEnd(5, { ...open, revisit: true })).toBe(true);
    expect(canSkipToEnd(9, { ...open, revisit: true })).toBe(false);
  });

  it('階段 5 到 7 自動切到對應的表', () => {
    expect(statementForStage(4)).toBe('is');
    expect(statementForStage(5)).toBe('cf');
    expect(statementForStage(6)).toBe('bs');
    expect(statementForStage(3)).toBeNull();
    expect(statementForStage(8)).toBeNull();
  });
});
