// 實驗室的列名（features/lab/line-labels.ts）：核心的版面（label 是 LocalizedText）與核心載入前由故事快照 firstPaint.lines 做成的版面（label 已攤平成字串）
// 都走同一個 lineLabelOf：有 termRef 且名詞索引有那個名詞時優先用名詞的名稱，沒有就用版面的名稱，找不到的列回傳列 ID。
import { describe, expect, it } from 'vitest';
import { firstPaintLayout, lineLabelOf } from '../src/features/lab/line-labels.ts';

describe('lineLabelOf 與 firstPaintLayout', () => {
  const core = { statements: { balance_sheet: [{ id: 'bs_cash', label: { 'zh-TW': '現金', en: 'Cash' }, termRef: 'tm_cash' }] } };
  const snapshot = firstPaintLayout({ bs_cash: { label: 'Cash and cash equivalents', termRef: 'tm_cash' }, bs_total_assets: { label: 'Total assets' } });
  const none = () => undefined;
  const terms = (id: string) => (id === 'tm_cash' ? '現金及約當現金' : undefined);

  it('核心的版面：依語系取名稱，名詞優先', () => {
    expect(lineLabelOf(core, 'bs_cash', 'en', none)).toBe('Cash');
    expect(lineLabelOf(core, 'bs_cash', 'zh-TW', none)).toBe('現金');
    expect(lineLabelOf(core, 'bs_cash', 'zh-TW', terms)).toBe('現金及約當現金');
    expect(lineLabelOf(core, 'bs_nothing', 'zh-TW', terms)).toBe('bs_nothing');
  });

  it('快照的版面：名稱已是字串（不分語系），名詞一樣優先；沒有 termRef 的列 termRef 是 null', () => {
    expect(lineLabelOf(snapshot, 'bs_cash', 'en', none)).toBe('Cash and cash equivalents');
    expect(lineLabelOf(snapshot, 'bs_cash', 'zh-TW', terms)).toBe('現金及約當現金');
    expect(lineLabelOf(snapshot, 'bs_total_assets', 'en', terms)).toBe('Total assets');
    expect(snapshot.statements.firstPaint!.find((l) => l.id === 'bs_total_assets')!.termRef).toBeNull();
    expect(lineLabelOf(firstPaintLayout({}), 'bs_cash', 'en', none)).toBe('bs_cash');
  });
});
