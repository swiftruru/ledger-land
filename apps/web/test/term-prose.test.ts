// 名詞頁長文的中文換行（features/term-page/prose.ts，M3 驗收第 7 輪：名詞頁 375 的「現時經／濟資源」「存貨與設／備」「有形資／產」）：
// 斷行單位以 components/prose-units.ts 為準，名詞頁另外讓名詞自己的名稱、會計複合名詞、數字與量詞整塊不斷，段落最後一段至少 3 個字，
// 整塊的單位不超過欄寬。另外對全部已發布名詞檢查：單位串回原字不變、沒有超過寬度上限的整塊單位。
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emWidth, termProse, type TermProseOptions } from '../src/features/term-page/prose.ts';

const kept = (text: string, o?: TermProseOptions) => (termProse(text, o) ?? []).filter(([, keep]) => keep).map(([t]) => t);
const HAN_G = /\p{Script=Han}/gu;

describe('termProse', () => {
  it('第 7 輪的拆詞：資產的定義裡「經濟資源」「設備」「所有權」都不從中間斷', () => {
    const def =
      '公司因過去的交易或事項而控制的現時經濟資源；經濟資源是有潛力帶來經濟效益的權利，例如現金、應收帳款、存貨與設備。重點在控制，不一定要有法律上的所有權。';
    const k = kept(def, { names: ['資產'], tailEm: 7 });
    expect(k).toEqual(expect.arrayContaining(['經濟', '資源', '設備', '應收帳款']));
    expect(k.at(-1)).toMatch(/所有權。$/);
  });

  it('名詞自己的名稱整塊不斷，即使 Segmenter 切成兩個詞', () => {
    expect(kept('把營業利益率和純益率混用。營業利益率停在本業這一層。', { names: ['營業利益率'] })).toContain('營業利益率');
  });

  it('會計複合名詞整塊：前一個詞接中心詞（有形資產、流動負債、現金流量）', () => {
    expect(kept('公司為了長期營業使用而持有的有形資產，例如機器設備。')).toContain('有形資產');
    expect(kept('再除以資產總計減流動負債，加上存貨。')).toContain('流動負債');
    expect(kept('營業活動的現金流量先扣掉現金股利。')).toEqual(expect.arrayContaining(['營業活動的', '現金流量']));
  });

  it('數字和後面的量詞不斷；日期與 N/A 不斷', () => {
    const k = kept('分子是第 2 層利益。營業收入為 0 時顯示 N/A，查證於 2026-10-24，課程看的是 365 天。');
    expect(k.some((t) => t.includes('第 2 層'))).toBe(true);
    expect(k).toEqual(expect.arrayContaining(['0 時', 'N/A', '2026-10-24']));
    expect(k.some((t) => t.includes('365 天'))).toBe(true);
  });

  it('最後一段至少 3 個字一起換行（「很重。」「的債。」不單獨成一行）', () => {
    for (const text of ['兩者差很多時通常是利息或業外項目很重。', '它是權益的第一個項目，不是公司欠股東的債。']) {
      const last = kept(text, { tailEm: 7 }).at(-1)!;
      expect(text.endsWith(last)).toBe(true);
      expect(last.match(HAN_G)!.length).toBeGreaterThanOrEqual(3);
      expect(emWidth(last)).toBeLessThanOrEqual(7);
    }
  });

  it('超過寬度上限的引號名稱改成裡面的詞各自不斷（320 寬加 200% 的欄放不下 8 個字寬）', () => {
    const k = kept('「相對股本的報酬率」是另一回事。');
    expect(k).not.toContain('相對股本的報酬率');
    expect(k).toEqual(expect.arrayContaining(['相對股本的', '報酬率']));
  });

  it('第 8 輪：助詞「的」不落在行首，併到前一個詞的結尾（「持有的／有形資產」，不排成「持有／的有形資產」）', () => {
    const pieces = termProse('公司為了長期營業使用而持有的有形資產，例如機器設備、辦公設備、廠房與土地。', { names: ['固定資產'], tailEm: 7 })!;
    expect(pieces.some(([t]) => t.startsWith('的'))).toBe(false);
    expect(kept('公司為了長期營業使用而持有的有形資產，例如機器設備。')).toEqual(expect.arrayContaining(['持有的', '有形資產']));
    // Segmenter 的「的是」也不落在行首（prose-units 拆成「的」「是」或整個併到前面都可以）；段落最後一段也不從「的」開始
    expect(kept('顯示的是扣掉累計折舊後的淨額。')[0]).toMatch(/^顯示的/);
    expect(kept('顯示的是扣掉累計折舊後的淨額。').some((t) => t.startsWith('的'))).toBe(false);
    expect(kept('它是權益的第一個項目，不是公司欠股東的負債。', { tailEm: 7 }).at(-1)).toBe('股東的負債。');
    expect(kept('「銷管費用」的名稱來自營業費用。')).toContain('「銷管費用」的');
    // 最後一段太寬時不拆複合名詞（「營業成本的／做法。」，不是「營業／成本的做法。」）
    expect(kept('網站採沖減營業成本的做法。', { tailEm: 7 })).toContain('營業成本的');
    // 連續的單字實詞不拆（「可以入／帳的科目。」）
    expect(kept('底下才是可以入帳的科目。', { tailEm: 7 }).at(-1)).toBe('入帳的科目。');
    // 「的確」「得到」「地方」是詞，照常可以在前面斷
    expect(kept('這樣的確比較清楚，最後得到的百分比。')).toContain('的確');
  });

  it('解鎖任務卡的標題：章與關的代號各自整塊', () => {
    expect(kept('在延伸第 2 章第 2 關遇到', { maxEm: 5 })).toEqual(['延伸', '第 2 章', '第 2 關', '遇到']);
  });

  it('英文照原字', () => {
    expect(termProse('A present economic resource the company controls.')).toBeNull();
  });
});

describe('全部已發布名詞', () => {
  const dir = fileURLToPath(new URL('../../../content/terms/', import.meta.url));
  const terms = readdirSync(dir).map(
    (f) => JSON.parse(readFileSync(dir + f, 'utf8')) as Record<string, unknown> & { status: string; label: Record<string, string> },
  );
  const texts = terms
    .filter((t) => t.status === 'published')
    .flatMap((t) =>
      (['definition', 'note', 'formula', 'example', 'misconception', 'ifrsNote'] as const).flatMap((k) =>
        String((t[k] as Record<string, string> | undefined)?.['zh-TW'] ?? '')
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p) => [p, [t.label['zh-TW']!, String(t.teacherLabel), String(t.currentTwLabel ?? '')], k === 'formula' ? 6 : 7] as const),
      ),
    );

  it('有內容可以檢查', () => {
    expect(texts.length).toBeGreaterThan(300);
  });

  it('單位串回原字不變；整塊的單位不超過寬度上限（內文 7、公式框 6 個字寬）', () => {
    const widest = (text: string, names: readonly string[], tailEm: number) =>
      Math.max(0, ...(termProse(text, { names, tailEm }) ?? []).filter(([, keep]) => keep).map(([t]) => emWidth(t.replace(/^[「『（]|[」』）]$/gu, ''))));
    const joined = (text: string, names: readonly string[], tailEm: number) => (termProse(text, { names, tailEm }) ?? [[text]]).map(([t]) => t).join('');
    expect(texts.filter(([text, names, tailEm]) => joined(text, names, tailEm) !== text)).toEqual([]);
    expect(texts.filter(([text, names, tailEm]) => widest(text, names, tailEm) > tailEm).map(([text]) => text)).toEqual([]);
  });

  it('沒有一行從助詞「的」「地」「得」開始：可斷的文字裡沒有這三個字，整塊的單位不以單獨成詞的助詞開頭', () => {
    const seg = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    const lead = (t: string) => /^(?:[的地得]|的是)$/u.test([...seg.segment(t)][0]?.segment ?? '');
    const bad = texts.flatMap(([text, names, tailEm]) =>
      (termProse(text, { names, tailEm }) ?? []).filter(([t, keep]) => (keep ? lead(t) : /[的地得]/u.test(t))).map(([t]) => `${t} ← ${text}`),
    );
    expect(bad).toEqual([]);
  });
});
