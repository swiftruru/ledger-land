// 指標計算題：數字框加單位、N/A 切換（aria-pressed，按下時停用並說明）、「看公式」是原生 details；指標小表格是有欄列表頭的 table
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it, vi } from 'vitest';
import { RatioNumeric, RatioTable, loadWebUiMessages, type RatioNumericResult } from '../src/index.ts';

function Demo({ result, onShowFormula }: { result?: RatioNumericResult; onShowFormula?: () => void }) {
  const [raw, setRaw] = useState('');
  const [na, setNa] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <I18nProvider i18n={i18n}>
      <RatioNumeric
        label="負債比率"
        unit="percent"
        suffix="%"
        value={raw}
        onChange={setRaw}
        na={na}
        onNaChange={setNa}
        checked={checked}
        {...(result === undefined ? {} : { result })}
        formula={{ text: '負債總額 ÷ 資產總計', versionLabel: '本題採 Excel 口徑', note: '以期末餘額計算' }}
        {...(onShowFormula === undefined ? {} : { onShowFormula })}
      />
      <button type="button" disabled={!na && raw.trim() === ''} onClick={() => setChecked(true)}>
        確認答案
      </button>
    </I18nProvider>
  );
}

describe('RatioNumeric', () => {
  it('數字框有單位後綴與「±」；N/A 是 aria-pressed 的切換，按下時數字框停用並說明原因', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const input = page.getByRole('textbox', { name: '負債比率' });
    expect(input.element().getAttribute('inputmode')).toBe('decimal');
    await expect.element(page.getByText('%')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: '切換正負號' })).toBeInTheDocument();
    const submit = page.getByRole('button', { name: '確認答案' });
    await expect.element(submit).toBeDisabled();
    const na = page.getByRole('button', { name: 'N/A，分母不存在' });
    await expect.element(na).toHaveAttribute('aria-pressed', 'false');
    (na.element() as HTMLButtonElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(na).toHaveAttribute('aria-pressed', 'true');
    await expect.element(input).toBeDisabled();
    await expect.element(page.getByText(/已選 N\/A/)).toBeInTheDocument();
    await expect.element(submit).toBeEnabled();
    screen.unmount();
  });
  it('「看公式」是可展開的 details，展開時呼叫 onShowFormula；判分後顯示正解文字', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const shown = vi.fn<() => void>();
    const screen = await render(<Demo result={{ correct: false, expected: '25.00%' }} onShowFormula={shown} />);
    const details = document.querySelector<HTMLDetailsElement>('details.ll-ratio-numeric__formula')!;
    expect(details.open).toBe(false);
    await page.getByText('看公式').click();
    await expect.element(page.getByText('負債總額 ÷ 資產總計')).toBeVisible();
    await expect.element(page.getByText('本題採 Excel 口徑')).toBeVisible();
    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    await userEvent.fill(page.getByRole('textbox', { name: '負債比率' }), '30');
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('不對，正解是 25.00%')).toBeInTheDocument();
    await expect.element(page.getByRole('textbox', { name: '負債比率' })).toBeDisabled();
    screen.unmount();
  });
});

describe('RatioTable', () => {
  it('是真正的 table：有 caption、欄表頭與列表頭；N/A 與 0 以文字說明', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <RatioTable
          caption="Ratios for this question"
          rows={[
            { id: 'a', label: 'Debt ratio', value: '25.00%', status: 'ok', note: 'Excel version' },
            { id: 'b', label: 'Current ratio', status: 'na' },
            { id: 'c', label: 'ROA', value: '0.00%', status: 'zero' },
          ]}
        />
      </I18nProvider>,
    );
    const table = page.getByRole('table', { name: 'Ratios for this question' });
    await expect.element(table).toBeInTheDocument();
    expect(document.querySelectorAll('th[scope="col"]').length).toBe(3);
    expect(document.querySelectorAll('th[scope="row"]').length).toBe(3);
    await expect.element(page.getByRole('cell', { name: 'N/A (the denominator does not exist)' })).toBeInTheDocument();
    await expect.element(page.getByRole('cell', { name: '0.00%' })).toBeInTheDocument();
    await expect.element(page.getByRole('cell', { name: 'Excel version' })).toBeInTheDocument();
    screen.unmount();
  });
});
