// 作答區「還沒齊」的回報與延後載入模組的 hook（維護者 2026-10-26 的要求：點進任何一頁都要直接看到完整的資訊，不先畫版面再補內容）。
// 題目元件還缺東西（四種題型的元件模組、核心資料、報表卡片的名詞定義）時用 usePendingReport(true) 回報；LevelSession 用 usePendingScope 收集：
// 第一題還沒齊時整頁不出現（lib/page-ready.tsx），之後換到還沒齊的題目時整張題目卡先不顯示、齊了再淡入（15-quiz-session.css 的 .ll-question-wrap）。
// 回報用 useLayoutEffect：換題的那一次 commit 裡就把「還沒齊」記下來並同步重畫，畫面上不會有一格只有題幹沒有作答區。
// 沒有 scope（錯題本頁）時回報是空操作。檔名沿用 useAsync（vite.config.ts 的 quiz-view 群組以檔名列出）。
import { createContext, useContext, useEffect, useId, useLayoutEffect, useState } from 'react';
import { coreDataNow, loadCoreData, loadQuestionTypes, questionTypesNow, type CoreData, type QuestionTypesModule } from './lazy-data.ts';

export interface PendingRegistry {
  /** 回報某個 id 目前還沒齊（true）、齊了（false）；卸載時傳 null */
  report: (id: string, pending: boolean | null) => void;
}

export const PendingContext = createContext<PendingRegistry | null>(null);

/** 還沒齊的 id 集合的下一個狀態：沒變時回傳同一個集合（setState 不重畫） */
export function nextPendingSet(set: ReadonlySet<string>, id: string, pending: boolean | null): ReadonlySet<string> {
  const has = set.has(id);
  if (pending === true && !has) return new Set([...set, id]);
  if (pending !== true && has) {
    const next = new Set(set);
    next.delete(id);
    return next;
  }
  return set;
}

/** 題目元件回報自己的作答區齊了沒 */
export function usePendingReport(pending: boolean): void {
  const reg = useContext(PendingContext);
  const id = useId();
  useLayoutEffect(() => {
    reg?.report(id, pending);
  }, [reg, id, pending]);
  useLayoutEffect(() => () => reg?.report(id, null), [reg, id]);
}

/** 收集作答區的回報：registry 給 PendingContext.Provider，pending 是「目前有元件還沒齊」 */
export function usePendingScope(): { registry: PendingRegistry; pending: boolean } {
  const [set, setSet] = useState<ReadonlySet<string>>(() => new Set());
  const [registry] = useState<PendingRegistry>(() => ({
    report(id, pending) {
      setSet((s) => nextPendingSet(s, id, pending));
    },
  }));
  return { registry, pending: set.size > 0 };
}

type Loaded<T> = { value: T; error?: undefined } | { value: null; error: unknown } | { value: null; error?: undefined };

/** 延後載入的模組：已經載好就同步給值（換題時第一次渲染就完整）；還沒載好先給 null 並開始載，失敗時 error 有值（呼叫端決定丟給 RouteError 或降級） */
function useLoadedModule<T>(now: () => T | null, load: () => Promise<T>, enabled: boolean): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>(() => {
    const v = now();
    return v === null ? { value: null } : { value: v };
  });
  const missing = enabled && state.value === null && state.error === undefined;
  useEffect(() => {
    if (!missing) return;
    const v = now();
    if (v !== null) {
      setState({ value: v });
      return;
    }
    let alive = true;
    load().then(
      (m) => alive && setState({ value: m }),
      (error: unknown) => alive && setState({ value: null, error }),
    );
    return () => {
      alive = false;
    };
  }, [missing, now, load]);
  return state;
}

/** 核心資料（科目表、教材版面、指標登錄檔）；enabled 為 false 的題目不載 */
export function useCoreData(enabled = true): Loaded<CoreData> {
  return useLoadedModule(coreDataNow, loadCoreData, enabled);
}

/** 分錄、五步驟、指標計算、交易影響的題型元件 */
export function useQuestionTypes(): Loaded<QuestionTypesModule> {
  return useLoadedModule(questionTypesNow, loadQuestionTypes, true);
}
