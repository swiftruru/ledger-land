// TermSheet 關閉後焦點回到開啟它的 chip（07 第 8.1 節，quiz-10、quiz-18）：作答頁的名詞卡在關閉時整個卸載（terms.tsx 只在打開時渲染），
// 卸載本身也要把對話框關掉並把焦點還給 chip；Esc、右上角的關閉都一樣
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useRef, useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { TermChip, TermSheet, loadWebUiMessages } from '../src/index.ts';

function Demo() {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  return (
    <I18nProvider i18n={i18n}>
      <button type="button">前面的按鈕</button>
      <TermChip ref={chipRef} label="資產" onClick={() => setOpen(true)} />
      {open && (
        <TermSheet
          open
          onClose={() => setOpen(false)}
          returnFocusTo={chipRef}
          term={{ label: '資產', teacherLabel: '資產', currentTwLabel: null, ifrsEnglish: 'Assets', definition: '店裡擁有的東西' }}
        />
      )}
    </I18nProvider>
  );
}

describe('TermSheet（關閉時卸載）', () => {
  it('鍵盤開啟、Esc 關閉：焦點回到 chip', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const chip = page.getByRole('button', { name: '名詞卡：資產' });
    (chip.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('dialog', { name: '資產' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(chip).toHaveFocus();
    screen.unmount();
  });

  it('點開後按右上角的「關閉」：焦點回到 chip，不掉到 body', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const chip = page.getByRole('button', { name: '名詞卡：資產' });
    await chip.click();
    const dialog = page.getByRole('dialog', { name: '資產' });
    await expect.element(dialog).toBeInTheDocument();
    await dialog.getByRole('button', { name: '關閉' }).first().click();
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(chip).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    screen.unmount();
  });
});

describe('TermSheet 的固定結構（站規 1.10、1.20、2.4.3）', () => {
  it('初始焦點在標題；只有右上角一顆「關閉」；類別 Badge；教材與現行用語相同時合併；有 fullHref 才有「在圖鑑看完整說明」', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const term = {
      label: '資產',
      secondaryLabel: 'Assets',
      secondaryLang: 'en',
      category: 'account' as const,
      categoryLabel: '科目',
      teacherLabel: '資產',
      currentTwLabel: '資產',
      ifrsEnglish: 'Assets',
      definition: '店裡擁有的東西',
      related: <TermChip label="負債" />,
    };
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <TermSheet open onClose={() => {}} term={term} />
      </I18nProvider>,
    );
    const dialog = page.getByRole('dialog', { name: '資產' });
    await expect.element(dialog).toBeInTheDocument();
    expect(document.activeElement?.classList.contains('ll-sheet__title')).toBe(true);
    expect(dialog.getByRole('button', { name: '關閉' }).elements()).toHaveLength(1);
    await expect.element(dialog.getByText('科目')).toBeInTheDocument();
    await expect.element(dialog.getByText('教材用語與現行用語')).toBeInTheDocument();
    expect(dialog.getByText('現行用語', { exact: true }).elements()).toHaveLength(0);
    expect(dialog.getByRole('link').elements()).toHaveLength(0);
    await expect.element(dialog.getByRole('button', { name: '名詞卡：負債' })).toBeInTheDocument();
    screen.rerender(
      <I18nProvider i18n={i18n}>
        <TermSheet open onClose={() => {}} term={{ ...term, currentTwLabel: '資產（現行）' }} fullHref="/terms/tm_x/" />
      </I18nProvider>,
    );
    await expect.element(dialog.getByRole('link', { name: '在圖鑑看完整說明' })).toHaveAttribute('href', '/terms/tm_x/');
    await expect.element(dialog.getByText('現行用語', { exact: true })).toBeInTheDocument();
    screen.unmount();
  });
});
