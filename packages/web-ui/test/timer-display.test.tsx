// TimerDisplay（03 第 2.10 節）：倒數文字、暫停與繼續、剩一分鐘與時間到各播報一次。
// 倒數文字讀得到（不是 aria-hidden，只是不主動播報）；暫停鈕是一般的動作按鈕（文字本身就是狀態，不用 aria-pressed）；
// 時間到後按「繼續」按鈕會消失，焦點移到計時區；重新整理或提醒設定晚讀到時，剩不到一分鐘播實際剩下的秒數（quiz-22、23、24）
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState } from 'react';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { TimerDisplay, loadWebUiMessages } from '../src/index.ts';

describe('TimerDisplay', () => {
  it('顯示「剩 4 分 30 秒」，按暫停後顯示已暫停與「繼續」', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Demo() {
      const [paused, setPaused] = useState(false);
      return (
        <I18nProvider i18n={i18n}>
          <TimerDisplay remainingSeconds={270} paused={paused} onToggle={() => setPaused((p) => !p)} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const timer = page.getByTestId('timer');
    await expect.element(page.getByText('剩 4 分 30 秒')).toBeInTheDocument();
    const pause = page.getByRole('button', { name: '暫停' });
    await expect.element(pause).not.toHaveAttribute('aria-pressed');
    await pause.click();
    await expect.element(page.getByText('已暫停')).toBeInTheDocument();
    await expect.element(timer).toHaveAttribute('data-paused', 'true');
    await expect.element(page.getByRole('button', { name: '繼續' })).not.toHaveAttribute('aria-pressed');
    // 倒數與「已暫停」在無障礙樹裡讀得到（不在 aria-hidden 底下）
    expect(timer.element().querySelector('[aria-hidden="true"] .ll-timer__value')).toBeNull();
    expect(timer.element().querySelector('[aria-hidden="true"] .ll-timer__paused')).toBeNull();
    screen.unmount();
  });

  it('不到一分鐘只寫秒；剩一分鐘與時間到各在 status 區播報一次；時間到沒有暫停按鈕', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    function Demo({ secs }: { secs: number }) {
      return (
        <I18nProvider i18n={i18n}>
          <TimerDisplay remainingSeconds={secs} paused={false} onToggle={() => {}} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo secs={61} />);
    const status = page.getByRole('status');
    await expect.element(status).toHaveTextContent('');
    await screen.rerender(<Demo secs={60} />);
    await expect.element(status).toHaveTextContent('1 minute left');
    await screen.rerender(<Demo secs={45} />);
    await expect.element(page.getByText('45 s left')).toBeInTheDocument();
    await screen.rerender(<Demo secs={0} />);
    await expect.element(status).toHaveTextContent('Time is up, you can keep answering');
    await expect.element(page.getByTestId('timer')).toHaveAttribute('data-expired', 'true');
    expect(await page.getByRole('button').all()).toHaveLength(0);
    screen.unmount();
  });

  it('silent：剩一分鐘與時間到都不播報（設定裡關閉提醒），倒數文字照常顯示', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Demo({ secs }: { secs: number }) {
      return (
        <I18nProvider i18n={i18n}>
          <TimerDisplay remainingSeconds={secs} paused={false} onToggle={() => {}} silent />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo secs={61} />);
    const status = page.getByRole('status');
    await screen.rerender(<Demo secs={60} />);
    await expect.element(page.getByText('剩 1 分 0 秒')).toBeInTheDocument();
    expect(status.element().textContent).toBe('');
    await screen.rerender(<Demo secs={0} />);
    await expect.element(page.getByTestId('timer')).toHaveAttribute('data-expired', 'true');
    expect(status.element().textContent).toBe('');
    screen.unmount();
  });

  it('時間到之後如果是暫停狀態（切到背景自動暫停），仍可以按「繼續」', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <TimerDisplay remainingSeconds={0} paused onToggle={() => {}} />
      </I18nProvider>,
    );
    await expect.element(page.getByRole('button', { name: '繼續' })).not.toHaveAttribute('aria-pressed');
    await expect.element(page.getByText('已暫停')).toBeInTheDocument();
    screen.unmount();
  });

  it('時間到又暫停時按「繼續」：按鈕消失，焦點移到計時區（不掉到 body）', async () => {
    i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
    function Demo() {
      const [paused, setPaused] = useState(true);
      return (
        <I18nProvider i18n={i18n}>
          <TimerDisplay remainingSeconds={0} paused={paused} onToggle={() => setPaused((p) => !p)} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    await page.getByRole('button', { name: '繼續' }).click();
    await expect.element(page.getByTestId('timer')).toHaveFocus();
    expect(await page.getByRole('button').all()).toHaveLength(0);
    // 焦點所在的計時區有名稱（靜音時也讀得出時間到了）
    await expect.element(page.getByRole('group', { name: '時間到了，你可以繼續作答' })).toBeInTheDocument();
    screen.unmount();
  });

  it('第一次畫出來就只剩 20 秒（重新整理後還原）：播「剩 20 秒」，不是「剩 1 分鐘」', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <TimerDisplay remainingSeconds={20} paused={false} onToggle={() => {}} />
      </I18nProvider>,
    );
    await expect.element(page.getByRole('status')).toHaveTextContent('20 s left');
    screen.unmount();
  });

  it('提醒設定晚讀到（silent 轉成 false）時已經剩 20 秒：補播「剩 20 秒」', async () => {
    i18n.loadAndActivate({ locale: 'en', messages: await loadWebUiMessages('en') });
    function Demo({ silent }: { silent: boolean }) {
      return (
        <I18nProvider i18n={i18n}>
          <TimerDisplay remainingSeconds={20} paused={false} onToggle={() => {}} silent={silent} />
        </I18nProvider>
      );
    }
    const screen = await render(<Demo silent />);
    expect(page.getByRole('status').element().textContent).toBe('');
    await screen.rerender(<Demo silent={false} />);
    await expect.element(page.getByRole('status')).toHaveTextContent('20 s left');
    screen.unmount();
  });
});
