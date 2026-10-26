// 名詞卡與名詞頁的欄位對應（features/quiz/term-fields.ts）：每個欄位放在自己的段落，note 放在「用語說明」，不放在「例子」
import { describe, expect, it } from 'vitest';
import { TERM_FIELD_ORDER, termFieldsOf } from '../src/features/quiz/term-fields.ts';

describe('termFieldsOf', () => {
  it('note、formula、example、misconception、ifrsNote 各對到自己的欄位', () => {
    expect(termFieldsOf({ note: '用語說明', formula: '公式 {{percent:1.3}}', example: '例子', misconception: '誤解', ifrsNote: 'IFRS' })).toEqual({
      note: '用語說明',
      formula: '公式 {{percent:1.3}}',
      example: '例子',
      misconception: '誤解',
      ifrsNote: 'IFRS',
    });
  });
  it('沒有 example 時不會拿 note 補上；缺欄位與空字串都省略', () => {
    const f = termFieldsOf({ note: '說明', example: '  ' });
    expect(f).toEqual({ note: '說明' });
    expect(f.example).toBeUndefined();
  });
  it('段落順序：用語說明、公式、例子、常見誤解、IFRS 怎麼處理（與名詞卡相同）', () => {
    expect(TERM_FIELD_ORDER).toEqual(['note', 'formula', 'example', 'misconception', 'ifrsNote']);
  });
});
