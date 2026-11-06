// 三表並排時要不要用三欄並列（features/lab/useColumnsFit.ts）：看表格區實際的寬度。
import { describe, expect, it } from 'vitest';
import { COLUMNS_TABLE_MIN_WIDTH, columnsFit } from '../src/features/lab/useColumnsFit.ts';

describe('columnsFit', () => {
  it('內容區最寬的 1040px（每張表約 336px）放不下三欄', () => {
    expect(columnsFit(1040, 16)).toBe(false);
    expect(columnsFit(988, 16)).toBe(false);
  });

  it('每張表剛好到最小寬度才算放得下，少 1px 就不算', () => {
    const exact = COLUMNS_TABLE_MIN_WIDTH * 3 + 16 * 2;
    expect(columnsFit(exact, 16)).toBe(true);
    expect(columnsFit(exact - 1, 16)).toBe(false);
  });

  it('張數不同時各自計算', () => {
    expect(columnsFit(COLUMNS_TABLE_MIN_WIDTH, 16, 1)).toBe(true);
    expect(columnsFit(COLUMNS_TABLE_MIN_WIDTH * 2 + 15, 16, 2)).toBe(false);
  });
});
