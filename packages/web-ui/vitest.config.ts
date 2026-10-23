// web-ui 的元件測試：Vitest Browser Mode 加 Playwright 的 WebKit（09 第 1 節）
import { fileURLToPath } from 'node:url';
import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Lingui 的抽取設定只有一份（apps/web/lingui.config.ts，同時列出 app 與 web-ui 的 catalog），這裡明確指向它
export default defineConfig({
  plugins: [react(), lingui({ macroTransform: true, configPath: fileURLToPath(new URL('../../apps/web/lingui.config.ts', import.meta.url)) })],
  test: {
    name: 'web-ui',
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    exclude: ['**/*.local.test.ts'],
    setupFiles: ['./test/setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'webkit' }],
    },
  },
});
