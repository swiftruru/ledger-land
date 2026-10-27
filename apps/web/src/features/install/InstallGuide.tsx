// 完整安裝圖解（06 第 2.5、2.6 節、02 第 9.5 節、10 第 10 節第 7 項）：iOS 26 以上分 Compact 與 Top／Bottom 兩套（網頁偵測不到分頁列版面，
// 由使用者選「我的 Safari 長這樣」，選擇記在 settings 的 installGuideLayout）；iOS 17、18 只有 Top／Bottom 那一套；Chromium 維持安裝按鈕；
// 其他瀏覽器給文字。第 0 步是「先把進度帶走」（匯出到 App）。iOS 的圖解沒有收尾按鈕（2026-10-27 拿掉「我已加入主畫面」：Safari 分頁偵測不到有沒有裝，
// 只能靠使用者自己宣告，誤按一次提示就再也不引導安裝；維護者實機回饋）。
// 按鈕（站規 2.13）：第 0 步的「匯出到 App」是獨立一行的 secondary sm（連到備份頁的匯出區，不帶 ?import，finding pages-b-3、pages-b-4）；
// Chromium 的「我已安裝」secondary md 加 CheckIcon；按下後焦點移到結果訊息（finding pages-b-1）。
// Chromium（第 4 輪驗收：原本只有一句話，整頁太空）：兩步（瀏覽器選單、確認視窗）加收尾：有安裝事件時「安裝」primary md 加 DeviceIcon，
// 否則「我已安裝」secondary md 加 CheckIcon（記成 installPromptDismissed，之後不再跳出安裝建議，和 appinstalled 同一個紀錄）。
// 其他瀏覽器：一段說明。reference（電腦或 Android 上附的 iPhone 做法）不放這台裝置的動作按鈕。
// 字串都在 en catalog（/en/ 的首次載入），所以句子盡量短、不另外加可讀名稱（「我已安裝」本身就是完整的意思）。
// 斷行：說明文字照全站規則（07 第 3.5 節，2026-10-27 起中文逐字換行、段落齊行、line-break: strict 讓標點不落在行首），
// 引號裡的介面名稱（「匯出到 App」「加入主畫面」）也照一般規則換行，不再包成不換行的 span。
// 英文訊息不包（英文在空格處換行；Add to Home Screen 整串不斷的話，320 寬放大 200% 會超出步驟欄）。步驟編號是懸掛的一欄（install.css）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { localePath } from '@ledgerland/i18n';
import { Button, CheckCircleIcon, CheckIcon, DeviceIcon, ExportIcon, Segmented } from '@ledgerland/web-ui';
import { INSTALL_DISMISSED_SETTING } from '../../components/InstallPrompt.tsx';
import { usePageReady } from '../../lib/page-ready.tsx';
import { nowIso } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { GuideIllustration, type GuideLabels, type GuideStep } from './illustrations.tsx';
import { INSTALL_GUIDE_LAYOUT_SETTING, parseSafariLayout, type InstallGuideVariant, type SafariLayout } from './ios-version.ts';
// 圖解的 CSS 在 install.css，由 info.css 以 @import 併成同一個 CSS 檔（全部 CSS 的預算）
import '../../styles/info.css';

export interface InstallGuideProps {
  variant: InstallGuideVariant;
  /** Chromium：beforeinstallprompt 已可用時給安裝按鈕 */
  installAvailable?: boolean;
  onInstall?: () => void;
  /** 接在 iOS 安裝建議橫幅正下方的卡片裡：橫幅上已經有「匯出到 App」，第 0 步不再放第二顆 */
  embedded?: boolean;
  /** 給別的裝置看的參考（電腦或 Android 上附的 iPhone 做法）：不放這台裝置的動作（匯出到 App） */
  reference?: boolean;
}

function useSafariLayout(): [SafariLayout, (v: SafariLayout) => void] {
  const [layout, setLayout] = useState<SafariLayout>('compact');
  // 記住的版面讀到之前整頁先不顯示（lib/page-ready.tsx），不會先畫 compact 再跳成另一種
  const [loaded, setLoaded] = useState(false);
  usePageReady(loaded);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => s.getSetting(INSTALL_GUIDE_LAYOUT_SETTING))
      .then(
        (entry) => alive && entry !== undefined && setLayout(parseSafariLayout(entry.value)),
        () => {},
      )
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const set = (v: SafariLayout) => {
    setLayout(v);
    void getProgressStore()
      .then((s) => s.setSetting(INSTALL_GUIDE_LAYOUT_SETTING, v, nowIso()))
      .catch(() => {});
  };
  return [layout, set];
}

/** 收尾的確認按鈕：按下後換成一句結果訊息，焦點移到訊息上（不另外疊 live region，取得焦點時螢幕閱讀器就會唸），不讓焦點掉到 body */
function DoneButton({ label, ariaLabel, message, onDone }: { label: ReactNode; ariaLabel?: string; message: ReactNode; onDone: () => void }) {
  const [done, setDone] = useState(false);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const justMarked = useRef(false);
  useEffect(() => {
    if (done && justMarked.current) {
      justMarked.current = false;
      doneRef.current?.focus();
    }
  }, [done]);
  return done ? (
    <p ref={doneRef} tabIndex={-1} className="ll-statusline ll-ok" data-testid="install-guide-seen">
      <CheckCircleIcon />
      <span>{message}</span>
    </p>
  ) : (
    <Button
      icon={<CheckIcon />}
      aria-label={ariaLabel}
      onClick={() => {
        justMarked.current = true;
        setDone(true);
        onDone();
      }}
    >
      {label}
    </Button>
  );
}

export function InstallGuide({ variant, installAvailable, onInstall, embedded, reference }: InstallGuideProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const [layout, setLayout] = useSafariLayout();
  const layoutLabelId = useId();
  const labels: GuideLabels = {
    share: t({ id: 'install.guide.label.share', message: '分享', comment: '示意圖裡 Safari「分享」按鈕的文字' }),
    addToHome: t({ id: 'install.guide.label.addToHome', message: '加入主畫面', comment: '示意圖裡「加入主畫面」那一列的文字' }),
    openAsApp: t({ id: 'install.guide.label.openAsApp', message: '以 Web App 打開', comment: '示意圖裡 iOS 26 的開關文字' }),
    add: t({ id: 'install.guide.label.add', message: '加入', comment: '示意圖裡確認對話框的「加入」按鈕' }),
    install: t({ id: 'install.guide.label.install', message: '安裝', comment: '示意圖裡 Chromium 選單的「安裝」' }),
    appName: t({ id: 'install.guide.label.appName', message: '會計樂園', comment: '示意圖裡的 App 名稱（短名）' }),
  };
  // 和 appinstalled 寫同一個紀錄（InstallPrompt 的 markDismissed）：之後不再跳出安裝建議
  const markInstalled = () =>
    void getProgressStore()
      .then((s) => s.setSetting(INSTALL_DISMISSED_SETTING, { reason: 'installed', at: nowIso() }, nowIso()))
      .catch(() => {});
  const canPrompt = installAvailable === true && onInstall !== undefined;
  const isIos = variant === 'ios-modern' || variant === 'ios-legacy';
  const effectiveLayout: SafariLayout = variant === 'ios-legacy' ? 'bar' : layout;
  const steps: { step: GuideStep; text: React.ReactNode }[] = [];
  if (variant === 'chromium') {
    if (canPrompt)
      steps.push({
        step: 'chromium-confirm',
        text: (
          <Trans id="install.guide.chromium.bip" comment="Chromium 有安裝事件時的說明（一步，下面就是「安裝」按鈕）">
            按「安裝」，在跳出的視窗再按一次「安裝」。
          </Trans>
        ),
      });
    else
      steps.push(
        {
          step: 'chromium-menu',
          text: (
            <Trans id="install.guide.chromium.menu" comment="Chromium 沒有安裝事件時的說明">
              打開右上角的選單，找「安裝」或「加入主畫面」。
            </Trans>
          ),
        },
        {
          step: 'chromium-confirm',
          text: (
            <Trans id="install.guide.chromium.confirm" comment="Chromium 沒有安裝事件時的第二步：瀏覽器的確認視窗">
              在跳出的確認視窗按「安裝」。
            </Trans>
          ),
        },
      );
  }
  if (isIos) {
    if (effectiveLayout === 'compact') {
      steps.push(
        {
          step: 'compact-more',
          text: (
            <Trans id="install.guide.compact.1" comment="Compact 分頁列第一步">
              點網址列旁的「⋯」（更多）。
            </Trans>
          ),
        },
        {
          step: 'compact-share',
          text: (
            <Trans id="install.guide.compact.2" comment="Compact 分頁列第二步">
              點「分享」。
            </Trans>
          ),
        },
      );
    } else {
      steps.push({
        step: 'bar-share',
        text: (
          <Trans id="install.guide.bar.1" comment="Top／Bottom 分頁列第一步">
            點工具列上的「分享」按鈕。
          </Trans>
        ),
      });
    }
    steps.push(
      {
        step: 'add-row',
        text: (
          <Trans id="install.guide.add" comment="往下找到加入主畫面">
            往下找到「加入主畫面」。
          </Trans>
        ),
      },
      {
        step: 'confirm',
        text: (
          <Trans
            id="install.guide.confirm"
            comment="確認對話框：iOS 17、18 沒有「以 Web App 打開」開關，所以寫成「有…就開啟」；要短：375 的步驟說明一行約 10 字、1280 的步驟方塊約 12 字，都排成兩行"
          >
            有「以 Web App 打開」就開啟，點「加入」。
          </Trans>
        ),
      },
    );
  }
  const stepList = (
    <ol className="ll-guide__steps" data-count={steps.length}>
      {steps.map((s) => (
        <li key={s.step} className="ll-guide__step" data-step={s.step}>
          <GuideIllustration step={s.step} labels={labels} />
          <p className="ll-guide__step-text">
            <span>{s.text}</span>
          </p>
        </li>
      ))}
    </ol>
  );
  return (
    // 外框是呼叫端的 Card（/install/ 的教學卡片、首頁安裝建議橫幅下方的圖解卡片，第 3 輪驗收：兩處同一個樣子，不再是藍色橫幅裡的一大片藍字）
    <div className="ll-guide" data-testid="install-guide" data-variant={variant} data-layout={isIos ? effectiveLayout : undefined}>
      {isIos && (
        <>
          <div className="ll-guide__step0">
            <p>
              <Trans id="install.guide.step0" comment="iOS 圖解的第 0 步：先把進度帶走">
                第 0 步：先把這裡的進度帶走。按「匯出到 App」複製備份碼（也可以存成備份檔），加入主畫面後第一次打開 App 時貼上，進度就會合併。
              </Trans>
            </p>
            {/* 接在安裝建議下方時，正上方橫幅的主動作就是「匯出到 App」，這裡不再放第二顆 */}
            {!embedded && !reference && (
              <Button size="sm" icon={<ExportIcon />} href={localePath(locale, '/me/backup/') + '?to=app'} data-testid="install-guide-export">
                <Trans id="export.toApp">匯出到 App</Trans>
              </Button>
            )}
          </div>
          {variant === 'ios-modern' ? (
            <div className="ll-guide__layout">
              <p className="ll-small ll-muted" id={layoutLabelId}>
                <Trans id="install.guide.layout.label" comment="讓使用者選 Safari 分頁列版面的標籤">
                  我的 Safari 長這樣：
                </Trans>
              </p>
              {/* 選項文字短到 375 寬的卡片裡（內容約 311px）也排得成一列膠囊（第 2 輪驗收） */}
              <Segmented<SafariLayout>
                value={layout}
                labelledBy={layoutLabelId}
                onChange={setLayout}
                size="md"
                options={[
                  {
                    value: 'compact',
                    label: t({
                      id: 'install.guide.layout.compact',
                      message: '縮小的網址列',
                      comment: 'Compact 分頁列的白話說法（底部只剩一條縮小的網址列）；要短，內嵌時和另一個選項排成一列',
                    }),
                  },
                  {
                    value: 'bar',
                    label: t({
                      id: 'install.guide.layout.bar',
                      message: '完整的工具列',
                      comment: 'Top 或 Bottom 分頁列的白話說法；要短，內嵌時和另一個選項排成一列',
                    }),
                  },
                ]}
              />
            </div>
          ) : (
            <p className="ll-small ll-muted">
              <Trans id="install.guide.legacyNote" comment="iOS 17、18 的說明">
                你的 iOS 版本沒有縮小的網址列，也沒有「以 Web App 打開」的開關；加入主畫面後會直接以 App 開啟。
              </Trans>
            </p>
          )}
          {stepList}
          <p className="ll-small ll-muted ll-guide__note">
            <Trans id="install.guide.after" comment="加入之後的提醒">
              之後都從主畫面的圖示開啟。Safari 分頁和 App 的紀錄是分開的兩份，新的進度記得用「匯出到 App」帶過去。
            </Trans>
          </p>
        </>
      )}
      {variant === 'chromium' && (
        // 外層 .ll-guide 是 container，不能用自己的 container query 改自己：寬版的兩欄排在這一層
        <div className="ll-guide__chromium">
          {stepList}
          {/* 收尾：寬的卡片（720px 以上）放在步驟方塊右側，窄的時候接在步驟下面（install.css） */}
          <div className="ll-guide__finish">
            <p className="ll-small ll-muted ll-guide__note">
              <Trans id="install.guide.chromium.after" comment="Chromium 安裝之後的說明：桌面或主畫面的圖示；進度和瀏覽器共用">
                裝好之後從桌面或主畫面的圖示開啟。進度和這個瀏覽器是同一份，不用搬。
              </Trans>
            </p>
            <div className="ll-row ll-guide__done">
              {canPrompt ? (
                <Button variant="primary" icon={<DeviceIcon />} onClick={onInstall}>
                  <Trans id="install.button">安裝</Trans>
                </Button>
              ) : (
                <DoneButton
                  label={
                    <Trans id="install.guide.chromium.done" comment="Chromium 安裝說明最後的確認按鈕（英文畫面上用短字）">
                      我已安裝
                    </Trans>
                  }
                  message={
                    <Trans id="install.guide.chromium.doneMsg" comment="按過「我已安裝」之後的回應">
                      記住了，不會再跳出安裝建議。
                    </Trans>
                  }
                  onDone={markInstalled}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {variant === 'generic' && (
        <>
          <p className="ll-guide__generic">
            <Trans id="install.guide.generic" comment="沒有安裝按鈕的瀏覽器（Firefox、電腦版 Safari）">
              這個瀏覽器沒有安裝按鈕：可以先加入書籤；在 iPhone 用 Safari、在 Android 用 Chrome 開啟這個網址，就能加到主畫面。
            </Trans>
          </p>
        </>
      )}
    </div>
  );
}

export default InstallGuide;
