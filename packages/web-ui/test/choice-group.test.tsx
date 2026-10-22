// web-ui 的元件測試（Browser Mode，WebKit）：同時驗證 macroTransform 在 workspace 套件原始碼上正常（14 第 5.3 節）
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { ChoiceGroup, FeedbackPanel, Segmented, loadWebUiMessages } from '../src/index.ts';

function Demo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  return (
    <I18nProvider i18n={i18n}>
      <ChoiceGroup
        name="q"
        prompt="哪一項是資產？"
        options={[
          { id: 'o_a', text: '咖啡機', feedback: '會持續帶來好處。' },
          { id: 'o_b', text: '還沒還的借款' },
        ]}
        correctOptionId="o_a"
        selected={selected}
        checked={checked}
        onSelect={setSelected}
        onCheck={() => setChecked(true)}
      />
      {checked && <FeedbackPanel correct={selected === 'o_a'} />}
    </I18nProvider>
  );
}

describe('ChoiceGroup', () => {
  it('英文 catalog 下按鈕是 Check answer，作答後狀態文字正確', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Demo />);
    await expect.element(page.getByRole('button', { name: 'Check answer' })).toBeDisabled();
    await page.getByRole('radio', { name: '咖啡機' }).click();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect.element(page.getByText('Correct answer, selected')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: /Correct!/ })).toBeInTheDocument();
    expect(document.activeElement?.tagName).toBe('H2');
    screen.unmount();
  });
  it('中文 catalog 下是確認答案', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    await expect.element(page.getByRole('button', { name: '確認答案' })).toBeInTheDocument();
    screen.unmount();
  });
});

describe('Segmented', () => {
  it('是 radiogroup，方向鍵可以切換', async () => {
    function S() {
      const [v, setV] = useState('a');
      return (
        <Segmented
          value={v}
          label="語言"
          options={[
            { value: 'a', label: '中' },
            { value: 'b', label: 'EN' },
          ]}
          onChange={setV}
        />
      );
    }
    const screen = await render(<S />);
    await expect.element(page.getByRole('radiogroup', { name: '語言' })).toBeInTheDocument();
    const first = page.getByRole('radio', { name: '中' });
    await first.click();
    await page
      .getByRole('radio', { name: '中' })
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await expect.element(page.getByRole('radio', { name: 'EN' })).toHaveAttribute('aria-checked', 'true');
    screen.unmount();
  });
});
