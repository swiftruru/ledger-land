// 實驗室能切換的兩套口徑的 ID（03 第 3.13 節）：教材是預設，IFRS 對照不計分。
// 單獨一個檔，讓第一波的頁面與設定（lab-view.ts）不必為了兩個常數載入整個核心（lab-core.ts 由 lazy-core.ts 動態載入）。
export type LabPolicyId = 'teacher@1' | 'ifrs@1';
export const TEACHER_POLICY: LabPolicyId = 'teacher@1';
export const IFRS_POLICY: LabPolicyId = 'ifrs@1';
