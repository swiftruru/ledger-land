// 背題瀏覽的關鍵字搜尋（features/exam/search.ts）：純函式，題目是自己編的
import { describe, expect, it } from 'vitest';
import type { HandoutQuestionSnapshot } from '../src/lib/content.ts';
import { buildSearchIndex, excerptOf, highlightOf, matchesTerms, matchingIds, normaliseText, searchTerms } from '../src/features/exam/search.ts';

const q = (
  id: string,
  parts: Partial<Pick<HandoutQuestionSnapshot, 'topic' | 'scenario' | 'question' | 'explanation'>> & { options?: string[] },
): HandoutQuestionSnapshot => ({
  id,
  rev: 1,
  revKind: 'text',
  answerRev: 1,
  deck: 'd1',
  section: 'd1s1',
  slide: 1,
  topic: parts.topic ?? '主題',
  scenario: parts.scenario ?? '情境。',
  question: parts.question ?? '問題？',
  options: (parts.options ?? ['甲', '乙', '丙']).map((text, i) => ({ letter: (['A', 'B', 'C'] as const)[i]!, text })),
  answer: ['B'],
  explanation: parts.explanation ?? '解析。',
});

const questions = [
  q('hq_a', { topic: '營業毛利', scenario: '一家咖啡店的營業收入是 100 萬元。' }),
  q('hq_b', { topic: '存貨週轉率', options: ['看現金流量表', '看 ROE 與毛利率', '看負債比率'] }),
  q('hq_c', { topic: '現金流量', explanation: '淨利不等於現金；存貨增加會讓現金變少。' }),
  q('hq_d', { topic: '股東權益報酬率', question: 'ROE 被什麼墊高？' }),
];
const index = buildSearchIndex(questions);
const ids = questions.map((x) => x.id);

describe('搜尋的正規化與拆詞', () => {
  it('全形英數變半形、小寫、空白收成一格', () => {
    expect(normaliseText('  ＲＯＥ　與  roa ')).toBe('roe 與 roa');
  });
  it('用空白隔開的詞；空的輸入沒有詞；重複的詞只留一個', () => {
    expect(searchTerms('現金  存貨')).toEqual(['現金', '存貨']);
    expect(searchTerms('   ')).toEqual([]);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('ROE roe')).toEqual(['roe']);
  });
});

describe('比對', () => {
  it('標題、情境、問題、選項、解析都比', () => {
    expect(matchingIds(ids, index, searchTerms('毛利'))).toEqual(['hq_a', 'hq_b']);
    expect(matchingIds(ids, index, searchTerms('咖啡店'))).toEqual(['hq_a']);
    expect(matchingIds(ids, index, searchTerms('墊高'))).toEqual(['hq_d']);
    expect(matchingIds(ids, index, searchTerms('負債比率'))).toEqual(['hq_b']);
    expect(matchingIds(ids, index, searchTerms('淨利'))).toEqual(['hq_c']);
  });
  it('不分大小寫與全形半形；結果照原本的順序', () => {
    expect(matchingIds(ids, index, searchTerms('roe'))).toEqual(['hq_b', 'hq_d']);
    expect(matchingIds(ids, index, searchTerms('ＲＯＥ'))).toEqual(['hq_b', 'hq_d']);
    expect(matchingIds(['hq_d', 'hq_b'], index, searchTerms('ROE'))).toEqual(['hq_d', 'hq_b']);
  });
  it('幾個詞要全部都有', () => {
    expect(matchingIds(ids, index, searchTerms('現金 存貨'))).toEqual(['hq_b', 'hq_c']);
    expect(matchingIds(ids, index, searchTerms('現金 墊高'))).toEqual([]);
  });
  it('一個詞不會跨兩個欄位比中', () => {
    // hq_a 的標題結尾是「毛利」、情境開頭是「一家」
    expect(matchingIds(ids, index, searchTerms('毛利一家'))).toEqual([]);
  });
  it('沒有詞時每一題都算；索引裡沒有的題不算', () => {
    expect(matchingIds(ids, index, [])).toEqual(ids);
    expect(matchesTerms(index, 'hq_zzz', [])).toBe(true);
    expect(matchesTerms(index, 'hq_zzz', ['現金'])).toBe(false);
  });
});

describe('標出比中的字', () => {
  it('切成前面、比中的字、後面；用原文的大小寫', () => {
    expect(highlightOf('看 ROE 與毛利率', ['roe'])).toEqual({ before: '看 ', hit: 'ROE', after: ' 與毛利率' });
    expect(highlightOf('營業毛利', ['毛利'])).toEqual({ before: '營業', hit: '毛利', after: '' });
  });
  it('幾個詞時標最前面的那一個；都沒有時是 null', () => {
    expect(highlightOf('存貨增加會讓現金變少', ['現金', '存貨'])?.hit).toBe('存貨');
    expect(highlightOf('營業毛利', ['現金'])).toBeNull();
    expect(highlightOf('營業毛利', [])).toBeNull();
  });
  it('摘錄：標題以外第一個比中的地方，前後太長就截掉並加刪節號', () => {
    const long = q('hq_x', { scenario: `${'前'.repeat(30)}現金${'後'.repeat(40)}` });
    const e = excerptOf(long, ['現金'])!;
    expect(e.hit).toBe('現金');
    expect(e.before).toBe(`…${'前'.repeat(10)}`);
    expect(e.after).toBe(`${'後'.repeat(28)}…`);
    // 短的不加刪節號
    expect(excerptOf(questions[3]!, ['墊高'])).toEqual({ before: 'ROE 被什麼', hit: '墊高', after: '？' });
    // 選項與解析也找得到
    expect(excerptOf(questions[1]!, ['負債比率'])?.hit).toBe('負債比率');
    expect(excerptOf(questions[2]!, ['淨利'])?.before).toBe('');
  });
  it('只有標題比中時沒有摘錄', () => {
    expect(excerptOf(questions[0]!, ['營業毛利'])).toBeNull();
  });
});
