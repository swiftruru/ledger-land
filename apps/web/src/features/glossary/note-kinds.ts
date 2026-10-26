// 名詞旗標裡要畫成 NoteTag（「舊稱」「簡化」「非 IFRS 項目」等）的幾種：名詞頁頁首與名詞卡（作答頁的 TermSheet）共用同一份，
// 同一個名詞在兩個地方標的東西一樣（M3 看圖驗收第 5 輪）。其餘旗標（japanese、typo_fixed、unused、ifrs_treatment_differs）
// 是內容管理用的，不顯示；它們的說明寫在「用語說明」與「IFRS 怎麼處理」段落裡。
import type { NoteTagKind } from '@ledgerland/web-ui';

export const TERM_NOTE_KINDS: readonly NoteTagKind[] = ['old_name', 'simplified', 'single_period', 'not_ifrs_line', 'ifrs_not_scored', 'design_note'];

/** 名詞的旗標中要顯示成 NoteTag 的部分，順序照內容裡的順序 */
export function termNoteKinds(flags: readonly string[]): NoteTagKind[] {
  return flags.filter((f): f is NoteTagKind => (TERM_NOTE_KINDS as readonly string[]).includes(f));
}
