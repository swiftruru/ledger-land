// 延後載入失敗後可以重試（quiz-4、quiz-15）：判分、結果頁、回饋區、核心資料與四種題型的載入器都不把被拒絕的 Promise 永久留著，
// 下一次呼叫重新 import（網路恢復後不必整頁重新整理）；科目、版面與指標資料直接從 loadCoreData 取，不再多快取一層。
// 元件檔用 Lingui 巨集，Node 環境的 web 專案不跑巨集，換成記號（同 quiz-lazy-loading.test.ts）。
import { defaultAccounts } from '@ledgerland/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/quiz/question-types.tsx', () => ({ DeferredQuestionView: () => null }));
vi.mock('../src/features/quiz/FeedbackView.tsx', () => ({ FeedbackView: () => null }));

// vitest 會把替身丟出的錯誤包成自己的訊息，所以只斷言丟出的是 Error
const CHUNK_ERROR = 'Failed to fetch dynamically imported module';

/** 第一次 import 失敗、之後正常的模組替身 */
function flaky<T>(real: () => Promise<T>): { factory: () => Promise<T>; calls: () => number } {
  let n = 0;
  return {
    factory: async () => {
      n += 1;
      if (n === 1) throw new Error(CHUNK_ERROR);
      return real();
    },
    calls: () => n,
  };
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.doUnmock('../src/features/quiz/record.ts');
  vi.doUnmock('../src/features/quiz/ResultView.tsx');
  vi.doUnmock('../src/features/quiz/core-data.ts');
});

describe('loadScoring（scoring-lazy.ts）', () => {
  it('第一次 import 失敗：這次拒絕，下一次重新載入並成功', async () => {
    const m = flaky(() => vi.importActual<typeof import('../src/features/quiz/record.ts')>('../src/features/quiz/record.ts'));
    vi.doMock('../src/features/quiz/record.ts', m.factory);
    const { loadScoring } = await import('../src/features/quiz/scoring-lazy.ts');
    await expect(loadScoring()).rejects.toBeInstanceOf(Error);
    const ok = await loadScoring();
    expect(typeof ok.recordAttempt).toBe('function');
    expect(typeof ok.scoreSnapshotQuestion).toBe('function');
    // 成功之後照舊是同一個 Promise
    expect(loadScoring()).toBe(loadScoring());
  });
});

describe('loadResultView（result-lazy.ts）', () => {
  it('第一次 import 失敗：下一次重新載入', async () => {
    const ResultView = () => null;
    const m = flaky(async () => ({ ResultView }));
    vi.doMock('../src/features/quiz/ResultView.tsx', m.factory);
    const { loadResultView } = await import('../src/features/quiz/result-lazy.ts');
    await expect(loadResultView()).rejects.toBeInstanceOf(Error);
    expect(await loadResultView()).toBe(ResultView);
  });
});

describe('loadCoreData 與科目選項（lazy-data.ts、accounts-lazy.ts）', () => {
  it('核心資料第一次 import 失敗：loadCoreData 與 accountOptionsOf 第二次呼叫都成功', async () => {
    const m = flaky(() => vi.importActual<typeof import('../src/features/quiz/core-data.ts')>('../src/features/quiz/core-data.ts'));
    vi.doMock('../src/features/quiz/core-data.ts', m.factory);
    const { loadCoreData } = await import('../src/features/quiz/lazy-data.ts');
    const { accountOptionsOf } = await import('../src/features/quiz/accounts-lazy.ts');
    await expect(accountOptionsOf(['cash'], 'zh-TW', () => undefined)).rejects.toBeInstanceOf(Error);
    const options = await accountOptionsOf(['cash'], 'zh-TW', () => undefined);
    expect(options.map((o) => o.id)).toEqual(['cash']);
    expect((await loadCoreData()).defaultAccounts).toEqual(defaultAccounts);
    expect(m.calls()).toBe(2);
  });
});
