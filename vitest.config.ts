// Vitest 5：純 TypeScript 套件在 Node 環境；web-ui 的元件測試在 Browser Mode（Playwright，WebKit）。*.local.test.ts 一律排除（09 第 8 節）。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.cache/**',
      '**/.pnpm-store/**',
      '**/prototypes/**',
      '**/references/**',
      '**/e2e/**',
      '**/*.local.test.ts',
    ],
    // 覆蓋率（使用者 2026-10-23 決定）：只量 packages/core/src，陳述式與行 90%、分支 85%、函式 90%；pnpm test:coverage 低於門檻就失敗
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['packages/core/src/**/types.ts', 'packages/core/src/**/index.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '.local-reports/coverage',
      thresholds: { statements: 90, lines: 90, branches: 85, functions: 90 },
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/tokens/test/**/*.test.ts',
            'packages/i18n/test/**/*.test.ts',
            'packages/content-schema/test/**/*.test.ts',
            'packages/core/test/**/*.test.ts',
            'packages/progress/test/**/*.test.ts',
            'packages/quiz/test/**/*.test.ts',
            'tools/test/**/*.test.ts',
          ],
          exclude: ['**/*.local.test.ts'],
        },
      },
      // apps/web 的儲存層（IndexedDB 實作、persist、備份碼、作答工作階段 store）：Node 環境加 fake-indexeddb（06 第 4.3 節）
      {
        define: { __LL_APP_VERSION__: JSON.stringify('0.0.0+test'), __LL_BUILT_AT__: JSON.stringify('test') },
        test: {
          name: 'web',
          environment: 'node',
          setupFiles: ['apps/web/test/setup.ts'],
          include: ['apps/web/test/**/*.test.ts'],
          exclude: ['**/*.local.test.ts'],
        },
      },
      './packages/web-ui/vitest.config.ts',
    ],
  },
});
