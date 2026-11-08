// 實驗室自己的小標籤（03 第 3.13 節的 IFRS 對照）：「與教材口徑不同」（報表列）、「IFRS 下的處理不同」（交易卡）、「IFRS 對照，不計分」（來源面板副標，沿用 NoteTag 那一句）。
// 外觀沿用 web-ui 的 .ll-notetag，字串放第三層 lab catalog，不加進 web-ui 的 NoteTag kind（那是每一頁第一波的 catalog）。
import { useLingui } from '@lingui/react/macro';
import { NoteTagButton, useNoteTagLabels } from '@ledgerland/web-ui';
import type { MouseEvent } from 'react';

export type LabTagKind = 'diff' | 'policy' | 'ifrs';

export function useLabTagLabels(): Record<LabTagKind, string> {
  const { t } = useLingui();
  const notes = useNoteTagLabels();
  return {
    diff: t({ id: 'lab.policy.rowDiff', message: '與教材口徑不同', comment: 'IFRS 對照時，金額和教材口徑不一樣的報表列的標記' }),
    policy: t({ id: 'lab.policy.differs', message: 'IFRS 下的處理不同', comment: '交易卡的標記：這一步的範本在 IFRS 下的分錄不一樣' }),
    ifrs: notes.ifrs_not_scored,
  };
}

export interface LabTagProps {
  kind: LabTagKind;
  className?: string;
  testId?: string;
  /** 給了就是按鈕（和 NoteTag 的按鈕形式同一套外觀）：按下開名詞卡；subject 是列名，opens 決定可讀名稱說的是哪一段 */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  subject?: string;
  opens?: 'ifrs' | 'term';
}

export function LabTag({ kind, className, testId, onClick, subject, opens = 'term' }: LabTagProps) {
  const { t } = useLingui();
  const labels = useLabTagLabels();
  const text = labels[kind];
  if (!onClick)
    return (
      <span className={`ll-notetag ll-lab-tag ll-lab-tag--${kind}${className ? ` ${className}` : ''}`} data-testid={testId}>
        {text}
      </span>
    );
  const line = subject ?? '';
  const a11y =
    opens === 'ifrs'
      ? t({
          id: 'lab.policy.tag.a11yIfrs',
          message: `${text}：${line}。查看 IFRS 怎麼處理`,
          comment: '差異標記按鈕的可讀名稱（名詞卡有 IFRS 段落）；text 是標籤文字、line 是列名',
        })
      : t({
          id: 'lab.policy.tag.a11yTerm',
          message: `${text}：${line}。看名詞卡`,
          comment: '差異標記按鈕的可讀名稱（名詞卡沒有 IFRS 段落）；text 是標籤文字、line 是列名',
        });
  return (
    <NoteTagButton text={text} pillClassName={`ll-lab-tag ll-lab-tag--${kind}`} a11y={a11y} onClick={onClick} className={className} data-testid={testId} />
  );
}
