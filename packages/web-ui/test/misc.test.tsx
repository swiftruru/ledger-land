// PickStatement、PickLine、TermSheet、NoteTag、Stars、Switch、Toast、TopBar、Skeleton 的語意檢查
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useRef, useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it, vi } from 'vitest';
import {
  Badge,
  EmptyState,
  ErrorState,
  NoteTag,
  PickLine,
  PickStatement,
  Skeleton,
  Stars,
  Switch,
  TermChip,
  TermSheet,
  Toast,
  TopBar,
  loadWebUiMessages,
} from '../src/index.ts';

describe('PickStatement', () => {
  it('三張卡片是 radiogroup，卡片名稱含報表名與說明', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    function Demo() {
      const [v, setV] = useState<'is' | 'bs' | 'cf' | null>(null);
      return (
        <I18nProvider i18n={i18n}>
          <h2 id="p">Which statement?</h2>
          <PickStatement
            name="ps"
            labelledBy="p"
            cards={[
              { code: 'is', description: 'Profit for the period' },
              { code: 'bs', description: 'What you own and owe' },
              { code: 'cf', description: 'Where cash came from and went' },
            ]}
            value={v}
            checked={false}
            onChange={setV}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    await expect.element(page.getByRole('radiogroup', { name: 'Which statement?' })).toBeInTheDocument();
    const bs = page.getByRole('radio', { name: 'Balance sheet What you own and owe' });
    await bs.click();
    await expect.element(bs).toBeChecked();
    screen.unmount();
  });
});

describe('PickLine', () => {
  it('是真正的 table，每列是 aria-pressed 的按鈕，方向鍵上下移動，選取後播報', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Demo() {
      const [v, setV] = useState<string | null>(null);
      return (
        <I18nProvider i18n={i18n}>
          <PickLine
            caption="損益表"
            rows={[
              { id: 'l_rev', label: '營業收入', value: '100,000' },
              { id: 'l_cogs', label: '營業成本', value: '60,000', indent: 1 },
              { id: 'l_gp', label: '營業毛利', value: '40,000', total: true },
            ]}
            selected={v}
            checked={false}
            onSelect={setV}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    expect(document.querySelector('table caption')?.textContent).toBe('損益表');
    expect(document.querySelectorAll('th[scope=row]').length).toBe(3);
    const rev = page.getByRole('button', { name: '營業收入' });
    expect(rev.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    (rev.element() as HTMLButtonElement).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(page.getByRole('button', { name: '營業毛利' }).element());
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('button', { name: '營業毛利' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('已選：營業毛利');
    screen.unmount();
  });
});

describe('TermSheet 與 NoteTag', () => {
  it('chip 可讀名稱是「名詞卡：…」；sheet 是 dialog，有標題與旗標，關閉後焦點回到 chip', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Demo() {
      const [open, setOpen] = useState(false);
      const chipRef = useRef<HTMLButtonElement>(null);
      return (
        <I18nProvider i18n={i18n}>
          <TermChip ref={chipRef} label="經常利益" onClick={() => setOpen(true)} />
          <TermSheet
            open={open}
            onClose={() => setOpen(false)}
            returnFocusTo={chipRef}
            term={{
              label: '經常利益',
              secondaryLabel: 'Ordinary profit',
              secondaryLang: 'en',
              teacherLabel: '經常利益',
              currentTwLabel: null,
              ifrsEnglish: null,
              definition: '定義文字',
              ifrsNote: 'IFRS 沒有這個小計。',
              flags: ['not_ifrs_line', 'design_note'],
            }}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const chip = page.getByRole('button', { name: '名詞卡：經常利益' });
    await chip.click();
    const dialog = page.getByRole('dialog', { name: '經常利益' });
    await expect.element(dialog).toBeInTheDocument();
    await expect.element(page.getByText('沒有對應的 IFRS 名稱')).toBeInTheDocument();
    await expect.element(page.getByText('IFRS 怎麼處理')).toBeInTheDocument();
    await expect.element(page.getByText('非 IFRS 項目')).toBeInTheDocument();
    await expect.element(page.getByText('設計說明')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip.element());
    screen.unmount();
  });
  it('NoteTag 是按鈕時有完整的可讀名稱', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <NoteTag kind="not_ifrs_line" subject="Ordinary profit" onClick={() => {}} />
        <NoteTag kind="old_name" />
      </I18nProvider>,
    );
    await expect.element(page.getByRole('button', { name: 'Not an IFRS line item: Ordinary profit. Show how IFRS treats this.' })).toBeInTheDocument();
    await expect.element(page.getByText('Former name')).toBeInTheDocument();
    screen.unmount();
  });
});

describe('小元件', () => {
  it('Stars、Switch、Toast、TopBar、Badge、EmptyState、ErrorState、Skeleton 的語意', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const back = vi.fn<() => void>();
    function Demo() {
      const [on, setOn] = useState(false);
      return (
        <I18nProvider i18n={i18n}>
          <TopBar title="設定" onBack={back} />
          <Stars value={2} />
          <Switch checked={on} onChange={setOn} label="計時" />
          <Toast onDismiss={() => {}}>已更新</Toast>
          <Badge kind="success">完成</Badge>
          <EmptyState title="錯題本是空的" action={<button type="button">去闖關</button>} />
          <ErrorState title="載入失敗" />
          <Skeleton lines={2} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    await expect.element(page.getByRole('img', { name: '3 顆星中的 2 顆' })).toBeInTheDocument();
    const sw = page.getByRole('switch', { name: '計時' });
    await expect.element(sw).toHaveAttribute('aria-checked', 'false');
    await expect.element(sw).toHaveTextContent('關');
    await sw.click();
    await expect.element(sw).toHaveAttribute('aria-checked', 'true');
    await expect.element(sw).toHaveTextContent('開');
    await expect.element(page.getByRole('status')).toHaveTextContent('已更新');
    await expect.element(page.getByRole('button', { name: '關閉提示' })).toBeInTheDocument();
    await page.getByRole('button', { name: '返回' }).click();
    expect(back).toHaveBeenCalledOnce();
    expect(document.querySelector('h1.ll-topbar__title')?.getAttribute('tabindex')).toBe('-1');
    await expect.element(page.getByRole('alert')).toHaveTextContent('載入失敗');
    await expect.element(page.getByRole('heading', { name: '錯題本是空的' })).toBeInTheDocument();
    expect(document.querySelectorAll('.ll-skeleton-lines[aria-hidden="true"] .ll-skeleton').length).toBe(2);
    screen.unmount();
  });
});
