// 回饋面板：焦點移到標題、段落順序、逐選項收合、取捨題中性標題、錯題本狀態；題目外框的進度與按鈕
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackPanel, QuestionCard, TermChip, TrueFalse, loadWebUiMessages } from '../src/index.ts';

describe('FeedbackPanel', () => {
  it('顯示時焦點移到標題（tabindex=-1），段落依序出現，其他選項收在 details 裡', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const onNext = vi.fn<() => void>();
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <FeedbackPanel
          outcome="wrong"
          summary="你選對了其中兩個，還有一個正確答案沒選到。"
          answer={<p>你的答案：甲</p>}
          explanation={<p>解說內容</p>}
          options={[
            { id: 'o_1', text: '甲', feedback: '甲的說明', chosen: true },
            { id: 'o_2', text: '乙', feedback: '乙的說明', chosen: false },
          ]}
          terms={<TermChip label="營業毛利" />}
          mistakeState="added"
          onNext={onNext}
        />
      </I18nProvider>,
    );
    const title = page.getByRole('heading', { name: /再想想/ });
    await expect.element(title).toBeInTheDocument();
    expect(document.activeElement).toBe(title.element());
    expect(title.element().getAttribute('tabindex')).toBe('-1');
    expect(document.querySelector('[aria-live]')).toBeNull();
    const text = document.querySelector('.ll-feedback')!.textContent!;
    expect(text.indexOf('你選對了')).toBeLessThan(text.indexOf('你的答案與正解'));
    expect(text.indexOf('你的答案與正解')).toBeLessThan(text.indexOf('解說'));
    expect(text.indexOf('解說內容')).toBeLessThan(text.indexOf('甲的說明'));
    expect(text.indexOf('已放進錯題本')).toBeLessThan(text.indexOf('下一題'));
    const details = document.querySelector('details.ll-feedback__others') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('乙的說明');
    await expect.element(page.getByRole('button', { name: '名詞卡：營業毛利' })).toBeInTheDocument();
    await page.getByRole('button', { name: '下一題' }).click();
    expect(onNext).toHaveBeenCalledOnce();
    screen.unmount();
  });
  it('multi_choice 全部展開並加註；取捨題用中性標題；答對時有「我是猜的」按鈕', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const add = vi.fn<() => void>();
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <FeedbackPanel
          outcome="correct"
          multi="any_correct"
          expandAllOptions
          options={[
            { id: 'o_1', text: '甲', feedback: '甲的說明', chosen: true },
            { id: 'o_2', text: '乙', feedback: '乙的說明', chosen: false },
          ]}
          mistakeState="can_add"
          onAddMistake={add}
          focusOnMount={false}
        />
        <FeedbackPanel outcome="neutral" focusOnMount={false} />
      </I18nProvider>,
    );
    await expect.element(page.getByText('The other reasonable answers are marked as well.')).toBeInTheDocument();
    expect(document.querySelector('details')).toBeNull();
    expect(document.querySelectorAll('.ll-feedback__option').length).toBe(2);
    await page.getByRole('button', { name: 'I guessed, add it to my review list' }).click();
    expect(add).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('heading', { name: 'Points of view' })).toBeInTheDocument();
    screen.unmount();
  });
});

describe('QuestionCard 與 TrueFalse', () => {
  function Demo() {
    const [v, setV] = useState<boolean | null>(null);
    const [checked, setChecked] = useState(false);
    return (
      <I18nProvider i18n={i18n}>
        <QuestionCard
          index={3}
          total={6}
          prompt="判斷下面的敘述"
          checked={checked}
          canSubmit={v !== null}
          onSubmit={() => setChecked(true)}
          feedback={<FeedbackPanel correct={v === false} />}
        >
          <TrueFalse
            name="tf"
            statement="應付帳款是資產。"
            value={v}
            checked={checked}
            correct={false}
            onChange={setV}
            feedback="應付帳款是還沒付的錢，是負債。"
          />
        </QuestionCard>
      </I18nProvider>
    );
  }
  it('進度文字、radiogroup 以完整敘述命名、沒有作答時按鈕停用、作答後回饋出現', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    await expect.element(page.getByText('第 3 題，共 6 題')).toBeInTheDocument();
    await expect.element(page.getByRole('radiogroup', { name: '應付帳款是資產。' })).toBeInTheDocument();
    const submit = page.getByRole('button', { name: '確認答案' });
    await expect.element(submit).toBeDisabled();
    await page.getByRole('radio', { name: '對' }).click();
    await expect.element(submit).toBeEnabled();
    await submit.click();
    await expect.element(page.getByRole('heading', { name: /再想想/ })).toBeInTheDocument();
    await expect.element(page.getByText('不是正確答案，你選了')).toBeInTheDocument();
    await expect.element(page.getByText('正確答案，你沒有選')).toBeInTheDocument();
    expect(document.querySelector('button[type=submit]')).toBeNull();
    screen.unmount();
  });
});
