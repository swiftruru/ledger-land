// 章節頁主卡的純函式（站規 2.3）：進度與星星、主按鈕（開始、繼續、再挑戰）、徽章狀態、場景縮圖的題材與地景底色。
import { describe, expect, it } from 'vitest';
import { chapterAction, chapterNextLevel, chapterStats, splitBadgeTitle, terrainOf, thumbKindFor, thumbObjectFits } from '../src/features/chapter/model.ts';
import { fixtureData, fixtureProgress } from '../src/features/quest-map/fixtures.ts';
import { currentLevelId, EMPTY_PROGRESS } from '../src/features/quest-map/progress.ts';

const data = fixtureData('zh-TW');
const ch1 = data.chapterById.get('ch_fx0001')!;
const ext = data.chapterById.get('ch_fx00e1')!;

describe('chapterStats', () => {
  it('新使用者：沒有完成的關卡，下一關是第一關，滿星只算計分關卡', () => {
    const s = chapterStats(data, EMPTY_PROGRESS, ch1);
    expect(s).toMatchObject({ done: 0, total: 4, stars: 0, maxStars: 12, badge: 'locked' });
    expect(s.next?.id).toBe('lv_fx010001');
    // 延伸章最後一關不計分：滿星少一關
    expect(chapterStats(data, EMPTY_PROGRESS, ext)).toMatchObject({ total: 4, maxStars: 9 });
  });

  it('做到一半：星星加總，下一關是第一個還沒完成的', () => {
    const s = chapterStats(data, fixtureProgress('default'), ch1);
    expect(s).toMatchObject({ done: 2, stars: 5, maxStars: 12, badge: 'locked' });
    expect(s.next?.id).toBe('lv_fx010003');
  });

  it('全部完成：沒有下一關，徽章依星星與已存的 unlock 取較高者', () => {
    expect(chapterStats(data, fixtureProgress('ch1done'), ch1)).toMatchObject({ done: 4, next: null, badge: 'done' });
    expect(chapterStats(data, fixtureProgress('ch1new'), ch1)).toMatchObject({ stars: 12, badge: 'mastery' });
    // 不計分關卡讀完也算完成
    expect(chapterStats(data, fixtureProgress('all'), ext)).toMatchObject({ done: 4, total: 4, next: null });
  });
});

describe('chapterAction', () => {
  it('還沒開始是開始第一關、做到一半是繼續下一關、全部完成是再挑戰第一關', () => {
    expect(chapterAction(ch1, chapterStats(data, EMPTY_PROGRESS, ch1))).toMatchObject({ kind: 'start', level: { id: 'lv_fx010001' } });
    expect(chapterAction(ch1, chapterStats(data, fixtureProgress('default'), ch1))).toMatchObject({ kind: 'continue', level: { id: 'lv_fx010003' } });
    expect(chapterAction(ch1, chapterStats(data, fixtureProgress('ch1done'), ch1))).toMatchObject({ kind: 'replay', level: { id: 'lv_fx010001' } });
  });

  it('沒有關卡的章沒有主按鈕', () => {
    expect(chapterAction({ ...ch1, levels: [] }, { done: 0, next: null })).toBeNull();
  });
});

describe('chapterNextLevel', () => {
  const nextOf = (chapter: typeof ch1, variant: Parameters<typeof fixtureProgress>[0] | null) => {
    const progress = variant ? fixtureProgress(variant) : EMPTY_PROGRESS;
    return chapterNextLevel(chapter, progress, currentLevelId(data, progress));
  };

  it('目前關卡在本章：就是它，關卡列加「建議下一關」', () => {
    expect(nextOf(ch1, null)).toEqual({ id: 'lv_fx010001', suggested: true });
    expect(nextOf(ch1, 'default')).toEqual({ id: 'lv_fx010003', suggested: true });
  });

  it('目前關卡不在本章（延伸章）：本章第一個還沒完成的關卡，和主卡的「開始 E1-1」同一關，不加膠囊', () => {
    expect(nextOf(ext, null)).toEqual({ id: 'lv_fx0e0001', suggested: false });
    expect(nextOf(ext, 'default')).toEqual({ id: 'lv_fx0e0001', suggested: false });
    // 和主卡主按鈕指向同一關
    expect(nextOf(ext, 'default')?.id).toBe(chapterAction(ext, chapterStats(data, fixtureProgress('default'), ext))?.level.id);
  });

  it('本章全部完成：沒有要標的關卡（主卡是「再挑戰」第一關）', () => {
    expect(nextOf(ch1, 'ch1done')).toBeNull();
    // 全部關卡都完成時，全站的目前關卡是最後玩的那一關（延伸章最後一關），章節頁也不標它，主卡與關卡列不會指向兩張卡
    expect(currentLevelId(data, fixtureProgress('all'))).toBe('lv_fx0e0004');
    expect(nextOf(ext, 'all')).toBeNull();
  });
});

describe('場景縮圖', () => {
  it('主線 10 章、延伸 4 章各有題材，超過時輪流使用', () => {
    expect(thumbKindFor(1, false)).toBe('dock');
    expect(thumbKindFor(10, false)).toBe('summit');
    expect(thumbKindFor(11, false)).toBe('dock');
    expect(thumbKindFor(1, true)).toBe('isle-valuation');
    expect(thumbKindFor(4, true)).toBe('isle-ledger');
    expect(thumbKindFor(5, true)).toBe('isle-valuation');
    expect(thumbKindFor(0, false)).toBe('dock');
  });

  it('地景底色照地圖規格 6.4：延伸區的小島都在深海上', () => {
    expect(terrainOf('dock')).toBe('sand');
    expect(terrainOf('islands')).toBe('sea');
    expect(terrainOf('summit')).toBe('meadow-deep');
    for (let n = 1; n <= 4; n++) expect(terrainOf(thumbKindFor(n, true))).toBe('sea-deep');
  });

  it('邊緣的物件看不完整就不畫：左右離外框至少 8px、不超出上下、不伸進上緣的圓角', () => {
    const box = { left: 100, top: 50, right: 500, bottom: 202 };
    const at = (left: number, top: number, w = 30, h = 20) => ({ left, top, right: left + w, bottom: top + h });
    expect(thumbObjectFits(box, at(200, 100))).toBe(true);
    // 被左緣切掉一截（半艘帆船）、離邊緣不到 8px、右緣同理
    expect(thumbObjectFits(box, at(90, 100))).toBe(false);
    expect(thumbObjectFits(box, at(104, 100))).toBe(false);
    expect(thumbObjectFits(box, at(108, 100))).toBe(true);
    expect(thumbObjectFits(box, at(470, 100))).toBe(false);
    // 上下超出外框（寬螢幕時上下被裁）
    expect(thumbObjectFits(box, at(200, 40))).toBe(false);
    expect(thumbObjectFits(box, at(200, 190))).toBe(false);
    // 上緣圓角 16px：伸進左上角的方塊就不畫，同一高度離角落夠遠就畫
    expect(thumbObjectFits(box, at(110, 55), 16)).toBe(false);
    expect(thumbObjectFits(box, at(110, 70), 16)).toBe(true);
    expect(thumbObjectFits(box, at(200, 55), 16)).toBe(true);
  });
});

describe('splitBadgeTitle', () => {
  it('徽章名連同緊鄰的引號是一段（中文「」、英文‘’）', () => {
    expect(splitBadgeTitle('完成本章可獲得「開店了」', '開店了')).toEqual({ before: '完成本章可獲得', title: '「開店了」', after: '' });
    expect(splitBadgeTitle('Finish this chapter to earn ‘Open for business’', 'Open for business')).toEqual({
      before: 'Finish this chapter to earn ',
      title: '‘Open for business’',
      after: '',
    });
    expect(splitBadgeTitle('Badge ‘Open for business’ earned', 'Open for business')).toEqual({
      before: 'Badge ',
      title: '‘Open for business’',
      after: ' earned',
    });
  });

  it('沒有引號時只包名字；名字含零寬空格也照原樣比對', () => {
    expect(splitBadgeTitle('Earn Map reader now', 'Map reader')).toEqual({ before: 'Earn ', title: 'Map reader', after: ' now' });
    expect(splitBadgeTitle('已取得徽章「看懂\u200b股東權益」', '看懂\u200b股東權益')?.title).toBe('「看懂\u200b股東權益」');
  });

  it('譯文裡找不到徽章名或名字是空的：回傳 null（整句照原樣顯示）', () => {
    expect(splitBadgeTitle('Badge earned', 'Open for business')).toBeNull();
    expect(splitBadgeTitle('Badge earned', '')).toBeNull();
  });
});
