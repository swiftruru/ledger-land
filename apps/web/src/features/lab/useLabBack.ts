// 實驗室子頁返回鍵的字（站規 2.0 的返回目的地表）：短字「實驗室」，可讀名稱「回到實驗室」。放在 features 裡而不是某個頁面：
// 頁面檔之間互相 import 會讓 Vite 把被 import 的頁面併進共用 chunk，殼層依路徑預先載入的表就找不到它（tools/postbuild.mjs）。
import { useLingui } from '@lingui/react/macro';

export function useLabBack(): { short: string; label: string } {
  const { t } = useLingui();
  return {
    short: t({ id: 'lab.back.short', message: '實驗室', comment: '實驗室子頁頂部返回鍵上的短字' }),
    label: t({ id: 'lab.back', message: '回到實驗室', comment: '實驗室子頁頂部返回鍵的可讀名稱' }),
  };
}
