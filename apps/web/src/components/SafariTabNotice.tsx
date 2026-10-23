// iOS Safari 分頁的常駐提示（06 第 4.7 節第 4 步、02 第 6 節）：「已加入主畫面的同學，請從主畫面開啟」，可收合成小按鈕（記在 sessionStorage）但不能永久關閉；
// 附「匯出到 App」捷徑（連到備份頁）；在作答頁同時寫出關卡代號（LevelCode 從地圖的 chunk 延後載入，不進首次載入）；
// 學生在教學頁按過「我已加入主畫面」（settings 的 installGuideSeen）後改成展開的完整版本。是否顯示由 Banners.tsx 依 isIosSafariTab() 決定。
import { Trans, useLingui } from '@lingui/react/macro';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useMatches } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Banner, Button } from '@ledgerland/web-ui';
import { whenIdle } from '../lib/idle.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { useSessionFlag } from './useSessionFlag.ts';

export const SAFARI_NOTICE_COLLAPSED_KEY = 'll:safari-notice-collapsed';
/** 教學頁按過「我已加入主畫面」的旗標（M3 的安裝教學頁寫入；這裡只讀） */
export const INSTALL_GUIDE_SEEN_SETTING = 'installGuideSeen';

const LevelCode = lazy(() => import('@ledgerland/web-ui/map').then((m) => ({ default: m.LevelCode })));

function useInstallGuideSeen(): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    let alive = true;
    // 進度資料庫等第一次閒置再開（06 第 8.2 節）：這個元件會插在內容上方，不能再多等 afterFirstPaint 的 400ms，否則會在使用者開始捲動後才把內容往下推
    const cancel = whenIdle(() => {
      getProgressStore()
        .then((s) => s.getSetting(INSTALL_GUIDE_SEEN_SETTING))
        .then(
          (entry) => alive && setSeen(entry?.value === true),
          () => {},
        );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, []);
  return seen;
}

/** 目前路由是作答頁時的關卡 ID（Root 在路由之外，從 matches 的 params 取） */
function useLevelIdFromRoute(): string | null {
  const matches = useMatches();
  const id = matches[matches.length - 1]?.params.levelId;
  return typeof id === 'string' && id.startsWith('lv_') ? id : null;
}

export function SafariTabNotice() {
  const { t } = useLingui();
  const locale = useLocale();
  const [collapsed, setCollapsed] = useSessionFlag(SAFARI_NOTICE_COLLAPSED_KEY);
  const full = useInstallGuideSeen();
  const levelId = useLevelIdFromRoute();

  if (collapsed === '1') {
    return (
      <div className="ll-row ll-safari-notice ll-safari-notice--collapsed">
        <Button className="ll-btn--small" aria-expanded={false} onClick={() => setCollapsed(null)}>
          {t({ id: 'safari.expand', message: '已加入主畫面？顯示提示', comment: 'Safari 分頁常駐提示收合後的小按鈕' })}
        </Button>
      </div>
    );
  }
  return (
    <Banner className="ll-safari-notice">
      <p>
        <Trans id="safari.text" comment="iOS Safari 分頁頂部的常駐提示">
          如果你已經加入主畫面，請從主畫面圖示開啟，進度存在那裡。
        </Trans>
      </p>
      {full && (
        <p className="ll-small">
          <Trans id="safari.full" comment="按過「我已加入主畫面」後的完整版說明">
            這個 Safari 分頁和主畫面 App 的紀錄是分開的兩份。如果這裡有新的進度，按「匯出到 App」複製備份碼，再到 App 的「我的 › 備份」貼上，兩邊的紀錄會合併。
          </Trans>
        </p>
      )}
      {levelId !== null && (
        <>
          <p className="ll-small">
            <Trans id="safari.levelCode" comment="作答頁的常駐提示裡，關卡代號前的一句話">
              把這個關卡代號記下來，在 App 裡輸入就能直接進到這一關。
            </Trans>
          </p>
          <Suspense fallback={null}>
            <LevelCode levelId={levelId} />
          </Suspense>
        </>
      )}
      <div className="ll-row">
        <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/me/backup/')}>
          <Trans id="export.toApp" comment="Safari 分頁的「匯出到 App」捷徑，連到備份頁">
            匯出到 App
          </Trans>
        </Link>
        <Button
          aria-expanded={true}
          onClick={() => setCollapsed('1')}
          aria-label={t({ id: 'safari.collapse', message: '收合主畫面提示', comment: '把常駐提示縮成小按鈕' })}
        >
          <Trans id="safari.collapseShort" comment="收合按鈕的文字">
            收合
          </Trans>
        </Button>
      </div>
    </Banner>
  );
}
