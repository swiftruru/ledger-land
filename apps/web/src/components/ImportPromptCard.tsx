// 主畫面 App 第一次啟動的「要從 Safari 匯入進度嗎？」（06 第 4.7 節第 3 步、02 第 6 節）：App 模式且資料庫是空的才出現，
// 選過任何一個選項就記在 settings 的 importPromptAnswered，之後不再出現。匯入一律預設合併（備份頁）。
import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Button, Card } from '@ledgerland/web-ui';
import { isAppMode } from '../lib/env.ts';
import { nowIso } from '../lib/progress/app-info.ts';
import { whenIdle } from '../lib/idle.ts';
import { getProgressStore, hasNoProgress } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';

export const IMPORT_PROMPT_SETTING = 'importPromptAnswered';

async function shouldShow(): Promise<boolean> {
  if (!isAppMode()) return false;
  const store = await getProgressStore();
  const answered = await store.getSetting(IMPORT_PROMPT_SETTING);
  if (answered !== undefined) return false;
  return hasNoProgress(store);
}

async function markAnswered(choice: 'code' | 'file' | 'fresh'): Promise<void> {
  const store = await getProgressStore();
  await store.setSetting(IMPORT_PROMPT_SETTING, { choice, at: nowIso() }, nowIso());
}

export function ImportPromptCard() {
  const locale = useLocale();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    // 進度資料庫等第一次閒置再開（06 第 8.2 節）：這個元件會插在內容上方，不能再多等 afterFirstPaint 的 400ms，否則會在使用者開始捲動後才把內容往下推
    const cancel = whenIdle(() => {
      void shouldShow().then((v) => alive && setShow(v));
    });
    return () => {
      alive = false;
      cancel();
    };
  }, []);
  if (!show) return null;
  return (
    <Card as="section" className="ll-import-prompt" aria-labelledby="ll-import-prompt-title">
      <h2 id="ll-import-prompt-title">
        <Trans id="importPrompt.title">要從 Safari 匯入進度嗎？</Trans>
      </h2>
      <p className="ll-small">
        <Trans id="importPrompt.body">如果你之前在 Safari 分頁練習過，先在那裡「匯出到 App」，再回到這裡貼上備份碼或選擇備份檔；匯入會和這裡的紀錄合併。</Trans>
      </p>
      <div className="ll-row">
        <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/me/backup/') + '?import=code'} onClick={() => void markAnswered('code')}>
          <Trans id="importPrompt.code">貼上備份碼</Trans>
        </Link>
        <Link className="ll-btn" to={localePath(locale, '/me/backup/') + '?import=file'} onClick={() => void markAnswered('file')}>
          <Trans id="importPrompt.file">選擇備份檔</Trans>
        </Link>
        <Button
          onClick={() => {
            setShow(false);
            void markAnswered('fresh');
          }}
        >
          <Trans id="importPrompt.fresh">從頭開始</Trans>
        </Button>
      </div>
    </Card>
  );
}
