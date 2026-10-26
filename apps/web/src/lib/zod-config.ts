// CSP 的 script-src 不含 'unsafe-eval'（09 第 11 節）：Zod 4 定義 z.object() 時會探測能不能用 new Function 產生解析器，探測本身就會觸發
// securitypolicyviolation（例外被 Zod 吞掉，但瀏覽器照樣回報）。所以在殼層入口（main.tsx 的第一個 import）就關掉 JIT，
// 讓任何之後才動態載入、含 Zod schema 的 chunk（content-schema、progress、quiz）都不再探測。
// 不 import zod：Zod 4 的全域設定就是 globalThis.__zod_globalConfig（zod/v4/core/core.js 的 globalConfig 直接取用這個物件），
// 先放好 jitless 就和呼叫 config({ jitless: true }) 一樣，殼層入口不必帶 zod 的 core 模組（約 3.5 KB gzip，06 第 8.2 節）。
// apps/web/test/zod-config.test.ts 用目前釘的 Zod 版本確認這個約定仍然成立。
const g = globalThis as { __zod_globalConfig?: Record<string, unknown> };
g.__zod_globalConfig = Object.assign(g.__zod_globalConfig ?? {}, { jitless: true });

export {};
