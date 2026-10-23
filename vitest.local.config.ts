// 本機老師 Excel 驗證（04 第 18.3 節）：只在 references/（或 LL_REFERENCES_DIR）存在時收 *.local.test.ts；CI 沒有教材，永遠略過。
// 用法：pnpm test:local；主設定 vitest.config.ts 永遠排除這些檔案。
import { defineConfig } from 'vitest/config';
import { resolveReferencesDir } from './packages/core/test/local/references.ts';

const referencesDir = resolveReferencesDir();
if (referencesDir === null) console.log('references 不存在，略過本機測試');

export default defineConfig({
  test: {
    environment: 'node',
    include: referencesDir === null ? [] : ['packages/core/test/**/*.local.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.cache/**', '**/.pnpm-store/**', '**/prototypes/**', '**/references/**'],
    passWithNoTests: true,
  },
});
