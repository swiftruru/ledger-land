// iOS Safari 分頁的常駐提示（06 第 4.7 節第 4 步、02 第 6 節）：2026-10-27 起改成引導加到主畫面（維護者在手機上的提議）：標題「把會計樂園加到主畫面」、
// 主要動作「看安裝教學」連到安裝教學頁，「匯出到 App」退成次要（給已經裝好、想把這裡的進度搬過去的人）；按過「我已加入主畫面」後才換成
// 「請從主畫面開啟會計樂園」、主要動作「匯出到 App」。可收合成小按鈕（記在 sessionStorage）但不能永久關閉；安裝教學頁本身不顯示（Banners.tsx）。
// 「匯出到 App」連到備份頁的三步引導卡（?to=app）；在作答頁同時寫出關卡代號（LevelCode 在地圖的 chunk，以 import() 載入、不進首次載入的 JS；
// 載不到時留在 web-ui 的 LevelCodePlaceholder：代號文字照樣看得到，只少「複製」按鈕）。
// 要不要顯示只看環境（同步）與 sessionStorage；完整版的那一段（settings 的 installGuideSeen）與作答頁的代號模組一掛載就讀，讀齊才經 usePageReady 回報，
// 橫幅和頁面一起出現、之後不再長高（維護者 2026-10-26；2026-10-24 的回報：代號列晚插入時題目卡片往下移 36px，學生點到的位置換成別的東西）。
// Banners 目前掛在 PageReveal 外面，這個回報要等 Root 把 Banners 放進 PageReveal 的範圍才生效（回報裡的 handoff），在那之前是 no-op。
// 學生在教學頁按過「我已加入主畫面」（settings 的 installGuideSeen）後改成展開的完整版本。是否顯示、展開或收合由 Banners.tsx 決定（banner-rules.ts：一次只展開一條，
// iOS 的安裝建議出現時這條不顯示）；收合狀態也由 Banners 記，這裡只畫。
// 外觀（站規 2.17，第 1 輪驗收改）：展開時是 Banner，主動作 secondary sm「匯出到 App」帶 ExportIcon（畫面上唯一的 primary 留給頁面主卡）、quiet sm「收合」（箭頭朝上，aria-expanded=true）；
// 收合後是一顆 secondary sm「Safari 分頁：顯示提示」，靠左放在頁首下方的橫幅位置；圖示是 WarningIcon（站規 2.17，第 4 輪驗收：和內建瀏覽器的收合膠囊、
// 地圖頁 Safari 提示條的 warning 一致；兩種收合膠囊同一個圖示，第 2 輪改成的 InfoIcon 收回）。
// 第 4 輪驗收：展開時有一行標題（和地圖頁提示條同一句），所有橫幅同一個結構。
// 地圖頁改用 HintBar（SafariTabHint，站規 2.2.4）。
import { Trans, useLingui } from '@lingui/react/macro';
import { createElement, useEffect, useState, type ComponentType } from 'react';
import { useMatches } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Banner, Button, CaretDownIcon, DeviceIcon, ExportIcon, HintBar, LevelCodePlaceholder, WarningIcon } from '@ledgerland/web-ui';
import { usePageReady } from '../lib/page-ready.tsx';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';

export const SAFARI_NOTICE_COLLAPSED_KEY = 'll:safari-notice-collapsed';
/** 教學頁按過「我已加入主畫面」的旗標（M3 的安裝教學頁寫入；這裡只讀） */
export const INSTALL_GUIDE_SEEN_SETTING = 'installGuideSeen';

type LevelCodeComponent = ComponentType<{ levelId: string }>;

// 作答頁的關卡代號元件：經 level-code-lazy.ts 只載入 LevelCode（理由見那個檔案），和頁面的資料一起等。chunk 載不到（離線又沒有快取、部署換版）時用佔位：
// 代號照樣看得到，只是沒有「複製」按鈕，錯誤不往上冒到根的錯誤頁（finding map-6）。undefined 是還在載；不需要（不是作答頁）時直接是 null
function useLevelCode(needed: boolean): LevelCodeComponent | null | undefined {
  const [value, setValue] = useState<LevelCodeComponent | null | undefined>(needed ? undefined : null);
  useEffect(() => {
    if (!needed) return;
    let alive = true;
    import('./level-code-lazy.ts').then(
      (m) => alive && setValue(() => m.LevelCode),
      () => alive && setValue(() => LevelCodePlaceholder),
    );
    return () => {
      alive = false;
    };
  }, [needed]);
  return value;
}

/** 教學頁按過「我已加入主畫面」沒有：null 是還在讀（取不到時當作沒有，不會一直是 null） */
function useInstallGuideSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => s.getSetting(INSTALL_GUIDE_SEEN_SETTING))
      .then(
        (entry) => alive && setSeen(entry?.value === true),
        () => alive && setSeen(false),
      );
    return () => {
      alive = false;
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

export interface SafariTabNoticeProps {
  /** 使用者收合過（這個工作階段）：只畫一顆膠囊 */
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function SafariTabNotice({ collapsed, onCollapse, onExpand }: SafariTabNoticeProps) {
  if (collapsed) return <SafariTabPill onExpand={onExpand} />;
  return <SafariTabBanner onCollapse={onCollapse} />;
}

function SafariTabPill({ onExpand }: { onExpand: () => void }) {
  const { t } = useLingui();
  return (
    <div className="ll-notice-collapsed ll-safari-notice ll-safari-notice--collapsed">
      <Button size="sm" icon={<WarningIcon />} aria-expanded={false} onClick={onExpand}>
        {t({ id: 'safari.collapsed', message: '加到主畫面：顯示提示', comment: 'Safari 分頁常駐提示收合後的小按鈕' })}
      </Button>
    </div>
  );
}

function SafariTabBanner({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  const full = useInstallGuideSeen();
  const levelId = useLevelIdFromRoute();
  const levelCode = useLevelCode(levelId !== null);
  usePageReady(full !== null && levelCode !== undefined);
  return (
    <Banner
      className="ll-safari-notice"
      title={
        full === true
          ? t({ id: 'safari.title.full', message: '請從主畫面開啟會計樂園', comment: 'iOS Safari 分頁常駐提示的標題：按過「我已加入主畫面」之後' })
          : t({ id: 'safari.title', message: '把會計樂園加到主畫面', comment: 'iOS Safari 分頁常駐提示（展開時）的標題：引導加到主畫面' })
      }
      actions={
        <>
          {full !== true && (
            <Button size="sm" icon={<DeviceIcon />} href={localePath(locale, '/install/')} data-testid="safari-install-link">
              <Trans id="safari.install" comment="Safari 分頁常駐提示的主要動作：連到安裝教學頁">
                看安裝教學
              </Trans>
            </Button>
          )}
          <Button size="sm" variant={full === true ? 'secondary' : 'quiet'} icon={<ExportIcon />} href={localePath(locale, '/me/backup/') + '?to=app'}>
            <Trans id="export.toApp" comment="Safari 分頁的「匯出到 App」捷徑，連到備份頁">
              匯出到 App
            </Trans>
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<CaretDownIcon className="ll-icon-flip" />}
            aria-expanded={true}
            onClick={onCollapse}
            aria-label={t({ id: 'safari.collapse', message: '收合主畫面提示', comment: '把常駐提示縮成小按鈕' })}
          >
            <Trans id="safari.collapseShort" comment="收合按鈕的文字">
              收合
            </Trans>
          </Button>
        </>
      }
    >
      {full !== true && (
        <p>
          <Trans id="safari.text" comment="iOS Safari 分頁頂部的常駐提示：引導加到主畫面">
            Safari 分頁的進度可能被清掉。加到主畫面後開啟更快，進度也比較不容易被清除；已經加入的話，請從主畫面的圖示開啟。
          </Trans>
        </p>
      )}
      {full === true && (
        <p>
          <Trans id="safari.full" comment="按過「我已加入主畫面」後的完整版說明">
            這個 Safari 分頁和主畫面 App 的紀錄是分開的兩份。如果這裡有新的進度，按「匯出到 App」複製備份碼，再到 App 的「我的 › 備份」貼上，兩邊的紀錄會合併。
          </Trans>
        </p>
      )}
      {levelId !== null && (
        <>
          <p>
            <Trans id="safari.levelCode" comment="作答頁的常駐提示裡，關卡代號前的一句話">
              把這個關卡代號記下來，在 App 裡輸入就能直接進到這一關。
            </Trans>
          </p>
          {levelCode ? createElement(levelCode, { levelId }) : <LevelCodePlaceholder levelId={levelId} />}
        </>
      )}
    </Banner>
  );
}

/** 地圖頁的提示條（站規 2.2.4）：一行字、「詳細」前往安裝教學頁、「關閉」等於收合（這個工作階段在地圖頁不再出現，其他頁顯示收合後的小按鈕） */
export function SafariTabHint({ collapse }: { collapse: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  return (
    <HintBar
      kind="warning"
      className="ll-safari-notice"
      detailsHref={localePath(locale, '/install/')}
      detailsLabel={t({
        id: 'play.hint.details.safari',
        message: '詳細：安裝教學',
        comment: '地圖頁 Safari 分頁提示條右側「詳細」圖示按鈕的可讀名稱（前往安裝教學頁）',
      })}
      onClose={collapse}
      data-testid="map-hint-safari"
    >
      {t({ id: 'play.hint.safari', message: '加到主畫面，進度才不會消失', comment: '地圖頁的單行提示條：iOS Safari 分頁的常駐提示（引導加到主畫面）' })}
    </HintBar>
  );
}
