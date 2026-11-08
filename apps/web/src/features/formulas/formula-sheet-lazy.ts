// 公式面板的動態載入點（FormulaPills.tsx 用）：第一次按膠囊才載 FormulaSheet（含 Sheet 與條目的五段），和名詞卡一樣不在作答頁第一波。
// 失敗不留著被拒絕的 Promise，下一次再 import。
export type FormulaSheetComponent = typeof import('./FormulaSheet.tsx').FormulaSheet;

let promise: Promise<FormulaSheetComponent> | null = null;

export function loadFormulaSheet(): Promise<FormulaSheetComponent> {
  promise ??= import('./FormulaSheet.tsx').then(
    (m) => m.FormulaSheet,
    (e: unknown) => {
      promise = null;
      throw e;
    },
  );
  return promise;
}
