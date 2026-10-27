// 名詞卡的說明列（站規 1.11.2，2026-10-25 看圖驗收第 1 輪）：類別一行、遇到的關卡另起一行；關卡名連同引號排成一塊，不從引號中間斷；
// 畫面是短的寫法時，可讀名稱仍帶完整的關卡名
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import type { ReactNode } from 'react';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { beforeAll, describe, expect, it } from 'vitest';
import { GlossaryGrid, GlossaryItem, LinkProvider, loadWebUiMessages, type LinkComponentProps } from '../src/index.ts';
import { splitMeet } from '../src/components/GlossaryItem.tsx';

beforeAll(async () => {
  i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
});

function PlainLink({ href, ref, children, ...rest }: LinkComponentProps) {
  return (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  );
}

function Wrap({ width, children }: { width: number; children: ReactNode }) {
  return (
    <I18nProvider i18n={i18n}>
      <LinkProvider component={PlainLink}>
        <div style={{ width }}>{children}</div>
      </LinkProvider>
    </I18nProvider>
  );
}

describe('splitMeet', () => {
  it('關卡名連同引號與後面緊接的字排成一塊', () => {
    expect(splitMeet('在 1-1「誰的東西、誰的錢」遇到', '誰的東西、誰的錢')).toEqual(['在 1-1', '「誰的東西、誰的錢」遇到', '']);
    expect(splitMeet('在延伸 1-2「表與表之間」遇到', '表與表之間')).toEqual(['在延伸 1-2', '「表與表之間」遇到', '']);
    expect(splitMeet('Met in 1-1 “Whose things, whose money”', 'Whose things, whose money')).toEqual(['Met in 1-1 ', '“Whose things, whose money”', '']);
  });
  it('沒有關卡名或找不到時不切', () => {
    expect(splitMeet('在 1-1 遇到', undefined)).toBeUndefined();
    expect(splitMeet('在 1-1 遇到', '別的關')).toBeUndefined();
  });
});

describe('GlossaryItem 的說明列', () => {
  it('類別一行、遇到的關卡另起一行；關卡名那一塊不從引號中間斷', async () => {
    // 375 的單欄卡（格子寬 343）
    const screen = await render(
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem
            href="/terms/a/"
            name="機器設備"
            english="Machinery and equipment"
            category="account"
            categoryLabel="科目"
            state="locked"
            stateLabel="未收進"
            meet="在 1-1「誰的東西、誰的錢」遇到"
            meetTitle="誰的東西、誰的錢"
          />
        </GlossaryGrid>
      </Wrap>,
    );
    // inline-block 前後 Chrome 會多算一個空白，可讀名稱的字和順序不變
    const link = page.getByRole('link', { name: /^機器設備 Machinery and equipment 科目 未收進 在 1-1 ?「誰的東西、誰的錢」遇到$/ });
    await expect.element(link).toBeInTheDocument();
    const el = link.element();
    const cat = el.querySelector('.ll-termitem__cat')!.getBoundingClientRect();
    const meet = el.querySelector('.ll-termitem__meet')!.getBoundingClientRect();
    expect(meet.top).toBeGreaterThanOrEqual(cat.bottom - 1);
    // 關卡名那一塊只有一行（放得下就整塊換行，不切成「誰的／錢」）
    const keep = el.querySelector('.ll-termitem__keep')!;
    expect(keep.textContent).toBe('「誰的東西、誰的錢」遇到');
    expect(keep.getBoundingClientRect().height).toBeLessThanOrEqual(26);
    // 說明列用本文小字的行高
    expect(getComputedStyle(el.querySelector('.ll-termitem__desc')!).lineHeight).toBe('24px');
    await screen.unmount();
  });

  it('meetLabel：畫面是「在 1-1 遇到」，可讀名稱帶完整的關卡名', async () => {
    const screen = await render(
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem
            href="/terms/b/"
            name="存貨"
            category="account"
            categoryLabel="科目"
            state="locked"
            stateLabel="未收進"
            meet="在 1-1 遇到"
            meetLabel="在 1-1「誰的東西、誰的錢」遇到"
          />
        </GlossaryGrid>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '存貨 科目 未收進 在 1-1「誰的東西、誰的錢」遇到' });
    await expect.element(link).toBeInTheDocument();
    const shown = link.element().querySelector('.ll-termitem__meet')!;
    expect(shown.getAttribute('aria-hidden')).toBe('true');
    expect(shown.textContent?.trim()).toBe('在 1-1 遇到');
    await screen.unmount();
  });
});

describe('GlossaryItem 的代號膠囊（看圖驗收第 2 輪）', () => {
  it('meetCode 加 meetTitle：畫面是「[6-1] 關卡名」，不留「在 6-1」單獨一行、最多兩行；可讀名稱是完整的句子', async () => {
    const screen = await render(
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem
            href="/terms/c/"
            name="三表勾稽"
            category="concept"
            categoryLabel="觀念"
            state="locked"
            stateLabel="未收進"
            meet="在 6-1「四個勾稽點在哪裡」遇到"
            meetTitle="四個勾稽點在哪裡"
            meetCode="6-1"
          />
          <GlossaryItem
            href="/terms/d/"
            name="人均營收"
            category="ratio"
            categoryLabel="指標"
            state="locked"
            stateLabel="未收進"
            meet="在 7-4「綜合挑戰：部門指標與取捨」遇到"
            meetTitle="綜合挑戰：部門指標與取捨"
            meetCode="7-4"
          />
        </GlossaryGrid>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '三表勾稽 觀念 未收進 在 6-1「四個勾稽點在哪裡」遇到' });
    await expect.element(link).toBeInTheDocument();
    const el = link.element();
    const shown = el.querySelector('.ll-termitem__meet')!;
    expect(shown.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.ll-termitem__code')!.textContent).toBe('6-1');
    // 代號和關卡名在同一行（說明列的行高 24）
    expect(shown.getBoundingClientRect().height).toBeLessThanOrEqual(26);
    // 長的關卡名最多兩行，第一行是代號加關卡名的前段
    const long = page.getByRole('link', { name: /^人均營收/ }).element();
    const longMeet = long.querySelector('.ll-termitem__meet')!;
    expect(longMeet.getBoundingClientRect().height).toBeLessThanOrEqual(50);
    const code = long.querySelector('.ll-termitem__code')!.getBoundingClientRect();
    const title = long.querySelector('.ll-termitem__ltitle')!.getClientRects()[0]!;
    expect(Math.abs(title.top + title.height / 2 - (code.top + code.height / 2))).toBeLessThan(6);
    await screen.unmount();
  });

  it('只給 meetCode：句子裡的代號換成小膠囊，字和順序不變', async () => {
    const screen = await render(
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem
            href="/terms/e/"
            name="存貨"
            category="account"
            categoryLabel="科目"
            state="locked"
            stateLabel="未收進"
            meet="在 1-1 遇到"
            meetLabel="在 1-1「誰的東西、誰的錢」遇到"
            meetCode="1-1"
          />
        </GlossaryGrid>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '存貨 科目 未收進 在 1-1「誰的東西、誰的錢」遇到' });
    await expect.element(link).toBeInTheDocument();
    const shown = link.element().querySelector('.ll-termitem__meet')!;
    expect(shown.textContent?.trim()).toBe('在 1-1 遇到');
    expect(shown.querySelector('.ll-termitem__code')!.textContent).toBe('1-1');
    await screen.unmount();
  });

  it('已收進：32px 印章', async () => {
    const screen = await render(
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem href="/terms/f/" name="現金" category="account" element="asset" categoryLabel="科目" state="unlocked" stateLabel="已收進" />
        </GlossaryGrid>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '現金 科目 已收進' });
    await expect.element(link).toBeInTheDocument();
    const stamp = link.element().querySelector('.ll-stamp')!;
    expect(stamp.classList.contains('ll-stamp--s32')).toBe(true);
    await screen.unmount();
  });

  // 一次出現（維護者 2026-10-26）：頁面在進度讀到之後才畫卡片，印章第一次繪製就在；蓋章動畫等布幕拉開那一次繪製才把 justCollected 傳成 true
  it('已收進的卡第一次繪製就有印章（沒有動畫 class）；之後 justCollected 變成 true 才播一次，再變回 false 也不會消失', async () => {
    const item = (justCollected: boolean) => (
      <Wrap width={343}>
        <GlossaryGrid>
          <GlossaryItem
            href="/terms/g/"
            name="應收帳款"
            category="account"
            element="asset"
            categoryLabel="科目"
            state="unlocked"
            stateLabel="已收進"
            justCollected={justCollected}
          />
        </GlossaryGrid>
      </Wrap>
    );
    const screen = await render(item(false));
    const link = page.getByRole('link', { name: '應收帳款 科目 已收進' });
    await expect.element(link).toBeInTheDocument();
    expect(link.element().querySelector('.ll-stamp')).not.toBeNull();
    expect(link.element().querySelector('.ll-stamp.is-stamping')).toBeNull();
    expect(link.element().classList.contains('is-just-collected')).toBe(false);
    await screen.rerender(item(true));
    await expect.element(link).toBeInTheDocument();
    expect(link.element().querySelector('.ll-stamp.is-stamping')).not.toBeNull();
    expect(link.element().classList.contains('is-just-collected')).toBe(true);
    await screen.rerender(item(false));
    expect(link.element().querySelector('.ll-stamp')).not.toBeNull();
    await screen.unmount();
  });
});
