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
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/tokens/test/**/*.test.ts',
            'packages/i18n/test/**/*.test.ts',
            'packages/content-schema/test/**/*.test.ts',
            'tools/test/**/*.test.ts',
          ],
          exclude: ['**/*.local.test.ts'],
        },
      },
      './packages/web-ui/vitest.config.ts',
    ],
  },
});
