// 「IFRS 對照，不計分」的標示（03 第 3.13 節、10 第 11.2 節完成標準第 5 條）：切到 IFRS 對照時每個實驗室畫面都有。分成兩塊：
// BasisBanner 是不被捲走的那一列（圖示加 web-ui 的 NoteTag，kind ifrs_not_scored，字串在第一層 catalog）：步驟頁放在固定在上方的區塊裡，
// 自由實驗的報表區與指標實驗室自己固定（ll-lab-basis--sticky）。只有一列，320 寬時才不會蓋掉四分之一個畫面。
// BasisNote 是緊接在下面的說明，跟著內容捲走：一句差異標記的說明，一句依據的準則版本（04 第 10.2 節：ifrs@1 以目前的 IAS 1 與 IAS 7 為準）。
// 自由實驗的 IFRS 重播算不出來時（failed，理論上不太會發生；failedText 帶步驟與原因）說明句留在固定的那一列：這時畫面上是教材數字，不能捲到只剩「IFRS 對照」的標記。
import { useLingui } from '@lingui/react/macro';
import { InfoIcon, NoteTag } from '@ledgerland/web-ui';

export interface BasisBannerProps {
  failed?: boolean;
  /** IFRS 算不下去的那一步與原因（已代入的一句）；沒有就用通用的一句 */
  failedText?: string;
  className?: string;
}

export function BasisBanner({ failed = false, failedText, className }: BasisBannerProps) {
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
      {failed && (
        <span className="ll-lab-basis__text">
          {failedText ??
            t({
              id: 'lab.policy.ifrsFailed',
              message: 'IFRS 對照算不出這組修改，先顯示教材口徑的數字。',
              comment: '自由實驗：IFRS 口徑重播失敗而教材口徑成功時的說明',
            })}
        </span>
      )}
    </p>
  );
}

/** 橫幅下面的說明；noCompare：顯示 IFRS 數字但沒有教材數字可比，不說「有標記」 */
export function BasisNote({ noCompare = false }: { noCompare?: boolean }) {
  const { t } = useLingui();
  return (
    <p className="ll-lab-basis-note" data-testid="lab-basis-note">
      {noCompare
        ? t({
            id: 'lab.policy.bannerNoCompare',
            message: '數字依 IFRS 的處理重算；教材口徑算不下去，所以這裡沒有差異標記。',
            comment: '自由實驗的舊存檔：教材口徑重播失敗、只有 IFRS 數字時的說明句',
          })
        : t({
            id: 'lab.policy.banner',
            message: '數字依 IFRS 的處理重算；和教材口徑不同的列有標記。',
            comment: 'IFRS 對照橫幅下面的說明句',
          })}
      <span className="ll-lab-basis-note__version" data-testid="lab-basis-version">
        {t({
          id: 'lab.policy.version',
          message: '依現行 IAS 1 與 IAS 7，不是 IFRS 18。',
          comment: 'IFRS 對照的說明：依據的準則版本（10 第 11.2 節）；IAS、IFRS 與編號不翻譯',
        })}
      </span>
    </p>
  );
}
