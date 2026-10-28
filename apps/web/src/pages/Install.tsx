// 「我的 › 安裝教學」（02 的頁面總表 /install/、06 第 2.5 節、站規 2.13）：依瀏覽器顯示對應的圖解；電腦上另外附 iPhone 的做法給老師看（Disclosure card）。
// 頁首 TopBar 的返回是「我的」（可讀名稱「回到我的」）。頂部提示（例如 Safari 分頁的收合膠囊）接在導言後面（data-ll-banner-after，第 2 輪驗收）：
// h1 和它的導言是一組，不被橫幅拆開。
// 第 4 輪驗收（非 iOS 的預設頁太空、像沒做完）：路由改成寬版；這台裝置的教學是一張有標題（h2）的卡片，Chromium 兩步加收尾按鈕；
// 1024 以上（有 rail）iPhone 的做法預設展開，兩張卡片的步驟都是並排的方塊（install.css 的 container query），桌面第一屏就是完整的教學。
// 從備份頁匯出成功後帶 ?step=2 回來（2026-10-28 維護者實機回饋）：第 1 步畫成已完成，布幕掀開後捲到第 2 步並把焦點移過去，注意力接回加入主畫面的步驟。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Card, DeviceIcon, Disclosure, TopBar } from '@ledgerland/web-ui';
import { promptInstall, useInstallEventAvailable } from '../components/InstallPrompt.tsx';
import { useBackToMe } from '../components/useBackLabels.ts';
import { wasExportedToApp } from '../features/install/exported.ts';
import { INSTALL_GUIDE_STEP2_ID, InstallGuide } from '../features/install/InstallGuide.tsx';
import { installGuideVariant, iosMenuStyle } from '../features/install/ios-version.ts';
import { useRevealed } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

/** 有 rail 的寬版（站規 2.0）：iPhone 的做法預設展開；進頁面時判斷一次，之後由使用者自己開合 */
const WIDE_QUERY = '(min-width: 1024px)';

export default function Install() {
  const { t } = useLingui();
  const locale = useLocale();
  const back = useBackToMe();
  const variant = useMemo(() => installGuideVariant(navigator.userAgent, navigator.maxTouchPoints), []);
  const menuStyle = useMemo(() => iosMenuStyle(navigator.userAgent, navigator.maxTouchPoints), []);
  const wide = useMemo(() => window.matchMedia(WIDE_QUERY).matches, []);
  const installAvailable = useInstallEventAvailable();
  const isIos = variant === 'ios-modern' || variant === 'ios-legacy';
  const [params] = useSearchParams();
  const location = useLocation();
  // 這個分頁匯出過（進頁面時讀一次；同一頁再按匯出會先離開這一頁）
  const exported = useMemo(() => wasExportedToApp(), []);
  // ?step=2：布幕掀開後捲到第 2 步、焦點移過去（換頁的焦點先移到 h1，PageReveal 在 requestAnimationFrame 裡做，所以排到再下一個影格；
  // 和備份頁的 ?to=app 同一個做法）。同路徑再導一次（location.key 換）也再做一次
  const jumpKey = isIos && params.get('step') === '2' ? location.key : null;
  const revealed = useRevealed();
  useEffect(() => {
    if (jumpKey === null || !revealed) return;
    let id = 0;
    const run = () => {
      const step = document.getElementById(INSTALL_GUIDE_STEP2_ID);
      if (!step) return;
      const reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      step.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      step.focus({ preventScroll: true });
    };
    id = requestAnimationFrame(() => {
      id = requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(id);
  }, [jumpKey, revealed]);
  const title = isIos
    ? t({ id: 'install.card.ios', message: '用 Safari 加入主畫面', comment: '安裝教學頁：iPhone、iPad 上這台裝置的教學卡片標題' })
    : variant === 'chromium'
      ? t({ id: 'install.card.chromium', message: '用這個瀏覽器安裝', comment: '安裝教學頁：Chrome、Edge 等瀏覽器的教學卡片標題' })
      : t({ id: 'install.card.generic', message: '換個瀏覽器安裝', comment: '安裝教學頁：沒有安裝功能的瀏覽器（Firefox、電腦版 Safari）的卡片標題' });
  return (
    <>
      <TopBar
        title={t({ id: 'install.page.title', message: '安裝教學', comment: '安裝教學頁的標題' })}
        backHref={localePath(locale, '/me/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      <p className="ll-lede" data-ll-banner-after="">
        <Trans id="install.page.intro" comment="安裝教學頁的開頭">
          把會計樂園加到主畫面：開啟更快，進度也比較不容易被清除。
        </Trans>
      </p>
      <div className="ll-install">
        <Card as="section" className="ll-install-card" aria-labelledby="ll-install-here">
          <h2 id="ll-install-here" className="ll-install-card__title">
            {title}
          </h2>
          <InstallGuide
            variant={variant}
            menuStyle={menuStyle}
            exported={exported}
            installAvailable={installAvailable}
            onInstall={() => void promptInstall()}
          />
        </Card>
        {!isIos && (
          <Disclosure
            variant="card"
            className="ll-install-ios"
            bodyClassName="ll-install-ios__body"
            icon={<DeviceIcon />}
            defaultOpen={wide}
            data-testid="install-ios-details"
            summary={
              <Trans id="install.page.iosDetails" comment="電腦或 Android 上附的 iPhone 做法（給老師說明用）">
                iPhone、iPad 的做法
              </Trans>
            }
          >
            <InstallGuide variant="ios-modern" reference />
          </Disclosure>
        )}
      </div>
    </>
  );
}
