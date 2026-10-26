// 基礎元件第二段（站規 1.7 到 1.11、1.13、1.14、1.20、4.3）：NavList、NavRow、NavCard、Disclosure、Menu、Sheet、ConfirmSheet、
// GlossaryItem、TermPill、SearchField、ProgressBar、HintBar、Banner、EmptyState、ErrorState
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Badge,
  Banner,
  Button,
  ConfirmSheet,
  Disclosure,
  EmptyState,
  ErrorState,
  GearIcon,
  GlossaryGrid,
  HeartIcon,
  GlossaryItem,
  HintBar,
  IconButton,
  LinkProvider,
  MenuButton,
  MenuItem,
  NavCard,
  NavList,
  NavRow,
  ProgressBar,
  SearchField,
  Segmented,
  Sheet,
  ShieldIcon,
  Switch,
  TermPill,
  TermPillList,
  Toast,
  TrashIcon,
  loadWebUiMessages,
  type LinkComponentProps,
} from '../src/index.ts';

beforeAll(async () => {
  i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
});
afterEach(() => {
  document.documentElement.removeAttribute('data-motion');
});

/** 假的 provider：記錄導航，尊重 onClick 裡的 preventDefault() */
function makeProvider() {
  const navigate = vi.fn<(href: string) => void>();
  function FakeLink({ href, onClick, ref, children, ...rest }: LinkComponentProps) {
    return (
      <a
        ref={ref}
        href={href}
        data-router="fake"
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          const prevented = e.defaultPrevented;
          e.preventDefault();
          if (!prevented) navigate(href);
        }}
      >
        {children}
      </a>
    );
  }
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <LinkProvider component={FakeLink}>{children}</LinkProvider>
    </I18nProvider>
  );
  return { navigate, Wrap };
}

const deco = (el: Element) => getComputedStyle(el).textDecorationLine;
const focusables = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLElement>('a[href], button, summary, input, [tabindex]')).filter((el) => el.tabIndex >= 0);

describe('NavList、NavRow、NavCard', () => {
  it('每列只有一個可聚焦元素；連結經 provider；current 輸出 aria-current；external 換外連箭頭並加隱藏文字', async () => {
    const { Wrap, navigate } = makeProvider();
    const screen = await render(
      <Wrap>
        <NavList title="這台裝置">
          <NavRow icon={<GearIcon />} title="設定" description="語言、外觀、計時" href="/me/settings/" />
          <NavRow icon={<GearIcon />} title="備份" trailing={<Badge kind="warning">還沒備份</Badge>} href="/me/backup/" current />
          <NavRow icon={<ShieldIcon />} title="回報問題" href="https://example.org/" external />
        </NavList>
      </Wrap>,
    );
    const list = page.getByRole('list', { name: '這台裝置' }).element();
    const items = list.querySelectorAll(':scope > li');
    expect(items.length).toBe(3);
    for (const li of Array.from(items)) expect(focusables(li).length).toBe(1);
    const settings = page.getByRole('link', { name: /設定/ });
    await expect.element(settings).toHaveAttribute('data-router', 'fake');
    await settings.click();
    expect(navigate).toHaveBeenCalledWith('/me/settings/');
    await expect.element(page.getByRole('link', { name: /備份/ })).toHaveAttribute('aria-current', 'page');
    const ext = page.getByRole('link', { name: /回報問題/ });
    await expect.element(ext).not.toHaveAttribute('data-router');
    await expect.element(ext).toHaveAttribute('rel', 'noopener');
    await expect.element(ext).toHaveAccessibleName(/（外部網站）/);
    // 外連箭頭（ArrowUpRightIcon 的 path）與站內的向右箭頭不同
    const extPath = ext.element().querySelector('.ll-navrow__chev path')?.getAttribute('d');
    const inPath = settings.element().querySelector('.ll-navrow__chev path')?.getAttribute('d');
    expect(extPath).toBeTruthy();
    expect(extPath).not.toBe(inPath);
    await screen.unmount();
  });

  it('列至少 56px（compact 44px）；靜止、滑過、焦點都沒有底線；焦點框畫在列內側', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <NavList aria-label="測試">
          <NavRow icon={<GearIcon />} title="一般列" href="/a/" />
          <NavRow icon={<GearIcon />} title="精簡列" size="compact" description="不顯示" href="/b/" />
          <NavRow icon={<GearIcon />} title="按鈕列" onClick={() => {}} />
        </NavList>
      </Wrap>,
    );
    const row = page.getByRole('link', { name: '一般列' }).element() as HTMLElement;
    const compact = page.getByRole('link', { name: '精簡列' }).element() as HTMLElement;
    expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    expect(compact.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(compact.textContent).not.toContain('不顯示');
    const btn = page.getByRole('button', { name: '按鈕列' }).element() as HTMLButtonElement;
    expect(btn.type).toBe('button');
    for (const el of [row, compact, btn]) {
      expect(deco(el)).toBe('none');
      await userEvent.hover(el);
      expect(deco(el)).toBe('none');
    }
    // 焦點框畫在列內側：:focus-visible 的判定因平台而異（macOS 的 WebKit 按過鍵盤後的程式聚焦算、Linux 的不算，Tab 鍵在 macOS 又不走按鈕；
    // 2026-10-26 CI），所以不靠瀏覽器判定，直接查樣式表裡 .ll-navrow:focus-visible 這條規則：outline 實線、offset -3px；
    // 聚焦時沒有底線則用程式聚焦量（任何平台都成立）
    const rules: CSSStyleRule[] = [];
    const walk = (list: CSSRuleList) => {
      for (const r of Array.from(list)) {
        if (r instanceof CSSStyleRule && r.selectorText === '.ll-navrow:focus-visible') rules.push(r);
        else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* 跨來源的樣式表讀不到，略過 */
      }
    }
    const focusRule = rules.find((r) => r.style.getPropertyValue('outline-offset') !== '');
    expect(focusRule?.style.getPropertyValue('outline-offset')).toBe('-3px');
    expect(focusRule?.style.getPropertyValue('outline-style') || focusRule?.style.getPropertyValue('outline')).toMatch(/solid/);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    expect(deco(btn)).toBe('none');
    await screen.unmount();
  });

  it('NavCard：aside 在連結外面；沒有 href 也沒有 onClick 是不可點的卡（沒有箭頭、不可聚焦）', async () => {
    const { Wrap } = makeProvider();
    const remove = vi.fn<() => void>();
    const screen = await render(
      <Wrap>
        <NavList aria-label="收藏" inset={false}>
          <NavCard
            icon={<GearIcon />}
            title="1-2 永遠平衡的一條式子"
            description="摘錄"
            href="/level/x/"
            aside={<IconButton icon={<TrashIcon />} label="移除收藏：摘錄" onClick={remove} />}
          />
          <NavCard icon={<GearIcon />} title="已下架" aside={<IconButton icon={<TrashIcon />} label="移除收藏：已下架" />} />
        </NavList>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: /1-2 永遠平衡/ }).element();
    const rm = page.getByRole('button', { name: '移除收藏：摘錄' }).element();
    expect(link.contains(rm)).toBe(false);
    expect(link.closest('li')?.contains(rm)).toBe(true);
    await page.getByRole('button', { name: '移除收藏：摘錄' }).click();
    expect(remove).toHaveBeenCalledOnce();
    const card = page.getByText('已下架', { exact: true }).element().closest('.ll-navrow') as HTMLElement;
    expect(card.tagName).toBe('DIV');
    expect(card.querySelector('.ll-navrow__chev')).toBeNull();
    expect(focusables(card).length).toBe(0);
    await screen.unmount();
  });
});

describe('Disclosure', () => {
  it('不受控：Enter 與空白鍵切換；summary 至少 48px、沒有底線', async () => {
    const screen = await render(
      <Disclosure summary="參考名詞" trailing={<Badge>64</Badge>}>
        <p>內容</p>
      </Disclosure>,
    );
    const details = document.querySelector('details.ll-disclosure') as HTMLDetailsElement;
    const summary = details.querySelector('summary')!;
    expect(summary.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(deco(summary)).toBe('none');
    summary.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => details.open).toBe(true);
    await userEvent.keyboard(' ');
    await expect.poll(() => details.open).toBe(false);
    await screen.unmount();
  });

  it('受控：父層的 open 為準（搜尋命中時強制展開）；使用者點了回呼 onToggle', async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" className="ll-x" onClick={() => setOpen(true)}>
            命中
          </button>
          <Disclosure
            summary="受控"
            open={open}
            onToggle={(o) => {
              onToggle(o);
              setOpen(o);
            }}
          >
            <p>內容</p>
          </Disclosure>
        </>
      );
    }
    const screen = await render(<Demo />);
    const details = document.querySelector('details.ll-disclosure') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await page.getByRole('button', { name: '命中' }).click();
    await expect.poll(() => details.open).toBe(true);
    await page.getByText('受控').click();
    await expect.poll(() => onToggle.mock.calls.at(-1)?.[0]).toBe(false);
    await expect.poll(() => details.open).toBe(false);
    await screen.unmount();
  });

  it('受控：點收合後、toggle 事件送出前父層又重繪，onToggle 照樣收到 false，不被重繪強制展開（E2E 在負載下量到過）', async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    function Demo() {
      const [open, setOpen] = useState(true);
      const [, bump] = useState(0);
      return (
        <>
          <button
            type="button"
            className="ll-x"
            onClick={() => {
              // 同一個工作裡：使用者點了 summary，接著父層同步重繪（例如輸入框的字改了），toggle 事件要到之後的工作才送出
              document.querySelector<HTMLElement>('details.ll-disclosure summary')!.click();
              flushSync(() => bump((n) => n + 1));
            }}
          >
            收合並重繪
          </button>
          <Disclosure
            summary="受控"
            open={open}
            onToggle={(o) => {
              onToggle(o);
              setOpen(o);
            }}
          >
            <p>內容</p>
          </Disclosure>
        </>
      );
    }
    const screen = await render(<Demo />);
    const details = document.querySelector('details.ll-disclosure') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    await page.getByRole('button', { name: '收合並重繪' }).click();
    await expect.poll(() => onToggle.mock.calls.at(-1)?.[0]).toBe(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(details.open).toBe(false);
    await screen.unmount();
  });

  it('受控但父層不改 open 時，畫面維持父層的狀態', async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    const screen = await render(
      <Disclosure summary="固定展開" open onToggle={onToggle}>
        <p>內容</p>
      </Disclosure>,
    );
    const details = document.querySelector('details.ll-disclosure') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    await page.getByText('固定展開').click();
    await expect.poll(() => onToggle.mock.calls.length).toBe(1);
    await expect.poll(() => details.open).toBe(true);
    await screen.unmount();
  });
});

describe('MenuButton、MenuItem', () => {
  it('打開時焦點到第一項；上下鍵、Home、End 移動；Esc 關閉、焦點回到按鈕；點項目觸發並關閉', async () => {
    const { Wrap } = makeProvider();
    const pick = vi.fn<() => void>();
    const screen = await render(
      <Wrap>
        <MenuButton>
          <MenuItem icon={<GearIcon />} onClick={pick}>
            輸入關卡代號
          </MenuItem>
          <MenuItem icon={<GearIcon />}>掃描課堂 QR</MenuItem>
          <MenuItem icon={<GearIcon />} href="/play/?view=list">
            清單檢視
          </MenuItem>
        </MenuButton>
      </Wrap>,
    );
    const btn = page.getByRole('button', { name: '更多' });
    await expect.element(btn).toHaveAttribute('aria-haspopup', 'menu');
    await expect.element(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect.element(btn).toHaveAttribute('aria-expanded', 'true');
    const items = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    await expect.poll(() => document.activeElement).toBe(items()[0]);
    for (const el of items()) {
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(deco(el)).toBe('none');
    }
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items()[1]);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(items()[2]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items()[0]);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items()[2]);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(items()[0]);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(btn.element());
    await btn.click();
    await page.getByRole('menuitem', { name: '輸入關卡代號' }).click();
    expect(pick).toHaveBeenCalledOnce();
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(btn.element());
    await screen.unmount();
  });

  it('點選單外面會關閉', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <p>外面</p>
        <MenuButton label="工具">
          <MenuItem>一</MenuItem>
        </MenuButton>
      </I18nProvider>,
    );
    await page.getByRole('button', { name: '工具' }).click();
    await expect.element(page.getByRole('menu')).toBeInTheDocument();
    await page.getByText('外面').click();
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
    await screen.unmount();
  });
});

describe('Sheet、ConfirmSheet', () => {
  it('開啟時焦點在標題；右上只有一顆「關閉」；Esc 關閉後焦點回到開啟它的按鈕', async () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <I18nProvider i18n={i18n}>
          <button type="button" className="ll-x" onClick={() => setOpen(true)}>
            打開
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="1-2 永遠平衡的一條式子" footer={<Button variant="primary">開始</Button>}>
            <p>學習目標</p>
          </Sheet>
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const opener = page.getByRole('button', { name: '打開' });
    // 鍵盤使用者：焦點在按鈕上按 Enter（Safari 點按鈕不會給焦點，那種情況靠 returnFocusTo）
    (opener.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    const dialog = page.getByRole('dialog', { name: '1-2 永遠平衡的一條式子' });
    await expect.element(dialog).toBeVisible();
    const el = dialog.element() as HTMLDialogElement;
    await expect.poll(() => document.activeElement?.tagName).toBe('H2');
    expect(el.querySelectorAll('button').length).toBe(2);
    expect(page.getByRole('button', { name: '關閉' }).elements().length).toBe(1);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => el.open).toBe(false);
    expect(document.activeElement).toBe(opener.element());
    await screen.unmount();
  });

  it('確認面板：取消（quiet）在上、破壞性的主動作（danger lg block）在下；說明連到 aria-describedby', async () => {
    const confirm = vi.fn<() => void>();
    const close = vi.fn<() => void>();
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <ConfirmSheet
          open
          onClose={close}
          onConfirm={confirm}
          title="要覆蓋現有進度嗎？"
          description="覆蓋之後不能復原。"
          confirmLabel="覆蓋現有進度"
          confirmIcon={<TrashIcon />}
        />
      </I18nProvider>,
    );
    const dialog = page.getByRole('dialog', { name: '要覆蓋現有進度嗎？' });
    await expect.element(dialog).toHaveAccessibleDescription('覆蓋之後不能復原。');
    const foot = Array.from(dialog.element().querySelectorAll('.ll-sheet__foot .ll-btn'));
    expect(foot.map((b) => b.textContent)).toEqual(['取消', '覆蓋現有進度']);
    expect(foot[0]!.className).toContain('ll-btn--quiet');
    expect(foot[1]!.className).toContain('ll-btn--danger');
    expect(foot[1]!.className).toContain('ll-btn--lg');
    await page.getByRole('button', { name: '覆蓋現有進度' }).click();
    expect(confirm).toHaveBeenCalledOnce();
    await page.getByRole('button', { name: '取消' }).click();
    expect(close).toHaveBeenCalledOnce();
    await screen.unmount();
  });
});

describe('GlossaryItem、TermPill、GlossaryGrid', () => {
  const items = (
    <GlossaryGrid aria-label="名詞">
      <GlossaryItem href="/terms/a/" name="現金" english="Cash" category="account" categoryLabel="科目" element="asset" state="unlocked" stateLabel="已收進" />
      <GlossaryItem
        href="/terms/b/"
        name="權責發生基礎"
        english="Accrual basis"
        category="concept"
        categoryLabel="觀念"
        state="locked"
        stateLabel="未收進"
        meet="在 1-1 誰的東西、誰的錢遇到"
      />
      <GlossaryItem href="/terms/c/" name="損益表" category="statement" categoryLabel="報表" state="pending" />
      <GlossaryItem href="/terms/d/" name="流動比率" category="ratio" categoryLabel="參考" state="reference" />
    </GlossaryGrid>
  );

  it('四種狀態的可讀名稱依序是名稱、英文、類別、狀態、遇到的關卡；已收進有印章、未收進是虛線空位', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(<Wrap>{items}</Wrap>);
    await expect.element(page.getByRole('link', { name: '現金 Cash 科目 已收進' })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: '權責發生基礎 Accrual basis 觀念 未收進 在 1-1 誰的東西、誰的錢遇到' })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: '損益表 報表' })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: '流動比率 參考' })).toBeInTheDocument();
    const unlocked = page.getByRole('link', { name: /^現金/ }).element();
    expect(unlocked.querySelector('.ll-stamp')).not.toBeNull();
    expect(unlocked.querySelector('.ll-termemblem--asset')).not.toBeNull();
    const locked = page.getByRole('link', { name: /^權責發生基礎/ }).element();
    expect(locked.querySelector('.ll-stamp')).toBeNull();
    expect(getComputedStyle(locked.querySelector('.ll-termemblem')!).borderTopStyle).toBe('dashed');
    // 讀取中保留印章的位置（讀到進度後不移位）
    expect(
      page
        .getByRole('link', { name: /^損益表/ })
        .element()
        .querySelector('.ll-termitem__stampslot'),
    ).not.toBeNull();
    for (const a of page.getByRole('link').elements()) {
      expect(a.getBoundingClientRect().height).toBeGreaterThanOrEqual(88);
      expect(deco(a)).toBe('none');
      await userEvent.hover(a);
      expect(deco(a)).toBe('none');
    }
    await screen.unmount();
  });

  it('justCollected 播蓋章動畫；減少動態時不加動畫 class', async () => {
    const { Wrap } = makeProvider();
    let screen = await render(
      <Wrap>
        <GlossaryGrid>
          <GlossaryItem href="/terms/a/" name="現金" category="account" categoryLabel="科目" state="unlocked" justCollected />
        </GlossaryGrid>
      </Wrap>,
    );
    expect(document.querySelector('.ll-stamp.is-stamping')).not.toBeNull();
    await screen.unmount();
    document.documentElement.dataset['motion'] = 'reduced';
    screen = await render(
      <Wrap>
        <GlossaryGrid>
          <GlossaryItem href="/terms/a/" name="現金" category="account" categoryLabel="科目" state="unlocked" justCollected />
        </GlossaryGrid>
      </Wrap>,
    );
    expect(document.querySelector('.ll-stamp')).not.toBeNull();
    expect(document.querySelector('.is-stamping, .is-just-collected')).toBeNull();
    await screen.unmount();
  });

  it('TermPill：文字含「(−)」時沒有底線；44px 高', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <TermPillList aria-label="參考名詞">
          <TermPill href="/terms/x/">累計折舊 (−)</TermPill>
        </TermPillList>
      </Wrap>,
    );
    const pill = page.getByRole('link', { name: '累計折舊 (−)' }).element();
    expect(pill.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(deco(pill)).toBe('none');
    for (const el of Array.from(pill.querySelectorAll('*'))) expect(deco(el)).toBe('none');
    await userEvent.hover(pill);
    expect(deco(pill)).toBe('none');
    await screen.unmount();
  });
});

describe('SearchField', () => {
  it('清除後焦點回輸入框；Esc 也清除；可見標籤連到輸入框', async () => {
    const changes: string[] = [];
    function Demo() {
      const [q, setQ] = useState('應收');
      return (
        <I18nProvider i18n={i18n}>
          <SearchField
            label="搜尋名詞"
            value={q}
            onChange={(v) => {
              changes.push(v);
              setQ(v);
            }}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const input = page.getByRole('searchbox', { name: '搜尋名詞' });
    await expect.element(input).toHaveValue('應收');
    expect((input.element() as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    await page.getByRole('button', { name: '清除搜尋' }).click();
    await expect.element(input).toHaveValue('');
    expect(document.activeElement).toBe(input.element());
    expect(changes.at(-1)).toBe('');
    await expect.poll(() => document.querySelector('.ll-search__clear')).toBeNull();
    await userEvent.type(input, '折舊');
    await expect.element(input).toHaveValue('折舊');
    await userEvent.keyboard('{Escape}');
    await expect.element(input).toHaveValue('');
    expect(document.activeElement).toBe(input.element());
    await screen.unmount();
  });

  it('父層晚一步回傳舊值（回音）時，框裡的字不回彈', async () => {
    const ctl: { echo?: (v: string) => void } = {};
    function Demo() {
      const [q, setQ] = useState('');
      useEffect(() => {
        ctl.echo = setQ;
      }, []);
      // 父層不立刻更新 value（例如寫回網址是非同步的）
      return (
        <I18nProvider i18n={i18n}>
          <SearchField label="搜尋" value={q} onChange={() => {}} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const input = page.getByRole('searchbox', { name: '搜尋' });
    await userEvent.type(input, 'abc');
    await expect.element(input).toHaveValue('abc');
    // 之前送出的「a」這時才回來：不得把框裡的字改回「a」
    ctl.echo!('a');
    await new Promise((r) => setTimeout(r, 50));
    await expect.element(input).toHaveValue('abc');
    // 外部真的換了值（不是剛送出的值）：跟著換
    ctl.echo!('現金');
    await expect.element(input).toHaveValue('現金');
    await screen.unmount();
  });
});

describe('ProgressBar、HintBar、Banner、空狀態與錯誤狀態', () => {
  it('ProgressBar：aria-hidden；比例夾在 0 到 1；兩種高度', async () => {
    const screen = await render(
      <div style={{ width: '200px' }}>
        <ProgressBar value={12} max={99} data-testid="p1" />
        <ProgressBar value={2} size="sm" data-testid="p2" />
        <ProgressBar value={-1} data-testid="p3" />
      </div>,
    );
    const p1 = page.getByTestId('p1').element();
    expect(p1.getAttribute('aria-hidden')).toBe('true');
    expect(p1.getAttribute('data-ratio')).toBe((12 / 99).toFixed(3));
    expect(p1.getBoundingClientRect().height).toBe(10);
    expect(page.getByTestId('p2').element().getAttribute('data-ratio')).toBe('1.000');
    expect(page.getByTestId('p2').element().getBoundingClientRect().height).toBe(6);
    expect(page.getByTestId('p3').element().getAttribute('data-ratio')).toBe('0.000');
    // 填色條往左移出軌道：12% 時可見寬度約是軌道的 12%
    const fill = p1.querySelector('.ll-progress__fill')!.getBoundingClientRect();
    const track = p1.getBoundingClientRect();
    expect(Math.round(fill.right - track.left)).toBe(Math.round(track.width * (12 / 99)));
    await screen.unmount();
  });

  it('HintBar：「詳細」是經 provider 的連結、「關閉」是按鈕，各 44×44；至少 44px 高', async () => {
    const { Wrap, navigate } = makeProvider();
    const close = vi.fn<() => void>();
    const screen = await render(
      <Wrap>
        <HintBar detailsHref="/me/backup/" detailsLabel="詳細：備份" onClose={close} data-testid="hint">
          記得備份進度
        </HintBar>
      </Wrap>,
    );
    const bar = page.getByTestId('hint').element();
    expect(bar.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    const details = page.getByRole('link', { name: '詳細：備份' });
    const closeBtn = page.getByRole('button', { name: '關閉提示' });
    for (const el of [details.element(), closeBtn.element()]) {
      const r = el.getBoundingClientRect();
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    await details.click();
    expect(navigate).toHaveBeenCalledWith('/me/backup/');
    await closeBtn.click();
    expect(close).toHaveBeenCalledOnce();
    await screen.unmount();
  });

  it('Banner：依 kind 的圖示、標題與動作列；可關閉時右上有 44px 的 X', async () => {
    const dismiss = vi.fn<() => void>();
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Banner kind="warning" title="無法儲存" onDismiss={dismiss} actions={<Button size="sm">立即匯出</Button>} data-testid="b1">
          先匯出備份檔。
        </Banner>
        <Banner data-testid="b2">舊寫法</Banner>
      </I18nProvider>,
    );
    const b1 = page.getByTestId('b1').element();
    expect(b1.querySelector('.ll-banner__icon svg')).not.toBeNull();
    expect(b1.querySelector('.ll-banner__title')?.textContent).toBe('無法儲存');
    const x = page.getByRole('button', { name: '關閉' });
    expect((x.element() as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await x.click();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(page.getByTestId('b2').element().querySelector('.ll-banner__icon')).not.toBeNull();
    await screen.unmount();
  });

  it('EmptyState、ErrorState：預設插圖是鈴；onRetry 放 primary「再試一次」在最前面', async () => {
    const retry = vi.fn<() => void>();
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <EmptyState title="今天沒有要複習的題目" action={<Button variant="primary">去闖關</Button>} data-testid="empty" />
        <ErrorState title="地圖載入失敗" onRetry={retry} action={<Button>先看名詞圖鑑</Button>} data-testid="error" />
      </I18nProvider>,
    );
    expect(page.getByTestId('empty').element().querySelector('.ll-state__art .ll-marker--clasp')).not.toBeNull();
    const err = page.getByTestId('error').element();
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.querySelector('.ll-state__art .ll-marker--cheek')).not.toBeNull();
    const buttons = Array.from(err.querySelectorAll('.ll-state__action .ll-btn'));
    expect(buttons.map((b) => b.textContent)).toEqual(['再試一次', '先看名詞圖鑑']);
    expect(buttons[0]!.className).toContain('ll-btn--primary');
    await page.getByRole('button', { name: '再試一次' }).click();
    expect(retry).toHaveBeenCalledOnce();
    await screen.unmount();
  });
});

// ---- M3 驗收第 1 輪的修正：窄欄 NavRow、深色開關與橫幅、收集類 Toast、多行欄位、進度條軌道 ----
describe('M3 驗收第 1 輪（基礎組）', () => {
  const setDark = (flavor: 'violet' | 'berry' | 'wine') => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-flavor', flavor);
  };
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-flavor');
  });
  /** 計算後的顏色（可能是 rgb() 或 oklab()）經 canvas 換成 sRGB，回傳加權亮度（0 到 255，只比大小用） */
  const lum = (c: string) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };

  it('NavRow：右側 Badge 依估計寬度分級：長的（Not backed up yet）在 343px 移到說明下方；中的（還沒備份）343px 留在右側、280px 才移下去；短的計數一律在右側；寬欄時都在右側', async () => {
    const { Wrap } = makeProvider();
    const rows = (
      <NavList title="這台裝置">
        <NavRow
          icon={<GearIcon />}
          title="Backup"
          description="Export or import your progress"
          trailing={<Badge kind="warning">Not backed up yet</Badge>}
          href="/me/backup/"
          data-testid="long"
        />
        <NavRow
          icon={<GearIcon />}
          title="備份"
          description="匯出或匯入學習進度"
          trailing={<Badge kind="warning">還沒備份</Badge>}
          href="/me/backup/"
          data-testid="mid"
        />
        <NavRow
          icon={<GearIcon />}
          title="錯題本"
          description="今天要複習 3 題"
          trailing={<Badge kind="danger">3</Badge>}
          href="/review/"
          data-testid="short"
        />
      </NavList>
    );
    const below = (id: string) => {
      const row = page.getByTestId(id).element();
      const text = row.querySelector('.ll-navrow__text')!.getBoundingClientRect();
      const trail = row.querySelector('.ll-navrow__trail')!.getBoundingClientRect();
      return trail.top >= text.bottom - 1 && Math.abs(trail.left - text.left) < 1;
    };
    const right = (id: string) => {
      const row = page.getByTestId(id).element();
      return row.querySelector('.ll-navrow__trail')!.getBoundingClientRect().left > row.querySelector('.ll-navrow__text')!.getBoundingClientRect().right - 1;
    };
    const screen = await render(
      <Wrap>
        <div style={{ width: 343 }}>{rows}</div>
      </Wrap>,
    );
    expect(page.getByTestId('long').element().className).toContain('ll-navrow--long-trail');
    expect(page.getByTestId('mid').element().className).toContain('ll-navrow--mid-trail');
    expect(page.getByTestId('short').element().className).not.toMatch(/ll-navrow--(long|mid)-trail/);
    expect(below('long')).toBe(true);
    // 說明不再被擠成好幾行：佔滿文字欄的寬度（不再和 Badge 分一列），行數用它自己的行高算、最多兩行（字型寬度因平台而異，不量 px 高度）
    const longDesc = page.getByTestId('long').element().querySelector('.ll-navrow__desc')!;
    const longText = page.getByTestId('long').element().querySelector('.ll-navrow__text')!.getBoundingClientRect();
    expect(longDesc.getBoundingClientRect().width).toBeGreaterThanOrEqual(longText.width - 1);
    expect(Math.round(longDesc.getBoundingClientRect().height / parseFloat(getComputedStyle(longDesc).lineHeight))).toBeLessThanOrEqual(2);
    expect(right('mid')).toBe(true);
    expect(right('short')).toBe(true);
    await screen.unmount();
    const narrow = await render(
      <Wrap>
        <div style={{ width: 280 }}>{rows}</div>
      </Wrap>,
    );
    expect(below('mid')).toBe(true);
    expect(right('short')).toBe(true);
    await narrow.unmount();
    const wide = await render(
      <Wrap>
        <div style={{ width: 560 }}>{rows}</div>
      </Wrap>,
    );
    expect(right('long')).toBe(true);
    expect(right('mid')).toBe(true);
    await wide.unmount();
  });

  it('NavRow chevron="none"（頁內錨點）：沒有箭頭，文字欄用到列的右內距', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <div style={{ width: 320 }}>
          <NavList title="本頁目錄" tone="neutral">
            <NavRow icon={<GearIcon />} title="顏色" href="#color" size="compact" chevron="none" data-testid="anchor" />
          </NavList>
        </div>
      </Wrap>,
    );
    const row = page.getByTestId('anchor').element();
    expect(row.className).toContain('ll-navrow--no-chev');
    expect(row.querySelector('.ll-navrow__chev')).toBeNull();
    const rowBox = row.getBoundingClientRect();
    const text = row.querySelector('.ll-navrow__text')!.getBoundingClientRect();
    expect(Math.round(rowBox.right - text.right)).toBe(16);
    await screen.unmount();
  });

  it.each(['violet', 'berry', 'wine'] as const)('Switch（深色 %s）：關是淺色圓鈕、開是深色圓鈕，軌道一中性一強調', async (flavor) => {
    setDark(flavor);
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Switch checked={false} onChange={() => {}} label="關的開關" />
        <Switch checked onChange={() => {}} label="開的開關" />
      </I18nProvider>,
    );
    const [off, on] = Array.from(document.querySelectorAll('.ll-switch__knob'));
    const offKnob = getComputedStyle(off!, '::after').backgroundColor;
    const onKnob = getComputedStyle(on!, '::after').backgroundColor;
    expect(lum(offKnob)).toBeGreaterThan(lum(onKnob) + 60);
    expect(getComputedStyle(off!).boxShadow).toContain('inset');
    expect(getComputedStyle(on!).boxShadow).toBe('none');
    expect(getComputedStyle(off!).backgroundColor).not.toBe(getComputedStyle(on!).backgroundColor);
    await screen.unmount();
  });

  it('Switch（淺色）：兩種狀態的圓鈕都是白的（卡片色）', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Switch checked={false} onChange={() => {}} label="關的開關" />
        <Switch checked onChange={() => {}} label="開的開關" />
      </I18nProvider>,
    );
    const [off, on] = Array.from(document.querySelectorAll('.ll-switch__knob'));
    expect(getComputedStyle(off!, '::after').backgroundColor).toBe(getComputedStyle(on!, '::after').backgroundColor);
    expect(lum(getComputedStyle(off!, '::after').backgroundColor)).toBeGreaterThan(240);
    await screen.unmount();
  });

  it('Banner（深色）：標題是主要文字色、內文是次要文字色，只有圖示帶狀態色', async () => {
    setDark('violet');
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Banner kind="info" title="有新版本可以使用" data-testid="b">
          你的進度已經存好。
        </Banner>
        <p data-testid="ref-text" style={{ color: 'var(--ll-text)' }} />
        <p data-testid="ref-text2" style={{ color: 'var(--ll-text-2)' }} />
        <p data-testid="ref-info" style={{ color: 'var(--ll-info-ink)' }} />
      </I18nProvider>,
    );
    const b = page.getByTestId('b').element();
    const color = (id: string) => getComputedStyle(page.getByTestId(id).element()).color;
    expect(getComputedStyle(b.querySelector('.ll-banner__title')!).color).toBe(color('ref-text'));
    expect(getComputedStyle(b.querySelector('.ll-banner__body')!).color).toBe(color('ref-text2'));
    expect(getComputedStyle(b.querySelector('.ll-banner__icon')!).color).toBe(color('ref-info'));
    // 底不是整片青色：和卡片色很接近（亮度差在 25 以內）
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--ll-surface').trim();
    expect(surface).toBe('#22212C');
    expect(Math.abs(lum(getComputedStyle(b).backgroundColor) - lum('rgb(34, 33, 44)'))).toBeLessThan(25);
    await screen.unmount();
  });

  it('Toast（收集類）：40px 圖像槽 aria-hidden、title-3 標題加一行說明、左側星星色條；減少動態時圖像不做縮放', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Toast kind="collect" title="取得精通徽章" media={<svg width="34" height="40" data-testid="media" />} onDismiss={() => {}}>
          開店了
        </Toast>
        <span data-testid="ref-star" style={{ color: 'var(--ll-star)' }} />
      </I18nProvider>,
    );
    const toast = document.querySelector('.ll-toast--collect')!;
    const slot = toast.querySelector('.ll-toast__media')!;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    // 出現時有縮放動畫，量版面寬度（不含 transform）
    expect((slot as HTMLElement).offsetWidth).toBe(40);
    expect(toast.querySelector('.ll-toast__title')!.textContent).toBe('取得精通徽章');
    expect(getComputedStyle(toast.querySelector('.ll-toast__title')!).fontWeight).toBe('600');
    expect(toast.querySelector('.ll-toast__body')!.textContent).toBe('開店了');
    // 左側色條是 ::before 畫的 4px 圓頭條（M3 驗收第 4 輪：border-left 在圓角上變成月牙形），上下各留 12px；卡片本身沒有左框線
    const bar = getComputedStyle(toast, '::before');
    expect(bar.backgroundColor).toBe(getComputedStyle(page.getByTestId('ref-star').element()).color);
    expect(bar.width).toBe('4px');
    expect(bar.top).toBe('12px');
    expect(bar.bottom).toBe('12px');
    expect(getComputedStyle(toast).borderLeftWidth).toBe('0px');
    expect(getComputedStyle(slot).animationName).toBe('ll-toast-pop');
    document.documentElement.setAttribute('data-motion', 'reduced');
    expect(getComputedStyle(slot).animationName).toBe('none');
    await screen.unmount();
  });

  it('多行欄位：五行加上下 12px 高、不能拖曳改大小；進度條軌道有 1px 外框', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <textarea className="ll-input" rows={4} readOnly value={'x'.repeat(2000)} data-testid="code" />
        <ProgressBar value={0} max={14} size="sm" data-testid="track" />
      </I18nProvider>,
    );
    const code = page.getByTestId('code').element() as HTMLTextAreaElement;
    const cs = getComputedStyle(code);
    expect(cs.resize).toBe('none');
    expect(code.getBoundingClientRect().height).toBe(5 * 24 + 24);
    // 內容區剛好是整數行（上下的留白是透明的 border，捲動的內容不會畫進去）
    expect(code.clientHeight).toBe(5 * 24);
    expect(cs.borderTopColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(page.getByTestId('track').element()).boxShadow).toContain('inset');
    await screen.unmount();
  });
});

// ---- M3 驗收第 2 輪的修正：空狀態的按鈕列與說明、分段控制、quiet 的載入中、列的按下色 ----
describe('M3 驗收第 2 輪（基礎組）', () => {
  afterEach(async () => {
    await page.viewport(414, 896);
  });
  const box = (el: Element) => el.getBoundingClientRect();

  it('空狀態與錯誤狀態：兩顆按鈕一律同寬（窄螢幕直排、最多 280px；寬螢幕橫排）；只有一顆時維持內容寬度', async () => {
    await page.viewport(375, 812);
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <ErrorState title="章節載入失敗" description="連上網路後再試一次。" onRetry={() => {}} action={<Button>回到闖關地圖</Button>} data-testid="error" />
        <EmptyState title="今天沒有要複習的題目" action={<Button variant="primary">去闖關</Button>} data-testid="empty" />
      </I18nProvider>,
    );
    const pair = page.getByTestId('error').element().querySelector('.ll-state__action')!;
    expect(pair.classList.contains('ll-state__action--pair')).toBe(true);
    const [a, b] = Array.from(pair.querySelectorAll('.ll-btn')).map(box) as [DOMRect, DOMRect];
    expect(a.width).toBeCloseTo(b.width, 0);
    expect(a.left).toBeCloseTo(b.left, 0);
    expect(b.top).toBeGreaterThan(a.bottom);
    expect(box(pair).width).toBeLessThanOrEqual(280);
    // 只有一顆：不加 pair、按鈕是內容寬度（比 280 窄）
    const single = page.getByTestId('empty').element().querySelector('.ll-state__action')!;
    expect(single.classList.contains('ll-state__action--pair')).toBe(false);
    expect(box(single.querySelector('.ll-btn')!).width).toBeLessThan(200);
    // 寬螢幕：橫排、同寬
    await page.viewport(1024, 800);
    const [c, d] = Array.from(pair.querySelectorAll('.ll-btn')).map(box) as [DOMRect, DOMRect];
    expect(c.width).toBeCloseTo(d.width, 0);
    expect(c.top).toBeCloseTo(d.top, 0);
    expect(d.left).toBeGreaterThan(c.right);
    await screen.unmount();
  });

  it('空狀態的說明：最多 22em、balance、全站換行規則（第 7 輪拿掉 keep-all）；切好詞的節點（.ll-phrased）只在詞與詞之間換行', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <EmptyState
          title="找不到這一頁"
          description={
            <span className="ll-phrased">
              這個
              <wbr />
              網址
              <wbr />
              沒有
              <wbr />
              對應的
              <wbr />
              頁面，
            </span>
          }
          data-testid="empty"
        />
      </I18nProvider>,
    );
    const desc = page.getByTestId('empty').element().querySelector('.ll-state__desc')!;
    const cs = getComputedStyle(desc);
    expect(cs.maxWidth).toBe(`${22 * parseFloat(cs.fontSize)}px`);
    expect(cs.wordBreak).toBe('normal');
    expect(cs.lineBreak).toBe('strict');
    expect(getComputedStyle(desc.querySelector('.ll-phrased')!).wordBreak).toBe('keep-all');
    await screen.unmount();
  });

  it('全站換行規則：html 是 strict 加 pretty；橫幅與選單列說明不再是 keep-all（第 7 輪）', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Banner kind="info" title="把會計樂園加到主畫面" data-testid="b">
          加到主畫面後，進度不會因為清除瀏覽紀錄而消失。
        </Banner>
        <NavList aria-label="x">
          <NavRow icon={<GearIcon />} title="設定" description="語言、外觀、計時" href="/me/settings/" data-testid="row" />
        </NavList>
      </I18nProvider>,
    );
    const root = getComputedStyle(document.documentElement);
    expect(root.lineBreak).toBe('strict');
    expect(root.getPropertyValue('text-wrap-style') || 'pretty').toBe('pretty');
    for (const el of [
      page.getByTestId('b').element().querySelector('.ll-banner__body')!,
      page.getByTestId('b').element().querySelector('.ll-banner__title')!,
      page.getByTestId('row').element().querySelector('.ll-navrow__desc')!,
    ]) {
      const cs = getComputedStyle(el);
      expect(cs.wordBreak).toBe('normal');
      expect(cs.lineBreak).toBe('strict');
    }
    await screen.unmount();
  });

  it('英文斷字只在窄容器（11em 以下）的內文；一般字級的段落、標題、名稱與按鈕不斷字（第 8 輪）', async () => {
    const box = (w: number, id: string) => (
      <div style={{ width: w, fontSize: 16, containerType: 'inline-size' }} data-testid={id}>
        <p>Accounting concept exercise, not investment advice.</p>
        <span className="ll-navrow__title">
          <span>Reading backwards from the figures</span>
        </span>
        <span className="ll-chend__name">Shareholders</span>
        <button type="button" className="ll-btn">
          <span className="ll-btn__label">Add to my review list</span>
        </button>
      </div>
    );
    const screen = await render(
      <div>
        {box(150, 'narrow')}
        {box(400, 'wide')}
        <p data-testid="plain">Not in any container.</p>
      </div>,
    );
    const lang = document.documentElement.lang;
    document.documentElement.lang = 'en';
    const hy = (id: string, sel: string) => getComputedStyle(page.getByTestId(id).element().querySelector(sel)!).hyphens;
    expect(hy('narrow', 'p')).toBe('auto');
    for (const sel of ['.ll-navrow__title', '.ll-navrow__title span', '.ll-chend__name', '.ll-btn', '.ll-btn__label']) expect(hy('narrow', sel)).toBe('manual');
    for (const sel of ['p', '.ll-navrow__title span', '.ll-btn__label']) expect(hy('wide', sel)).toBe('manual');
    expect(getComputedStyle(page.getByTestId('plain').element()).hyphens).toBe('manual');
    document.documentElement.lang = 'zh-TW';
    expect(hy('narrow', 'p')).toBe('manual');
    document.documentElement.lang = lang;
    await screen.unmount();
  });

  it('plain Disclosure：色塊和上下髮絲線兩端切齊、上下各離線 2px，字與展開內容離邊 16px（第 7 輪）', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <div style={{ width: 400 }}>
          <Disclosure summary="給老師：關卡代號" variant="plain" defaultOpen data-testid="plain">
            <p>內容</p>
          </Disclosure>
        </div>
      </I18nProvider>,
    );
    const d = page.getByTestId('plain').element();
    const sum = d.querySelector('summary')!;
    const db = d.getBoundingClientRect();
    const sb = sum.getBoundingClientRect();
    expect(sb.left).toBeCloseTo(db.left, 0);
    expect(sb.right).toBeCloseTo(db.right, 0);
    expect(sb.top - db.top).toBeCloseTo(1 + 2, 0);
    expect(d.querySelector('.ll-disclosure__title')!.getBoundingClientRect().left - db.left).toBeCloseTo(16, 0);
    expect(d.querySelector('.ll-disclosure__body p')!.getBoundingClientRect().left - db.left).toBeCloseTo(16, 0);
    await screen.unmount();
  });

  it('NavCard 在卡片寬不到 16em 時不畫圖示格，標題用到整列寬（第 7 輪：英文 320 加 200% 的收藏卡）；有插圖的卡片不變', async () => {
    const card = (w: number, id: string) => (
      <div style={{ width: w, fontSize: 16 }}>
        <NavList aria-label={id} inset={false}>
          <NavCard icon={<GearIcon />} title="Shareholders and creditors" description="x" href="/a/" data-testid={id} />
        </NavList>
      </div>
    );
    const screen = await render(
      <I18nProvider i18n={i18n}>
        {card(250, 'narrow')}
        {card(264, 'wide')}
      </I18nProvider>,
    );
    const icon = (id: string) => page.getByTestId(id).element().querySelector('.ll-navrow__icon')!;
    const text = (id: string) => page.getByTestId(id).element().querySelector('.ll-navrow__text')!;
    expect(getComputedStyle(icon('narrow')).display).toBe('none');
    expect(getComputedStyle(icon('wide')).display).not.toBe('none');
    // 窄的卡片：文字欄從列的左內距再往左 4px 開始（不空出 36px 加 12px 的圖示格）
    const rowLeft = page.getByTestId('narrow').element().getBoundingClientRect().left;
    expect(text('narrow').getBoundingClientRect().left - rowLeft).toBeCloseTo(12, 0);
    expect(text('wide').getBoundingClientRect().left - page.getByTestId('wide').element().getBoundingClientRect().left).toBeCloseTo(16 + 36 + 12, 0);
    await screen.unmount();
  });

  it('分段控制：sm 44px、md 48px，每個選項本身撐滿軌道（觸控目標至少 44px）；選取段是浮起的按鍵，不再有 accent 細框', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Segmented
          value="zh-TW"
          label="語言"
          size="sm"
          onChange={() => {}}
          options={[
            { value: 'zh-TW', label: '中' },
            { value: 'en', label: 'EN' },
          ]}
        />
        <Segmented
          value="name"
          label="排序"
          onChange={() => {}}
          options={[
            { value: 'chapter', label: '依章節' },
            { value: 'name', label: '依名稱' },
          ]}
        />
      </I18nProvider>,
    );
    const [sm, md] = Array.from(document.querySelectorAll('.ll-seg')) as [HTMLElement, HTMLElement];
    expect(box(sm).height).toBeCloseTo(44, 0);
    expect(box(md).height).toBeCloseTo(48, 0);
    for (const b of document.querySelectorAll('.ll-seg button')) {
      expect(box(b).height).toBeGreaterThanOrEqual(44);
      expect(box(b).width).toBeGreaterThanOrEqual(44);
    }
    const on = sm.querySelector('[aria-checked="true"]')!;
    expect(getComputedStyle(on).boxShadow).toBe('none');
    expect(getComputedStyle(on).fontWeight).toBe('700');
    const key = getComputedStyle(on, '::before');
    // 按鍵離軌道邊緣 4px（下面多 2px 給底邊），有外框與底邊兩層陰影
    expect(key.top).toBe('4px');
    expect(key.left).toBe('4px');
    expect(key.boxShadow.match(/(rgba?|color|oklab)\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    await screen.unmount();
  });

  it('quiet 沒有前置圖示時的載入中：文字留著、轉圈在前面、有底色；轉圈是淡色軌道加亮色的弧', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Button variant="quiet" busy>
          之後再說
        </Button>
        <Button variant="primary" busy>
          開始
        </Button>
      </I18nProvider>,
    );
    const quiet = page.getByRole('button', { name: '之後再說' }).element();
    expect(quiet.classList.contains('is-busy-over')).toBe(false);
    expect(quiet.firstElementChild!.classList.contains('ll-btn__busy')).toBe(true);
    expect(getComputedStyle(quiet.querySelector('.ll-btn__label')!).opacity).toBe('1');
    expect(getComputedStyle(quiet).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const spin = getComputedStyle(quiet.querySelector('.ll-btn__spinner')!);
    expect(spin.borderTopColor).not.toBe(spin.borderRightColor);
    expect(spin.borderRightColor).toBe(spin.borderBottomColor);
    // 其他變體沒有前置圖示時仍蓋在文字上（寬度不變）
    const primary = page.getByRole('button', { name: '開始' }).element();
    expect(primary.classList.contains('is-busy-over')).toBe(true);
    await screen.unmount();
  });

  it('列的按下色和滑過的底不同（紙質原本兩者都是 #F4F0E7）', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <span data-testid="pressed" style={{ background: 'var(--ll-row-pressed)' }} />
        <span data-testid="hover" style={{ background: 'var(--ll-quiet-hover)' }} />
      </I18nProvider>,
    );
    const bg = (id: string) => getComputedStyle(page.getByTestId(id).element()).backgroundColor;
    expect(bg('pressed')).not.toBe(bg('hover'));
    await screen.unmount();
  });
});

// ---- 第 2 輪 handoff：NavCard 的 chevron、NavRow 的 aria-current="location"、Banner 關閉鈕的顏色、Badge kind="star"、HeartIcon ----
describe('第 2 輪 handoff（基礎組的元件）', () => {
  afterEach(async () => {
    await page.viewport(414, 896);
  });

  it('NavCard chevron="wide"：600 以下不畫箭頭、文字欄用到整列寬；600 以上照常；預設一律有箭頭', async () => {
    await page.viewport(375, 812);
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <NavList aria-label="收藏" inset={false}>
          <NavCard
            icon={<HeartIcon />}
            chevron="wide"
            title="寬才有箭頭"
            description="摘錄"
            href="/level/a/"
            aside={<IconButton icon={<TrashIcon />} label="移除收藏：a" />}
          />
          <NavCard
            icon={<HeartIcon />}
            chevron="wide"
            title="有右側狀態"
            trailing={<Badge>1-2</Badge>}
            href="/level/b/"
            aside={<IconButton icon={<TrashIcon />} label="移除收藏：b" />}
          />
          <NavCard icon={<HeartIcon />} title="預設" href="/level/c/" aside={<IconButton icon={<TrashIcon />} label="移除收藏：c" />} />
        </NavList>
      </Wrap>,
    );
    const row = (name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) }).element() as HTMLElement;
    const chev = (name: string) => getComputedStyle(row(name).querySelector('.ll-navrow__chev')!).display;
    expect(row('寬才有箭頭').closest('.ll-navcard')!.classList.contains('ll-navcard--chev-wide')).toBe(true);
    expect(chev('寬才有箭頭')).toBe('none');
    expect(chev('有右側狀態')).toBe('none');
    expect(chev('預設')).not.toBe('none');
    // 沒有箭頭時文字欄延伸到列的右緣（扣掉內距）；有右側狀態時狀態仍在右側
    const text = row('寬才有箭頭').querySelector('.ll-navrow__text')!.getBoundingClientRect();
    const r = row('寬才有箭頭').getBoundingClientRect();
    expect(r.right - text.right).toBeLessThanOrEqual(parseFloat(getComputedStyle(row('寬才有箭頭')).paddingRight) + 0.5);
    const trail = row('有右側狀態').querySelector('.ll-navrow__trail')!.getBoundingClientRect();
    expect(trail.left).toBeGreaterThan(row('有右側狀態').querySelector('.ll-navrow__text')!.getBoundingClientRect().right - 0.5);
    await page.viewport(1024, 800);
    expect(chev('寬才有箭頭')).not.toBe('none');
    await screen.unmount();
  });

  it('NavRow current：true 與 page 是 aria-current="page"，location 是頁內目錄的目前段落；外觀都是圖示方塊的 accent 框', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <NavList aria-label="目錄">
          <NavRow icon={<GearIcon />} title="一" href="#a" current />
          <NavRow icon={<GearIcon />} title="二" href="#b" current="page" />
          <NavRow icon={<GearIcon />} title="三" href="#c" current="location" />
          <NavRow icon={<GearIcon />} title="四" href="#d" />
        </NavList>
      </Wrap>,
    );
    await expect.element(page.getByRole('link', { name: '一' })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: '二' })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: '三' })).toHaveAttribute('aria-current', 'location');
    await expect.element(page.getByRole('link', { name: '四' })).not.toHaveAttribute('aria-current');
    expect(page.getByRole('link', { name: '三' }).element().classList.contains('is-current')).toBe(true);
    await screen.unmount();
  });

  it('Banner 的關閉鈕跟著橫幅的字色（每種 kind），不是 accent 色', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        {(['info', 'warning', 'success', 'danger'] as const).map((kind) => (
          <Banner key={kind} kind={kind} title={kind} onDismiss={() => {}} data-testid={`banner-${kind}`}>
            說明
          </Banner>
        ))}
      </I18nProvider>,
    );
    for (const kind of ['info', 'warning', 'success', 'danger']) {
      const b = page.getByTestId(`banner-${kind}`).element();
      const x = b.querySelector('.ll-banner__close')!;
      expect(getComputedStyle(x).color).toBe(getComputedStyle(b).color);
    }
    await screen.unmount();
  });

  it('Badge kind="star"：淡金底加金色細框；最前面有新收的勾章時左內距 5px、右側內距多 2px', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Badge kind="star">
          <span className="ll-stamp ll-stamp--inline" aria-hidden="true" />
          新收進 3
        </Badge>
        <Badge kind="star">徽章</Badge>
        <Badge>一般</Badge>
      </I18nProvider>,
    );
    const dot = page.getByText('新收進 3').element() as HTMLElement;
    const plain = page.getByText('徽章').element() as HTMLElement;
    const neutral = page.getByText('一般').element() as HTMLElement;
    expect(dot.classList.contains('ll-badge--star')).toBe(true);
    expect(getComputedStyle(plain).boxShadow).toContain('inset');
    expect(getComputedStyle(plain).backgroundColor).not.toBe(getComputedStyle(neutral).backgroundColor);
    expect(parseFloat(getComputedStyle(dot).paddingRight)).toBe(parseFloat(getComputedStyle(plain).paddingRight) + 2);
    expect(parseFloat(getComputedStyle(dot).paddingLeft)).toBe(5);
    await screen.unmount();
  });

  it('HeartIcon：aria-hidden、filled 時實心', async () => {
    const screen = await render(
      <div data-testid="hearts">
        <HeartIcon />
        <HeartIcon filled />
      </div>,
    );
    const [off, on] = Array.from(page.getByTestId('hearts').element().querySelectorAll('svg'));
    expect(off!.getAttribute('aria-hidden')).toBe('true');
    expect(off!.querySelector('path')!.getAttribute('fill')).toBe('none');
    expect(on!.querySelector('path')!.getAttribute('fill')).toBe('currentColor');
    await screen.unmount();
  });
});

// ---- M3 驗收第 4 輪的修正：選取色、停用開關、淺色橫幅內文、深色 info 橫幅、整頁狀態 ----
describe('M3 驗收第 4 輪（基礎組）', () => {
  const setTheme = (theme: 'light' | 'violet' | 'berry' | 'wine') => {
    if (theme === 'light') return;
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-flavor', theme);
  };
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-flavor');
  });
  const css = (id: string, prop: 'color' | 'backgroundColor' = 'color') => getComputedStyle(page.getByTestId(id).element())[prop];

  it.each(['light', 'violet', 'berry', 'wine'] as const)('Switch（%s）：開啟軌道是選取色，和分段控制同一個色相（深色隨風味）', async (theme) => {
    setTheme(theme);
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Switch checked onChange={() => {}} label="開的開關" />
        <span data-testid="ref" style={{ color: 'var(--ll-selected)' }} />
      </I18nProvider>,
    );
    expect(getComputedStyle(document.querySelector('.ll-switch__knob')!).backgroundColor).toBe(css('ref'));
    await screen.unmount();
  });

  it('Switch 停用：中性灰底、1.5px 虛線外框、圓鈕 text-4（和停用按鈕同一種語言）', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Switch checked={false} disabled onChange={() => {}} label="停用的開關" />
        <span data-testid="ref-bg" style={{ color: 'var(--ll-btn-disabled-bg)' }} />
        <span data-testid="ref-knob" style={{ color: 'var(--ll-text-4)' }} />
      </I18nProvider>,
    );
    const knob = document.querySelector('.ll-switch__knob')!;
    expect(getComputedStyle(knob).outlineStyle).toBe('dashed');
    // 1.5px（WebKit 在 1 倍螢幕上把框線寬度對齊到整數像素，量到 1px）
    expect(parseFloat(getComputedStyle(knob).outlineWidth)).toBeGreaterThanOrEqual(1);
    expect(getComputedStyle(knob).backgroundColor).toBe(css('ref-bg'));
    expect(getComputedStyle(knob, '::after').backgroundColor).toBe(css('ref-knob'));
    expect(getComputedStyle(document.querySelector('.ll-switch')!).cursor).toBe('not-allowed');
    await screen.unmount();
  });

  it('Banner（淺色）：內文是主要文字色、body-sm（頁面放進來的 <p> 也是）；標題與圖示是 kind 的墨色', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Banner kind="info" title="有新版本可以使用" data-testid="b">
          <p style={{ fontSize: '17px' }}>你的進度已經存好。</p>
        </Banner>
        <span data-testid="ref-text" style={{ color: 'var(--ll-text)' }} />
        <span data-testid="ref-info" style={{ color: 'var(--ll-info-ink)' }} />
      </I18nProvider>,
    );
    const b = page.getByTestId('b').element();
    expect(getComputedStyle(b.querySelector('.ll-banner__body')!).color).toBe(css('ref-text'));
    expect(getComputedStyle(b.querySelector('.ll-banner__body p')!).color).toBe(css('ref-text'));
    expect(getComputedStyle(b.querySelector('.ll-banner__title')!).color).toBe(css('ref-info'));
    expect(getComputedStyle(b.querySelector('.ll-banner__icon')!).color).toBe(css('ref-info'));
    expect(getComputedStyle(b.querySelector('.ll-banner__body')!).fontSize).toBe('15px');
    await screen.unmount();
  });

  it.each(['violet', 'berry', 'wine'] as const)('Banner 與 HintBar（深色 %s info）：底是外框色 12% 混進卡片色（不是青色的冷灰板）', async (flavor) => {
    setTheme(flavor);
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <Banner kind="info" title="有新版本可以使用" data-testid="b">
          你的進度已經存好。
        </Banner>
        <Banner kind="warning" title="無法儲存" data-testid="w">
          先匯出。
        </Banner>
        <HintBar detailsHref="/me/backup/" detailsLabel="詳細" onClose={() => {}} data-testid="h">
          記得備份進度
        </HintBar>
        <span data-testid="ref" style={{ backgroundColor: 'color-mix(in oklab, var(--ll-border-strong) 12%, var(--ll-surface))' }} />
        <span data-testid="ref-w" style={{ backgroundColor: 'color-mix(in oklab, var(--ll-warning-ink) 8%, var(--ll-surface))' }} />
      </I18nProvider>,
    );
    expect(css('b', 'backgroundColor')).toBe(css('ref', 'backgroundColor'));
    expect(css('w', 'backgroundColor')).toBe(css('ref-w', 'backgroundColor'));
    expect(getComputedStyle(document.querySelector('.ll-hintbar')!).backgroundColor).toBe(css('ref', 'backgroundColor'));
    await screen.unmount();
  });

  it('EmptyState：標題是 h1、直接放在 main 裡時，1024 以上畫成最寬 480px 的卡片（鈴 120px）；不是 h1 的維持原樣', async () => {
    await page.viewport(1280, 900);
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <main>
          <EmptyState title="找不到這一頁" titleAs="h1" data-testid="page" />
        </main>
        <main>
          <ErrorState title="地圖載入失敗" data-testid="inline" onRetry={() => {}} />
        </main>
      </I18nProvider>,
    );
    const card = page.getByTestId('page').element() as HTMLElement;
    const inline = page.getByTestId('inline').element() as HTMLElement;
    expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(480);
    expect(getComputedStyle(card).boxShadow).not.toBe('none');
    expect(card.querySelector('.ll-state__art svg')!.getBoundingClientRect().width).toBe(120);
    expect(getComputedStyle(inline).boxShadow).toBe('none');
    expect(inline.querySelector('.ll-state__art svg')!.getBoundingClientRect().width).toBe(96);
    await screen.unmount();
    await page.viewport(414, 896);
  });
});
