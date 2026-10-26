// 截圖與 E2E 用的橫幅觸發參數（站規 4.2「沒有觸發方式的狀態，在 fixture 層加只在 E2E 建置存在的觸發參數」、5.1 的橫幅 15 種狀態）：
// 網址加 ?ll-banner=<狀態>。只在開發伺服器與帶 VITE_LL_FIXTURES=1 的建置有作用（和按鈕狀態板同一個條件）；
// 正式建置時 BANNER_FIXTURES 是常數 false，bannerFixture() 一律回 null，各元件裡的 fixture 分支都不會成立。
// 狀態：storage-suspended、storage-blocked、storage-degraded、storage-quota、storage-writeFailed（儲存層旗標）、update（更新提示）、ephemeral（相機預覽提示）。
// 其他橫幅用真的觸發方式（userAgent、sessionStorage、設定值、beforeinstallprompt、瀏覽器語言），作法見 e2e/banners.spec.ts。
export const BANNER_FIXTURES = import.meta.env.DEV || import.meta.env.VITE_LL_FIXTURES === '1';

export type StorageFixture = 'suspended' | 'blocked' | 'degraded' | 'quotaExceeded' | 'writeFailed';

const STORAGE: Record<string, StorageFixture> = {
  'storage-suspended': 'suspended',
  'storage-blocked': 'blocked',
  'storage-degraded': 'degraded',
  'storage-quota': 'quotaExceeded',
  'storage-writeFailed': 'writeFailed',
};

export function bannerFixture(): string | null {
  if (!BANNER_FIXTURES) return null;
  try {
    return new URLSearchParams(window.location.search).get('ll-banner');
  } catch {
    return null;
  }
}

/** ?ll-banner=storage-* 對應的儲存層旗標；不是 storage 狀態時回 null */
export function storageFixture(): StorageFixture | null {
  const fx = bannerFixture();
  return fx === null ? null : (STORAGE[fx] ?? null);
}
