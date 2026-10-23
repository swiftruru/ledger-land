// CSP 的 script-src 不含 'unsafe-eval'（09 第 11 節）：Zod 4 定義 z.object() 時會探測能不能用 new Function 產生解析器，探測本身就會觸發
// securitypolicyviolation（例外被 Zod 吞掉，但瀏覽器照樣回報）。所以在殼層入口（main.tsx 的第一個 import）就關掉 JIT，
// 讓任何之後才動態載入、含 Zod schema 的 chunk（content-schema、progress、quiz）都不再探測。只 import zod/v4/core 的 config，不把 schema 拉進首次載入。
import { config } from 'zod/v4/core';

config({ jitless: true });
