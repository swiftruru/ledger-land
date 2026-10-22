// Tab bar 控制器（07 第 6.1 到 6.3 節）：只取得殼層裡既有的 #ll-tabbar，更新屬性與文字，
// 不建立也不替換 nav 或任何子元素，也不使用 React portal。
// 2026-10-21 起參考你的 nekoserve（LiquidIndicator、TabLensMagnifier）加上 Liquid Glass 的鏡片：
// 切換時鏡片拉長、壓扁、過衝再落定；按住時鏡片抬起放大；在 Tab bar 上拖曳可以選 Tab。
// 與 nekoserve 不同的地方：只動 transform（nekoserve 動 left 與 width）。切換動畫用一個 rAF 迴圈同時寫膠囊與分身，兩者同一幀更新，不會錯開。
import { localeFromPath, localePath, stripLocale, type Locale } from '@ledgerland/i18n';
import { NAV_LABEL, SKIP_LABEL, TABS } from './tabs';

export interface TabbarHandle {
  update(pathname: string): void;
  state(): { current: number; collapsed: boolean; hidden: boolean; vertical: boolean; lifted: boolean };
  destroy(): void;
}

export type TabbarNavigate = (to: string, opts?: { replace?: boolean }) => void | Promise<void>;

const TEXT_INPUT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select, [contenteditable="true"]';

// 手勢參數沿用 nekoserve 在 iPhone 實機調過的值（D-080、D-160、D-161）
const LIFT_MS = 690; // tokens.css 的 --ll-dur-lift（620ms）加 --ll-lift-lag（70ms）：抬起與放下的史萊姆回彈全部結束
const DRAG_THRESHOLD = 6;
const SWALLOW_MS = 350;
const TAP_HANG_MS = 220;
const EDGE = 1; // 分身底板內縮，與 tabbar.css 的 .ll-lens__mag inset 相同
// 2026-10-21 你在實機上的兩次回饋：「甩回去的水珠太細長」與「失去水滴特有的 Q 彈感」。
// 現在用兩個阻尼彈簧模擬水滴：位置彈簧把鏡片拉到目標（過衝約 9%，再小小回彈一次）；
// 形狀彈簧比較有彈性，飛行時跟著速度拉長，到達目標那一刻目標形狀改回圓形，水滴就會收縮再回彈兩三次
// （一格約 1.12 → 0.96 → 1.01 → 1，兩格以上 1.18 → 0.945 → 1.02 → 1），另一軸反向變化，體積大致不變。
// 拉伸上限仍是 1.18、另一軸最低 0.92，不會再變成細長條
const POS_RESPONSE = 380; // ms，彈簧的自然週期
const POS_DAMPING = 0.6; // 阻尼比，過衝約 9%
const SHAPE_RESPONSE = 220;
const SHAPE_DAMPING = 0.3; // 每次回彈約剩前一次的 37%
const SHAPE_GAIN = 12; // 速度（格/ms）乘上這個值是飛行中想要的拉伸量
// 2026-10-22 你回報拖放後「太保守、少了骨溜感」：拖曳中與放開後的滑行改用比較大的拉伸上限（1.30），
// 放開時帶走的速度也放寬，水滴會帶著慣性滑過目標約 0.25 格、拉長，再收縮回彈；點按切換維持 1.18
const MAX_FLING = 2.2; // px/ms，拖曳放開時帶走的速度上限
const MAX_STRETCH_DRAG = 1.3;
const EDGE_OVERSHOOT = 0.06; // 格，第一格與最後一格往外最多只「看起來」過衝這麼多（飽和映射，不是硬牆），水滴不會被甩出 Tab bar
const MAX_STRETCH = 1.18;
const MIN_STRETCH = 0.94;
const MIN_SQUASH = 0.92;
const MAX_BULGE = 1.06;
const SETTLE_MAX_MS = 1400;
// 拉長時鏡片的外緣最多超出底盤內緣這麼多 px：甩到兩端時水滴不會衝出螢幕。抬起的鏡片在第一格與最後一格本來就超出約 8.5px，
// 留 10px 讓兩端還能稍微拉長一點
const LENS_EDGE_SLACK = 10;
// 抬起的彈簧最大會過衝到 --ll-lift 的 1.062 倍（1.3 → 1.38），capStretch 用這個最大值估鏡片寬度
const LIFT_PEAK = 1.062;
const FRAME_CAP_MS = 34; // 每幀最多推進 34ms（30fps 的省電模式不會變慢動作，很慢的一幀才會被截短）

interface Pos {
  pos: number;
  s: number;
  c: number;
}

/** 拉長時另一軸變窄、收縮時另一軸變寬，像水滴；限制在 0.92 到 1.06 */
const crossFor = (s: number) => Math.min(MAX_BULGE, Math.max(MIN_SQUASH, 1 - 0.8 * (s - 1)));

export function tabIndexFor(pathname: string): number {
  const rest = stripLocale(pathname).replace(/^\//, '').toLowerCase();
  return TABS.findIndex((t) => (t.path === '' ? rest === '' : rest.startsWith(t.path) || t.also.some((a) => rest.startsWith(a))));
}

const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

export function attachTabbar(navigate: TabbarNavigate): TabbarHandle {
  const nav = document.getElementById('ll-tabbar');
  if (!nav) {
    return { update() {}, state: () => ({ current: -1, collapsed: false, hidden: false, vertical: false, lifted: false }), destroy() {} };
  }
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[data-tab]'));
  const pill = nav.querySelector<HTMLElement>('.ll-tabbar__pill');
  const row = nav.querySelector<HTMLElement>('.ll-lens__row');
  const list = nav.querySelector<HTMLElement>('.ll-tabbar__list');
  const ghostLabels = Array.from(nav.querySelectorAll<HTMLElement>('.ll-lens__item .ll-tabbar__label'));
  const skip = document.querySelector<HTMLAnchorElement>('.ll-skiplink');
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wideMq = window.matchMedia('(min-width: 1024px)');
  const forcedMq = window.matchMedia('(forced-colors: active)');
  const params = new URLSearchParams(location.search);
  // 試作專用：?ll-lens=hold 讓鏡片常駐抬起（截圖取樣對比用）；?ll-lens=align 抬起但不放大（檢查分身對齊）
  const holdLens = params.get('ll-lens') === 'hold' || params.get('ll-lens') === 'align';
  if (params.get('ll-lens') === 'align') nav.classList.add('is-align');
  // 試作專用：再加 &ll-lens-at=0.6 讓常駐抬起的鏡片停在第 0.6 格（與 LINE 拖曳中的截圖並排比對），&ll-lens-s=1.1 是拉伸量
  const heldAt = holdLens && params.has('ll-lens-at') ? Number(params.get('ll-lens-at')) : NaN;
  const heldS = Number(params.get('ll-lens-s') ?? '1') || 1;
  let current = nav.hasAttribute('data-current') ? Number(nav.getAttribute('data-current')) : -1;
  let travelRaf = 0;
  let lastFrame = -1;
  // 水滴的物理狀態：位置 x（px）、速度 v（px/ms）、形狀 d（拉伸量，s = 1 + d）與它的變化速度 dv
  const sim = { x: 0, v: 0, d: 0, dv: 0, landed: false, side: 1, cap: MAX_STRETCH };
  let collapsed = false;
  let hidden = false;
  let lifted = false;
  let destroyed = false;
  let dropTimer = 0;
  let lowerTimer = 0;
  let fadeTimer = 0;
  let verifyRaf = 0;

  function setText(el: Element | null, text: string) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ---- 幾何。膠囊的位置 p 是沿主軸的 translate（未縮放時的左緣或上緣），s 是沿主軸的縮放、c 是另一軸的縮放 ----
  // 尺寸一律用計算後的小數值（offsetWidth 會取整數）；膠囊的靜止位置也由這裡寫成 px（--ll-pill-x），
  // 不靠 CSS 的 translateX(i * 100%)：WebKit 會用對齊裝置像素後的寬度算百分比，分身會每格偏 0.4 個裝置像素
  let pillW = 0;
  let pillH = 0;
  // Tab 間距（一格 li 的寬度）。2026-10-22 起橫向膠囊比一格寬（tabbar.css 的 --ll-pill-w），位置與拖曳換算一律用間距
  let slotW = 0;
  // 膠囊在 nav 裡的位置（CSS 固定 4px）：量一次存起來，每幀寫 transform 時不必再讀版面
  let offL = 0;
  let offT = 0;
  // 底盤內緣的寬度與抬起時鏡片的放大倍數（tabbar.css 的 --ll-lift），給 capStretch 用
  let innerW = 0;
  let liftX = 1;
  const vertical = () => wideMq.matches;
  function measure() {
    if (!pill) return;
    const cs = getComputedStyle(pill);
    // 膠囊沒有畫出來（沒有目前的 Tab、強制色彩模式）時量不到尺寸：歸零，靜止位置退回 CSS 的百分比
    if (cs.display === 'none') {
      pillW = pillH = slotW = offL = offT = 0;
      return;
    }
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    if (w > 0) pillW = w;
    if (h > 0) pillH = h;
    const li = links[0]?.parentElement;
    const lw = li ? parseFloat(getComputedStyle(li).width) : 0;
    slotW = lw > 0 ? lw : pillW;
    offL = pill.offsetLeft;
    offT = pill.offsetTop;
    if (list) innerW = parseFloat(getComputedStyle(list).width) || 0;
    liftX = parseFloat(getComputedStyle(nav!).getPropertyValue('--ll-lift')) || 1;
  }
  const slot = () => {
    if (!pillW) measure();
    return vertical() ? pillH : slotW;
  };
  const restPos = () => (current >= 0 && pill ? current * slot() : 0);
  const pillT = (p: number, sMain: number, sCross: number) =>
    vertical() ? `translateY(${p}px) scale(${sCross}, ${sMain})` : `translateX(${p}px) scale(${sMain}, ${sCross})`;
  // 分身要抵銷膠囊的位移才會和真的 Tab 重合；膠囊被拉伸時，分身再以膠囊中心反向縮放，字不會被拉扁
  // （鏡片抬起的 1.3 倍不抵銷，那是放大鏡；抬起與放下的史萊姆晃動也不抵銷，分身跟著晃，像透過果凍看）
  function rowT(p: number, sMain = 1, sCross = 1) {
    const v = vertical();
    const qx = pillW / 2 - EDGE;
    const qy = pillH / 2 - EDGE;
    const rx = v ? -(offL + EDGE) : -(offL + p + EDGE);
    const ry = v ? -(offT + p + EDGE) : -(offT + EDGE);
    const sx = 1 / (v ? sCross : sMain);
    const sy = 1 / (v ? sMain : sCross);
    return `translate(${qx}px, ${qy}px) scale(${sx}, ${sy}) translate(${-qx}px, ${-qy}px) translate(${rx}px, ${ry}px)`;
  }
  function placeRow(p: number) {
    if (row && pill) row.style.transform = rowT(p);
  }
  /** 依鏡片畫面上的位置 x 限制拉伸量，拉長的鏡片外緣不超出底盤內緣 LENS_EDGE_SLACK px 以外；收縮（小於 1）不受影響 */
  function capStretch(x: number, sc: number) {
    if (sc <= 1 || vertical() || !pillW || !innerW) return sc;
    const c = offL + x + pillW / 2;
    const room = Math.min(c, innerW - c) + LENS_EDGE_SLACK;
    return Math.max(1, Math.min(sc, (2 * room) / (pillW * (lifted ? liftX * LIFT_PEAK : 1))));
  }
  /** 試作專用的停格（?ll-lens-at）：鏡片停在指定的格位與拉伸量，沒有指定時回傳 false */
  function holdPose() {
    if (!pill || Number.isNaN(heldAt)) return false;
    const x = heldAt * slot();
    const c = crossFor(heldS);
    pill.style.transform = pillT(x, heldS, c);
    if (row && !vertical()) row.style.transform = rowT(x, heldS, c);
    return true;
  }
  function placePill() {
    if (current >= 0 && pillW) nav!.style.setProperty('--ll-pill-x', `${restPos()}px`);
    else nav!.style.removeProperty('--ll-pill-x');
  }
  function sizeRow() {
    measure();
    placePill();
    if (!row || !list) return;
    const ls = getComputedStyle(list);
    nav!.style.setProperty('--ll-row-w', `${parseFloat(ls.width)}px`);
    nav!.style.setProperty('--ll-row-h', `${parseFloat(ls.height)}px`);
    nav!.style.setProperty('--ll-row-pad', ls.paddingLeft);
    // 切換或拖曳進行中：下一幀會用新尺寸重寫分身，這裡不覆寫（否則那一幀分身會停在靜止位置）
    if (dragging) measureGeo();
    else if (!travelRaf && !holdPose()) placeRow(restPos());
  }
  function readPos(): Pos {
    const t = getComputedStyle(pill!).transform;
    const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
    return vertical() ? { pos: m.m42, s: m.m22, c: m.m11 } : { pos: m.m41, s: m.m11, c: m.m22 };
  }
  /** 改目前的 Tab（data-current 與膠囊的靜止位置），呼叫前要先讀好起點 */
  function markCurrent(idx: number) {
    const wasHidden = current < 0;
    current = idx;
    if (idx < 0) {
      nav!.removeAttribute('data-current');
      placePill();
      return;
    }
    nav!.setAttribute('data-current', String(idx));
    if (wasHidden)
      sizeRow(); // 膠囊剛從 display: none 出現
    else placePill();
  }

  // ---- 抬起與放下 ----
  function setLift(on: boolean) {
    const v = !vertical() && (holdLens || (on && !reduceMq.matches && !forcedMq.matches));
    if (v === lifted) return;
    lifted = v;
    clearTimeout(lowerTimer);
    clearTimeout(fadeTimer);
    if (v) {
      nav!.classList.remove('is-fading');
      nav!.classList.add('is-raised', 'is-lifted');
    } else {
      nav!.classList.remove('is-lifted');
      // 鏡片縮到接近原尺寸時（LIFT_MS 的 70%，483ms，水平曲線走到 78%、垂直 67%，縮放約 0.995）先淡出分身的亮底，
      // 縮回之後才降到 Tab 下面：縮回途中分身一直蓋在上面，不會看到兩層字；放開後也不會停在亮白的膠囊太久
      fadeTimer = window.setTimeout(() => nav!.classList.add('is-fading'), LIFT_MS * 0.7);
      lowerTimer = window.setTimeout(() => nav!.classList.remove('is-raised', 'is-fading'), LIFT_MS);
    }
  }
  function dropLater(ms: number) {
    clearTimeout(dropTimer);
    dropTimer = window.setTimeout(() => setLift(false), ms);
  }
  function cancelAnims() {
    if (travelRaf) cancelAnimationFrame(travelRaf);
    travelRaf = 0;
    nav!.classList.remove('is-moving');
  }
  /** 畫面上的位置：超出第一格與最後一格的部分用 tanh 飽和，最多只露出 EDGE_OVERSHOOT 格（物理狀態本身不夾，彈簧照常） */
  function shown(x: number, W: number) {
    const B = EDGE_OVERSHOOT * W;
    const hi = (links.length - 1) * W;
    if (B <= 0) return x;
    if (x > hi) return hi + B * Math.tanh((x - hi) / B);
    if (x < 0) return -B * Math.tanh(-x / B);
    return x;
  }
  /** 停止切換動畫並回到靜止位置（迴圈停掉後不會再有人清 inline transform） */
  function stopTravel() {
    cancelAnims();
    if (pill) pill.style.transform = '';
    placeRow(restPos());
  }
  /**
   * 推進物理狀態 dt 毫秒（每 2ms 一小步，半隱式 Euler）。target 為 null 時位置由手指決定，只推進形狀。
   * 第一次越過目標時 landed 變成 true，形狀的目標改回圓形，水滴因此收縮再回彈
   */
  function simStep(target: number | null, dt: number, W: number) {
    const wp = (2 * Math.PI) / POS_RESPONSE;
    const wd = (2 * Math.PI) / SHAPE_RESPONSE;
    let rem = dt;
    while (rem > 0) {
      const h = Math.min(2, rem);
      rem -= h;
      if (target !== null) {
        sim.v += (-wp * wp * (sim.x - target) - 2 * POS_DAMPING * wp * sim.v) * h;
        sim.x += sim.v * h;
        if (!sim.landed && (sim.x - target) * sim.side >= 0) sim.landed = true;
      }
      const goal = target !== null && sim.landed ? 0 : Math.min(sim.cap - 1, (SHAPE_GAIN * Math.abs(sim.v)) / W);
      sim.dv += (-wd * wd * (sim.d - goal) - 2 * SHAPE_DAMPING * wd * sim.dv) * h;
      sim.d += sim.dv * h;
      if (sim.d > sim.cap - 1 || sim.d < MIN_STRETCH - 1) {
        sim.d = Math.min(sim.cap - 1, Math.max(MIN_STRETCH - 1, sim.d));
        sim.dv = 0;
      }
    }
  }

  /**
   * 切換動畫：兩個阻尼彈簧（見檔案開頭）在一個 rAF 迴圈裡推進，同一幀寫膠囊與分身
   * （兩組 Web Animations 在 WebKit 換頁那幾幀會錯開，看得到放大的字跟著膠囊跑）。
   * 每幀最多推進 34ms、前三幀 10ms：換頁那一幀很慢時，水滴只是停一下，不會一次跳一大段。
   * carry 為 true 時沿用目前的速度與形狀（拖曳放開、連點兩個 Tab），水滴的動作是連續的
   */
  function travel(from: Pos, to: number, keepLift: boolean, carry = false) {
    const wasRunning = travelRaf !== 0;
    const continuing = carry || wasRunning;
    cancelAnims();
    const W = slot();
    const p1 = to * W;
    const fingerDown = pid !== -1;
    const done = () => {
      travelRaf = 0;
      nav!.classList.remove('is-moving');
      sim.x = to * slot();
      sim.v = sim.d = sim.dv = 0;
      pill!.style.transform = '';
      placeRow(restPos());
    };
    if (reduceMq.matches || !W) {
      done();
      if (!fingerDown) setLift(false);
      return;
    }
    sim.x = from.pos;
    if (!continuing) {
      sim.v = 0;
      sim.d = from.s - 1;
      sim.dv = 0;
    }
    // 拖曳放開的滑行用比較大的拉伸上限；新的點按切換用 1.18；接手進行中的動畫則沿用原本的上限
    if (carry) sim.cap = MAX_STRETCH_DRAG;
    else if (!wasRunning) sim.cap = MAX_STRETCH;
    // 從哪一側接近目標；剛好在目標上時看速度往哪邊
    sim.side = p1 - sim.x > 0 ? 1 : p1 - sim.x < 0 ? -1 : sim.v > 0 ? -1 : 1;
    sim.landed = false;
    const d = p1 - sim.x;
    if (Math.abs(d) < 0.5 && Math.abs(sim.v) < 0.001 && Math.abs(sim.d) < 0.002) {
      done();
      if (!fingerDown) dropLater(TAP_HANG_MS);
      return;
    }
    // 過衝之後回到目標附近時放下（鏡片中心對準目標，放大的分身與真的標籤才不會被切開），落地帶著回彈；手指還按著就等放開再說
    const wantDrop = (keepLift || lifted) && !fingerDown;
    if (keepLift || lifted) {
      setLift(true);
      // 放下改由這個迴圈負責：取消點按時設的 300ms 保險計時器
      clearTimeout(dropTimer);
    }
    const write = () => {
      const x = shown(sim.x, slot());
      const sc = capStretch(x, 1 + sim.d);
      const cr = crossFor(sc);
      pill!.style.transform = pillT(x, sc, cr);
      if (row && !vertical()) row.style.transform = rowT(x, sc, cr);
    };
    nav!.classList.add('is-moving');
    write();
    let prev = continuing ? lastFrame : -1;
    let elapsed = 0;
    let calls = 0;
    let dropped = !wantDrop;
    const step = (now: number) => {
      // 前三幀最多 10ms（換頁那一幀較重，起步不跳）；之後每幀最多 34ms
      const dt = prev < 0 ? 0 : Math.min(now - prev, calls < 3 && !continuing ? 10 : FRAME_CAP_MS);
      calls += 1;
      prev = now;
      lastFrame = now;
      elapsed += dt;
      // 尺寸在動畫中改變（旋轉、分割畫面）時跟著新的格寬走
      const Wn = slot();
      const target = to * Wn;
      simStep(target, dt, Wn);
      const returning = sim.landed && sim.v * sim.side <= 0;
      if (!dropped && ((returning && Math.abs(sim.x - target) < 0.04 * Wn) || (sim.landed && elapsed > 700))) {
        dropped = true;
        if (pid === -1) setLift(false);
      }
      const settled = Math.abs(sim.x - target) < 0.05 && Math.abs(sim.v) < 0.0008 && Math.abs(sim.d) < 0.0015 && Math.abs(sim.dv) < 0.0001;
      if (settled || elapsed > SETTLE_MAX_MS) {
        done();
        if (!dropped && pid === -1) setLift(false);
        return;
      }
      write();
      travelRaf = requestAnimationFrame(step);
    };
    travelRaf = requestAnimationFrame(step);
  }

  /** 立刻把指示移到 idx（不等路由）；路由換頁後 update() 看到同一格就不會再動 */
  function select(idx: number, from: Pos | null, carry = false) {
    if (idx === current) return;
    const start = from ?? (pill && current >= 0 ? readPos() : null);
    markCurrent(idx);
    if (!pill || !start) {
      stopTravel();
      return;
    }
    travel(start, idx, from !== null, carry);
  }

  function movePill(to: number) {
    if (to === current) return;
    // 一定要在改 data-current 之前讀目前位置（含進行中的動畫）
    const start = pill && current >= 0 && to >= 0 && !dragging ? readPos() : null;
    markCurrent(to);
    if (to < 0) {
      stopTravel();
      setLift(false);
      return;
    }
    // 手指正在拖：鏡片歸手指管，放開時才決定落在哪一格
    if (dragging) return;
    if (!pill || !start) {
      stopTravel();
      return;
    }
    travel(start, to, false);
  }

  function update(pathname: string) {
    const loc: Locale = localeFromPath(pathname);
    links.forEach((a, i) => {
      const href = localePath(loc, `/${TABS[i]!.path}`);
      if (a.getAttribute('href') !== href) a.setAttribute('href', href);
      setText(a.querySelector('.ll-tabbar__label'), TABS[i]!.label[loc]);
      setText(ghostLabels[i] ?? null, TABS[i]!.label[loc]);
    });
    if (nav!.getAttribute('aria-label') !== NAV_LABEL[loc]) nav!.setAttribute('aria-label', NAV_LABEL[loc]);
    setText(skip, SKIP_LABEL[loc]);
    const next = tabIndexFor(pathname);
    links.forEach((a, i) => {
      if (i === next) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    movePill(next);
  }

  // ---- 導覽 ----
  let inflight: string | null = null;
  let navToken = 0;
  // 確認路由真的換了：沒換（被擋下或失敗）就把指示移回目前頁面的 Tab
  function verifyRoute() {
    cancelAnimationFrame(verifyRaf);
    verifyRaf = requestAnimationFrame(() => {
      if (destroyed) return;
      const actual = tabIndexFor(location.pathname);
      if (actual !== current) movePill(actual);
    });
  }
  function settle(result: void | Promise<void>, token: number) {
    const done = () => {
      if (destroyed || token !== navToken) return;
      inflight = null;
      verifyRoute();
    };
    if (result && typeof (result as Promise<void>).then === 'function') (result as Promise<void>).then(done, done);
    else window.setTimeout(done, 600);
  }
  /** 導覽到 href。目標就是目前網址時不多推一筆紀錄；若有還在載入的導覽，用 replace 取代它（等於取消） */
  function go(href: string) {
    const target = new URL(href, location.href).pathname;
    const token = ++navToken;
    if (samePath(target, location.pathname)) {
      if (inflight) {
        inflight = href;
        settle(navigate(href, { replace: true }), token);
      } else {
        verifyRoute();
      }
      return;
    }
    inflight = href;
    settle(navigate(href), token);
  }

  // 站內導覽：click 時交給 React Router；有修飾鍵或中鍵時保留瀏覽器預設行為
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-tab]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') ?? '/';
    // 點目前這一頁的 Tab：不再多推一筆瀏覽紀錄，改成捲回頂端（原生 Tab bar 的行為）
    if (samePath(a.pathname, location.pathname) && !inflight) {
      window.scrollTo({ top: 0, behavior: reduceMq.matches ? 'auto' : 'smooth' });
      return;
    }
    // 指示立刻開始移動（在點按的這個 task 裡，不等換頁那一幀）
    const idx = links.indexOf(a);
    if (idx >= 0) select(idx, null);
    go(href);
  };
  nav.addEventListener('click', onClick);

  // iOS 的合成 click 比 setTimeout 0 晚到（nekoserve D-080）：吞掉拖曳後 350ms 內的 click，避免導覽兩次。
  // 下一個手勢開始時一定解除，Chromium 拖曳後不會有 click，不能讓它吞掉下一次真正的點按
  let swallowFn: ((ev: Event) => void) | null = null;
  let swallowTimer = 0;
  function disarmSwallow() {
    if (swallowFn) nav!.removeEventListener('click', swallowFn, { capture: true });
    swallowFn = null;
    clearTimeout(swallowTimer);
  }
  function armSwallow() {
    disarmSwallow();
    swallowFn = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      disarmSwallow();
    };
    nav!.addEventListener('click', swallowFn, { capture: true });
    swallowTimer = window.setTimeout(disarmSwallow, SWALLOW_MS);
  }

  // ---- 按住抬起與拖曳選取（nekoserve LiquidIndicator 的手勢，只在手機與平板的橫向 Tab bar） ----
  let pid = -1;
  let startX = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;
  let dragPos = 0;
  let dragPrev = -1;
  // 抓住時鏡片和手指的差距：慢慢收斂到 0，鏡片滑到手指下面，不會瞬間跳過去
  let grabOffset = 0;
  let lensPos = 0;
  let raf = 0;
  let origin = 0;
  let k = 1;
  function measureGeo() {
    // 收合時 nav 有 scale(0.92)：量畫面座標與版面座標的比例
    const r = nav!.getBoundingClientRect();
    k = r.width / nav!.offsetWidth || 1;
    origin = r.left + nav!.clientLeft * k;
  }
  /** 手指的畫面座標換成膠囊的位置（膠囊中心對準手指，膠囊比一格寬，所以減的是膠囊寬度的一半）；呼叫前先 measureGeo() */
  function mapFinger(clientX: number) {
    const W = slot();
    let p = (clientX - origin) / k - offL - pillW / 2;
    const max = (links.length - 1) * W;
    // 兩端像橡皮筋：超出的部分只跟 25%，而且飽和在 EDGE_OVERSHOOT 格內，放開時不會被一下子拉回
    const B = EDGE_OVERSHOOT * W;
    if (p < 0) p = -B * (1 - Math.exp((p * 0.25) / B));
    else if (p > max) p = max + B * (1 - Math.exp((-(p - max) * 0.25) / B));
    return p;
  }
  function dragFrame(now: number) {
    raf = 0;
    if (!dragging || !pill) return;
    // 手指停住時速度慢慢歸零，形狀彈簧就會回到圓形（帶一點回彈）
    if (performance.now() - lastT > 32) velocity *= 0.8;
    const dt = dragPrev < 0 ? 0 : Math.min(now - dragPrev, FRAME_CAP_MS);
    dragPrev = now;
    lastFrame = now;
    // 每幀用這一幀的畫面座標重新換算手指位置：Tab bar 的縮放還在轉場時（捲動收合），手指停住鏡片也不會被帶離手指
    // （2026-10-22 審查：只在 pointermove 換算時最多偏 4.8px）
    measureGeo();
    dragPos = mapFinger(lastX);
    // 鏡片與手指的差距在第一幀量（用這一幀的放大量），第一幀鏡片剛好停在原位，不會跳
    if (Number.isNaN(grabOffset)) grabOffset = lensPos - dragPos;
    grabOffset *= Math.exp(-dt / 70);
    lensPos = dragPos + grabOffset;
    sim.x = lensPos;
    sim.v = velocity / k;
    if (reduceMq.matches) sim.d = sim.dv = 0;
    else {
      sim.landed = false;
      sim.cap = MAX_STRETCH_DRAG;
      simStep(null, dt, slot());
    }
    // 拖曳中若有路由切換的動畫，一律取消：鏡片只跟手指
    if (travelRaf) cancelAnims();
    nav!.classList.add('is-moving');
    const sc = capStretch(lensPos, 1 + sim.d);
    const cr = crossFor(sc);
    pill.style.transform = pillT(lensPos, sc, cr);
    if (row) row.style.transform = rowT(lensPos, sc, cr);
    raf = requestAnimationFrame(dragFrame);
  }
  function resetInline() {
    // 切換動畫進行中：迴圈每幀都會重寫，不必清
    if (travelRaf) return;
    if (pill?.style.transform) {
      pill.style.transform = '';
      placeRow(restPos());
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    // 強制色彩模式不畫膠囊（量不到尺寸），只保留點按
    if (!e.isPrimary || e.button !== 0 || !pill || vertical() || current < 0 || hidden || forcedMq.matches || !slot()) return;
    disarmSwallow();
    resetInline();
    pid = e.pointerId;
    dragging = false;
    velocity = 0;
    startX = lastX = e.clientX;
    lastT = e.timeStamp;
    measureGeo();
    // 放開可能發生在 Tab bar 外面（滑鼠、觸控板）：放開與取消掛在 window 上
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    clearTimeout(dropTimer);
    setLift(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== pid || !pill) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      finish(e, true);
      return;
    }
    if (!dragging) {
      if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return;
      dragging = true;
      // 收合或展開的轉場可能還在跑：開始拖的這一刻重新量一次
      measureGeo();
      try {
        nav!.setPointerCapture(pid);
      } catch {
        /* 有些情況（合成事件、已放開）會丟例外，忽略 */
      }
      // 從進行中的切換直接開始拖：保留水滴目前的形狀與位置（之後慢慢滑到手指下），不會突然變圓或跳過去
      const wasTraveling = travelRaf !== 0;
      const startPos = readPos().pos;
      cancelAnims();
      setLift(true);
      dragPrev = -1;
      if (!wasTraveling) sim.d = sim.dv = 0;
      grabOffset = NaN;
      lensPos = startPos;
      raf = requestAnimationFrame(dragFrame);
    }
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = velocity * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
    lastX = e.clientX;
    lastT = e.timeStamp;
    // 位置與鏡片和手指的差距都在 dragFrame 用那一幀的畫面座標換算
  };
  function finish(e: PointerEvent, cancelled: boolean) {
    if (e.pointerId !== pid) return;
    pid = -1;
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!dragging) {
      resetInline();
      // 點按：點在別的 Tab 上就維持抬起，等 click 的切換動畫接手；300ms 是保險
      const a = (e.target as Element | null)?.closest?.('a[data-tab]') as HTMLAnchorElement | null;
      const idx = a ? links.indexOf(a) : -1;
      dropLater(cancelled || idx < 0 || idx === current ? TAP_HANG_MS : 300);
      return;
    }
    dragging = false;
    try {
      nav!.releasePointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
    nav!.classList.remove('is-moving');
    // 放開時沿用手指的速度與水滴目前的形狀（travel 的 carry），甩出去的動作是連續的
    const W = slot();
    // 還沒畫出第一幀就放開時，鏡片還在原位（lensPos 是開始拖的位置）
    const relPos = lensPos;
    sim.x = relPos;
    sim.v = reduceMq.matches ? 0 : Math.max(-MAX_FLING, Math.min(MAX_FLING, velocity / k));
    const from: Pos = { pos: relPos, s: 1 + sim.d, c: crossFor(1 + sim.d) };
    if (cancelled) {
      travel(from, current, true, true);
      return;
    }
    armSwallow();
    // 依放開時的速度往前推 25ms 再選格：輕甩過半格會選到甩去的那一格，但不會越過手指下面那格再多跳一格；
    // 背離選中格的速度削弱，不會先飛到隔壁再回來
    const projected = relPos + sim.v * 25;
    const idx = Math.max(0, Math.min(links.length - 1, Math.round(projected / W)));
    if (sim.v * (idx * W - relPos) < 0) sim.v *= 0.25;
    // 朝選中格的速度依剩下的距離設上限：保留慣性讓水滴滑過目標約 0.25 格（骨溜感），但不會整顆衝到隔壁 Tab 上
    else sim.v = Math.sign(sim.v) * Math.min(Math.abs(sim.v), 0.6 + (6 * Math.abs(idx * W - relPos)) / POS_RESPONSE);
    if (idx === current) {
      travel(from, current, true, true);
      return;
    }
    // 已知限制（M0a 實測）：拖曳不算「使用者在這一頁有互動」，若使用者到這一頁後第一個動作就是拖曳，
    // Safari 的返回鍵會跳過這一頁。點按不受影響；程式無法讓拖曳算成互動
    select(idx, from, true);
    go(links[idx]!.getAttribute('href') ?? '/');
  }
  const onPointerUp = (e: PointerEvent) => finish(e, false);
  const onPointerCancel = (e: PointerEvent) => finish(e, true);
  // 連結與 SVG 會啟動瀏覽器原生拖曳並取消 pointer：一律擋掉
  const onDragStart = (e: Event) => e.preventDefault();
  const onContextMenu = (e: Event) => {
    if (dragging) e.preventDefault();
  };
  nav.addEventListener('pointerdown', onPointerDown);
  nav.addEventListener('pointermove', onPointerMove);
  nav.addEventListener('dragstart', onDragStart, { capture: true });
  nav.addEventListener('contextmenu', onContextMenu);

  // 分身的尺寸跟著 nav 走（旋轉、分割畫面、字級）
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => sizeRow()) : null;
  ro?.observe(nav);
  sizeRow();
  const onWide = () => {
    cancelAnims();
    if (pill) pill.style.transform = '';
    setLift(false);
    sizeRow();
  };
  wideMq.addEventListener('change', onWide);
  forcedMq.addEventListener('change', onWide);
  if (holdLens) setLift(true);

  // 捲動收合（07 第 6.3 節）：門檻暫定累計 48px 且已捲離頂部 120px，往上 24px 或到頂、到底時展開；有遲滯
  let lastY = window.scrollY;
  let down = 0;
  let up = 0;
  let ticking = 0;
  function setCollapsed(v: boolean) {
    if (collapsed === v) return;
    collapsed = v;
    nav!.classList.toggle('is-collapsed', v);
  }
  function onScrollFrame() {
    ticking = 0;
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    if (reduceMq.matches || wideMq.matches) {
      setCollapsed(false);
      return;
    }
    const atTop = y <= 0;
    const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 2;
    if (atTop || atBottom) {
      down = 0;
      up = 0;
      setCollapsed(false);
      return;
    }
    if (dy > 0) {
      down += dy;
      up = 0;
      if (down >= 48 && y > 120) setCollapsed(true);
    } else if (dy < 0) {
      up -= dy;
      down = 0;
      if (up >= 24) setCollapsed(false);
    }
  }
  const onScroll = () => {
    if (!ticking) ticking = requestAnimationFrame(onScrollFrame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // 鍵盤開啟時隱藏（07 第 6.3 節、06 第 7 節）：文字輸入聚焦或 visualViewport 明顯縮小
  let focusText = false;
  let vvShrunk = false;
  let focusTimer = 0;
  function applyHidden() {
    const v = focusText || vvShrunk;
    if (v === hidden) return;
    hidden = v;
    if (v) {
      setLift(false);
      nav!.classList.add('is-hidden');
      if (reduceMq.matches) nav!.classList.add('is-hidden-done');
    } else {
      nav!.classList.remove('is-hidden-done');
      nav!.classList.remove('is-hidden');
    }
  }
  const onTransitionEnd = (e: TransitionEvent) => {
    if (e.target === nav && e.propertyName === 'transform' && hidden) nav!.classList.add('is-hidden-done');
  };
  nav.addEventListener('transitionend', onTransitionEnd);
  const onFocusIn = (e: FocusEvent) => {
    focusText = !!(e.target as Element | null)?.matches?.(TEXT_INPUT);
    applyHidden();
  };
  const onFocusOut = () => {
    clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      focusText = !!document.activeElement?.matches?.(TEXT_INPUT);
      applyHidden();
    }, 0);
  };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  const vv = window.visualViewport;
  const onVv = () => {
    if (!vv) return;
    // 雙指放大時 visualViewport 也會變矮：乘回縮放倍率，只有鍵盤真的佔掉畫面時才隱藏（放大的人仍然找得到 Tab bar）
    vvShrunk = vv.height * vv.scale < window.innerHeight * 0.75;
    applyHidden();
  };
  vv?.addEventListener('resize', onVv);

  return {
    update,
    state: () => ({ current, collapsed, hidden, vertical: wideMq.matches, lifted }),
    destroy() {
      destroyed = true;
      nav.removeEventListener('click', onClick);
      nav.removeEventListener('transitionend', onTransitionEnd);
      nav.removeEventListener('pointerdown', onPointerDown);
      nav.removeEventListener('pointermove', onPointerMove);
      nav.removeEventListener('dragstart', onDragStart, { capture: true });
      nav.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      wideMq.removeEventListener('change', onWide);
      forcedMq.removeEventListener('change', onWide);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', onVv);
      ro?.disconnect();
      disarmSwallow();
      for (const t of [dropTimer, lowerTimer, fadeTimer, focusTimer]) clearTimeout(t);
      for (const f of [raf, ticking, verifyRaf]) if (f) cancelAnimationFrame(f);
      cancelAnims();
      // 重新掛上時（開發模式的 StrictMode、HMR）從乾淨的狀態開始
      nav.classList.remove('is-lifted', 'is-raised', 'is-fading', 'is-moving', 'is-collapsed', 'is-hidden', 'is-hidden-done', 'is-align');
      if (pill) pill.style.transform = '';
      if (row) row.style.transform = '';
      for (const p of ['--ll-row-w', '--ll-row-h', '--ll-row-pad', '--ll-pill-x']) nav.style.removeProperty(p);
    },
  };
}
