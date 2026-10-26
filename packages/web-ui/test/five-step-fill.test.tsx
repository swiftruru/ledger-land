// 五步驟勾稽填格：每格是 inputmode=decimal 的數字框、標籤含勾稽點與哪一邊；判分後燈號有文字並以 aria-describedby 連到輸入框
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { FiveStepFill, isFiveStepComplete, loadWebUiMessages, type FiveStepCell, type FiveStepCellResult } from '../src/index.ts';

const CELLS: FiveStepCell[] = [
  { id: 'cf_pretax_income', label: '勾稽點②，現金流量表的稅前淨利' },
  { id: 'bs_cash', label: '勾稽點③，資產負債表的現金' },
];

function Demo({ results }: { results?: Record<string, FiveStepCellResult> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  return (
    <I18nProvider i18n={i18n}>
      <h2 id="p">填入兩格</h2>
      <FiveStepFill
        cells={CELLS}
        values={values}
        onChange={(id, raw) => setValues((v) => ({ ...v, [id]: raw }))}
        checked={checked}
        {...(results === undefined ? {} : { results })}
        labelledBy="p"
      />
      <button type="button" disabled={!isFiveStepComplete(CELLS, values)} onClick={() => setChecked(true)}>
        確認答案
      </button>
    </I18nProvider>
  );
}

describe('FiveStepFill', () => {
  it('每格一個數字框（inputmode=decimal），旁邊有「±」；全部填了才能確認', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    await expect.element(page.getByRole('group', { name: '填入兩格' })).toBeInTheDocument();
    const first = page.getByRole('textbox', { name: '勾稽點②，現金流量表的稅前淨利' });
    const second = page.getByRole('textbox', { name: '勾稽點③，資產負債表的現金' });
    expect(first.element().getAttribute('inputmode')).toBe('decimal');
    expect(document.querySelectorAll('button[aria-label="切換正負號"]').length).toBe(2);
    const submit = page.getByRole('button', { name: '確認答案' });
    await expect.element(submit).toBeDisabled();
    await userEvent.fill(first, '48,000');
    await expect.element(page.getByText(/系統讀到：.*48,000/)).toBeInTheDocument();
    await expect.element(submit).toBeDisabled();
    await userEvent.fill(second, '120000');
    await expect.element(submit).toBeEnabled();
    screen.unmount();
  });
  it('判分後逐格燈號以文字播報（相符、差額），並以 aria-describedby 連到輸入框', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <Demo
        results={{
          cf_pretax_income: { correct: true },
          bs_cash: { correct: false, difference: '12,000', expected: '132,000' },
        }}
      />,
    );
    await userEvent.fill(page.getByRole('textbox', { name: '勾稽點②，現金流量表的稅前淨利' }), '48000');
    await userEvent.fill(page.getByRole('textbox', { name: '勾稽點③，資產負債表的現金' }), '120000');
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('相符，差額 0')).toBeInTheDocument();
    await expect.element(page.getByText('差 12,000，正解是 132,000')).toBeInTheDocument();
    const second = page.getByRole('textbox', { name: '勾稽點③，資產負債表的現金' });
    await expect.element(second).toBeDisabled();
    const described = second.element().getAttribute('aria-describedby') ?? '';
    const ids = described.split(' ');
    expect(ids.some((id) => document.getElementById(id)?.textContent?.includes('差 12,000'))).toBe(true);
    expect(document.querySelectorAll('.ll-fivestep__cell.is-ok').length).toBe(1);
    expect(document.querySelectorAll('.ll-fivestep__cell.is-off').length).toBe(1);
    screen.unmount();
  });
  it('英文 catalog 的燈號文字', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo results={{ cf_pretax_income: { correct: true }, bs_cash: { correct: false } }} />);
    await userEvent.fill(page.getByRole('textbox', { name: '勾稽點②，現金流量表的稅前淨利' }), '1');
    await userEvent.fill(page.getByRole('textbox', { name: '勾稽點③，資產負債表的現金' }), '2');
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('Matches, difference 0')).toBeInTheDocument();
    await expect.element(page.getByText('Not filled yet')).toBeInTheDocument();
    screen.unmount();
  });
});
