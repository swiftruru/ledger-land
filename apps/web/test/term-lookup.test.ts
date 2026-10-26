// 名詞資料對應科目與指標（04 第 16.3 節，quiz-16、quiz-17）：名詞索引的 ratioRef 帶版本（current_ratio@excel），
// 分類題的指標卡只寫 ID（roe）、交易影響題的目標帶版本：兩種都要找到名詞，畫面顯示名詞名稱，不顯示內部代號
import { describe, expect, it } from 'vitest';
import type { TermIndexEntry } from '../src/lib/content.ts';
import { termByRef } from '../src/features/quiz/term-lookup.ts';

const entry = (id: string, label: string, extra: Partial<TermIndexEntry>): TermIndexEntry => ({
  id,
  category: 'ratio',
  label,
  teacherLabel: label,
  currentTwLabel: null,
  ifrsEnglish: null,
  flags: [],
  ...extra,
});

const terms = new Map(
  [
    entry('tm_c8r1t4zm', '流動比率', { ratioRef: 'current_ratio@excel' }),
    entry('tm_r0e00001', '股東權益報酬率', { ratioRef: 'roe@excel' }),
    entry('tm_cash0001', '現金', { category: 'account', accountRef: 'cash' }),
  ].map((t) => [t.id, t] as const),
);

describe('termByRef', () => {
  it('指標：只寫 ID、帶同一個版本、帶別的版本都找得到', () => {
    expect(termByRef(terms, 'ratioRef', 'roe')?.label).toBe('股東權益報酬率');
    expect(termByRef(terms, 'ratioRef', 'current_ratio@excel')?.label).toBe('流動比率');
    expect(termByRef(terms, 'ratioRef', 'current_ratio')?.label).toBe('流動比率');
    expect(termByRef(terms, 'ratioRef', 'current_ratio@slides02')?.label).toBe('流動比率');
    expect(termByRef(terms, 'ratioRef', 'debt_ratio')).toBeUndefined();
  });
  it('科目：照舊用完整的 accountRef 比對；不會把指標 ID 當成科目', () => {
    expect(termByRef(terms, 'accountRef', 'cash')?.label).toBe('現金');
    expect(termByRef(terms, 'accountRef', 'roe')).toBeUndefined();
  });
});
