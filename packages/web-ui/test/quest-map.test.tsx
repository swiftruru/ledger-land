// 闖關地圖元件（17 第 3、7 節）：節點的可讀名稱與 aria-current、關卡表單的焦點管理、代號輸入的錯誤連結、關卡列的狀態文字、角色純裝飾
// M3：章節徽章三種外觀、章末區的完成與精通、角色的姿勢與表情、數字滾動（減少動態時直接換）、延伸標籤
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useRef, useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LevelCodePlaceholder, loadWebUiMessages } from '../src/index.ts';
import {
  ChapterBadge,
  ChapterBanner,
  ChapterEnd,
  LevelCard,
  LevelCode,
  LevelCodeInput,
  LevelNode,
  LevelSheet,
  MapHud,
  MapMarker,
  NoteTag,
  RollingNumber,
  formatLevelCode,
  starPath,
  type LevelCodeStatus,
} from '../src/map.ts';

beforeAll(async () => {
  i18n.load('zh-TW', await loadWebUiMessages('zh-TW'));
  i18n.activate('zh-TW');
});

const wrap = (ui: React.ReactNode) => <I18nProvider i18n={i18n}>{ui}</I18nProvider>;

describe('LevelNode', () => {
  it('可讀名稱含章、關、名稱、星星與狀態；目前關卡 aria-current="step"；延伸章有形狀 class', async () => {
    const screen = await render(
      wrap(
        <ol>
          <LevelNode levelId="lv_a" chapterNo={3} levelNo={2} title="收入與營業成本" stars={2} status="done" onSelect={() => {}} />
          <LevelNode levelId="lv_b" chapterNo={3} levelNo={3} title="毛利" stars={0} status="current" onSelect={() => {}} />
          <LevelNode levelId="lv_c" chapterNo={1} levelNo={1} stars={0} status="todo" extension onSelect={() => {}} />
        </ol>,
      ),
    );
    const buttons = screen.getByRole('button').all();
    expect(buttons).toHaveLength(3);
    await expect.element(buttons[0]!).toHaveAttribute('aria-label', '第 3 章第 2 關 收入與營業成本，3 顆星中的 2 顆');
    await expect.element(buttons[1]!).toHaveAttribute('aria-label', '第 3 章第 3 關 毛利，建議下一關');
    await expect.element(buttons[1]!).toHaveAttribute('aria-current', 'step');
    await expect.element(buttons[2]!).toHaveAttribute('aria-label', '延伸第 1 章第 1 關，尚未挑戰');
    expect(document.querySelector('.ll-node--ext')).not.toBeNull();
    const disc = document.querySelector<HTMLElement>('.ll-node__disc')!;
    expect(disc.getBoundingClientRect().width).toBe(56);
    const box = buttons[0]!.element().getBoundingClientRect();
    expect([box.width, box.height]).toEqual([64, 64]);
    // 延伸章的編號是 E1-1（圖規 4.1）；主線是 3-2
    expect([...document.querySelectorAll('.ll-node__no')].map((e) => e.textContent)).toEqual(['3-2', '3-3', 'E1-1']);
    // 星星籤（圖規 4.2）：60 × 22，在圓心下方 36 到 58；是按鈕的子元素
    const tag = document.querySelector<HTMLElement>('.ll-node__stars')!;
    const t = tag.getBoundingClientRect();
    expect([t.width, t.height]).toEqual([60, 22]);
    const centre = box.top + 32;
    expect(t.top - centre).toBe(36);
    expect(tag.closest('button')).toBe(buttons[0]!.element());
    expect(tag.getAttribute('aria-hidden')).toBe('true');
  });

  it('按下的語言和按鈕相同（站規 0.4 的 A1）：圓盤有 4px 底邊；已完成與目前關卡用主按鈕的底邊色', async () => {
    await render(
      wrap(
        <ol>
          <LevelNode levelId="lv_a" chapterNo={1} levelNo={1} stars={3} status="done" onSelect={() => {}} />
          <LevelNode levelId="lv_b" chapterNo={1} levelNo={2} stars={0} status="todo" onSelect={() => {}} />
        </ol>,
      ),
    );
    const discs = [...document.querySelectorAll<HTMLElement>('.ll-node__disc')];
    expect(discs.map((d) => getComputedStyle(d).getPropertyValue('--_d').trim())).toEqual(['4px', '4px']);
    const root = getComputedStyle(document.documentElement);
    expect(getComputedStyle(discs[0]!).getPropertyValue('--_ledge').trim()).toBe(root.getPropertyValue('--ll-btn-primary-ledge').trim());
    expect(getComputedStyle(discs[1]!).getPropertyValue('--_ledge').trim()).toBe(root.getPropertyValue('--ll-btn-secondary-ledge').trim());
    expect(getComputedStyle(discs[0]!.querySelector('.ll-node__shape')!).boxShadow).toContain('4px');
  });

  it('按下節點回傳關卡 ID 與按鈕元素', async () => {
    let got: [string, HTMLButtonElement] | null = null;
    const screen = await render(wrap(<LevelNode levelId="lv_a" chapterNo={1} levelNo={1} stars={0} status="todo" onSelect={(id, el) => (got = [id, el])} />));
    await screen.getByRole('button').click();
    expect(got![0]).toBe('lv_a');
    expect(got![1].tagName).toBe('BUTTON');
  });
});

describe('LevelSheet', () => {
  function Demo() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    return wrap(
      <>
        <button ref={ref} type="button" onClick={() => setOpen(true)}>
          開啟
        </button>
        <LevelSheet
          open={open}
          onClose={() => setOpen(false)}
          returnFocusTo={ref}
          level={{
            levelId: 'lv_k7m2q9xd',
            title: '毛利',
            subtitle: '第 3 章 損益表',
            objectives: ['能算出毛利', '能說明毛利率'],
            startHref: '/level/lv_k7m2q9xd/',
            chapterHref: '/chapter/ch_c5f8w2/',
            suggestedPrevTitle: '收入與營業成本',
          }}
        />
      </>,
    );
  }
  it('是對話框：開啟後焦點在裡面、顯示代號與建議、關閉後焦點回到開啟它的按鈕', async () => {
    const screen = await render(<Demo />);
    await screen.getByRole('button', { name: '開啟' }).click();
    const dialog = document.querySelector<HTMLDialogElement>('dialog.ll-sheet--level')!;
    expect(dialog.open).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expect.element(page.getByRole('heading', { level: 2 })).toHaveTextContent('毛利');
    expect(dialog.textContent).toContain('建議先完成「收入與營業成本」');
    expect(dialog.textContent).toContain('還沒挑戰過');
    expect(dialog.querySelector('code')!.textContent).toBe('k7m2 q9xd');
    await expect.element(page.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_k7m2q9xd/');
    // 站規 1.10：只有一顆主按鈕、在最下方；沒有「關閉」按鈕（右上的 X 就是）；代號收在「給老師：關卡代號」
    const foot = dialog.querySelector('.ll-sheet__foot')!;
    expect(foot.lastElementChild!.textContent).toBe('開始');
    expect(dialog.querySelectorAll('.ll-btn--primary')).toHaveLength(1);
    expect(page.getByRole('button', { name: '關閉' }).all()).toHaveLength(1);
    expect([...dialog.querySelectorAll('button, a')].some((b) => b.textContent === '關閉')).toBe(false);
    expect(dialog.querySelector('summary')!.textContent).toContain('給老師：關卡代號');
    // 「章節資訊」是有圖示方塊與箭頭的列（NavRow），不是置中的文字按鈕（第 2 輪看圖驗收）
    await expect.element(page.getByRole('link', { name: '章節資訊' })).toHaveClass(/ll-navrow/);
    await userEvent.keyboard('{Escape}');
    expect(dialog.open).toBe(false);
    expect(document.activeElement?.textContent).toBe('開啟');
  });
});

describe('LevelCodeInput 與 LevelCode', () => {
  it('錯誤以 aria-describedby 連到輸入框；已下架附章節連結；字級至少 16px', async () => {
    const navigated: string[] = [];
    await render(
      wrap(<LevelCodeInput status={{ kind: 'retired', chapterHref: '/chapter/ch_x/' }} onSubmit={() => {}} onNavigate={(h) => navigated.push(h)} />),
    );
    const input = page.getByRole('textbox');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    const el = input.element() as HTMLInputElement;
    expect(document.getElementById(el.getAttribute('aria-describedby')!)!.textContent).toContain('已經下架');
    expect(parseFloat(getComputedStyle(el).fontSize)).toBeGreaterThanOrEqual(16);
    await page.getByRole('link', { name: '前往所屬章節' }).click();
    expect(navigated).toEqual(['/chapter/ch_x/']);
  });
  it('已下架（站規 2.2.5，第 4 輪看圖驗收）：錯誤句下一行是 secondary sm「前往所屬章節」，送出鈕維持 primary、可以按（不用停用的虛線框）', async () => {
    function Retired() {
      const [status, setStatus] = useState<LevelCodeStatus>({ kind: 'idle' });
      return wrap(<LevelCodeInput status={status} onSubmit={() => setStatus({ kind: 'retired', chapterHref: '/chapter/ch_x/' })} onNavigate={() => {}} />);
    }
    await render(<Retired />);
    await page.getByRole('textbox').fill('fx0r0001');
    await page.getByRole('button', { name: '前往', exact: true }).click();
    const chapter = page.getByRole('link', { name: '前往所屬章節' });
    await expect.element(chapter).toHaveClass(/ll-btn--secondary/);
    await expect.element(chapter).toHaveClass(/ll-btn--sm/);
    await expect.element(page.getByRole('button', { name: '前往', exact: true })).toBeEnabled();
    await expect.element(page.getByRole('button', { name: '前往', exact: true })).toHaveClass(/ll-btn--primary/);
  });
  it('送出時把原始輸入交給父層', async () => {
    const got: string[] = [];
    await render(wrap(<LevelCodeInput status={{ kind: 'idle' }} onSubmit={(raw) => got.push(raw)} />));
    await page.getByRole('textbox').fill('K7M2 Q9XD');
    await page.getByRole('button', { name: '前往' }).click();
    expect(got).toEqual(['K7M2 Q9XD']);
    expect(formatLevelCode('k7m2q9xd')).toBe('k7m2 q9xd');
  });
});

describe('LevelCodePlaceholder（LevelCode 從地圖 chunk 載入前的佔位）', () => {
  it('和 LevelCode 同樣的標題、代號、可讀名稱與大小；「複製」的位置是同尺寸的骨架膠囊，不是按鈕、不在無障礙樹', async () => {
    // 兩者都只在有 Clipboard API 時畫「複製」按鈕；測試環境沒有時補一個，按鈕的佔位一定量得到
    if (!navigator.clipboard) Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
    const screen = await render(
      wrap(
        <div style={{ inlineSize: '320px' }}>
          <div data-testid="ph">
            <LevelCodePlaceholder levelId="lv_k7m2q9xd" />
          </div>
          <div data-testid="real">
            <LevelCode levelId="lv_k7m2q9xd" />
          </div>
        </div>,
      ),
    );
    const ph = screen.getByTestId('ph').element().querySelector('.ll-levelcode')!;
    const real = screen.getByTestId('real').element().querySelector('.ll-levelcode')!;
    expect(ph.querySelector('.ll-levelcode__label')!.textContent).toBe('關卡代號');
    expect(ph.querySelector('.ll-levelcode__code')!.textContent).toBe('k7m2 q9xd');
    expect(ph.querySelector('.ll-levelcode__code')!.getAttribute('aria-label')).toBe(real.querySelector('.ll-levelcode__code')!.getAttribute('aria-label'));
    const a = ph.getBoundingClientRect();
    const b = real.getBoundingClientRect();
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(0.5);
    const codeA = ph.querySelector('.ll-levelcode__code')!.getBoundingClientRect();
    const codeB = real.querySelector('.ll-levelcode__code')!.getBoundingClientRect();
    expect(Math.abs(codeA.left - a.left - (codeB.left - b.left))).toBeLessThanOrEqual(0.5);
    const pending = ph.querySelector('.ll-levelcode__slot')!;
    expect(pending.getAttribute('aria-hidden')).toBe('true');
    const copy = real.querySelector('.ll-levelcode__copy')!.getBoundingClientRect();
    const slot = pending.getBoundingClientRect();
    expect(Math.abs(slot.height - copy.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(slot.width - copy.width)).toBeLessThanOrEqual(0.5);
    // 佔位裡沒有任何按鈕；載入後的「複製」是 Button quiet sm
    expect(ph.querySelectorAll('button')).toHaveLength(0);
    expect(real.querySelector('.ll-levelcode__copy')!.classList.contains('ll-btn--quiet')).toBe(true);
  });
});

describe('LevelCard、ChapterBanner、MapHud、MapMarker', () => {
  it('關卡列有狀態文字與按鈕；已下架沒有按鈕', async () => {
    await render(
      wrap(
        <ol>
          <LevelCard levelId="lv_a" chapterNo={1} levelNo={1} title="認識資產" stars={3} status="done" href="/level/lv_a/" />
          <LevelCard levelId="lv_b" chapterNo={1} levelNo={2} title="認識負債" stars={0} status="current" href="/level/lv_b/" onInfo={() => {}} />
          <LevelCard levelId="lv_c" chapterNo={1} levelNo={3} stars={2} status="done" retired />
        </ol>,
      ),
    );
    await expect.element(page.getByRole('link', { name: '再挑戰' })).toHaveAttribute('href', '/level/lv_a/');
    await expect.element(page.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_b/');
    // 站規 1.20：只有建議的下一關是主按鈕；「介紹」是 IconButton，可讀名稱帶編號與關卡名
    expect(page.getByRole('button', { name: '介紹：1-2 認識負債' }).all()).toHaveLength(1);
    expect(page.getByRole('link', { name: '開始' }).element().classList.contains('ll-btn--primary')).toBe(true);
    expect(page.getByRole('link', { name: '再挑戰' }).element().classList.contains('ll-btn--secondary')).toBe(true);
    const retired = document.querySelector('.ll-levelcard--retired')!;
    expect(retired.textContent).toContain('已下架');
    expect(retired.querySelector('a, button')).toBeNull();
    expect(document.querySelector('.ll-levelcard.is-current')!.textContent).toContain('建議下一關');
  });

  it('actionVariant="secondary"：建議的下一關保留標籤與外框，但動作鈕是 secondary（章節頁主卡已有一顆 primary）', async () => {
    await render(
      wrap(
        <ol>
          <LevelCard levelId="lv_b" chapterNo={1} levelNo={2} title="認識負債" stars={0} status="current" href="/level/lv_b/" actionVariant="secondary" />
        </ol>,
      ),
    );
    const go = page.getByRole('link', { name: '開始' }).element();
    expect(go.classList.contains('ll-btn--secondary')).toBe(true);
    expect(document.querySelectorAll('.ll-btn--primary')).toHaveLength(0);
    expect(document.querySelector('.ll-levelcard.is-current')!.textContent).toContain('建議下一關');
  });

  it('suggestedBadge={false}：目前關卡保留外框與播放圖示，但不畫「建議下一關」膠囊（章節頁本章的下一關不是全站的目前關卡時）', async () => {
    await render(
      wrap(
        <ol>
          <LevelCard
            levelId="lv_b"
            chapterNo={1}
            levelNo={2}
            title="認識負債"
            stars={0}
            status="current"
            href="/level/lv_b/"
            actionVariant="secondary"
            suggestedBadge={false}
          />
        </ol>,
      ),
    );
    const card = document.querySelector('.ll-levelcard.is-current')!;
    expect(card).not.toBeNull();
    expect(card.textContent).not.toContain('建議下一關');
    expect(card.querySelector('.ll-badge--accent')).toBeNull();
    expect(page.getByRole('link', { name: '開始' }).element().querySelector('svg')).not.toBeNull();
  });

  it('章節牌是 h2 加連結、不含徽章（圖規 4.4）；延伸章不放標籤；頂部統計：星星是靜態、徽章與錯題本是連結；角色 aria-hidden', async () => {
    await render(
      wrap(
        <>
          <ChapterBanner chapterId="ch_a" chapterNo={2} title="三張報表" done={1} total={5} href="/chapter/ch_a/" headingId="h-a" extension />
          <MapHud title="闖關" stars={27} badges={2} due={3} badgesHref="/me/badges/" reviewHref="/review/" />
          <MapMarker />
        </>,
      ),
    );
    await expect.element(page.getByRole('heading', { level: 2 })).toHaveTextContent('三張報表');
    expect(document.getElementById('h-a')).not.toBeNull();
    const banner = document.querySelector('.ll-chbanner')!;
    expect(banner.querySelector('.ll-chbadge')).toBeNull();
    expect(banner.querySelector('.ll-notetag')).toBeNull();
    expect(banner.textContent).toContain('延伸第 2 章');
    expect(banner.textContent).not.toContain('不列入期中考');
    const link = page.getByRole('link', { name: '三張報表' });
    await expect.element(link).toHaveAttribute('href', '/chapter/ch_a/');
    expect(link.element().classList.contains('ll-chbanner__link')).toBe(true);
    expect(getComputedStyle(link.element()).textDecorationLine).toBe('none');
    expect(link.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect.element(page.getByRole('link', { name: '錯題本待複習 3 題，到錯題本' })).toHaveAttribute('href', '/review/');
    await expect.element(page.getByRole('link', { name: '徽章 2 個，看我的徽章' })).toHaveAttribute('href', '/me/badges/');
    expect(document.querySelector('[data-testid="hud-stars"]')!.tagName).toBe('SPAN');
    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('闖關');
    expect(document.querySelector('.ll-marker')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('頂部統計列的工具：compact 只放第一個工具加「更多」選單；medium 以上全部排開、有文字提示', async () => {
    const calls: string[] = [];
    const tools = [
      { id: 'locate', icon: null, label: '跳到目前關卡', onClick: () => calls.push('locate') },
      { id: 'code', icon: null, label: '輸入關卡代號', onClick: () => calls.push('code'), opensOverlay: true },
      { id: 'list', icon: null, label: '清單檢視', pressed: false, menuLabel: '清單檢視', onClick: () => calls.push('list') },
    ];
    const screen = await render(
      wrap(
        <>
          <div data-testid="compact">
            <MapHud title="闖關" stars={1} badges={0} due={0} badgesHref="/me/badges/" reviewHref="/review/" compact tools={tools} />
          </div>
          <div data-testid="wide">
            <MapHud title="闖關" stars={1} badges={0} due={0} badgesHref="/me/badges/" reviewHref="/review/" tools={tools} />
          </div>
        </>,
      ),
    );
    const compact = screen.getByTestId('compact').element();
    expect(compact.querySelectorAll('.ll-hud__tools > .ll-hud__tool')).toHaveLength(1);
    expect(compact.querySelector('[aria-haspopup="menu"]')).not.toBeNull();
    const wide = screen.getByTestId('wide').element();
    expect(wide.querySelectorAll('.ll-hud__tool--tip')).toHaveLength(3);
    expect(wide.querySelector('[aria-haspopup="menu"]')).toBeNull();
    expect([...wide.querySelectorAll<HTMLElement>('.ll-hud__tool--tip')].map((e) => e.dataset['tip'])).toEqual(['跳到目前關卡', '輸入關卡代號', '清單檢視']);
    expect(wide.querySelector('[aria-pressed="false"]')).not.toBeNull();
    // 全部 44px，沒有立體底邊（站規 0.4 的 A2）
    for (const b of wide.querySelectorAll<HTMLElement>('.ll-iconbtn, .ll-statchip')) expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});

describe('章節徽章、章末區、角色、數字滾動（M3）', () => {
  afterEach(() => {
    delete document.documentElement.dataset['motion'];
  });

  it('章節徽章三種外觀；只有主線期中考範圍的章節牌有「期中考範圍」標籤', async () => {
    await render(
      wrap(
        <>
          <ChapterBadge state="done" />
          <ChapterBadge state="mastery" />
          <ChapterBadge state="locked" />
          <ChapterBanner chapterId="ch_b" chapterNo={2} title="乙" done={4} total={4} href="/chapter/ch_b/" headingId="h-2" inExam />
          <ChapterBanner chapterId="ch_c" chapterNo={3} title="丙" done={0} total={4} href="/chapter/ch_c/" headingId="h-3" />
        </>,
      ),
    );
    expect(document.querySelectorAll('.ll-chbadge--done')).toHaveLength(1);
    expect(document.querySelectorAll('.ll-chbadge--mastery')).toHaveLength(1);
    expect(document.querySelectorAll('.ll-chbadge--locked')).toHaveLength(1);
    // 精通有三顆星與月桂，完成一顆星，未取得只有外框（星星沒有填色）
    expect(document.querySelectorAll('.ll-chbadge--mastery .ll-chbadge__star')).toHaveLength(3);
    expect(document.querySelectorAll('.ll-chbadge--mastery .ll-chbadge__laurel')).toHaveLength(2);
    expect(document.querySelectorAll('.ll-chbadge--done .ll-chbadge__star')).toHaveLength(1);
    const lockedStar = document.querySelector<SVGPathElement>('.ll-chbadge--locked .ll-chbadge__star')!;
    expect(getComputedStyle(lockedStar).fill).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(document.querySelectorAll('.ll-notetag--midterm')).toHaveLength(1);
    expect(document.querySelector('.ll-notetag--midterm')!.textContent).toBe('期中考範圍');
    expect(document.querySelector('#h-2')!.closest('.ll-chbanner')!.querySelector('.ll-notetag--midterm')).not.toBeNull();
    expect(document.querySelectorAll('.ll-chbanner .ll-chbadge')).toHaveLength(0);
    expect(starPath(0, 0, 10)).toMatch(/^M0\.00 -10\.00L/);
    expect(document.querySelector('.ll-chbadge')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('章末區：未完成是路標文字；完成顯示「第 N 章完成」與徽章；精通另有文字', async () => {
    await render(
      wrap(
        <>
          <ChapterEnd chapterNo={1} completed={false} badgeTitle="開店了" />
          <ChapterEnd chapterNo={2} completed badgeTitle="看懂地圖" badgeState="done" celebrating />
          <ChapterEnd chapterNo={3} completed badgeTitle="記帳員" badgeState="mastery" extension />
        </>,
      ),
    );
    const ends = document.querySelectorAll<HTMLElement>('[data-testid="chapter-end"]');
    expect(ends[0]!.textContent).toContain('第 1 章終點');
    expect(ends[0]!.textContent).toContain('可獲得徽章「開店了」');
    expect(ends[0]!.dataset['badgeState']).toBe('locked');
    expect(ends[1]!.textContent).toContain('第 2 章完成');
    expect(ends[1]!.textContent).toContain('徽章：看懂地圖');
    expect(ends[1]!.classList.contains('is-celebrating')).toBe(true);
    expect(ends[1]!.querySelector('.ll-chbadge--done')).not.toBeNull();
    expect(ends[2]!.textContent).toContain('延伸第 3 章完成');
    expect(ends[2]!.textContent).toContain('精通徽章：記帳員');
    expect(ends[2]!.querySelector('.ll-chbadge--mastery')).not.toBeNull();
    // 拱門（圖規 4.5）：未完成沒有彩帶；完成有強調色彩帶與柱頂兩面朝外的三角旗（各有旗桿）；精通的拱心石上嵌一顆星；紙籤裡有 40px 徽章
    expect(ends[0]!.querySelector('.ll-chend__ribbon')).toBeNull();
    expect(ends[1]!.querySelector('.ll-chend__ribbon:not(.is-mastery)')).not.toBeNull();
    expect(ends[1]!.querySelectorAll('.ll-chend__pennants .ll-chend__pennant')).toHaveLength(2);
    expect(ends[1]!.querySelector('.ll-chend__pennants .ll-chend__pole')).not.toBeNull();
    expect(ends[2]!.querySelector('.ll-chend__keystar')).not.toBeNull();
    expect(ends[2]!.querySelector('.ll-chend__keymark .ll-chend__key')).not.toBeNull();
    // 徽章名稱整組一起換行（第 1 輪看圖驗收）
    expect(ends[0]!.querySelector('.ll-chend__name')!.textContent).toBe('「開店了」');
    expect(ends[1]!.querySelector('.ll-chend__plaque .ll-chbadge')!.getAttribute('width')).toBe('40');
  });

  it('章末徽章文字只看徽章狀態（finding map-4）：已取得徽章、但內容新增了一關而 completed 是 false 時，不寫「可獲得徽章」；最後一章有終點旗', async () => {
    await render(wrap(<ChapterEnd chapterNo={4} completed={false} badgeTitle="記帳員" badgeState="done" last />));
    const end = document.querySelector<HTMLElement>('[data-testid="chapter-end"]')!;
    expect(end.dataset['badgeState']).toBe('done');
    expect(end.textContent).not.toContain('可獲得徽章');
    expect(end.textContent).toContain('徽章：記帳員');
    expect(end.textContent).toContain('第 4 章終點');
    expect(end.querySelector('.ll-chend__flag')).not.toBeNull();
  });

  it('不計分關卡：節點、關卡列與表單顯示已讀完或尚未讀，不顯示星等；章末只有給了連結才有實驗室小卡', async () => {
    const hrefs: string[] = [];
    await render(
      wrap(
        <>
          <ol>
            <LevelNode levelId="lv_u1" chapterNo={3} levelNo={1} title="四種觀點" stars={0} status="todo" extension unscored onSelect={() => {}} />
            <LevelNode levelId="lv_u2" chapterNo={3} levelNo={2} title="誰在看報表" stars={0} status="done" extension unscored onSelect={() => {}} />
            {/* 全部完成時目前關卡是最後一次挑戰的關卡：status 是 current，但已讀完 */}
            <LevelNode levelId="lv_u3" chapterNo={3} levelNo={3} title="最後一關" stars={0} status="current" extension unscored read onSelect={() => {}} />
          </ol>
          <ol>
            <LevelCard levelId="lv_u1" chapterNo={3} levelNo={1} title="四種觀點" stars={0} status="todo" unscored href="/level/lv_u1/" />
            <LevelCard levelId="lv_u2" chapterNo={3} levelNo={2} title="誰在看報表" stars={0} status="done" unscored href="/level/lv_u2/" />
            <LevelCard levelId="lv_u3" chapterNo={3} levelNo={3} title="最後一關" stars={0} status="current" unscored read href="/level/lv_u3/" />
          </ol>
          <ChapterEnd chapterNo={3} completed={false} badgeTitle="旁觀者" labLinks={[{ href: '/lab/story/story_a/st_1/' }]} />
          <ChapterEnd chapterNo={4} completed={false} badgeTitle="沒有連結" labLinks={[]} />
        </>,
      ),
    );
    const nodes = page.getByRole('button').all();
    await expect.element(nodes[0]!).toHaveAttribute('aria-label', '延伸第 3 章第 1 關 四種觀點，尚未讀');
    await expect.element(nodes[1]!).toHaveAttribute('aria-label', '延伸第 3 章第 2 關 誰在看報表，已讀完');
    await expect.element(nodes[2]!).toHaveAttribute('aria-label', '延伸第 3 章第 3 關 最後一關，已讀完，建議下一關');
    expect(document.querySelectorAll('.ll-node .ll-stars')).toHaveLength(0);
    expect([...document.querySelectorAll('.ll-node__read')].map((e) => e.textContent)).toEqual(['尚未讀', '已讀完', '已讀完']);
    expect([...document.querySelectorAll('.ll-levelcard__read')].map((e) => e.textContent)).toEqual(['尚未讀', '已讀完', '已讀完']);
    expect(document.querySelectorAll('.ll-levelcard .ll-stars')).toHaveLength(0);
    await expect.element(page.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_u1/');
    await expect.element(page.getByRole('link', { name: '再讀一次' }).first()).toHaveAttribute('href', '/level/lv_u2/');
    await expect.element(page.getByRole('link', { name: '再讀一次' }).nth(1)).toHaveAttribute('href', '/level/lv_u3/');
    expect(document.querySelectorAll('[data-testid="chapter-end-lab"]')).toHaveLength(1);
    // 實驗室連結是紙籤裡的 Button quiet sm（站規 0.4 第 5 列）
    const lab = page.getByRole('link', { name: '到實驗室看這一章的故事步驟' });
    await expect.element(lab).toHaveAttribute('href', '/lab/story/story_a/st_1/');
    expect(lab.element().classList.contains('ll-btn--quiet')).toBe(true);
    expect(hrefs).toEqual([]);
  });

  it('角色：三種姿勢與兩種表情用 props 切換，笑眼時有星光，一律 aria-hidden', async () => {
    const screen = await render(
      wrap(
        <>
          <MapMarker pose="cheek" />
          <MapMarker pose="clasp" expression="joy" />
          <MapMarker pose="wave" expression="joy" />
        </>,
      ),
    );
    const markers = screen.container.querySelectorAll<SVGSVGElement>('.ll-marker');
    expect(markers).toHaveLength(3);
    expect([...markers].map((m) => m.dataset['pose'])).toEqual(['cheek', 'clasp', 'wave']);
    expect([...markers].map((m) => m.dataset['expression'])).toEqual(['smile', 'joy', 'joy']);
    expect(markers[0]!.querySelectorAll('.ll-marker__spark')).toHaveLength(0);
    expect(markers[1]!.querySelectorAll('.ll-marker__spark')).toHaveLength(3);
    expect([...markers].every((m) => m.getAttribute('aria-hidden') === 'true')).toBe(true);
    // 星光在減少動態時沒有動畫
    document.documentElement.dataset['motion'] = 'reduced';
    const spark = markers[1]!.querySelector<SVGPathElement>('.ll-marker__spark')!;
    expect(getComputedStyle(spark).animationName).toBe('none');
  });

  it('數字滾動：減少動態時直接換成新值；一般情況會在短時間內滾到新值', async () => {
    document.documentElement.dataset['motion'] = 'reduced';
    function Demo({ start }: { start: number }) {
      const [v, setV] = useState(start);
      return (
        <>
          <button type="button" onClick={() => setV((x) => x + 5)}>
            加五
          </button>
          <RollingNumber value={v} />
        </>
      );
    }
    const screen = await render(wrap(<Demo start={3} />));
    const num = () => screen.container.querySelector<HTMLElement>('.ll-rollnum')!;
    expect(num().textContent).toBe('3');
    await screen.getByRole('button', { name: '加五' }).click();
    // 減少動態時也是在 effect 裡換值（click() 回來時 React 可能還沒跑到 effect；vitest 5.0.4 的 browser mode 在 Linux 的 WebKit 上就是這樣，
    // 2026-10-27 main 的 CI），所以等值出現，不立刻斷言
    await expect.poll(() => num().textContent, { timeout: 2000 }).toBe('8');
    expect(num().dataset['rolling']).toBeUndefined();
    delete document.documentElement.dataset['motion'];
    await screen.getByRole('button', { name: '加五' }).click();
    await expect.poll(() => num().textContent, { timeout: 2000 }).toBe('13');
    expect(num().dataset['value']).toBe('13');
  });

  it('頂部統計的數字用等寬數字並滾動；延伸標籤是純文字', async () => {
    await render(
      wrap(
        <>
          <MapHud title="闖關" stars={12} badges={1} due={0} badgesHref="/me/badges/" reviewHref="/review/" />
          <NoteTag kind="extension" />
        </>,
      ),
    );
    const values = document.querySelectorAll<HTMLElement>('.ll-statchip__value .ll-rollnum');
    expect([...values].map((v) => v.textContent)).toEqual(['12', '1', '0']);
    expect(document.querySelector('.ll-notetag--extension')!.textContent).toBe('延伸，不列入期中考');
    expect(document.querySelector('.ll-notetag--extension')!.tagName).toBe('SPAN');
  });
});

// 維護者 2026-10-26：頂部統計列的數字一律是確定的值，沒有「…」（進度沒到之前整頁在布幕後面）；型別上也不再收 null
describe('MapHud 的數字', () => {
  it('三個統計都是數字（新使用者是 0），文字與可讀名稱裡都沒有「…」；第一次掛載不滾動', async () => {
    await render(wrap(<MapHud title="闖關" stars={0} badges={0} due={0} badgesHref="/me/badges/" reviewHref="/review/" />));
    const stats = document.querySelector<HTMLElement>('.ll-hud__stats')!;
    const values = [...stats.querySelectorAll<HTMLElement>('.ll-rollnum')];
    expect(values).toHaveLength(3);
    for (const v of values) {
      expect(v.textContent).toMatch(/^\d+$/);
      expect(v.dataset['rolling']).toBeUndefined();
    }
    expect(stats.textContent).not.toContain('…');
    for (const el of stats.querySelectorAll('[aria-label]')) expect(el.getAttribute('aria-label')).not.toContain('…');
    expect(document.querySelector('.ll-statchip__dot')).toBeNull();
    // @ts-expect-error stars 必須是 number，不再接受 null
    const bad: Parameters<typeof MapHud>[0] = { title: '闖關', stars: null, badges: 0, due: 0, badgesHref: '/me/badges/', reviewHref: '/review/' };
    expect(bad).toBeTruthy();
  });
});
