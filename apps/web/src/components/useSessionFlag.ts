// 工作階段內記住的開關（sessionStorage）：可收合的提示用它記「已收合」或「已關閉」，關掉分頁就重來（02 第 6 節：常駐提示不能永久關閉）。
import { useCallback, useState } from 'react';

export function readSessionFlag(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionFlag(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* 寫不進去只影響這一次 */
  }
}

/** 第一次 render 就同步讀出目前值，避免提示先出現再消失造成版面位移 */
export function useSessionFlag(key: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => readSessionFlag(key));
  const set = useCallback(
    (next: string | null) => {
      writeSessionFlag(key, next);
      setValue(next);
    },
    [key],
  );
  return [value, set];
}
