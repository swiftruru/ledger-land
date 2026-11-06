// 苦練首頁建議的步驟（features/exam/steps.ts）
import { describe, expect, it } from 'vitest';
import { recommendedStep } from '../src/features/exam/steps.ts';

describe('苦練首頁建議的步驟', () => {
  it('全新：先讀題', () => {
    expect(recommendedStep({ total: 307, read: 0, practised: 0 })).toBe('read');
  });
  it('讀了一些、還沒作答：繼續讀', () => {
    expect(recommendedStep({ total: 307, read: 11, practised: 0 })).toBe('read');
    expect(recommendedStep({ total: 307, read: 306, practised: 0 })).toBe('read');
  });
  it('全部讀完、還沒作答：自己練', () => {
    expect(recommendedStep({ total: 307, read: 307, practised: 0 })).toBe('practise');
  });
  it('作答過（不管讀了多少）：自己練', () => {
    expect(recommendedStep({ total: 307, read: 0, practised: 1 })).toBe('practise');
    expect(recommendedStep({ total: 307, read: 11, practised: 306 })).toBe('practise');
  });
  it('每一題都練過：模擬考', () => {
    expect(recommendedStep({ total: 307, read: 0, practised: 307 })).toBe('mock');
    expect(recommendedStep({ total: 307, read: 307, practised: 307 })).toBe('mock');
  });
  it('沒有題庫時不出錯', () => {
    expect(recommendedStep({ total: 0, read: 0, practised: 0 })).toBe('read');
  });
});
