// web-ui 的元件測試（Browser Mode，WebKit）：同時驗證 macroTransform 在 workspace 套件原始碼上正常（14 第 5.3 節）
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { ChoiceGroup, FeedbackPanel, Segmented, loadWebUiMessages, type ChoiceHint } from '../src/index.ts';

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

const OPTIONS = [
  { id: 'o_1', text: '甲', feedback: '甲的說明' },
  { id: 'o_2', text: '乙', feedback: '乙的說明' },
  { id: 'o_3', text: '丙', feedback: '丙的說明' },
];

function Multi({ hint }: { hint: ChoiceHint }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [single, setSingle] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const multiple = hint === 'all_correct';
  return (
    <I18nProvider i18n={i18n}>
      <ChoiceGroup
        name="m"
        prompt="哪些說得通？"
        mode={multiple ? 'multiple' : 'single'}
        hint={hint}
        options={OPTIONS}
        correctOptionIds={['o_1', 'o_2']}
        selected={multiple ? selected : single}
        checked={checked}
        onSelect={(id) => (multiple ? setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) : setSingle(id))}
        onCheck={() => setChecked(true)}
      />
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
  it('單選：方向鍵在選項間移動並選取，Enter 送出；作答後狀態有文字並連到選項', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const first = page.getByRole('radio', { name: '咖啡機' });
    await first.click();
    // WebKit 點選後不會把焦點放到 radio 上，鍵盤使用者是 Tab 進群組，這裡直接聚焦
    (first.element() as HTMLInputElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('radio', { name: '還沒還的借款' })).toBeChecked();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(first).toBeChecked();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByText('正確答案，你選了')).toBeInTheDocument();
    await expect.element(page.getByText('不是正確答案')).toBeInTheDocument();
    const described = first.element().getAttribute('aria-describedby');
    expect(described).toBe('q-fb-o_a');
    expect(document.getElementById('q-fb-o_a')?.textContent).toContain('會持續帶來好處。');
    expect(first.element()).toBeDisabled();
    screen.unmount();
  });
  it('any_correct：legend 是固定提示、選項是 radio、沒選的正解標成「也是合理答案」', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Multi hint="any_correct" />);
    const group = page.getByRole('group');
    await expect.element(group).toHaveAccessibleName(/這題有不只一個合理答案，選出任一個即可。/);
    expect(document.querySelectorAll('input[type=radio]').length).toBe(3);
    await page.getByRole('radio', { name: '甲' }).click();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect.element(page.getByText('正確答案，你選了')).toBeInTheDocument();
    await expect.element(page.getByText('也是合理答案')).toBeInTheDocument();
    await expect.element(page.getByText('不是正確答案')).toBeInTheDocument();
    screen.unmount();
  });
  it('all_correct：checkbox 群組，Tab 逐一移動、Space 勾選；一個都沒選時按鈕停用；漏選標「正確答案，你沒有選」', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(<Multi hint="all_correct" />);
    await expect.element(page.getByRole('group')).toHaveAccessibleName(/Select all the correct answers\. You can choose more than one\./);
    expect(document.querySelectorAll('input[type=checkbox]').length).toBe(3);
    const submit = page.getByRole('button', { name: 'Check answer' });
    await expect.element(submit).toBeDisabled();
    const first = page.getByRole('checkbox', { name: '甲' });
    (first.element() as HTMLInputElement).focus();
    await userEvent.keyboard(' ');
    await expect.element(first).toBeChecked();
    // WebKit 預設 Tab 會略過核取方塊（Safari 的「按 Tab 鍵標示每個項目」關閉時的行為），所以改以直接聚焦模擬 Tab 到第三個
    (page.getByRole('checkbox', { name: '丙' }).element() as HTMLInputElement).focus();
    await userEvent.keyboard(' ');
    await expect.element(page.getByRole('checkbox', { name: '丙' })).toBeChecked();
    await expect.element(submit).toBeEnabled();
    await submit.click();
    await expect.element(page.getByText('Correct answer, selected')).toBeInTheDocument();
    await expect.element(page.getByText('Correct answer, not selected')).toBeInTheDocument();
    await expect.element(page.getByText('Not a correct answer, but selected')).toBeInTheDocument();
    expect(page.getByRole('checkbox', { name: '乙' }).element().getAttribute('aria-describedby')).toBe('m-fb-o_2');
    screen.unmount();
  });
  it('statuses 給了就蓋過由正解推導的狀態（quiz 的判分結果）', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <ChoiceGroup
          name="s"
          prompt="題幹"
          options={OPTIONS}
          selected="o_3"
          checked
          statuses={{ o_3: 'correct_selected', o_1: 'wrong_not_selected', o_2: 'wrong_not_selected' }}
          onSelect={() => {}}
        />
      </I18nProvider>,
    );
    await expect.element(page.getByText('正確答案，你選了')).toBeInTheDocument();
    expect(document.querySelectorAll('.is-wrong-not-selected').length).toBe(2);
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
    // 焦點跟著新選的項目（finding foundation-1），再按一次右鍵繞回「中」
    expect(document.activeElement).toBe(page.getByRole('radio', { name: 'EN' }).element());
    await page
      .getByRole('radio', { name: 'EN' })
      .element()
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await expect.element(page.getByRole('radio', { name: '中' })).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(page.getByRole('radio', { name: '中' }).element());
    screen.unmount();
  });
});
