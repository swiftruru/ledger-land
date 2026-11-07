// 「IFRS 對照，不計分」橫幅（03 第 3.13 節、10 第 11.2 節完成標準第 5 條）：切到 IFRS 對照時每個實驗室畫面都有，放在固定在上方的區塊裡。
// 圖示加 web-ui 的 NoteTag（kind ifrs_not_scored，字串在第一層 catalog）加一句說明；自由實驗的 IFRS 重播算不出來時改成說明句（防呆，理論上不會發生）。
import { useLingui } from '@lingui/react/macro';
import { InfoIcon, NoteTag } from '@ledgerland/web-ui';

export function BasisBanner({ failed = false, className }: { failed?: boolean; className?: string }) {
  const { t } = useLingui();
  return (
    <p
      className={`ll-lab-basis${failed ? ' is-failed' : ''}${className ? ` ${className}` : ''}`}
      data-testid="lab-basis"
      data-failed={failed ? 'true' : undefined}
    >
      <span className="ll-lab-basis__icon" aria-hidden="true">
        <InfoIcon />
      </span>
      <NoteTag kind="ifrs_not_scored" />
      <span className="ll-lab-basis__text">
        {failed
          ? t({
              id: 'lab.policy.ifrsFailed',
              message: 'IFRS 對照算不出這組修改，先顯示教材口徑的數字。',
              comment: '自由實驗：IFRS 口徑重播失敗而教材口徑成功時的說明',
            })
          : t({
              id: 'lab.policy.banner',
              message: '數字依 IFRS 的處理重算；和教材口徑不同的列有標記。',
              comment: 'IFRS 對照橫幅的說明句',
            })}
      </span>
    </p>
  );
}
