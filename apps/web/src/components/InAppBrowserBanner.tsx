// App 內建瀏覽器的提醒（06 第 4.8 節第 2 點、02 第 9.6 節）：LINE、Facebook、Instagram 裡開啟時，所有頁面頂部常駐但可收合（收合記在 sessionStorage），
// 附「複製連結」讓學生貼到 Safari 或 Chrome；不阻擋學習。是否顯示、展開或收合由 Banners.tsx 決定（banner-rules.ts：一次只展開一條），收合狀態也由 Banners 記。
// 外觀（站規 2.17，第 1 輪驗收改）：展開時是 warning 的 Banner，主動作 secondary sm「複製連結」帶 CopyIcon（畫面上唯一的 primary 留給頁面主卡）、quiet sm「收合」（箭頭朝上）；
// 收合後是一顆有警示圖示的 secondary sm「在 LINE 裡開啟：顯示提示」，靠左放在頁首下方的橫幅位置。
// 第 4 輪驗收：展開時有一行標題「在 LINE 裡開啟」（和收合膠囊同一句開頭），內文只寫建議怎麼做。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Banner, Button, CaretDownIcon, WarningIcon } from '@ledgerland/web-ui';
import { CopyIcon } from '@ledgerland/web-ui/map';
import { inAppBrowserName } from '../lib/env.ts';

export const IN_APP_COLLAPSED_KEY = 'll:inapp-collapsed';

export interface InAppBrowserBannerProps {
  /** 使用者收合過（這個工作階段）：只畫一顆膠囊 */
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function InAppBrowserBanner({ collapsed, onCollapse, onExpand }: InAppBrowserBannerProps) {
  const { t } = useLingui();
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

  if (collapsed) {
    return (
      <div className="ll-notice-collapsed ll-inapp ll-inapp--collapsed" data-testid="inapp-collapsed">
        <Button size="sm" icon={<WarningIcon />} aria-expanded={false} onClick={onExpand}>
          {t({ id: 'inapp.collapsed', message: `在 ${app} 裡開啟：顯示提示`, comment: '內建瀏覽器提醒收合後的小按鈕；app 是 App 名稱' })}
        </Button>
      </div>
    );
  }
  return (
    <Banner
      kind="warning"
      className="ll-inapp"
      title={t({ id: 'inapp.title', message: `在 ${app} 裡開啟`, comment: '內建瀏覽器提醒的標題（和收合後的小按鈕同一句開頭）；app 是 App 名稱' })}
      actions={
        <>
          <Button size="sm" icon={<CopyIcon />} onClick={() => void copy()}>
            <Trans id="inapp.copy" comment="複製目前網址的按鈕">
              複製連結
            </Trans>
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<CaretDownIcon className="ll-icon-flip" />}
            aria-expanded={true}
            onClick={onCollapse}
            aria-label={t({ id: 'inapp.collapse', message: '收合提示', comment: '把內建瀏覽器提醒縮成小按鈕' })}
          >
            <Trans id="inapp.collapseShort" comment="收合按鈕的文字">
              收合
            </Trans>
          </Button>
          {/* 複製結果：空的時候沒有寬高；有字時自己換到按鈕下面一行（notices.css） */}
          <output className="ll-notice-status" aria-live="polite" data-testid="inapp-copy-status">
            {copied === 'done'
              ? t({ id: 'inapp.copied', message: '已複製連結，貼到 Safari 或 Chrome 的網址列就能開啟。', comment: '複製成功' })
              : copied === 'failed'
                ? t({ id: 'inapp.copyFailed', message: '無法自動複製，請長按網址列自行複製。', comment: '複製失敗' })
                : null}
          </output>
        </>
      }
    >
      <p>
        <Trans id="inapp.body" comment="內建瀏覽器提醒的本文（標題已經寫了在哪個 App 裡開啟）">
          改用 Safari 或 Chrome 開啟，進度比較不會消失，也能離線使用。
        </Trans>
      </p>
    </Banner>
  );
}
