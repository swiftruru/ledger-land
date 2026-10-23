// 闖關地圖元件（17 第 3、7 節）：節點的可讀名稱與 aria-current、關卡表單的焦點管理、代號輸入的錯誤連結、關卡列的狀態文字、角色純裝飾
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useRef, useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWebUiMessages } from '../src/index.ts';
import { ChapterBanner, LevelCard, LevelCodeInput, LevelNode, LevelSheet, MapHud, MapMarker, formatLevelCode } from '../src/map.ts';

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
    expect(buttons[0]!.element().getBoundingClientRect().width).toBe(64);
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
          onNavigate={() => {}}
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
    expect(dialog.textContent).toContain('建議先完成『收入與營業成本』');
    expect(dialog.textContent).toContain('還沒挑戰過');
    expect(dialog.querySelector('code')!.textContent).toBe('k7m2 q9xd');
    await expect.element(page.getByRole('link', { name: '開始' })).toHaveAttribute('href', '/level/lv_k7m2q9xd/');
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
  it('送出時把原始輸入交給父層', async () => {
    const got: string[] = [];
    await render(wrap(<LevelCodeInput status={{ kind: 'idle' }} onSubmit={(raw) => got.push(raw)} />));
    await page.getByRole('textbox').fill('K7M2 Q9XD');
    await page.getByRole('button', { name: '前往' }).click();
    expect(got).toEqual(['K7M2 Q9XD']);
    expect(formatLevelCode('k7m2q9xd')).toBe('k7m2 q9xd');
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
    expect(page.getByRole('button', { name: '介紹' }).all()).toHaveLength(1);
    const retired = document.querySelector('.ll-levelcard--retired')!;
    expect(retired.textContent).toContain('已下架');
    expect(retired.querySelector('a, button')).toBeNull();
    expect(document.querySelector('.ll-levelcard.is-current')!.textContent).toContain('建議下一關');
  });

  it('章節牌是 h2 加連結，徽章未取得時唸出尚未取得；頂部統計三個都是連結；角色 aria-hidden', async () => {
    const hrefs: string[] = [];
    await render(
      wrap(
        <>
          <ChapterBanner
            chapterId="ch_a"
            chapterNo={2}
            title="三張報表"
            done={1}
            total={5}
            badgeTitle="看懂地圖"
            href="/chapter/ch_a/"
            onNavigate={(h) => hrefs.push(h)}
            headingId="h-a"
            extension
          />
          <MapHud title="闖關" stars={27} badges={2} due={3} starsHref="/me/" badgesHref="/me/" reviewHref="/review/" onNavigate={(h) => hrefs.push(h)} />
          <MapMarker />
        </>,
      ),
    );
    await expect.element(page.getByRole('heading', { level: 2 })).toHaveTextContent('三張報表');
    expect(document.getElementById('h-a')).not.toBeNull();
    await expect.element(page.getByRole('img', { name: '徽章「看懂地圖」尚未取得' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('延伸，不列入期中考');
    await page.getByRole('link', { name: '三張報表' }).click();
    await page.getByRole('link', { name: '錯題本待複習 3 題，到錯題本' }).click();
    expect(hrefs).toEqual(['/chapter/ch_a/', '/review/']);
    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('闖關');
    expect(document.querySelector('.ll-marker')!.getAttribute('aria-hidden')).toBe('true');
  });
});
