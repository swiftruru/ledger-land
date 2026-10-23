// 分類題：點選與鍵盤流程、aria-live 播報、回饋文字（03 第 2.5 節、07 第 8.1 節）
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { ClassifyBoard, isClassifyComplete, loadWebUiMessages, type ClassifyResult } from '../src/index.ts';

const CARDS = [
  { id: 'it_1', label: '應收帳款', text: '應收帳款' },
  { id: 'it_2', label: '應付帳款', text: '應付帳款' },
];
const CATS = [
  { id: 'asset', label: '資產' },
  { id: 'liability', label: '負債' },
];

function Demo({ checked = false, results }: { checked?: boolean; results?: Record<string, ClassifyResult> }) {
  const [placement, setPlacement] = useState<Record<string, string | undefined>>(checked ? { it_1: 'asset', it_2: 'asset' } : {});
  return (
    <I18nProvider i18n={i18n}>
      <ClassifyBoard
        cards={CARDS}
        categories={CATS}
        placement={placement}
        onPlace={(c, cat) => setPlacement((p) => ({ ...p, [c]: cat ?? undefined }))}
        checked={checked}
        results={results}
      />
      <output data-testid="complete">{String(isClassifyComplete(CARDS, placement))}</output>
    </I18nProvider>
  );
}

const live = () => document.querySelector('[aria-live="polite"]')?.textContent;

describe('ClassifyBoard', () => {
  it('點選流程：拿起、放入、拿回，aria-live 播報對應文字', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    await expect.element(page.getByTestId('complete')).toHaveTextContent('false');
    const card = page.getByRole('button', { name: /^應收帳款/ });
    await card.click();
    await expect.element(card).toHaveAttribute('aria-pressed', 'true');
    expect(live()).toBe('已拿起：應收帳款');
    await page.getByRole('button', { name: '把「應收帳款」放入資產' }).click();
    expect(live()).toBe('應收帳款放入資產，第 1 張，共 2 張');
    const placed = page.getByRole('button', { name: /^應收帳款/ });
    await expect.element(placed).toHaveAccessibleName(/再按一次拿回/);
    expect(document.activeElement).toBe(placed.element());
    await placed.click();
    expect(live()).toBe('已拿回：應收帳款');
    await expect.element(page.getByRole('button', { name: '先拿起一張卡片' }).first()).toBeDisabled();
    screen.unmount();
  });
  it('鍵盤流程：Space 拿起、方向鍵選格、Enter 放入；Esc 取消；全部放好後 isClassifyComplete 為 true', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const card = page.getByRole('button', { name: /^應收帳款/ });
    (card.element() as HTMLButtonElement).focus();
    await userEvent.keyboard(' ');
    await expect.element(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Escape}');
    await expect.element(card).toHaveAttribute('aria-pressed', 'false');
    expect(live()).toBe('已放下：應收帳款');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(live()).toBe('先用方向鍵選一個分類格，再按 Enter 放入');
    await userEvent.keyboard('{ArrowRight}');
    expect(live()).toBe('放置目標：資產');
    await userEvent.keyboard('{ArrowRight}');
    expect(live()).toBe('放置目標：負債');
    expect(document.querySelectorAll('.ll-classify__zone.is-target').length).toBe(1);
    await userEvent.keyboard('{Enter}');
    expect(live()).toBe('應收帳款放入負債，第 1 張，共 2 張');
    const second = page.getByRole('button', { name: /^應付帳款/ });
    (second.element() as HTMLButtonElement).focus();
    await userEvent.keyboard('{Enter}{ArrowLeft}{Enter}');
    expect(live()).toBe('應付帳款放入負債，第 2 張，共 2 張');
    await expect.element(page.getByTestId('complete')).toHaveTextContent('true');
    await expect.element(page.getByText('全部放好了，可以按「確認分類」。')).toBeInTheDocument();
    screen.unmount();
  });
  it('回饋：每張卡片有「放對了」或「放錯了」加「應該放在：負債」（英文 catalog）', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo checked results={{ it_1: { correct: true }, it_2: { correct: false, expectedCategoryId: 'liability' } }} />);
    await expect.element(page.getByText('Placed correctly')).toBeInTheDocument();
    await expect.element(page.getByText('Should go in: 負債')).toBeInTheDocument();
    const wrong = page.getByRole('button', { name: '應付帳款' });
    expect(wrong.element()).toBeDisabled();
    expect(document.getElementById(wrong.element().getAttribute('aria-describedby')!)?.textContent).toContain('Placed in the wrong category');
    screen.unmount();
  });
});
