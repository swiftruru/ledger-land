// 來源面板或它要用的核心載入失敗時的提示（03 第 3.9 節）：不搶焦點，放在頁面常駐的 ToastRegion 裡才會被播報。
// 不自己消失：使用者要知道剛才那一下沒有成功。第一次給「再試一次」，頁面帶著原本的目標再開一次（lazy-trace.ts 與 lazy-core.ts 失敗時不留著被拒絕的 Promise）。
// 重試還是失敗就換成重新載入：WebKit 把失敗的動態 import 記在這份文件的模組表裡，再 import 同一個網址不會發請求（2026-11-07 實測），只有換一份文件才讀得到。
import { useLingui } from '@lingui/react/macro';
import { Toast } from '@ledgerland/web-ui';

export interface TraceLoadToastProps {
  /** 這次失敗是「再試一次」之後的 */
  retried: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function TraceLoadToast({ retried, onRetry, onDismiss }: TraceLoadToastProps) {
  const { t } = useLingui();
  return (
    <Toast
      kind="danger"
      onDismiss={onDismiss}
      action={
        retried
          ? {
              label: t({ id: 'lab.trace.loadReload', message: '重新載入', comment: '來源面板重試仍失敗的提示裡的按鈕：重新載入這一頁' }),
              onClick: () => window.location.reload(),
            }
          : { label: t({ id: 'lab.trace.loadRetry', message: '再試一次', comment: '來源面板載入失敗的提示裡的按鈕：重新開啟同一個數字' }), onClick: onRetry }
      }
    >
      {retried
        ? t({ id: 'lab.trace.loadStuck', message: '還是讀不到這個數字的來源，重新載入這一頁再試試。', comment: '按了再試一次仍載入失敗時的提示' })
        : t({ id: 'lab.trace.loadError', message: '讀不到這個數字的來源，可能是離線了。', comment: '來源面板的模組或核心載入失敗（離線）時的提示' })}
    </Toast>
  );
}
