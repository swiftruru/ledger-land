// 只對 /assets/* 執行（wrangler.jsonc 的 run_worker_first）。其餘請求照常由 Static Assets 直接回應，不經過這支 Worker。
// /assets/ 底下只會是帶 hash 的 JS、CSS 等檔案；如果拿到 HTML，代表檔案不存在、被 SPA fallback 換成了殼層。
// 這時改回 404 並禁止快取，避免舊頁面把殼層當成 JS 載入，或把它以一年 immutable 的快取存起來（09 第 7.3 節，M0a 實測）。
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'x-robots-tag': 'noindex',
        },
      });
    }
    return res;
  },
};
