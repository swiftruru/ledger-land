// 啟動畫面的停留與離場（src/shell/launch-screen.ts，06 第 2.4 節）：用假的 document 與假的計時器跑狀態機
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeNode {
  dataset: Record<string, string>;
  removed: boolean;
  listeners: Record<string, () => void>;
  remove(): void;
  addEventListener(name: string, fn: () => void): void;
}

interface Setup {
  display: 'app' | 'browser';
  motion?: 'reduced';
  reduce?: boolean;
  navType?: 'navigate' | 'reload';
  hasNode?: boolean;
}

function setup({ display, motion, reduce = false, navType = 'navigate', hasNode = true }: Setup): FakeNode {
  const node: FakeNode = {
    dataset: {},
    removed: false,
    listeners: {},
    remove() {
      this.removed = true;
    },
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    },
  };
  const dataset: Record<string, string> = { display };
  if (motion) dataset.motion = motion;
  vi.stubGlobal('document', {
    documentElement: { dataset },
    getElementById: (id: string) => (id === 'll-launch' && hasNode && !node.removed ? node : null),
  });
  vi.stubGlobal('window', { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) });
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
  const start = Date.now();
  vi.stubGlobal('performance', { now: () => Date.now() - start, getEntriesByType: () => [{ type: navType }] });
  return node;
}

async function load() {
  vi.resetModules();
  return import('../src/shell/launch-screen.ts');
}

describe('launch-screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('瀏覽器模式：arm 就直接移除', async () => {
    const node = setup({ display: 'browser' });
    const m = await load();
    m.armLaunchScreen();
    expect(node.removed).toBe(true);
    expect(node.dataset.leave).toBeUndefined();
  });

  it('App 模式：第一頁早於 1.5 秒掀開時等到 1.5 秒才加 data-leave，transitionend 之後移除', async () => {
    const node = setup({ display: 'app' });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(300);
    m.dismissLaunchScreen();
    vi.advanceTimersByTime(1100);
    expect(node.dataset.leave).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(node.dataset.leave).toBe('');
    expect(node.removed).toBe(false);
    node.listeners.transitionend?.();
    expect(node.removed).toBe(true);
  });

  it('App 模式：第一頁晚於 1.5 秒才掀開就立刻離場；沒有 transitionend 時 400ms 後移除', async () => {
    const node = setup({ display: 'app' });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(2000);
    m.dismissLaunchScreen();
    expect(node.dataset.leave).toBe('');
    vi.advanceTimersByTime(399);
    expect(node.removed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(node.removed).toBe(true);
  });

  it('減少動態（prefers-reduced-motion）：到時間直接移除，不加 data-leave', async () => {
    const node = setup({ display: 'app', reduce: true });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(200);
    m.dismissLaunchScreen();
    vi.advanceTimersByTime(1300);
    expect(node.removed).toBe(true);
    expect(node.dataset.leave).toBeUndefined();
  });

  it('減少動態（html[data-motion=reduced]）也一樣', async () => {
    const node = setup({ display: 'app', motion: 'reduced' });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(1600);
    m.dismissLaunchScreen();
    expect(node.removed).toBe(true);
    expect(node.dataset.leave).toBeUndefined();
  });

  it('頁面一直沒掀開：4 秒上限離場', async () => {
    const node = setup({ display: 'app' });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(3999);
    expect(node.dataset.leave).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(node.dataset.leave).toBe('');
    vi.advanceTimersByTime(400);
    expect(node.removed).toBe(true);
  });

  it('重新整理（navigation type reload）不等 1.5 秒', async () => {
    const node = setup({ display: 'app', navType: 'reload' });
    const m = await load();
    m.armLaunchScreen();
    vi.advanceTimersByTime(100);
    m.dismissLaunchScreen();
    expect(node.dataset.leave).toBe('');
  });

  it('重複呼叫與移除後再呼叫都沒有作用；沒有節點時也不會出錯', async () => {
    const node = setup({ display: 'app' });
    const m = await load();
    m.armLaunchScreen();
    m.armLaunchScreen();
    vi.advanceTimersByTime(1600);
    m.dismissLaunchScreen();
    m.dismissLaunchScreen();
    node.listeners.transitionend?.();
    expect(node.removed).toBe(true);
    expect(() => {
      m.dismissLaunchScreen();
      m.armLaunchScreen();
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
    const m2 = await load();
    setup({ display: 'app', hasNode: false });
    expect(() => {
      m2.armLaunchScreen();
      m2.dismissLaunchScreen();
    }).not.toThrow();
  });
});
