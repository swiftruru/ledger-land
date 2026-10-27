// 地圖標題的子句（MapPhrase 的 phrased，M3 驗收第 7 輪）：章名、關卡名稱、海峽說明卡在「：」「，」「、」「；」後面與開括號前面切成 inline-block 子句，
// 放得進一行的子句整段換行；結尾（章名的最後兩個字與箭頭）放在最後一個子句裡。2026-10-27 起不再切詞：子句裡沒有 <wbr>、沒有不換行的 span
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
    // 只有一個子句（結尾另外接）：照原字，不包
    expect(await clausesOf('損益表：', true)).toEqual([]);
  });

  it('子句裡只有原字：沒有 <wbr>、沒有不換行的 span，textContent 不變', async () => {
    const screen = await render(<p className="ll-phrased">{phrased('資產負債表：結帳那天的全貌')}</p>);
    expect(screen.container.textContent).toBe('資產負債表：結帳那天的全貌');
    expect(screen.container.querySelector('.ll-nowrap')).toBeNull();
    expect(screen.container.querySelector('.ll-phrased__clause wbr')).toBeNull();
    await screen.unmount();
  });

  it('沒有子句標點、英文時照原字（不包子句）', async () => {
    expect(await clausesOf('一家小店的帳')).toEqual([]);
    expect(phrased('Balance sheet: the full picture')).toBe('Balance sheet: the full picture');
    expect(phrased('一家小店的帳')).toBe('一家小店的帳');
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
