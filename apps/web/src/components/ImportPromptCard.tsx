// 主畫面 App 第一次啟動的「要從 Safari 匯入進度嗎？」（06 第 4.7 節第 3 步、02 第 6 節）：App 模式且資料庫是空的才出現，
// 選過任何一個選項就記在 settings 的 importPromptAnswered，之後不再出現。匯入一律預設合併（備份頁）。
// 外觀（站規 2.17，第 1 輪驗收改）：info 的 Banner（標題、說明），主動作 primary sm「貼上備份碼」帶 CopyIcon、secondary sm「選擇備份檔」帶 FileIcon；
// 「不用了」改成右上角 44px 的關閉鈕（可讀名稱「不用了，從這裡重新開始」）：手機上不再單獨一列、靠左縮排像沒對齊的殘留，兩顆動作一列放得下。
// 換行用全站規則（web-ui 的 Banner：strict 加 pretty）；說明與標題的中文詞裡事先插入看不見的 U+2060（banner-joined-ids.ts，第 7 輪），只在詞與詞之間換行、
// 「匯出到 App」不拆開（這個元件在首次載入的 chunk，不在畫面上切詞）；第 8 輪起說明裡的按鈕名稱「貼上備份碼」「選擇備份檔」也整塊不斷
// （prose-units.ts 的 UNQUOTED_NAMES：320 寬不再斷成「選擇／備份檔」，不用 rich text，首次載入的 JS 不變）。關閉鈕和標題、圖示同一個資訊色（notices.css，第 2 輪驗收：不再是 accent 的鐵鏽色）。
// 要不要顯示由 useImportPrompt 決定（只看環境與進度，一掛載就讀，不再等閒置）：null 代表還沒決定，首頁把它算進 usePageReady 的條件，
// 卡片和首頁其他內容一起出現，不會在頁面出現後才插進來把主卡往下推（維護者 2026-10-26）。
// 一個畫面一顆主按鈕（站規 5.2）：顯示時首頁主卡的按鈕暫時改成 secondary（首頁直接看 show）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { localePath } from '@ledgerland/i18n';
import { Banner, Button, FileIcon } from '@ledgerland/web-ui';
import { CopyIcon } from '@ledgerland/web-ui/map';
import { IMPORT_PROMPT_SETTING, importPromptNeeded } from '../features/me/progress-reads.ts';
import { isAppMode } from '../lib/env.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';

export { IMPORT_PROMPT_SETTING };

async function markAnswered(choice: 'code' | 'file' | 'fresh'): Promise<void> {
  const store = await getProgressStore();
  await store.setSetting(IMPORT_PROMPT_SETTING, { choice, at: nowIso() }, nowIso());
}

export interface ImportPromptState {
  /** null：還在讀進度；true：要顯示；false：不顯示（不是 App 模式、回答過、或已經有進度） */
  readonly show: boolean | null;
  /** 右上角的關閉鈕：不匯入、從這裡重新開始 */
  readonly dismiss: () => void;
}

export function useImportPrompt(): ImportPromptState {
  // 不是 App 模式時同步就能決定（絕大多數的瀏覽器分頁），不用等進度資料庫
  const [show, setShow] = useState<boolean | null>(() => (isAppMode() ? null : false));
  useEffect(() => {
    if (!isAppMode()) return;
    let alive = true;
    getProgressStore()
      .then((s) => importPromptNeeded(s, true))
      .then(
        (v) => alive && setShow(v),
        () => alive && setShow(false),
      );
    return () => {
      alive = false;
    };
  }, []);
  return {
    show,
    dismiss: () => {
      setShow(false);
      void markAnswered('fresh');
    },
  };
}

export function ImportPromptCard({ show, dismiss }: ImportPromptState) {
  const { t } = useLingui();
  const locale = useLocale();
  if (show !== true) return null;
  return (
    <Banner
      className="ll-import-prompt"
      data-testid="import-prompt"
      title={<Trans id="importPrompt.title">要從 Safari 匯入進度嗎？</Trans>}
      onDismiss={dismiss}
      dismissLabel={t({ id: 'importPrompt.skipA11y', message: '不用了，從這裡重新開始', comment: '匯入提示卡右上角關閉鈕的可讀名稱：不匯入、從這裡重新開始' })}
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            icon={<CopyIcon />}
            href={localePath(locale, '/me/backup/') + '?import=code'}
            onClick={() => void markAnswered('code')}
          >
            <Trans id="importPrompt.code">貼上備份碼</Trans>
          </Button>
          <Button size="sm" icon={<FileIcon />} href={localePath(locale, '/me/backup/') + '?import=file'} onClick={() => void markAnswered('file')}>
            <Trans id="importPrompt.file">選擇備份檔</Trans>
          </Button>
        </>
      }
    >
      <p>
        <Trans id="importPrompt.body">如果你之前在 Safari 分頁練習過，先在那裡「匯出到 App」，再回到這裡貼上備份碼或選擇備份檔；匯入會和這裡的紀錄合併。</Trans>
      </p>
    </Banner>
  );
}
