// 苦練首頁的三步（2026-11-06）：先讀題（背題瀏覽）、再自己練（作答）、最後模擬考。三張卡的順序固定，
// 這裡只決定哪一張掛「建議」的標籤、主要按鈕用實心的那一顆。純函式。
export type ExamStep = 'read' | 'practise' | 'mock';

/**
 * 建議的步驟：
 * - 還沒作答過，而且還有題沒讀：先讀題（新來的人，或正在讀的人）
 * - 作答過，或全部讀完了：自己練
 * - 每一題都練過了：模擬考
 */
export function recommendedStep({ total, read, practised }: { total: number; read: number; practised: number }): ExamStep {
  if (total <= 0) return 'read';
  if (practised >= total) return 'mock';
  if (practised === 0 && read < total) return 'read';
  return 'practise';
}
