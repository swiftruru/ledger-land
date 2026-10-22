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
