// 講義題庫的離線保險（features/exam/prefetch.ts）：網址依講義順序、離線或省流量不送、等 SW ready 後把 PREFETCH_HANDOUT 訊息送給 active
import { describe, expect, it, vi } from 'vitest';
import type { HandoutManifestEntry } from '../src/lib/content.ts';
import { handoutPrefetchUrls, postHandoutPrefetch, PREFETCH_HANDOUT, shouldPrefetch } from '../src/features/exam/prefetch.ts';

const index = {
  decks: [
    { id: 'd2', order: 2, file: 'content/zh-TW/handout_d2.bbb.json' },
    { id: 'd1', order: 1, file: 'content/zh-TW/handout_d1.aaa.json' },
  ],
} as unknown as HandoutManifestEntry;

const nav = (active: { postMessage(m: unknown): void } | null, extra: Record<string, unknown> = {}) => ({
  serviceWorker: { ready: Promise.resolve({ active }) },
  ...extra,
});

describe('exam prefetch', () => {
  it('網址依講義順序，開頭加斜線', () => {
    expect(handoutPrefetchUrls(index)).toEqual(['/content/zh-TW/handout_d1.aaa.json', '/content/zh-TW/handout_d2.bbb.json']);
  });

  it('沒有 SW、離線或開了省流量就不送', () => {
    expect(shouldPrefetch({})).toBe(false);
    expect(shouldPrefetch(nav(null, { onLine: false }))).toBe(false);
    expect(shouldPrefetch(nav(null, { connection: { saveData: true } }))).toBe(false);
    expect(shouldPrefetch(nav(null, { onLine: true, connection: { saveData: false } }))).toBe(true);
  });

  it('SW ready 後把訊息送給 active；沒有 active 就不送', async () => {
    const postMessage = vi.fn<(message: unknown) => void>();
    expect(await postHandoutPrefetch(index, nav({ postMessage }))).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({
      type: PREFETCH_HANDOUT,
      urls: ['/content/zh-TW/handout_d1.aaa.json', '/content/zh-TW/handout_d2.bbb.json'],
    });
    expect(await postHandoutPrefetch(index, nav(null))).toBe(false);
    expect(await postHandoutPrefetch(index, nav({ postMessage }, { onLine: false }))).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
