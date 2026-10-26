// 地圖標題的子句（MapPhrase 的 phrased，M3 驗收第 7 輪）：章名、關卡名稱、海峽說明卡在「：」「，」「、」「；」後面與開括號前面切成 inline-block 子句，
// 放得進一行的子句整段換行；結尾（章名的最後兩個字與箭頭）放在最後一個子句裡
import { render } from 'vitest-browser-react';
import { describe, expect, it } from 'vitest';
import { phrased } from '../src/map.ts';

async function clausesOf(text: string, withTail = false) {
  const screen = await render(<p className="ll-phrased">{phrased(text, withTail ? <span key="tail">›</span> : undefined)}</p>);
  const out = [...screen.container.querySelectorAll('.ll-phrased__clause')].map((c) => c.textContent);
  await screen.unmount();
  return out;
}

describe('phrased 的子句', () => {
  it('「延伸區：不列入期中考，想多學再來」是三個子句', async () => {
    expect(await clausesOf('延伸區：不列入期中考，想多學再來')).toEqual(['延伸區：', '不列入期中考，', '想多學再來']);
  });

  it('章名的結尾放在最後一個子句；開括號前面也切開；只包 7 個字以內或接在「：」後面的子句', async () => {
    expect(await clausesOf('資產負債表：結帳那天的', true)).toEqual(['資產負債表：', '結帳那天的›']);
    // 括號裡的頓號後面也切開（第 9 輪）：「（獲利能力、」6 個字、「償債能」加結尾 5 個字，各自是子句
    expect(await clausesOf('六大指標：產出（獲利能力、償債能', true)).toEqual(['六大指標：', '產出', '（獲利能力、', '償債能›']);
    // 「非流動與留下的利益」9 個字：不包，窄的時候不會留下「流動、」單獨一行
    expect(await clausesOf('流動、非流動與留下的利益')).toEqual(['流動、']);
    // 接在「：」後面：長也包（「綜合挑戰：」單獨一行）
    expect(await clausesOf('綜合挑戰：一年內還得出來嗎')).toEqual(['綜合挑戰：', '一年內還得出來嗎']);
    expect(await clausesOf('損益表：', true)).toEqual([]);
  });

  it('詞尾的標點和前一個字整塊不斷：比一行寬的子句緊急換行時不會把「：」「、」單獨斷到下一行（第 9 輪）', async () => {
    const screen = await render(<p className="ll-phrased">{phrased('資產負債表：結帳那天的全貌')}</p>);
    expect([...screen.container.querySelectorAll('.ll-nowrap')].map((n) => n.textContent)).toEqual(['表：']);
    expect(screen.container.textContent).toBe('資產負債表：結帳那天的全貌');
    await screen.unmount();
    const narrow = await render(
      <p data-testid="n" className="ll-phrased" style={{ width: '4.5em', fontSize: '20px' }}>
        {phrased('財務比率（獲利能力、償債能力）')}
      </p>,
    );
    // 每一行的開頭都不是標點
    const el = narrow.getByTestId('n').element();
    const lines = new Map<number, string>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      for (let i = 0; i < n.textContent!.length; i++) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const top = Math.round(r.getBoundingClientRect().top);
        lines.set(top, (lines.get(top) ?? '') + n.textContent![i]);
      }
    for (const line of lines.values()) expect(line).not.toMatch(/^[、：，）]/);
  });

  it('沒有子句標點、英文時照原本的切詞（不包子句）', async () => {
    expect(await clausesOf('一家小店的帳')).toEqual([]);
    expect(phrased('Balance sheet: the full picture')).toBe('Balance sheet: the full picture');
  });

  it('放得進一行的子句不會被拆開：寬 10 個字時「不列入期中考，」整段在第二行', async () => {
    const screen = await render(
      <p data-testid="w" className="ll-phrased" style={{ width: '10.5em', fontSize: '20px', textWrap: 'balance' }}>
        {phrased('延伸區：不列入期中考，想多學再來')}
      </p>,
    );
    const spans = [...screen.getByTestId('w').element().querySelectorAll('.ll-phrased__clause')].map((c) => c.getBoundingClientRect());
    // 每個子句都是一行（高度一樣），第二、第三個子句換到第一個子句的下面
    expect(new Set(spans.map((r) => Math.round(r.height))).size).toBe(1);
    expect(spans[1]!.top).toBeGreaterThan(spans[0]!.top);
  });
});
