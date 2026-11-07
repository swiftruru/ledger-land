// 實驗室自己的小標籤（03 第 3.13 節的 IFRS 對照）：「與教材口徑不同」（報表列）、「IFRS 下的處理不同」（交易卡）、「IFRS 對照，不計分」（來源面板副標，沿用 NoteTag 那一句）。
// 外觀沿用 web-ui 的 .ll-notetag，字串放第三層 lab catalog，不加進 web-ui 的 NoteTag kind（那是每一頁第一波的 catalog）。
import { useLingui } from '@lingui/react/macro';
import { useNoteTagLabels } from '@ledgerland/web-ui';

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

export function LabTag({ kind, className, testId }: { kind: LabTagKind; className?: string; testId?: string }) {
  const labels = useLabTagLabels();
  return (
    <span className={`ll-notetag ll-lab-tag ll-lab-tag--${kind}${className ? ` ${className}` : ''}`} data-testid={testId}>
      {labels[kind]}
    </span>
  );
}
