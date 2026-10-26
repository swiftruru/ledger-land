// 名詞旗標裡要畫成 NoteTag 的部分（features/glossary/note-kinds.ts）：名詞頁頁首與名詞卡共用
import { describe, expect, it } from 'vitest';
import { TERM_NOTE_KINDS, termNoteKinds } from '../src/features/glossary/note-kinds.ts';

describe('termNoteKinds', () => {
  it('只留下舊稱、簡化、非 IFRS 項目等註記，順序照內容', () => {
    expect(termNoteKinds(['not_ifrs_line', 'japanese', 'old_name'])).toEqual(['not_ifrs_line', 'old_name']);
    expect(termNoteKinds(['simplified'])).toEqual(['simplified']);
  });

  it('內容管理用的旗標（日式用語、筆誤、未使用、IFRS 處理不同）不顯示', () => {
    expect(termNoteKinds(['japanese', 'typo_fixed', 'unused', 'ifrs_treatment_differs'])).toEqual([]);
    expect(termNoteKinds([])).toEqual([]);
  });

  it('地圖專用的期中考與延伸標籤不是名詞的註記', () => {
    expect(TERM_NOTE_KINDS).not.toContain('midterm');
    expect(TERM_NOTE_KINDS).not.toContain('extension');
  });
});
