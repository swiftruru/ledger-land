// 數字輸入：inputmode、「±」切換正負號且游標不動、N/A 切換停用輸入並說明、「系統讀到」預覽與錯誤提示
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import type { NumericUnit } from '@ledgerland/i18n';
import { NumberInput, loadWebUiMessages } from '../src/index.ts';

function Demo({ unit = 'plain', allowNa = true }: { unit?: NumericUnit; allowNa?: boolean }) {
  const [v, setV] = useState('');
  const [na, setNa] = useState(false);
  return (
    <I18nProvider i18n={i18n}>
      <NumberInput label="流動比率" value={v} onChange={setV} unit={unit} suffix="%" allowNa={allowNa} na={na} onNaChange={setNa} />
      <output data-testid="raw">{v}</output>
    </I18nProvider>
  );
}

describe('NumberInput', () => {
  it('是 text 加 inputmode=decimal、字級至少 16px；「±」在開頭加減負號並保留游標位置', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo unit="percent" />);
    const input = page.getByRole('textbox', { name: '流動比率' });
    expect(input.element().getAttribute('inputmode')).toBe('decimal');
    expect(input.element().getAttribute('type')).toBe('text');
    expect(parseFloat(getComputedStyle(input.element()).fontSize)).toBeGreaterThanOrEqual(16);
    await userEvent.fill(input, '12.5');
    await expect.element(page.getByText('系統讀到：12.50%')).toBeInTheDocument();
    const el = input.element() as HTMLInputElement;
    el.setSelectionRange(2, 2);
    await page.getByRole('button', { name: '切換正負號' }).click();
    await expect.element(page.getByTestId('raw')).toHaveTextContent('-12.5');
    expect(el.selectionStart).toBe(3);
    await page.getByRole('button', { name: '切換正負號' }).click();
    await expect.element(page.getByTestId('raw')).toHaveTextContent('12.5');
    expect(el.selectionStart).toBe(2);
    screen.unmount();
  });
  it('N/A 是 aria-pressed 的切換按鈕，按下時輸入框停用並以 aria-describedby 說明；再按一次取消', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo />);
    const na = page.getByRole('button', { name: 'N/A, the denominator does not exist' });
    await expect.element(na).toHaveAttribute('aria-pressed', 'false');
    await na.click();
    await expect.element(na).toHaveAttribute('aria-pressed', 'true');
    const input = page.getByRole('textbox', { name: '流動比率' });
    await expect.element(input).toBeDisabled();
    const desc = document.getElementById(input.element().getAttribute('aria-describedby')!.split(' ')[0]!);
    expect(desc?.textContent).toContain('N/A is selected');
    await na.click();
    await expect.element(input).toBeEnabled();
    screen.unmount();
  });
  it('括號負數與亂打的文字顯示提示並標 aria-invalid', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo allowNa={false} />);
    const input = page.getByRole('textbox', { name: '流動比率' });
    await userEvent.fill(input, '(1,234)');
    await expect.element(page.getByText('負數請用 - 號或 ± 按鈕')).toBeInTheDocument();
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.fill(input, '１，２３４');
    await expect.element(page.getByText('系統讀到：1,234')).toBeInTheDocument();
    expect(input.element().hasAttribute('aria-invalid')).toBe(false);
    screen.unmount();
  });
});
