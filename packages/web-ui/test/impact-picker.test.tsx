// 交易影響題：每列是以目標命名的 radiogroup，方向鍵換選項；金額目標用 NumberInput；作答後逐目標結果
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { ImpactPicker, isImpactComplete, loadWebUiMessages, type ImpactAnswer, type ImpactResult } from '../src/index.ts';

const TARGETS = [
  { id: 't_cash', label: '現金', measure: 'direction' as const },
  { id: 't_gp', label: '營業毛利', measure: 'delta' as const },
];

function Demo({ checked = false, results }: { checked?: boolean; results?: Record<string, ImpactResult> }) {
  const [answers, setAnswers] = useState<Record<string, ImpactAnswer>>(checked ? { t_cash: { direction: 'up' }, t_gp: { raw: '100' } } : {});
  return (
    <I18nProvider i18n={i18n}>
      <ImpactPicker
        name="te"
        targets={TARGETS}
        choices={['up', 'down', 'unchanged', 'becomes_na']}
        answers={answers}
        onChange={(id, a) => setAnswers((s) => ({ ...s, [id]: a }))}
        checked={checked}
        results={results}
      />
      <output data-testid="complete">{String(isImpactComplete(TARGETS, answers))}</output>
    </I18nProvider>
  );
}

describe('ImpactPicker', () => {
  it('方向目標是以「現金的變動方向」命名的 radiogroup，按鈕名稱是文字，方向鍵換選項', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const group = page.getByRole('radiogroup', { name: '現金的變動方向' });
    await expect.element(group).toBeInTheDocument();
    expect(group.element().querySelectorAll('input[type=radio]').length).toBe(4);
    await expect.element(page.getByRole('radio', { name: '變成 N/A' })).toBeInTheDocument();
    const up = page.getByRole('radio', { name: '增加' });
    await up.click();
    await expect.element(up).toBeChecked();
    (up.element() as HTMLInputElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('radio', { name: '減少' })).toBeChecked();
    await expect.element(page.getByTestId('complete')).toHaveTextContent('false');
    await userEvent.fill(page.getByRole('textbox', { name: '營業毛利的變動金額' }), '1,200');
    await expect.element(page.getByText('系統讀到：NT$1,200')).toBeInTheDocument();
    await expect.element(page.getByTestId('complete')).toHaveTextContent('true');
    screen.unmount();
  });
  it('作答後每列顯示結果文字並以 aria-describedby 連到該列', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo checked results={{ t_cash: { correct: false, expected: 'Decrease' }, t_gp: { correct: true } }} />);
    await expect.element(page.getByText('Not right, the answer is Decrease')).toBeInTheDocument();
    await expect.element(page.getByText('Correct')).toBeInTheDocument();
    const group = page.getByRole('radiogroup', { name: 'Direction of change in 現金' });
    expect(document.getElementById(group.element().getAttribute('aria-describedby')!)?.textContent).toContain('Decrease');
    expect(page.getByRole('radio', { name: 'Increase' }).element()).toBeDisabled();
    screen.unmount();
  });
});
