import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import { defineConfig, minifySync, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { MANIFEST_COLORS, THEME_COLOR, firstPaintStyle, launchScreenStyle } from '@ledgerland/tokens';
import { site } from './site.config.ts';
import { readStackVersions } from './stack-versions.config.ts';
import { buildBootScript, buildLaunchScreen, buildNav, buildShellL10nScript, buildSplashLinks, buildThemeColorMetas } from './src/shell/shellHtml.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));

// 每個 chunk 含哪些原始碼模組（.vite/chunk-modules.json，路徑相對於 apps/web）：codeSplitting.groups 併出來的 chunk（進度 runtime 等）在 Vite manifest 裡
// 只有雜湊檔名、沒有原始碼鍵，殼層的預先載入表（route-preload.json 的 always，tools/lib/preload-table.mjs）靠這份對照找出「含某個模組的 chunk」。
// 和 .vite/manifest.json 一樣只給 tools/postbuild.mjs 用，用完一起刪掉，不部署
function chunkModules(): Plugin {
  const appRoot = fileURLToPath(new URL('./', import.meta.url));
  return {
    name: 'll-chunk-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      const map: Record<string, string[]> = {};
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        map[fileName] = Object.keys(chunk.modules)
          .filter((id) => id.startsWith(appRoot) || id.startsWith(workspaceRoot))
          .map((id) => (id.startsWith(appRoot) ? id.slice(appRoot.length) : '../../' + id.slice(workspaceRoot.length)))
          .sort();
      }
      this.emitFile({ type: 'asset', fileName: '.vite/chunk-modules.json', source: JSON.stringify(map) });
    },
  };
}
// PR 預覽與本機不收錄（05 第 9.3 節）：只有正式部署（LL_DEPLOY_TARGET=production）才拿掉 noindex
const isProduction = process.env.LL_DEPLOY_TARGET === 'production';

// 殼層：boot 腳本、首次繪製的 style、theme-color meta、Tab bar 的完整 nav、殼層在地化腳本都由同一份設定在建置時寫入 index.html（09 第 3.2 節）
function shell(): Plugin {
  let building = false;
  return {
    name: 'll-shell',
    configResolved(config) {
      building = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // 建置時用 Vite 自帶的壓縮器把 boot 腳本壓小（2026-10-28：殼層 HTML 內嵌了啟動畫面的 SVG 後超過 TCP 第一個視窗，Lighthouse 的模擬每頁多一趟往返，
        // 06 第 8.2 節）；開發模式不壓，看得懂。__LL_PRELOAD__ 是未宣告的全域識別字，壓縮後原樣保留，壓完再換成 postbuild 找得到的佔位：
        // 依路徑預先載入的表要等 chunk 檔名確定後才填（tools/postbuild.mjs），開發模式就一直是 null
        const source = readFileSync(`${root}src/shell/boot.js`, 'utf8').replaceAll('__LL_THEME_COLOR__', JSON.stringify(THEME_COLOR));
        const code = building ? minifySync('boot.js', source, {}).code : source;
        if (!code.includes('__LL_PRELOAD__')) throw new Error('boot 腳本壓縮後找不到 __LL_PRELOAD__，postbuild 會填不進預先載入的表');
        const boot = code.replaceAll('__LL_PRELOAD__', '/*ll:preload*/null');
        return (
          html
            .replace('<!--ll:favicon-->', buildFaviconLink())
            .replace('<!--ll:theme-color-->', buildThemeColorMetas())
            .replace('<!--ll:robots-->', isProduction ? '' : '<meta name="robots" content="noindex">')
            .replace('<!--ll:splash-->', buildSplashLinks())
            // 啟動畫面的樣式接在同一段 style 裡（postbuild 只允許一段 inline style）
            .replace('<!--ll:first-paint-->', `<style>${firstPaintStyle()}${launchScreenStyle()}</style>`)
            .replace('<!--ll:boot-->', buildBootScript(boot))
            .replace('<!--ll:launch-->', buildLaunchScreen())
            .replace('<!--ll:tabbar-->', buildNav())
            .replace('<!--ll:shell-l10n-->', buildShellL10nScript())
        );
      },
    },
    generateBundle() {
      // 給建置後檢查（tools/postbuild.mjs）用的 site config 快照
      this.emitFile({ type: 'asset', fileName: 'site-config.json', source: JSON.stringify(site, null, 2) });
    },
  };
}

// SVG 圖示直接寫成 data: URI（M3 收尾 QA，2026-10-26）：瀏覽器在 load 之後才抓 favicon，本機 Lighthouse 的模擬（HTTP/1.1、6 條連線）把它算進每一頁 LCP 前的請求；
// 寫進 HTML 就少一個請求（占位圖時約 0.6 KB；2026-10-28 換成小綠綠的描圖版後約 5.4 KB、gzip 2.2 KB，06 第 2.2 節）。來源仍是 public/favicon.svg（檔案照常部署、進 precache）；CSP 的 img-src 本來就允許 data:。favicon.ico（48、32、16）保留給不支援 SVG 圖示的瀏覽器
function buildFaviconLink(): string {
  const svg = readFileSync(`${root}public/favicon.svg`, 'utf8')
    .trim()
    .replaceAll('"', "'")
    .replace(/[<>#%{}\s]/g, (c) => (c === ' ' ? ' ' : encodeURIComponent(c)));
  return `<link rel="icon" href="data:image/svg+xml,${svg}" type="image/svg+xml" />`;
}

// vite-plugin-pwa 在 </head> 前插入的 <link rel="manifest">（M3 收尾 QA，2026-10-26）：改由殼層在第一次繪製送出後才插入（src/app/manifest-link.ts）。
// Chrome 看到 manifest 就會在 load 前後抓 manifest 與它的 192px 圖示（安裝條件的檢查），本機 Lighthouse 的模擬把這兩個請求算進每一頁 LCP 前；
// 它們不影響第一次繪製，和 Service Worker 的註冊一樣延後。manifest 檔照常產生、進 precache，Chrome 與 Safari 都會處理之後才加進來的 manifest 連結。
// 要排在 VitePWA 之後（enforce: 'post'、order: 'post'），而且在 Workbox 算 index.html 的 precache revision 之前
function deferManifestLink(): Plugin {
  return {
    name: 'll-defer-manifest-link',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const tag = `<link rel="manifest" href="${site.base}${site.manifestFile}">`;
        if (html.split(tag).length !== 2) throw new Error(`ll-defer-manifest-link：index.html 應該剛好有一個 ${tag}`);
        return html.replace(tag, '');
      },
    },
  };
}

const appVersion = (JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string }).version;

// chunk 與它的 CSS 的檔名（M3 驗收第 7 輪 handoff，預算）：entriesAware 群組以「用到它的頁面」命名，用「~」連起來的名稱最長約 100 個字
// （shared~Terms~Term~Settings~Play~Me~Design~…），每一個都原樣寫進入口 chunk 的 __vite__mapDeps，/en/ 首次載入的 JS 因此多約 140 bytes gzip。
// 檔名只留「~」前面那一段（shared、quiz、progress）加雜湊；場景共用的 shared~scene-… 保留（tools/budget.mjs 用名稱認 scene-kit 與場景共用的 chunk）
const shortChunk = (name: string): string => (name.includes('~') && !name.startsWith('shared~scene-') ? name.slice(0, name.indexOf('~')) : name);

export default defineConfig({
  base: site.base,
  define: {
    __LL_APP_VERSION__: JSON.stringify(`${appVersion}+${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}`),
    __LL_BUILT_AT__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    // 幕後頁技術棧的版本號：建置時從套件清單抄（stack-versions.config.ts）
    __LL_STACK_VERSIONS__: JSON.stringify(readStackVersions()),
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
    // .vite/manifest.json：tools/postbuild.mjs 據此算出依路徑預先載入的頁面 chunk（tools/lib/preload-table.mjs），用完就刪掉，不部署
    manifest: true,
    rolldownOptions: {
      output: {
        chunkFileNames: (chunk) => `assets/${shortChunk(chunk.name)}-[hash].js`,
        assetFileNames: (asset) => {
          const name = asset.names[0] ?? '';
          return name.endsWith('.css') && name.includes('~') ? `assets/${shortChunk(name)}-[hash][extname]` : 'assets/[name]-[hash][extname]';
        },
        // Rolldown 會把殼層入口與懶載入頁面共用的模組各自拆成小 chunk（M2 加了多個懶載入頁面後首次載入變成 17 個請求，
        // Lighthouse 模擬節流下 LCP 從 2.2 秒變 3.2 秒）；把入口靜態可達的模組（$initial）合成一個 chunk，首次載入的 JS 總量不變但只剩兩個請求（06 第 8.2 節）
        codeSplitting: {
          // 群組會連同被抓到的模組的依賴一起抓（includeDependenciesRecursively 預設 true；關掉它會讓入口拆成三個檔並出現循環的 chunk，不採用），
          // 所以先宣告的群組先把共用的依賴拿走：zod、作答工作階段（session）、進度 runtime（progress）各自一個 chunk；quiz 群組用 entriesAware
          // 把「只有作答頁用」、「按下確認才載入」與「地圖也用」的模組分開。另外不要在任何地方 import('@ledgerland/progress') 之後解構整個入口：
          // 那會把套件所有模組綁成一個動態進入點，讓第一波 chunk 又連回 runtime（BackupReminder.tsx 的註解）。改群組後用 06 第 8.2 節的方式量一次
          groups: [
            { name: 'app', tags: ['$initial'], priority: 3 },
            // 幾乎每個懶載入頁面都用、又很小的共用模組（i18n 的格式化函式與 web-ui 的圖示、小標、骨架、Toast、空狀態、星星）合成一個 common chunk：
            // 各自成 chunk 時作答頁與地圖要多發 6 個不到 1 KB 的請求，HTTP/1.1 的 6 條連線下一層一層排隊（2026-10-24 實測；合起來約 2.6 KB gzip，
            // 名詞列表與名詞頁因此多載約 1.5 KB 用不到的元件，換作答頁少 5 個請求、地圖少 6 個）。首頁不載它（殼層入口不 import）
            // 2026-10-25（M3 整合）另外放進來：頁首的 TopBar 與 BackButton（章節頁、名詞頁、子頁都用）、卡片 Card、展開列 Disclosure 與減少動態的判斷（motion.ts，各自不到 1 KB，
            // 單獨成 chunk 時名詞圖鑑、地圖、章節頁第一波各多一個請求）、名詞類別的顯示名稱（useCategoryLabel，名詞圖鑑、名詞頁與作答頁的名詞卡共用）。
            // 不放的話它們被 quiz-view 群組連依賴一起抓走，名詞圖鑑、名詞頁與章節頁為了一個小函式要在第一波多載 quiz-view、level-view 與 session（約 30 KB gzip）。
            // 2026-10-25 本機 Lighthouse（3 次中位數）：這一段與下面 overlay、glossary、award、地圖 CSS 的調整合起來，名詞圖鑑 2761 到 2459ms、名詞頁 2872 到 2419ms、
            // 地圖 2901 到 2451ms、章節頁 2873 到 2423ms，回到 2500ms 門檻內。
            // M3 收尾 QA（2026-10-26）：「中途離開的關卡」紀錄（lib/level-exit.ts，兩個不到 100 bytes 的函式，作答頁寫、地圖讀）從 session 移到這裡：
            // 地圖頁原本為了它要在第一波多載整個作答工作階段（store、idb、session-cache，約 5.6 KB）。地圖改成動態載入它的話，Rolldown 會把執行期輔助函式
            // 拆成另一個入口 chunk（rolldown-runtime，每一頁第一波多一個請求），所以放在這裡。這個 chunk 的大小要留意：本機 Lighthouse 的模擬下
            // 同時 6 個請求時每條連線一次往返只送約 4.3 KB（含約 0.9 KB 的回應標頭），common 目前約 3.4 KB gzip，再大就多一次往返
            {
              name: 'common',
              test: /[\\/](packages[\\/](i18n[\\/]src[\\/]format\.ts|web-ui[\\/]src[\\/]components[\\/](icons|NoteTag|Skeleton|Toast|States|Stars|Badge|TopBar|BackButton|Disclosure|motion|Card)\.tsx?)|apps[\\/]web[\\/]src[\\/](features[\\/]glossary[\\/]useCategoryLabel|lib[\\/]level-exit)\.ts)$/,
              priority: 3,
            },
            { name: 'zod', test: /[\\/]node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?zod[\\/]/, priority: 2 },
            // 核心的內建資料（科目表、教材版面、指標登錄檔與它們的 JSON）：分錄、指標計算、交易影響、五步驟題第一次繪製後才載入（features/quiz/lazy-data.ts）。
            // 要在 quiz 群組之前宣告，否則資料會和核心其他程式、判分一起進 quiz 的 chunk，載資料就連判分、題目 schema 與 zod 一起載（2026-10-24 實測多約 51 KB gzip）
            {
              name: 'core-data',
              test: /[\\/](packages[\\/]core[\\/](src[\\/]data[\\/](index|types)\.ts|data[\\/].+\.json)|apps[\\/]web[\\/]src[\\/]features[\\/]quiz[\\/]core-data\.ts)$/,
              priority: 2,
            },
            // 佔位符的純文字版與名詞欄位對應（features/quiz/placeholders.ts、term-fields.ts）、名詞旗標（features/glossary/note-kinds.ts）與佔位符的 ID 規則
            // （content-schema 的 ids.ts，不帶 zod）合成一個小 chunk：名詞頁與作答頁共用，分開時作答頁第一波多三個 chunk、名詞頁多兩個（2026-10-26）。
            // 群組會連依賴一起抓：session 與 progress 的模組都依賴 ids.ts，所以要宣告在它們之前，ids.ts 才不會被它們先拿走。
            // 2026-10-27 起中文逐字換行，原本也在這裡的切詞工具（ProseWords、prose-units、term-page/prose）已刪，群組名稱沿用
            {
              name: 'prose',
              test: /[\\/](apps[\\/]web[\\/]src[\\/]features[\\/](quiz[\\/](placeholders|term-fields)|glossary[\\/]note-kinds)\.ts|packages[\\/]content-schema[\\/]src[\\/]ids\.ts)$/,
              priority: 2,
            },
            // 作答工作階段：@ledgerland/progress 的 session 純函式、model 的常數與 ID 函式（generateAttemptId）、時間工具、apps/web 的 store 與暫存區、idb，
            // 作答頁第一次繪製就要，所以在 progress 群組之前宣告，
            // 否則 progress 群組會把它們和儲存 runtime、zod 併成一個 chunk，runtime 回到關鍵路徑（2026-10-24 收回 LCP 門檻時實測）。
            // content-schema 的 ids.ts 與 lib/level-exit.ts 不在這裡（M3 收尾 QA，2026-10-26）：地圖的關卡代號與 QR 為了 ids.ts 的字母表、地圖頁為了 level-exit，
            // 第一波要多載整個工作階段（約 5.6 KB）；ids.ts 改放 prose 群組、level-exit 改放 common 群組。
            // 同一天把原本的 level-view 群組併進來：作答與判分共用的答案正規化（answers、ratio-units 與 i18n 的 input、quiz 的 normalise）、收藏清單（favourites）與計時設定（timer）。
            // 它們和工作階段都是作答頁第一次繪製就要的，分成兩個 chunk 時作答頁第一波多一個請求（本機 Lighthouse 的模擬下作答頁 LCP 剛好在 2500ms 邊緣）；
            // 代價是設定頁（計時設定）與「我的」的收藏區也會載入工作階段的 store 與 idb（約 4.6 KB）。只有關卡頁用的小模組（計時器、捲動錨點、結果頁的載入器等）改放 quiz-view
            {
              name: 'session',
              test: /[\\/](packages[\\/](progress[\\/]src[\\/](session|model|util|time)|i18n[\\/]src[\\/]input|quiz[\\/]src[\\/]normalise)\.ts|apps[\\/]web[\\/]src[\\/](store[\\/]quiz\.ts|features[\\/]quiz[\\/](session-cache|favourites|timer|answers|ratio-units)\.ts)|node_modules[\\/](\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?idb[\\/])/,
              priority: 2,
            },
            // 進度 runtime：@ledgerland/progress 其餘模組（store、merge、migrations、backup、schemas）與 lib/progress 的 IndexedDB 實作；只由 getProgressStore 動態載入，
            // 地圖、章節與首頁延後開庫只等這個（schema 的 zod 由備份與匯入才用）
            {
              name: 'progress',
              test: /[\\/](packages[\\/]progress[\\/]src|apps[\\/]web[\\/]src[\\/]lib[\\/]progress)[\\/]/,
              entriesAware: true,
              priority: 2,
            },
            // 面板 Sheet 與選單 Menu（2026-10-25，M3 整合）：地圖的關卡面板與「更多」選單、作答頁的名詞卡與分錄科目選單、備份的確認面板都用。
            // 交給 quiz 群組時依「誰用到」切成兩個 1 KB 多的 chunk，地圖與章節頁第一波各多一個請求；合成一個
            { name: 'overlay', test: /[\\/]packages[\\/]web-ui[\\/]src[\\/]components[\\/](Sheet|Menu)\.tsx$/, priority: 2 },
            // 名詞圖鑑的資料 hook 與純函式（名詞列表、名詞頁、徽章頁與「我的」頁的徽章區共用）加上名詞卡元件 GlossaryItem：自成一個 chunk。放進 shared 的話會因為 4 KB 的合併門檻
            // 和徽章區（BadgesSection 用地圖的 ChapterBadge）併在一起，名詞列表與名詞頁就得連整個地圖的 chunk 一起載（2026-10-24 量到多 15.7 KB）。
            // 2026-10-25（M3 整合）優先度從 1 提到 2 並排在 quiz 群組之前：名詞卡（作答頁的 term-sheet 也用）與 unlocks.ts（首頁與「我的」的統計也用）原本被 quiz 群組
            // 依「誰用到」切成兩個 1 到 2 KB 的小 chunk，名詞圖鑑與名詞頁第一波多兩個請求
            {
              name: 'glossary',
              test: /[\\/](apps[\\/]web[\\/]src[\\/]features[\\/]glossary[\\/]|packages[\\/]web-ui[\\/]src[\\/]components[\\/]GlossaryItem\.tsx$)/,
              priority: 2,
            },
            // 作答頁（關卡、錯題本）第一次繪製就要的題目模組：關卡的工作階段（LevelSession）、題型對應、名詞卡、佔位符渲染與指標的顯示資料。不用 entriesAware：
            // 延後載入的四種題型（question-types.tsx）也用到這些模組，交給 quiz 群組的 entriesAware 會依「誰用到」拆成三個 chunk，作答頁第一波多兩個請求（2026-10-24 實測）。
            // 回饋區（FeedbackView、FeedbackPanel）不在這裡，由 feedback-lazy 和判分一起預載。它們的依賴（web-ui 的選項、是非、分類與選列元件）也一起進來；題目卡（Level 直接用）、數字輸入（計時器與延後的題型共用）與判分的載入器要另外列出。
            // 原本 level-view 群組裡只有 LevelSession 用的小模組（計時器 level-timer 與 TimerDisplay、捲動錨點、收藏的 hook、結果頁的載入器 result-lazy、標題下的 level-notes）也併進來（2026-10-26）；
            // 結果頁元件（ResultView）不在第一波：由 result-lazy 和判分一起在第一次繪製後預載（level-view 的寫法曾把它一起放進第一波）。
            // level-view 群組的歷史：交給 quiz 群組的 entriesAware 會依「哪些頁面用到」拆成六個 0.3 到 2.5 KB 的 chunk，作答頁因此多發五個請求（2026-10-24 實測），
            // 所以它們一直要明確列在某個第一波的群組裡
            {
              name: 'quiz-view',
              test: /[\\/](apps[\\/]web[\\/]src[\\/]features[\\/](quiz[\\/](LevelSession|QuestionView|feedback-lazy|Markup|terms|categories|useAsync|layout-lazy|ratio-lazy|lazy-data|ratio-format|scoring-lazy|result-lazy|level-favourites|level-timer|TimerDisplay|useScrollAnchor|level-notes)\.tsx?)|packages[\\/]web-ui[\\/]src[\\/]components[\\/](QuestionCard|NumberInput)\.tsx)$/,
              priority: 2,
            },
            // 只有作答頁（關卡、錯題本）才需要的模組：quiz 判分、core、content-schema 的題目 schema、web-ui 的題目元件與 features/quiz。
            // 判分與紀錄由 scoring-lazy.ts 動態載入，entriesAware 會把它們和第一次繪製就要的題目元件分成不同 chunk。
            // Stars 與 Badge 也放這裡（entriesAware 依用到的頁面自成小 chunk）：它們同時被地圖的元件（LevelNode、LevelSheet）與其他頁面用到，
            // 不放的話會被 quest-map 群組連依賴一起抓走，作答頁、名詞列表與名詞頁就得載整個地圖的 chunk（2026-10-24 量到名詞頁多載 19.7 KB）
            {
              name: 'quiz',
              test: (id: string) =>
                /[\\/](packages[\\/](quiz|core|content-schema)[\\/]src|apps[\\/]web[\\/]src[\\/]features[\\/]quiz)[\\/]/.test(id)
                  ? !/[\\/](packages[\\/]quiz[\\/]src[\\/](stars|review|index)|packages[\\/]content-schema[\\/]src[\\/](common|index)|features[\\/]quiz[\\/]session-cache)\.ts$/.test(
                      id,
                    )
                  : /[\\/]packages[\\/]web-ui[\\/]src[\\/]components[\\/](ChoiceGroup|ClassifyBoard|ImpactPicker|PickLine|PickStatement|TrueFalse|NumberInput|FeedbackPanel|QuestionCard|Stars|Badge)\./.test(
                      id,
                    ),
              entriesAware: true,
              priority: 2,
            },
            // 闖關地圖與章節頁共用的地圖模組（features/quest-map、場景共用的 quest-map-scenes/scene-shared 與 @ledgerland/web-ui/map 的元件）。
            // 各章場景（quest-map-scenes/scene-<名稱>.tsx）不能抓：它們是依章 lazy 載入的進入點，抓進來就全部跟著地圖第一波下載（tools/budget.mjs 會擋）：
            // 以前落在 shared，作答頁為了 store 與空狀態元件連地圖元件、地圖的 CSS 一起載；掃描畫面、解碼 worker、fixtures、?from 的走路時間軸（walk.ts）與各章場景是各自的動態進入點，不抓。
            // 章節徽章的寫入（features/badges/award.ts，地圖、章節頁、徽章頁都用，它本身只依賴地圖的資料與進度模組）也併進來，不另外成一個不到 1 KB 的 chunk
            // 地圖頁的版面 CSS（styles/quest-map.css）不放進來（2026-10-25）：只有 Play.tsx 匯入它、只有地圖頁用得到；放在群組裡時章節頁與徽章頁載入地圖模組也會連帶載它（第一波多一個 3 KB 的 CSS）
            // tools/budget.mjs 的 mapChunkGzipKb 把 Play 與 quest-map 的 chunk 加總
            // 代號輸入框 LevelCodeInput 不抓（第 7 輪 handoff）：只有延後載入的代號疊加層（features/quest-map-overlays/LevelCodeOverlay.tsx）用，
            // 列在這裡時它和 FieldError 留在地圖 chunk（約 0.7 KB gzip），地圖第一波用不到。
            // 課堂 QR 的網址驗證（qr-url.ts，由延後載入的掃描疊加層呼叫）與關卡代號的正規化（level-code.ts，代號疊加層與 Safari 分頁提示延後載入）也不抓（2026-10-26）：
            // 它們是地圖第一波唯一用到 ids.ts 的模組，Safari 分頁提示的代號格式化也不必為了它載整個地圖 chunk
            {
              name: 'quest-map',
              test: (id: string) =>
                (/[\\/]apps[\\/]web[\\/]src[\\/](features[\\/]quest-map[\\/]|features[\\/]quest-map-scenes[\\/]scene-shared\.tsx$|features[\\/]badges[\\/]award\.ts$)/.test(
                  id,
                ) &&
                  !/[\\/](QrScanner\.(tsx|css)|qr-worker\.ts|fixtures\.ts|walk\.ts|qr-url\.ts|level-code\.ts)$/.test(id)) ||
                /[\\/]packages[\\/]web-ui[\\/]src[\\/](map\.ts|components[\\/](LevelNode|LevelSheet|LevelCard|LevelCode|ChapterBanner|ChapterEnd|MapMarker|MapHud|MapListToggle|map-icons)\.)/.test(
                  id,
                ),
              priority: 1,
            },
            // 其餘懶載入頁面共用的模組（空狀態、圖示、安裝說明、徽章、圖鑑索引等）：entriesAware 依「哪些頁面用到」分組，作答頁只載空狀態與 Toast，
            // 不會為了安裝說明與徽章連地圖的 chunk 一起載；小於 4 KB 的子群組併進鄰近的子群組，請求數不會失控（06 第 8.2 節）
            { name: 'shared', minShareCount: 2, entriesAware: true, entriesAwareMergeThreshold: 4096, priority: 1 },
          ],
        },
      },
    },
  },
  plugins: [
    shell(),
    chunkModules(),
    react(),
    lingui({ macroTransform: true }),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      filename: 'sw.js',
      manifestFilename: site.manifestFile,
      scope: site.base,
      // 安裝用的 PNG（manifest 的 icons 與 apple-touch-icon）不進 precache：系統在「加入主畫面」那一刻自己抓，離線時用不到；
      // 2026-10-28 圖示換成小綠綠的插圖後五個 PNG 合計約 350 KB，precache 預算（3600 KB）放不下（06 第 2.2 節）
      includeAssets: ['favicon.svg', 'icons/favicon.ico', 'glass/refract-map.svg'],
      // generateSW 預設會把 manifest 的 icons 加進 precache，光靠 globIgnores 擋不住
      includeManifestIcons: false,
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
        globIgnores: [
          'splash/**',
          'icons/pwa-*.png',
          'icons/maskable-*.png',
          'icons/apple-touch-icon-*.png',
          'site-config.json',
          'build-report.json',
          '_headers',
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
    deferManifestLink(),
  ],
  server: { port: 5173, strictPort: true },
});
