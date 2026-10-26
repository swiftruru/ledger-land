// 分錄題的鍵盤與播報（quiz-21、quiz-25）：科目搜尋框在作答表單裡，按 Enter（iOS 鍵盤的「搜尋」）選第一個結果、不送出答案；
// 注音選字的 Enter 不選科目；連續兩次刪除同一個行號時播報區換成新的節點，第二次也會讀出
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it, vi } from 'vitest';
import { JournalEntryEditor, QuestionCard, isJournalComplete, loadWebUiMessages, type JournalLineState } from '../src/index.ts';

const ACCOUNTS = [
  { id: 'cash', label: '現金', group: 'asset', aliases: ['Cash'] },
  { id: 'inventory', label: '存貨', group: 'asset', aliases: ['Inventory'] },
  { id: 'accounts_payable', label: '應付帳款', group: 'liability', aliases: ['Accounts payable'] },
];
const GROUPS = [
  { id: 'asset', label: '資產' },
  { id: 'liability', label: '負債' },
];

function InCard({ initial, onSubmit }: { initial: JournalLineState[]; onSubmit: () => void }) {
  const [lines, setLines] = useState<readonly JournalLineState[]>(initial);
  return (
    <I18nProvider i18n={i18n}>
      <QuestionCard index={1} total={1} prompt="寫出這筆分錄" checked={false} canSubmit={isJournalComplete(lines)} onSubmit={onSubmit}>
        {({ promptId }) => <JournalEntryEditor accounts={ACCOUNTS} groups={GROUPS} lines={lines} onChange={setLines} checked={false} labelledBy={promptId} />}
      </QuestionCard>
    </I18nProvider>
  );
}

describe('JournalEntryEditor 的搜尋框', () => {
  it('已經可以送出時，在搜尋框按 Enter：選第一個結果、新增一行，不送出答案', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const onSubmit = vi.fn<() => void>();
    const screen = await render(<InCard initial={[{ key: 'a', account: 'cash', side: 'debit', raw: '5' }]} onSubmit={onSubmit} />);
    await page.getByRole('button', { name: '新增一行' }).click();
    const search = page.getByRole('searchbox', { name: '搜尋科目' });
    await userEvent.fill(search, 'inventory');
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('rowheader', { name: '第 2 行' })).toBeInTheDocument();
    await expect.element(page.getByRole('combobox', { name: '第 2 行的借或貸' })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('搜尋框是空的時按 Enter 也不送出', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const onSubmit = vi.fn<() => void>();
    const screen = await render(<InCard initial={[{ key: 'a', account: 'cash', side: 'debit', raw: '5' }]} onSubmit={onSubmit} />);
    await page.getByRole('button', { name: '新增一行' }).click();
    await expect.element(page.getByRole('searchbox', { name: '搜尋科目' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await expect.element(page.getByRole('rowheader', { name: '第 2 行' })).not.toBeInTheDocument();
    screen.unmount();
  });
});

describe('JournalEntryEditor 的播報', () => {
  it('連續兩次刪除第 2 行：播報文字相同，但每次都是新的節點（螢幕閱讀器會再讀一次）', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <InCard
        initial={[
          { key: 'a', account: 'cash', side: 'debit', raw: '5' },
          { key: 'b', account: 'inventory', side: 'debit', raw: '5' },
          { key: 'c', account: 'accounts_payable', side: 'credit', raw: '5' },
          { key: 'd', account: 'cash', side: 'credit', raw: '5' },
        ]}
        onSubmit={() => {}}
      />,
    );
    const live = () => document.querySelector('.ll-journal [aria-live]');
    await page.getByRole('button', { name: '刪除第 2 行' }).click();
    await expect.poll(() => live()?.textContent).toBe('已刪除第 2 行');
    const first = live()?.firstElementChild;
    expect(first).not.toBeNull();
    await page.getByRole('button', { name: '刪除第 2 行' }).click();
    await expect.poll(() => live()?.firstElementChild !== first).toBe(true);
    expect(live()?.textContent).toBe('已刪除第 2 行');
    screen.unmount();
  });
});
