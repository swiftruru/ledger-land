(function () {
  var root = document.documentElement;
  // CSP 違規紀錄：debug 頁與 E2E 一併檢查（09 第 11.1 節）
  window.__llCsp = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    window.__llCsp.push(e.violatedDirective + ' ' + e.blockedURI + ' ' + String(e.sample || '').slice(0, 60));
  });
  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function mq(q) {
    return window.matchMedia(q).matches;
  }

  // 實驗（launch-flash-experiments 分支）：/x-<旗標>-<旗標>/ 當 start_url，旗標記在 data-exp，網址改回 /
  var EXP = [];
  var xm = /^\/x-([a-z-]+)\/?/.exec(location.pathname);
  if (xm) {
    EXP = xm[1].split('-');
    if (EXP.indexOf('all') >= 0) EXP = ['nooverlay', 'block', 'noiw', 'media', 'noglass', 'nonav', 'manifest'];
    root.dataset.exp = EXP.join(' ');
    window.__llExp = EXP;
    history.replaceState(history.state, '', '/' + location.search + location.hash);
  }
  var ENTRY_CSS = __LL_ENTRY_CSS__;
  if (EXP.indexOf('block') >= 0 && ENTRY_CSS) {
    // 屬性順序刻意和建置的連結不同，vite.config.ts 的 ll-entry-stylesheet-non-blocking 才不會把這段字串也當成樣式表連結改掉
    document.write('<link data-ll="entry-css" rel="stylesheet" crossorigin href="' + ENTRY_CSS + '">');
  }
  // 第二輪（頁面以外的變因）：nosplash 拿掉全部 iOS 啟動圖、darkmeta 兩個 theme-color 都改成夜空色且不帶 media、noiw 的 viewport 不帶 interactive-widget
  if (EXP.indexOf('nosplash') >= 0) {
    var sl = document.querySelectorAll('link[rel="apple-touch-startup-image"]');
    for (var si = 0; si < sl.length; si++) sl[si].parentNode.removeChild(sl[si]);
  }
  var DARK_META = EXP.indexOf('darkmeta') >= 0;
  if (DARK_META) {
    var tm = document.querySelectorAll('meta[name="theme-color"]');
    for (var ti = 0; ti < tm.length; ti++) {
      tm[ti].removeAttribute('media');
      tm[ti].setAttribute('content', '#121018');
    }
  }
  // 第三輪：第一格就有 WebKit 算得到的「看得見的內容」。text 寫一段 300 字的文字，img 寫一張 64×64 的圖（WebKit 的 first visually non-empty layout
  // 只數文字字元與圖片像素，內嵌 SVG 與藏起來的內容都不算；iOS 可能等這個訊號才把啟動圖換掉）
  if (EXP.indexOf('text') >= 0) {
    var words = '';
    for (var wi = 0; wi < 30; wi++) words += 'LedgerLand ';
    document.write('<p>' + words + '</p>');
  }
  if (EXP.indexOf('img') >= 0) {
    document.write('<img width="64" height="64" alt="" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27%3E%3Crect width=%2764%27 height=%2764%27 fill=%27%23121018%27/%3E%3C/svg%3E">');
  }
  // 第四輪：啟動圖連結的寫法。media 改成和 NekoServe 一樣（淺色不帶 prefers-color-scheme、深色把它放最前面、都帶 device-height）；nolight 只留深色的啟動圖
  if (EXP.indexOf('media') >= 0 || EXP.indexOf('nolight') >= 0) {
    var links = document.querySelectorAll('link[rel="apple-touch-startup-image"]');
    for (var li = 0; li < links.length; li++) {
      var ln = links[li];
      var hm = /apple-splash-(light|dark)-(\d+)x(\d+)\.png$/.exec(ln.getAttribute('href') || '');
      var wm = /device-width: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\)/.exec(ln.getAttribute('media') || '');
      if (!hm || !wm) continue;
      if (EXP.indexOf('nolight') >= 0 && hm[1] === 'light') {
        ln.parentNode.removeChild(ln);
        continue;
      }
      if (EXP.indexOf('media') >= 0) {
        var dpr = Number(wm[2]);
        var geo = '(device-width: ' + wm[1] + 'px) and (device-height: ' + Number(hm[3]) / dpr + 'px) and (-webkit-device-pixel-ratio: ' + dpr + ') and (orientation: portrait)';
        ln.setAttribute('media', hm[1] === 'dark' ? 'screen and (prefers-color-scheme: dark) and ' + geo : 'screen and ' + geo);
      }
    }
  }
  // 第五輪：noglass 玻璃改實色（沒有 backdrop-filter）、nonav 不畫 Tab bar（首次繪製 style 的規則）、manifest 掛一份有 display_override 的 manifest
  if (EXP.indexOf('manifest') >= 0) {
    var ml = document.createElement('link');
    ml.rel = 'manifest';
    ml.href = '/manifest-exp-' + xm[1] + '.webmanifest';
    document.head.appendChild(ml);
  }
  if (EXP.indexOf('noiw') >= 0) {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
  // 語系：網址為準。只有根路徑依已存偏好轉到 /en/（05 第 7.4 節第 3 點）
  var path = location.pathname;
  var rootRedirected = false;
  if (path === '/' && read('ll:locale') === 'en') {
    history.replaceState(history.state, '', '/en/' + location.search + location.hash);
    path = '/en/';
    rootRedirected = true;
  }
  root.lang = /^\/en(\/|$)/i.test(path) ? 'en' : 'zh-TW';

  // 依路徑預先載入（06 第 8.2 節、14 第 5.2 節）：這一頁的頁面 chunk（含靜態 import）、目前語言的訊息 catalog 與第一次繪製要讀的內容快照，
  // 和殼層入口 chunk 同時開始下載，不必等入口執行完、路由解析完才一層一層發請求。表格由 tools/postbuild.mjs 在建置後填入
  // （tools/lib/preload-table.mjs，路由表在 src/shell/route-preload.json）；開發模式與沒有表格時是 null，什麼都不做。
  // 內容快照用 as=fetch 加 crossorigin，和 lib/content.ts 的 fetch() 同一組 mode 與 credentials 才會被重用。
  // 實驗 R3：boot 不加任何預先載入的連結（正式版一開機就加約 40 個 preload，全部同時打到 Service Worker）
  window.__llPreloadTable = __LL_PRELOAD__;
  var PRELOAD = null;
  if (PRELOAD) {
    try {
      var lang = root.lang;
      var langIndex = PRELOAD.m.l.indexOf(lang);
      var rel = path.replace(/^\/en(?=\/|$)/i, '').toLowerCase() || '/';
      if (rel.charAt(rel.length - 1) !== '/') rel += '/';
      var head = document.head;
      var addLink = function (href, kind) {
        var l = document.createElement('link');
        if (kind === 'js') l.rel = 'modulepreload';
        else {
          l.rel = 'preload';
          l.as = kind === 'css' ? 'style' : 'fetch';
          if (kind === 'json') l.crossOrigin = 'anonymous';
        }
        l.href = href;
        head.appendChild(l);
      };
      var addAssets = function (list) {
        for (var i = 0; i < list.length; i++) {
          var f = PRELOAD.a[list[i]];
          addLink('/assets/' + f, /\.css$/.test(f) ? 'css' : 'js');
        }
      };
      addAssets(PRELOAD.c[lang] || []);
      addAssets(PRELOAD.w || []);
      for (var r = 0; r < PRELOAD.r.length; r++) {
        var route = PRELOAD.r[r];
        var hit = new RegExp(route[0]).exec(rel);
        if (!hit) continue;
        addAssets(route[1]);
        var id = hit[1];
        for (var k = 0; k < route[2].length; k++) {
          var kind = route[2][k];
          var cm = PRELOAD.m;
          if (kind === 'chapterIndex') addLink('/' + cm.ci[lang], 'json');
          else if (kind === 'termIndex') addLink('/' + cm.ti[lang], 'json');
          else if (kind === 'tombstones') addLink('/' + cm.tb, 'json');
          else if (kind === 'level' && id && cm.lv[id] && cm.ch[cm.lv[id]])
            // 關卡在所屬章節的章節包裡（lv 是關卡 ID 對章節 ID，ch 是章節 ID 對各語言的雜湊）
            addLink('/content/' + lang + '/' + cm.lv[id] + '.' + cm.ch[cm.lv[id]][langIndex] + '.json', 'json');
          else if (kind === 'termDetail' && id)
            for (var t = 0; t < cm.l.length; t++) {
              // 名詞分桶：ID 最後一個字元的字元碼除以 8 的餘數，和 lib/content.ts 的 termDetailBucket 一致
              var bucket = String(id.charCodeAt(id.length - 1) % 8);
              var h = cm.td[cm.l[t]] && cm.td[cm.l[t]][bucket];
              if (h) addLink('/content/' + cm.l[t] + '/terms-' + bucket + '.' + h + '.json', 'json');
            }
        }
        break;
      }
    } catch (e) {
      /* 預先載入失敗不影響頁面：之後照常由路由載入 */
    }
  }

  // isAppMode()（06 第 2.7 節）：三種訊號都看，原始值留給 debug 頁
  var dm = {
    standalone: mq('(display-mode: standalone)'),
    fullscreen: mq('(display-mode: fullscreen)'),
    minimalUi: mq('(display-mode: minimal-ui)'),
    browser: mq('(display-mode: browser)'),
    navigatorStandalone: navigator.standalone === true,
  };
  root.dataset.display = dm.standalone || dm.fullscreen || dm.navigatorStandalone ? 'app' : 'browser';
  // 實驗 V：第一格裡沒有固定定位的 Tab bar（nonav 不畫；absnav 改絕對定位）
  root.dataset.exp = 'absnav';
  // 入口樣式表建置時是 media="print"（不擋第一次繪製，啟動圖換到 App 內畫面才不會白一下，vite.config.ts 的 ll-entry-stylesheet-non-blocking）：
  // 載完就切回 all 並標 data-css，首次繪製 style 在那之前把 body 裡除了啟動畫面以外的內容藏起來；載入失敗也標，頁面退成沒樣式而不是一直空白
  function cssReady(e) {
    var t = e.target;
    if (!t || !t.getAttribute || t.getAttribute('data-ll') !== 'entry-css') return;
    t.media = 'all';
    root.dataset.css = '1';
  }
  document.addEventListener('load', cssReady, true);
  document.addEventListener('error', cssReady, true);
  // 啟動畫面（06 第 2.4 節）：主畫面 App 的視窗有時從狀態列底下開始、比整個螢幕矮（WebKit bug 301994，2026-10-28 iPhone 實機：插圖往下 25 點、字樣 7 點），
  // 而 iOS 的啟動圖是依整個螢幕截的；把少掉的高度記成 --ll-launch-top，覆蓋層往上延伸同樣的高度，版面才和啟動圖一樣。視窗和螢幕一樣高時不設（0）
  if (root.dataset.display === 'app' && window.screen && window.innerWidth === screen.width) {
    var gap = screen.height - window.innerHeight;
    if (gap > 0 && gap < 160) root.style.setProperty('--ll-launch-top', gap + 'px');
  }

  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  // 實驗 R12：主題這段照跑
  {
    // 主題（16 第 7 節）：ll:theme 為 system、light、dark（預設 system）；ll:dark-flavor 為 violet、berry、wine（預設 violet）。
    // 色碼由 packages/tokens 在建置時填入（vite.config.ts 的殼層外掛會把下一行的佔位換成色碼）
    var THEME_COLOR = __LL_THEME_COLOR__;
    function themePref() {
      var v = read('ll:theme');
      return v === 'light' || v === 'dark' ? v : 'system';
    }
    function flavorPref() {
      var v = read('ll:dark-flavor');
      return v === 'berry' || v === 'wine' ? v : 'violet';
    }
    function applyTheme() {
      var pref = themePref();
      var flavor = flavorPref();
      var theme = pref === 'system' ? (darkMq.matches ? 'dark' : 'light') : pref;
      root.dataset.theme = theme;
      root.dataset.flavor = flavor;
      root.style.colorScheme = theme;
      // 跟隨系統時兩個 meta 依 media 各自取值；手動指定時兩個都改成目前主題的值（06 第 2.4 節第 1 點）
      // 實驗 R10：boot 完全不碰 theme-color meta
      var metas = [];
      for (var i = 0; i < metas.length; i++) {
        var isDarkMeta = (metas[i].getAttribute('media') || '').indexOf('dark') >= 0;
        var useDark = pref === 'system' ? isDarkMeta : theme === 'dark';
        metas[i].setAttribute('content', useDark ? THEME_COLOR[flavor] : THEME_COLOR.light);
      }
    }
    // 測試用：網址帶 ?ll-theme=system|light|dark 與 ?ll-flavor=violet|berry|wine 時先寫入同樣的兩個 key（axe 與截圖矩陣用，對使用者無害）
    try {
      var params = new URLSearchParams(location.search);
      var qt = params.get('ll-theme');
      var qf = params.get('ll-flavor');
      if (qt === 'system') localStorage.removeItem('ll:theme');
      else if (qt === 'light' || qt === 'dark') localStorage.setItem('ll:theme', qt);
      if (qf === 'violet' || qf === 'berry' || qf === 'wine') localStorage.setItem('ll:dark-flavor', qf);
    } catch (e) {
      /* 本機儲存不可用時忽略 */
    }
    applyTheme();
    darkMq.addEventListener('change', applyTheme);
    window.__llApplyTheme = applyTheme;

  }
  // 實驗 R13：玻璃這段照跑，但 resolveGlass 一律回 solid（Tab bar 沒有 backdrop-filter）
  {
    // 玻璃閘門（07 第 5.2 節）
    var LEGACY_SAFARI_SOLID = false;
    var unprefixed = CSS.supports('backdrop-filter', 'blur(1px)');
    var prefixed = CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    var legacy = !unprefixed && prefixed;
    root.dataset.glassLegacy = legacy ? 'true' : 'false';
    function resolveGlass() {
      if (EXP.indexOf('noglass') >= 0 || true) return 'solid';
      var pref = read('ll:transparency');
      if (pref === 'reduced') return 'solid';
      if (mq('(prefers-reduced-transparency: reduce)') || mq('(prefers-contrast: more)') || mq('(forced-colors: active)')) return 'solid';
      if (!unprefixed && !prefixed) return 'solid';
      if (legacy && LEGACY_SAFARI_SOLID) return 'solid';
      var uad = navigator.userAgentData;
      var chromium = !!(
        uad &&
        uad.brands &&
        uad.brands.some(function (b) {
          return b.brand === 'Chromium';
        })
      );
      if (chromium && (pref === 'refract' || (pref === null && uad.mobile === false))) return 'refract';
      return 'frost';
    }
    function apply() {
      root.dataset.glass = resolveGlass();
    }
    apply();
    ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)', '(forced-colors: active)'].forEach(function (q) {
      window.matchMedia(q).addEventListener('change', apply);
    });
    window.__llReapplyGlass = apply;
  }
  window.__llBoot = {
    displayMode: dm,
    unprefixedBackdrop: unprefixed,
    prefixedBackdrop: prefixed,
    bootPath: path,
    rootRedirected: rootRedirected,
    prefersDark: darkMq.matches,
    stored: read('ll:theme'),
  };
})();
