// 名詞圖鑑重做（站規 2.6、2.7）新增的純函式：雙語搜尋（finding glossary-2）、關卡代號、蓋章動畫的比對、分組的收集數、
// 返回圖鑑時帶回 ?q 與 ?group（finding glossary-4）
import { describe, expect, it } from 'vitest';
import {
  glossaryReturnPath,
  glossaryReturnSearch,
  groupProgress,
  hasOtherLabels,
  levelCode,
  matchesQuery,
  newlyCollected,
  withOtherLabels,
  type GlossaryTerm,
} from '../src/features/glossary/unlocks.ts';

function term(id: string, label: string, extra: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return { id, category: 'ratio', label, teacherLabel: label, currentTwLabel: null, ifrsEnglish: null, flags: [], ...extra };
}

describe('雙語搜尋', () => {
  it('另一種語言的主名稱（otherLabel）也比對：中文介面找得到 Current ratio', () => {
    const t = term('tm_c8r1t4zm', '流動比率', { otherLabel: 'Current ratio' });
    expect(matchesQuery(t, 'current ratio')).toBe(true);
    expect(matchesQuery(t, '  CURRENT   ratio ')).toBe(true);
    expect(matchesQuery({ ...t, otherLabel: undefined }, 'current ratio')).toBe(false);
  });

  it("彎撇號與直撇號互相找得到（內容用 ’，鍵盤打的是 '）", () => {
    const t = term('tm_q5srzxb2', 'Directors’ remuneration', { aliases: { en: ['Owners’ capital'] } });
    expect(matchesQuery(t, "directors' rem")).toBe(true);
    expect(matchesQuery(t, 'Directors’ remuneration')).toBe(true);
    expect(matchesQuery(t, "owners' capital")).toBe(true);
    expect(matchesQuery({ ...term('tm_x', "Owner's equity") }, 'owner’s')).toBe(true);
  });

  it('英文介面找得到中文主名稱', () => {
    const t = term('tm_1ebm48ca', 'DuPont analysis', { teacherLabel: '杜邦分析法', otherLabel: '杜邦分析' });
    expect(matchesQuery(t, '杜邦分析')).toBe(true);
  });

  it('withOtherLabels 從另一語系的索引補名稱；名稱相同或已經有的不動', () => {
    const terms = [term('tm_a', '流動比率'), term('tm_b', 'ROE'), term('tm_c', '速動比率', { otherLabel: 'Quick ratio' })];
    const other = [
      { id: 'tm_a', label: 'Current ratio' },
      { id: 'tm_b', label: 'ROE' },
      { id: 'tm_c', label: 'Acid-test ratio' },
    ];
    const out = withOtherLabels(terms, other);
    expect(out[0]!.otherLabel).toBe('Current ratio');
    expect(out[1]).toBe(terms[1]);
    expect(out[2]!.otherLabel).toBe('Quick ratio');
  });

  it('hasOtherLabels：索引已經帶另一種語言的名稱時不必再讀另一語系', () => {
    expect(hasOtherLabels([])).toBe(false);
    expect(hasOtherLabels([term('tm_a', 'a', { otherLabel: 'A' })])).toBe(true);
    expect(hasOtherLabels([term('tm_a', 'a', { otherLabel: 'A' }), term('tm_b', 'b')])).toBe(false);
  });
});

describe('levelCode', () => {
  // 和 features/home/codes.ts 的 useLevelCodeFormatter 同樣的形狀（測試不經 Lingui）
  const code = (c: number, l: number, ext: boolean) => (ext ? `E${c}-${l}` : `${c}-${l}`);
  it('章序與關序組成「1-2」；不知道關序時沒有代號', () => {
    expect(levelCode({ chapterNo: 1, levelNo: 2, extension: false }, code)).toBe('1-2');
    expect(levelCode({ chapterNo: 3, levelNo: undefined, extension: false }, code)).toBeUndefined();
  });
  it('延伸章的代號和章節頁、地圖、首頁一樣是 E4-1（看圖驗收第 3 輪），不是「延伸 4-1」', () => {
    expect(levelCode({ chapterNo: 4, levelNo: 1, extension: true }, code)).toBe('E4-1');
  });
});

describe('newlyCollected（蓋章動畫）', () => {
  const unlocked = new Map([
    ['tm_a', '2026-10-20'],
    ['tm_b', '2026-10-21'],
  ]);
  it('上次離開時沒有、現在有的名詞', () => {
    expect([...newlyCollected(['tm_a'], unlocked)]).toEqual(['tm_b']);
  });
  it('讀不到上次的清單或進度還沒讀到時一張都不播', () => {
    expect(newlyCollected(null, unlocked).size).toBe(0);
    expect(newlyCollected(['tm_a'], null).size).toBe(0);
  });
});

describe('groupProgress', () => {
  it('一組名詞裡已收進幾個；進度還沒讀到時 done 是 null', () => {
    const terms = [term('tm_a', 'a'), term('tm_b', 'b'), term('tm_c', 'c')];
    expect(groupProgress(terms, new Map([['tm_b', 'x']]))).toEqual({ done: 1, total: 3 });
    expect(groupProgress(terms, null)).toEqual({ done: null, total: 3 });
  });
});

describe('返回名詞圖鑑（finding glossary-4）', () => {
  it('history state 裡的查詢字串只取字串', () => {
    expect(glossaryReturnSearch({ llGlossarySearch: 'q=%E6%AF%94&group=name' })).toBe('q=%E6%AF%94&group=name');
    expect(glossaryReturnSearch({ llGlossarySearch: 3 })).toBeUndefined();
    expect(glossaryReturnSearch(null)).toBeUndefined();
    expect(glossaryReturnSearch('x')).toBeUndefined();
  });
  it('只帶回 q 與 group；沒有時是乾淨的 /terms/', () => {
    expect(glossaryReturnPath('/terms/', 'q=%E6%AF%94%E7%8E%87&group=name&x=1')).toBe('/terms/?q=%E6%AF%94%E7%8E%87&group=name');
    expect(glossaryReturnPath('/en/terms/', 'group=name')).toBe('/en/terms/?group=name');
    expect(glossaryReturnPath('/terms/', '')).toBe('/terms/');
    expect(glossaryReturnPath('/terms/', undefined)).toBe('/terms/');
    expect(glossaryReturnPath('/terms/', 'x=1')).toBe('/terms/');
  });
});
