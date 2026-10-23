// App 內建瀏覽器的提醒（06 第 4.8 節第 2 點、02 第 9.6 節）：LINE、Facebook、Instagram 裡開啟時，所有頁面頂部常駐但可收合（收合記在 sessionStorage），
// 附「複製連結」讓學生貼到 Safari 或 Chrome；不阻擋學習。是否顯示由 Banners.tsx 依 isInAppBrowser() 決定。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Banner, Button } from '@ledgerland/web-ui';
import { inAppBrowserName } from '../lib/env.ts';
import { useSessionFlag } from './useSessionFlag.ts';

export const IN_APP_COLLAPSED_KEY = 'll:inapp-collapsed';

export function InAppBrowserBanner() {
  const { t } = useLingui();
  const [collapsed, setCollapsed] = useSessionFlag(IN_APP_COLLAPSED_KEY);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const app = inAppBrowserName() ?? t({ id: 'inapp.generic', message: '這個 App', comment: '認不出是哪個 App 的內建瀏覽器時，橫幅裡代替 App 名稱的字' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 3000);
  };

  if (collapsed === '1') {
    return (
      <div className="ll-row ll-inapp ll-inapp--collapsed" data-testid="inapp-collapsed">
        <Button className="ll-btn--small" aria-expanded={false} onClick={() => setCollapsed(null)}>
          {t({ id: 'inapp.expand', message: `在 ${app} 裡開啟：顯示提示`, comment: '內建瀏覽器提醒收合後的小按鈕；app 是 App 名稱' })}
        </Button>
      </div>
    );
  }
  return (
    <Banner kind="warning" className="ll-inapp">
      <p>
        <Trans id="inapp.text" comment="內建瀏覽器提醒的本文；app 是 LINE、Facebook、Instagram 或「這個 App」">
          你正在 {app} 裡開啟。改用 Safari 或 Chrome，進度比較不會消失，也能離線使用。
        </Trans>
      </p>
      <div className="ll-row">
        <Button variant="primary" onClick={() => void copy()}>
          <Trans id="inapp.copy" comment="複製目前網址的按鈕">
            複製連結
          </Trans>
        </Button>
        <Button
          aria-expanded={true}
          onClick={() => setCollapsed('1')}
          aria-label={t({ id: 'inapp.collapse', message: '收合提示', comment: '把內建瀏覽器提醒縮成小按鈕' })}
        >
          <Trans id="inapp.collapseShort" comment="收合按鈕的文字">
            收合
          </Trans>
        </Button>
      </div>
      <output className="ll-small" aria-live="polite" data-testid="inapp-copy-status">
        {copied === 'done'
          ? t({ id: 'inapp.copied', message: '已複製連結，貼到 Safari 或 Chrome 的網址列就能開啟。', comment: '複製成功' })
          : copied === 'failed'
            ? t({ id: 'inapp.copyFailed', message: '無法自動複製，請長按網址列自行複製。', comment: '複製失敗' })
            : ''}
      </output>
    </Banner>
  );
}
