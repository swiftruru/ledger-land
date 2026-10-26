// 判分模組或結果頁延後載入失敗時的提示（06 第 9.1 節）：第一次造訪時網路中斷、或部署後舊的 chunk 不在了。
// 說明原因，給「再試一次」（載入器失敗後不留著被拒絕的 Promise，會重新 import）與「重新整理」；作答已經存在暫存，重新整理會還原。
// 題目還在畫面上時（按「確認答案」、還原已確認的作答）用 Banner（標題、說明、兩顆 sm 按鈕）；整個結果頁都畫不出來時用 ErrorState（鈴）。
// 關卡與錯題本共用；焦點不搶（role="alert" 會讀出），按鈕都是設計過的 Button。
import { Trans, useLingui } from '@lingui/react/macro';
import { Banner, Button, ErrorState, RetryIcon } from '@ledgerland/web-ui';

function useTexts() {
  const { t } = useLingui();
  return {
    title: t({ id: 'quiz.loadFailed.title', message: '判分的程式沒有載入成功', comment: '判分或結果頁的程式沒有載入成功時的標題' }),
    body: t({
      id: 'quiz.loadFailed.bodyShort',
      message: '可能是網路中斷或網站剛更新。你的作答已經存好，再試一次或重新整理就能繼續。',
      comment: '判分程式載入失敗的說明（標題已經說了沒有載入成功）；作答已暫存',
    }),
  };
}

const reload = () => window.location.reload();

export function LoadFailedBanner({ onRetry }: { onRetry: () => void }) {
  const text = useTexts();
  return (
    <Banner
      kind="warning"
      role="alert"
      className="ll-load-failed"
      title={text.title}
      actions={
        <>
          <Button variant="primary" size="sm" icon={<RetryIcon />} onClick={onRetry}>
            <Trans id="quiz.loadFailed.retry" comment="判分程式載入失敗時，重新載入一次的按鈕">
              再試一次
            </Trans>
          </Button>
          <Button variant="quiet" size="sm" onClick={reload}>
            <Trans id="error.reload">重新整理</Trans>
          </Button>
        </>
      }
    >
      <p>{text.body}</p>
    </Banner>
  );
}

/** 結果頁畫不出來（判分或結果頁的程式都要有）：整頁一個 ErrorState，「再試一次」由 onRetry 自動放在最前面 */
export function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  const text = useTexts();
  return (
    <ErrorState
      className="ll-load-failed"
      title={text.title}
      description={text.body}
      onRetry={onRetry}
      action={
        <Button onClick={reload}>
          <Trans id="error.reload">重新整理</Trans>
        </Button>
      }
    />
  );
}
