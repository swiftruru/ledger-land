// firstPaintSettled（src/lib/idle.ts）：冷啟動第一頁的裝飾性資源（地圖的章節場景）等第一次繪製送出後才載入（06 第 8.2 節）。
// Node 環境沒有 requestAnimationFrame 與 requestIdleCallback，afterFirstPaint 退回 setTimeout 加 settleMs（400ms）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('firstPaintSettled', () => {
  it('第一次繪製後（閒置再加 400ms）才 resolve；之後每次呼叫都是同一個已完成的 Promise', async () => {
    const { firstPaintSettled } = await import('../src/lib/idle.ts');
    let done = false;
    const p = firstPaintSettled();
    void p.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
    expect(firstPaintSettled()).toBe(p);
  });
});
