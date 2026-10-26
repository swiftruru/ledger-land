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
    // 「看其他選項為什麼不對」的標題對齊欄的左緣（和你選的那張說明卡同一條線），展開列連同髮絲線往左右各伸 8px（M3 驗收第 7 輪）
    const card = document.querySelector('.ll-feedback__option.is-chosen')!.getBoundingClientRect();
    const titleBox = details.querySelector('.ll-disclosure__title')!.getBoundingClientRect();
    const box = details.getBoundingClientRect();
    expect(titleBox.left).toBeCloseTo(card.left, 0);
    expect(card.left - box.left).toBeCloseTo(8, 0);
    expect(box.right - card.right).toBeCloseTo(8, 0);
    details.open = true;
    await expect.poll(() => details.querySelector('.ll-feedback__option')!.getBoundingClientRect().left).toBeCloseTo(card.left, 0);
    expect(details.querySelector('.ll-feedback__option')!.getBoundingClientRect().right).toBeCloseTo(card.right, 0);
    details.open = false;
    await expect.element(page.getByRole('button', { name: '名詞卡：營業毛利' })).toBeInTheDocument();
    await page.getByRole('button', { name: '下一題' }).click();
    expect(onNext).toHaveBeenCalledOnce();
    screen.unmount();
  });
  it('剛收進圖鑑的名詞：「相關名詞」旁的 role=status 晚一點插入「新收進 N」，新收的 chip 可讀名稱加「剛收進圖鑑」；工具列與「下一題」包在同一個動作區', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const props = {
      outcome: 'correct' as const,
      terms: (
        <>
          <TermChip label="資產" isNew />
          <TermChip label="存貨" />
        </>
      ),
      mistakeState: 'can_add' as const,
      onAddMistake: () => {},
      onNext: () => {},
    };
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <FeedbackPanel {...props} />
      </I18nProvider>,
    );
    const status = document.querySelector('.ll-feedback__terms-head [role="status"]')!;
    expect(status).not.toBeNull();
    expect(status.textContent).toBe('');
    await screen.rerender(
      <I18nProvider i18n={i18n}>
        <FeedbackPanel {...props} newTerms={1} />
      </I18nProvider>,
    );
    expect(status.isConnected).toBe(true);
    expect(status.textContent).toContain('新收進 1');
    await expect.element(page.getByRole('button', { name: '名詞卡：資產，剛收進圖鑑' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: '名詞卡：存貨' })).toBeInTheDocument();
    expect(document.querySelectorAll('.ll-chip--new > .ll-stamp')).toHaveLength(1);
    expect(document.querySelectorAll('.ll-chip--new > svg')).toHaveLength(0);
    const actions = document.querySelector('.ll-feedback__actions')!;
    expect(actions.querySelector('.ll-feedback__tools')).not.toBeNull();
    expect(actions.querySelector('.ll-feedback__next')).not.toBeNull();
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
    await page.getByRole('button', { name: 'I guessed: review it' }).click();
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
  it('題號下方的進度條：確認之前是前面幾題，確認後往前一格；確認鈕是 primary lg', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(<Demo />);
    const bar = document.querySelector('.ll-question .ll-progress') as HTMLElement;
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(bar.dataset['ratio']).toBe((2 / 6).toFixed(3));
    const submit = page.getByRole('button', { name: '確認答案' });
    expect(submit.element().className).toContain('ll-btn--primary');
    expect(submit.element().className).toContain('ll-btn--lg');
    await page.getByRole('radio', { name: '不對' }).click();
    await submit.click();
    await expect.element(page.getByRole('heading', { name: /答對了/ })).toBeInTheDocument();
    expect(bar.dataset['ratio']).toBe((3 / 6).toFixed(3));
    screen.unmount();
  });
});

describe('FeedbackPanel 的工具列（站規 2.4.1）', () => {
  it('收藏是 secondary sm 的切換按鈕：文字固定、aria-pressed 表示狀態；名詞 chip 有「相關名詞」小標；我是猜的是 secondary sm（M3 驗收第 4 輪）', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Fav() {
      const [on, setOn] = useState(false);
      return (
        <I18nProvider i18n={i18n}>
          <FeedbackPanel
            outcome="correct"
            terms={<TermChip label="存貨" />}
            mistakeState="can_add"
            onAddMistake={() => {}}
            onFavourite={() => setOn((v) => !v)}
            favourited={on}
            focusOnMount={false}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Fav />);
    const fav = page.getByRole('button', { name: '收藏', exact: true });
    await expect.element(fav).toHaveAttribute('aria-pressed', 'false');
    expect(fav.element().className).not.toContain('ll-btn--quiet');
    expect(fav.element().className).toContain('ll-btn--sm');
    await fav.click();
    await expect.element(fav).toHaveAttribute('aria-pressed', 'true');
    await expect.element(fav).toHaveTextContent('收藏');
    await expect.element(page.getByRole('heading', { name: '相關名詞' })).toBeInTheDocument();
    const guess = page.getByRole('button', { name: '我是猜的，加入錯題本' }).element();
    expect(guess.className).not.toContain('ll-btn--quiet');
    expect(guess.className).toContain('ll-btn--sm');
    screen.unmount();
  });
  it('「我是猜的」按下後換成 danger Badge「已放進錯題本」，Badge 插進常駐的 role=status（按鈕和狀態外觀不同）', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Guess() {
      const [added, setAdded] = useState(false);
      return (
        <I18nProvider i18n={i18n}>
          <FeedbackPanel
            outcome="correct"
            mistakeState={added ? 'added' : 'can_add'}
            onAddMistake={() => setAdded(true)}
            onNext={() => {}}
            focusOnMount={false}
          />
        </I18nProvider>
      );
    }
    const screen = await render(<Guess />);
    const status = document.querySelector('.ll-feedback__tools [role="status"]')!;
    expect(status).not.toBeNull();
    expect(status.textContent).toBe('');
    await page.getByRole('button', { name: '我是猜的，加入錯題本' }).click();
    expect(status.isConnected).toBe(true);
    expect(status.textContent).toBe('已放進錯題本');
    expect(status.querySelector('.ll-badge--danger')).not.toBeNull();
    expect(document.querySelector('.ll-feedback__tools button')).toBeNull();
    screen.unmount();
  });
});
