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
import { phraseParts, punctTail } from '../src/components/phrase.ts';

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

/** 切好的詞接回原字：英文後面空一格接「的」時，那個空格換成了不換行空白（第 9 輪），比對時換回來 */
const rejoin = (parts: readonly string[]) => parts.join('').replace(/\u00A0(?=的)/g, ' ');

describe('phraseParts', () => {
  it('中文名稱切成詞：接回去是原字，標點不放在詞的開頭，開括號後面不斷', () => {
    for (const name of ['長期資金占固定資產比率', '不動產、廠房及設備週轉率', '每股盈餘（EPS）', '期末現金及約當現金餘額']) {
      const parts = phraseParts(name)!;
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.join('')).toBe(name);
      for (const p of parts) expect(p).not.toMatch(/^[、，。：）」]/);
    }
    expect(phraseParts('每股盈餘（EPS）')!.some((p) => p.endsWith('（'))).toBe(false);
    // Segmenter 切成單字的「約當」不從中間斷；連接詞「及」前後可以斷
    expect(phraseParts('期末現金及約當現金餘額')!.some((p) => p.endsWith('約'))).toBe(false);
    expect(phraseParts('期末現金及約當現金餘額')!.join('|')).toContain('及|');
  });
  it('貨幣符號和後面的數字不斷（NT$1,200、US$30）', () => {
    for (const text of ['每月收費 NT$1,200 元', '價格是NT$1,200元', '另付 US$30 的手續費']) {
      // 整句沒有可以斷的地方時回 undefined（照一般斷行），等於一整塊
      const parts = phraseParts(text) ?? [text];
      expect(rejoin(parts)).toBe(text);
      for (const p of parts) expect(p).not.toMatch(/^\d/);
    }
  });
  it('不換行空白的前後不斷（第 7 輪：「今天要複習 1／題」）；否定詞黏著後面的詞（「也不／影響星星」）', () => {
    expect(phraseParts('今天要複習 1\u00A0題')!.at(-1)).toBe('1\u00A0題');
    for (const text of ['今天要複習 1\u00A0題', '已取得 2\u00A0/\u00A014\u00A0枚', '以\u2060Web App\u2060打開']) {
      const parts = phraseParts(text) ?? [text];
      expect(parts.join('')).toBe(text);
      for (const p of parts) expect(p).not.toMatch(/^[\u00A0\u202F\u2060]|[\u00A0\u202F\u2060]$/);
    }
    for (const text of ['時間到不會送出，也不影響星星。', '只有不收集個資的匿名流量統計。', '這題尚未作答，沒關係'])
      expect(phraseParts(text)!.some((p) => /[不沒未]$/.test(p))).toBe(false);
    expect(phraseParts('時間到不會送出，也不影響星星。')!.join('|')).toContain('也不影響');
    // 單字的「別」也黏著後面的詞（和 prose-units.ts 同一組）；「類別」結尾的「別」不算否定詞
    expect(phraseParts('先別關掉這個頁面')!.some((p) => p.endsWith('別'))).toBe(false);
    expect(phraseParts('依類別篩選名詞')!.join('|')).toContain('依類別|篩選');
  });
  it('keep 的詞整塊不拆（名詞頁傳名詞自己的名稱）；沒有 keep 時照 Segmenter', () => {
    const text = '資產、負債與股東權益，以及它們之間';
    expect(phraseParts(text)!.join('|')).toContain('股東|權益');
    const kept = phraseParts(text, ['股東權益'])!;
    expect(kept.join('')).toBe(text);
    expect(kept.join('|')).toContain('股東權益，');
    expect(phraseParts('期末現金及約當現金餘額', ['現金及約當現金'])).toEqual(['期末', '現金及約當現金', '餘額']);
  });
  it('助詞「的」「地」「得」不落在行首：「的」黏著前面的詞、後面照常可以斷（M3 收尾）', () => {
    for (const text of [
      '公司為了長期營業使用而持有的有形資產',
      '以及它們之間永遠成立的關係。',
      '慢慢地累積，做得好就有星星',
      '股東的權益',
      // Segmenter 把「的是」切成一段；前面是英文或閉引號
      '唯一直接沿用的是故事裡那家公司的情境',
      'GitHub repo 的 issue 頁面',
      '按「匯出到 App」的按鈕',
    ]) {
      const parts = phraseParts(text) ?? [text];
      expect(rejoin(parts)).toBe(text);
      for (const p of parts) expect(p).not.toMatch(/^[的地得]/);
    }
    expect(phraseParts('公司為了長期營業使用而持有的有形資產')!.join('|')).toContain('持有的|');
  });
  it('第 9 輪 handoff：英文後面的「的」、「的」後面的孤字、英數字串、黏成一長串的標題、括號裡的頓號', () => {
    // 英文後面空一格接「的」：空格是瀏覽器的斷點，換成不換行空白（「ROA／的差距」）
    expect(phraseParts('ROE 與 ROA 的差距')).toContain('ROA\u00A0的');
    expect(phraseParts('把 Safari 的進度')).toContain('Safari\u00A0的');
    // 「的」後面只剩一個字時黏著，不留「帳」「錢」單獨一行
    expect(phraseParts('一家小店的帳')).toEqual(['一家', '小店的帳']);
    expect(phraseParts('誰的東西、誰的錢')!.at(-1)).toBe('誰的錢');
    // 英數字串中間不斷（「N/」「A」）
    expect(phraseParts('N/A 與 0 不一樣')![0]).toBe('N/A ');
    expect(phraseParts('時顯示 N/A。本課故事沒有研發費用。')!.some((p) => /^A|\/$/.test(p))).toBe(false);
    // 「在」「從」「而」前面可以斷、黏著後面；「後」「時」後面可以斷，前面不到兩個字時不拆
    expect(phraseParts('四個勾稽點在哪裡')).toEqual(['四個', '勾稽點', '在哪裡']);
    expect(phraseParts('資本公積從哪裡來')).toEqual(['資本公積', '從哪裡來']);
    expect(phraseParts('開啟後作答頁顯示剩餘時間')!.join('|')).toContain('開啟後|作答頁顯示');
    expect(phraseParts('貼上時請確認沒有夾帶其他文字')!.join('|')).toContain('貼上時|請確認');
    expect(phraseParts('稅後淨利')).toBeUndefined();
    // 單字的否定詞前面可以斷（和 prose-units 同一條），後面仍黏著
    expect(phraseParts('關閉後倒數照常顯示，只是不唸出來。')!.join('|')).toContain('只是|不唸出來。');
    expect(phraseParts('期後事項')).toBeUndefined();
    // 括號裡整段不斷，頓號後面例外
    expect(phraseParts('六大指標：產出（獲利能力、償債能力）')!.join('|')).toContain('（獲利能力、|償債能力）');
    expect(phraseParts('每股盈餘（EPS）')!.some((p) => p.endsWith('（'))).toBe(false);
  });
  it('punctTail：詞尾的標點連同前一個字（渲染時整塊不斷，緊急換行不會把標點單獨斷到行首）', () => {
    expect(punctTail('資產負債表：')).toEqual(['資產負債', '表：']);
    expect(punctTail('只是不唸出來。')).toEqual(['只是不唸出', '來。']);
    expect(punctTail('（獲利能力、')).toEqual(['（獲利能', '力、']);
    expect(punctTail('表：')).toBeUndefined();
    expect(punctTail('現金流量')).toBeUndefined();
  });
  it('英文或單一個詞不切', () => {
    expect(phraseParts('Cash and cash equivalents')).toBeUndefined();
    expect(phraseParts('現金')).toBeUndefined();
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
