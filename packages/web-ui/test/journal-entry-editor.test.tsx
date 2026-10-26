// 借貸分錄：「新增一行」開啟可搜尋、依要素分組的科目面板；每行是原生 select 加 NumberInput；分錄是 table；回饋逐行標出多了、金額不對與少了的行
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { JournalEntryEditor, isJournalComplete, loadWebUiMessages, type JournalEntryResult, type JournalLineState } from '../src/index.ts';

const ACCOUNTS = [
  { id: 'cash', label: '現金', group: 'asset', aliases: ['Cash', '現金及約當現金'] },
  { id: 'inventory', label: '存貨', group: 'asset', aliases: ['Inventory'] },
  { id: 'accounts_payable', label: '應付帳款', group: 'liability', aliases: ['Accounts payable'] },
  { id: 'revenue', label: '營業收入', group: 'revenue', aliases: ['Revenue'] },
];
const GROUPS = [
  { id: 'asset', label: '資產' },
  { id: 'liability', label: '負債' },
  { id: 'revenue', label: '收益' },
];

function Demo({ result, initial = [] }: { result?: JournalEntryResult; initial?: JournalLineState[] }) {
  const [lines, setLines] = useState<readonly JournalLineState[]>(initial);
  const [checked, setChecked] = useState(false);
  return (
    <I18nProvider i18n={i18n}>
      <h2 id="p">寫出這筆分錄</h2>
      <JournalEntryEditor
        accounts={ACCOUNTS}
        groups={GROUPS}
        lines={lines}
        onChange={setLines}
        checked={checked}
        {...(result === undefined ? {} : { result })}
        note="報表上的「本期進貨」不是分錄科目。"
        labelledBy="p"
      />
      <button type="button" disabled={!isJournalComplete(lines)} onClick={() => setChecked(true)}>
        確認答案
      </button>
    </I18nProvider>
  );
}

describe('JournalEntryEditor', () => {
  it('新增一行：按鈕 aria-expanded、面板可搜尋並依要素分組、選科目後焦點到該行的借或貸；表格每行有列標題', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const add = page.getByRole('button', { name: '新增一行' });
    await expect.element(add).toHaveAttribute('aria-expanded', 'false');
    await expect.element(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    (add.element() as HTMLButtonElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(add).toHaveAttribute('aria-expanded', 'true');
    const search = page.getByRole('searchbox', { name: '搜尋科目' });
    await expect.element(search).toBeInTheDocument();
    expect(document.activeElement).toBe(search.element());
    await expect.element(page.getByRole('group', { name: '資產' })).toBeInTheDocument();
    await expect.element(page.getByRole('group', { name: '負債' })).toBeInTheDocument();
    // 以英文別名搜尋
    await userEvent.fill(search, 'cash');
    await expect.element(page.getByRole('button', { name: '現金' })).toBeInTheDocument();
    expect(document.querySelectorAll('.ll-journal__option').length).toBe(1);
    await page.getByRole('button', { name: '現金' }).click();
    const side = page.getByRole('combobox', { name: '第 1 行的借或貸' });
    await expect.element(side).toBeInTheDocument();
    expect(document.activeElement).toBe(side.element());
    expect((side.element() as HTMLSelectElement).value).toBe('debit');
    await expect.element(page.getByRole('rowheader', { name: '第 1 行' })).toBeInTheDocument();
    await expect.element(page.getByText('已新增第 1 行：現金')).toBeInTheDocument();
    // 金額是 NumberInput；填了才能確認；借貸不平衡有文字
    const amount = page.getByRole('textbox', { name: '第 1 行的金額' });
    expect(amount.element().getAttribute('inputmode')).toBe('decimal');
    await userEvent.fill(amount, '120,000');
    await expect.element(page.getByText(/借貸不平衡，差 .*120,000/)).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
    // 第二行預設給貸方
    await page.getByRole('button', { name: '新增一行' }).click();
    await page.getByRole('button', { name: '營業收入' }).click();
    const side2 = page.getByRole('combobox', { name: '第 2 行的借或貸' });
    expect((side2.element() as HTMLSelectElement).value).toBe('credit');
    await userEvent.fill(page.getByRole('textbox', { name: '第 2 行的金額' }), '120000');
    await expect.element(page.getByText('借貸平衡')).toBeInTheDocument();
    // 刪除一行後焦點回到「新增一行」
    await page.getByRole('button', { name: '刪除第 2 行' }).click();
    await expect.element(page.getByText('已刪除第 2 行')).toBeInTheDocument();
    expect(document.activeElement?.textContent).toContain('新增一行');
    screen.unmount();
  });
  it('Esc 關閉面板並把焦點還給「新增一行」', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    await page.getByRole('button', { name: '新增一行' }).click();
    await expect.element(page.getByRole('searchbox', { name: '搜尋科目' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('button', { name: '新增一行' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement?.textContent).toContain('新增一行');
    screen.unmount();
  });
  it('回饋逐行標出「多了這一行」「金額不對」，並列出少了的行；判分後控制項停用', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <Demo
        initial={[
          { key: 'a', account: 'cash', side: 'debit', raw: '100000' },
          { key: 'b', account: 'inventory', side: 'credit', raw: '100000' },
        ]}
        result={{ lines: { a: 'amount', b: 'extra' }, missing: [{ side: 'credit', account: '營業收入', amount: '120,000' }] }}
      />,
    );
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('金額不對')).toBeInTheDocument();
    await expect.element(page.getByText('多了這一行')).toBeInTheDocument();
    await expect.element(page.getByText('少了這一行：貸方 營業收入 120,000')).toBeInTheDocument();
    await expect.element(page.getByRole('combobox', { name: '第 1 行的借或貸' })).toBeDisabled();
    await expect.element(page.getByRole('textbox', { name: '第 1 行的金額' })).toBeDisabled();
    const described = page.getByRole('textbox', { name: '第 1 行的金額' }).element().getAttribute('aria-describedby') ?? '';
    expect(described.split(' ').some((id) => document.getElementById(id)?.textContent?.includes('金額不對'))).toBe(true);
    expect(document.querySelector('.ll-journal__add')).toBeNull();
    await expect.element(page.getByText('報表上的「本期進貨」不是分錄科目。')).toBeInTheDocument();
    screen.unmount();
  });
  it('英文 catalog：欄表頭與狀態文字', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo initial={[{ key: 'a', account: 'cash', side: 'debit', raw: '5' }]} result={{ lines: { a: 'extra' }, missing: [] }} />);
    await expect.element(page.getByRole('columnheader', { name: 'Debit or credit' })).toBeInTheDocument();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('This line should not be here')).toBeInTheDocument();
    screen.unmount();
  });
  it('窄螢幕：每一行排成兩列的小卡（不必左右捲動），外層不變寬；科目欄不被擠成一字一行；刪除鈕與借貸下拉至少 44px、都在容器裡', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <div style={{ width: '260px' }} data-testid="narrow">
        <Demo
          initial={[
            { key: 'a', account: 'accounts_payable', side: 'debit', raw: '100000' },
            { key: 'b', account: 'cash', side: 'credit', raw: '100000' },
          ]}
        />
      </div>,
    );
    const region = page.getByRole('region', { name: '分錄表格' });
    await expect.element(region).toBeInTheDocument();
    const el = region.element() as HTMLElement;
    expect(el.tabIndex).toBe(0);
    expect(el.querySelector('table')).not.toBeNull();
    // 260px：外層窄（container query）時每一行排成兩列，region 不必水平捲動，外層容器也不被撐寬
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
    const narrow = document.querySelector('[data-testid="narrow"]') as HTMLElement;
    expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth);
    const box = narrow.getBoundingClientRect();
    const side = page.getByRole('combobox', { name: '第 1 行的借或貸' }).element().getBoundingClientRect();
    expect(side.height).toBeGreaterThanOrEqual(44);
    const amount = page.getByRole('textbox', { name: '第 1 行的金額' }).element().getBoundingClientRect();
    expect(amount.right).toBeLessThanOrEqual(box.right + 0.5);
    // 科目欄至少容得下四個字（「應付帳款」不會一字一行）
    const account = el.querySelector('.ll-journal__account > span') as HTMLElement;
    const lineHeight = parseFloat(getComputedStyle(account).lineHeight) || 24;
    expect(account.getBoundingClientRect().height).toBeLessThan(lineHeight * 1.5);
    const remove = page.getByRole('button', { name: '刪除第 1 行' }).element().getBoundingClientRect();
    expect(remove.width).toBeGreaterThanOrEqual(44);
    expect(remove.height).toBeGreaterThanOrEqual(44);
    expect(remove.right).toBeLessThanOrEqual(box.right + 0.5);
    screen.unmount();
  });
});
