import { useEffect, useRef, useState } from 'react';

/** 依 key 重新執行的非同步值；卸載或 key 變動後的舊結果不會寫進狀態。run 每次都可以是新的閉包，只有 key 變了才重新執行 */
export function useAsync<T>(run: () => Promise<T>, key: string): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | undefined>(undefined);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    let alive = true;
    runRef.current().then(
      (value) => alive && setState({ key, value }),
      () => alive && setState(undefined),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return state?.key === key ? state.value : undefined;
}
