import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { MANIFEST_COLORS, THEME_COLOR, firstPaintStyle } from '@ledgerland/tokens';
import { site } from './site.config.ts';
import { buildBootScript, buildNav, buildShellL10nScript, buildSplashLinks, buildThemeColorMetas } from './src/shell/shellHtml.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
// PR 預覽與本機不收錄（05 第 9.3 節）：只有正式部署（LL_DEPLOY_TARGET=production）才拿掉 noindex
const isProduction = process.env.LL_DEPLOY_TARGET === 'production';

// 殼層：boot 腳本、首次繪製的 style、theme-color meta、Tab bar 的完整 nav、殼層在地化腳本都由同一份設定在建置時寫入 index.html（09 第 3.2 節）
function shell(): Plugin {
  return {
    name: 'll-shell',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const boot = readFileSync(`${root}src/shell/boot.js`, 'utf8').replaceAll('__LL_THEME_COLOR__', JSON.stringify(THEME_COLOR));
        return html
          .replace('<!--ll:theme-color-->', buildThemeColorMetas())
          .replace('<!--ll:robots-->', isProduction ? '' : '<meta name="robots" content="noindex">')
          .replace('<!--ll:splash-->', buildSplashLinks())
          .replace('<!--ll:first-paint-->', `<style>${firstPaintStyle()}</style>`)
          .replace('<!--ll:boot-->', buildBootScript(boot))
          .replace('<!--ll:tabbar-->', buildNav())
          .replace('<!--ll:shell-l10n-->', buildShellL10nScript());
      },
    },
    generateBundle() {
      // 給建置後檢查（tools/postbuild.mjs）用的 site config 快照
      this.emitFile({ type: 'asset', fileName: 'site-config.json', source: JSON.stringify(site, null, 2) });
    },
  };
}

const appVersion = (JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string }).version;

export default defineConfig({
  base: site.base,
  define: {
    __LL_APP_VERSION__: JSON.stringify(`${appVersion}+${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}`),
    __LL_BUILT_AT__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // 依根目錄 package.json 的 browserslist（含 iOS 17）自動補 -webkit-backdrop-filter（09 第 6.8 節）
      targets: browserslistToTargets(browserslist(undefined, { path: workspaceRoot })),
    },
  },
  build: {
    cssMinify: 'lightningcss',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Rolldown 會把殼層入口與懶載入頁面共用的模組各自拆成小 chunk（M2 加了多個懶載入頁面後首次載入變成 17 個請求，
        // Lighthouse 模擬節流下 LCP 從 2.2 秒變 3.2 秒）；把入口靜態可達的模組（$initial）合成一個 chunk，首次載入的 JS 總量不變但只剩兩個請求（06 第 8.2 節）
        codeSplitting: {
          // 群組會連同被抓到的模組的依賴一起抓（includeDependenciesRecursively 預設 true；關掉它會讓入口拆成三個檔並出現循環的 chunk，不採用），
          // 所以先宣告的群組先把共用的依賴拿走：zod 與進度 runtime 各自一個 chunk；quiz 群組用 entriesAware 把「只有作答頁用」與「地圖也用」的模組分開
          groups: [
            { name: 'app', tags: ['$initial'], priority: 3 },
            { name: 'zod', test: /[\\/]node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?zod[\\/]/, priority: 2 },
            // 進度 runtime：@ledgerland/progress、idb、lib/progress 的執行期；地圖、章節與首頁延後開庫只等這個與 zod
            {
              name: 'progress',
              test: /[\\/](packages[\\/]progress[\\/]src|apps[\\/]web[\\/]src[\\/]lib[\\/]progress|node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?idb)[\\/]/,
              priority: 2,
            },
            // 只有作答頁（關卡、錯題本）才需要的模組：quiz 判分、core、content-schema 的題目 schema、web-ui 的題目元件與 features/quiz
            {
              name: 'quiz',
              test: (id: string) =>
                /[\\/](packages[\\/](quiz|core|content-schema)[\\/]src|apps[\\/]web[\\/]src[\\/]features[\\/]quiz)[\\/]/.test(id)
                  ? !/[\\/](packages[\\/]quiz[\\/]src[\\/](stars|review|index)|packages[\\/]content-schema[\\/]src[\\/](common|index)|features[\\/]quiz[\\/]session-cache)\.ts$/.test(
                      id,
                    )
                  : /[\\/]packages[\\/]web-ui[\\/]src[\\/]components[\\/](ChoiceGroup|ClassifyBoard|ImpactPicker|PickLine|PickStatement|TrueFalse|NumberInput|FeedbackPanel|QuestionCard)\./.test(
                      id,
                    ),
              entriesAware: true,
              priority: 2,
            },
            // 其餘懶載入頁面共用的模組（地圖資料、共用元件）合成一個 chunk，作答頁的第二波請求從 15 個變成少數幾個（06 第 8.2 節）
            { name: 'shared', minShareCount: 2, priority: 1 },
          ],
        },
      },
    },
  },
  plugins: [
    shell(),
    react(),
    lingui({ macroTransform: true }),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      filename: 'sw.js',
      manifestFilename: 'manifest.webmanifest',
      scope: site.base,
      includeAssets: ['favicon.svg', 'icons/favicon.ico', 'icons/apple-touch-icon-180x180.png', 'glass/refract-map.svg'],
      manifest: {
        id: site.manifestId,
        name: site.name,
        short_name: site.shortName,
        description: site.description,
        lang: 'zh-TW',
        dir: 'ltr',
        start_url: site.base,
        scope: site.base,
        display: 'standalone',
        theme_color: MANIFEST_COLORS.theme_color,
        background_color: MANIFEST_COLORS.background_color,
        categories: ['education'],
        prefer_related_applications: false,
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // /assets/ 與 /content/ 找不到檔案時不回殼層；Cloudflare 保留的 /cdn-cgi/ 與 stub 端點一律走網路（06 第 3.1 節）
        navigateFallbackDenylist: [/^\/assets\//, /^\/content\//, /^\/sw\.js$/, /^\/cdn-cgi\//, /^\/__ll/],
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest,json}'],
        globIgnores: ['splash/**', 'icons/source.svg', 'site-config.json', 'build-report.json', '_headers'],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, strictPort: true },
});
