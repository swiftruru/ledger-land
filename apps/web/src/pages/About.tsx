// 關於與授權頁（02 第 1.1 節、11 第 4.4 節、站規 2.14）。具名致謝的段落要等老師看過文字與位置之後才加入（D6）。
// 頁首 TopBar 的返回是「我的」；頂部提示接在導言後面（data-ll-banner-after，h1 和導言不被拆開）；開頭段落不再有句中連結；「教學用途，不構成投資建議」的聲明（11 第 1 節、第 2 節第 21 列）放在簡介下方；
// 頁尾一組 NavList「更多」（neutral）：關於系統設計、原始碼與第三方授權聲明（外部網站）、診斷資訊（PulseIcon；齒輪只給「我的」的設定，第 2 輪驗收）。
import { Trans, useLingui } from '@lingui/react/macro';
import { localePath } from '@ledgerland/i18n';
import { Banner, CodeIcon, CompassIcon, HeartIcon, NavList, NavRow, PulseIcon, TopBar } from '@ledgerland/web-ui';
import { site } from '../../site.config.ts';
import { useBackToMe } from '../components/useBackLabels.ts';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

export default function About() {
  const { t } = useLingui();
  const locale = useLocale();
  const back = useBackToMe();
  return (
    <>
      <TopBar
        title={t({ id: 'about.title', message: '關於與授權' })}
        backHref={localePath(locale, '/me/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      {/* 導言、聲明卡、授權與版本：聲明卡和頁尾的「更多」選單列同一層、同一個欄寬（第 6 輪驗收：放在 .ll-prose 裡時跟著內文的 65ch，
          1280 時右緣比下面的選單列卡片短 25px）；導言與授權段落仍是 65ch 的行長 */}
      {/* 「可離線使用」整塊不斷（第 8 輪驗收：1280 第二行停在「中英雙語，可」；首頁標語同一句也是整塊） */}
      <p className="ll-lede" data-ll-banner-after="">
        <Trans id="about.intro" comment="關於頁導言">
          LedgerLand
          會計樂園是一個公開、開源、手機優先的會計入門學習網站：用闖關題目與報表實驗室，從一家小店的帳開始認識資產、負債、股東權益與三大財務報表，中英雙語，可離線使用。
        </Trans>
      </p>
      <Banner
        role="note"
        className="ll-about-notice"
        data-testid="about-not-advice"
        title={
          <Trans id="about.notAdvice.title" comment="關於頁的非投資建議聲明標題（11 第 1 節、第 2 節第 21 列）">
            教學用途，不構成投資建議
          </Trans>
        }
      >
        <p>
          <Trans id="about.notAdvice.body" comment="關於頁的非投資建議聲明說明">
            本站的題目、名詞卡與報表範例都是會計入門的教學練習。涉及本益比、融資、估價的章節也一樣，只用來練習會計觀念，不是投資建議，也不推薦任何投資標的。
          </Trans>
        </p>
      </Banner>
      <div className="ll-prose">
        {/* 給老師（維護者 2026-10-26）：關卡代號與課堂 QR 怎麼用，放在關於頁最前面的一節 */}
        <h2>
          <Trans id="about.teacher.title">給老師</Trans>
        </h2>
        <ul className="ll-list">
          <li>
            <Trans id="about.teacher.code">
              每一關都有 8
              碼的關卡代號，在闖關地圖點開關卡介紹、展開「給老師：關卡代號」就看得到。把代號寫在黑板上，學生在地圖右上按「輸入關卡代號」就會直接到那一關；大小寫、空白與連字號都可以省略。
            </Trans>
          </li>
          <li>
            <Trans id="about.teacher.qr">
              在同一個展開列按「顯示 QR」就能產生這一關的 QR，下載圖片放在投影片上，或複製連結貼到課程群組；學生用手機相機掃，或在地圖右上按「掃描課堂
              QR」，掃到就直接開啟那一關。
            </Trans>
          </li>
          <li>
            <Trans id="about.teacher.order">
              地圖只建議順序、不鎖關：上課講到哪一關，就可以用代號或 QR 直接把全班帶到那一關，進去不會跳出「建議先完成前一關」的提示。
            </Trans>
          </li>
        </ul>
        <h2>
          <Trans id="about.license.title">授權</Trans>
        </h2>
        <ul className="ll-list">
          <li>
            <Trans id="about.license.code">程式碼：MIT 授權。</Trans>
          </li>
          <li>
            <Trans id="about.license.content">
              原創教學內容（題目、名詞卡、解說、故事的敘述文字）：創用 CC 姓名標示 相同方式分享 4.0 國際（CC BY-SA 4.0）。
            </Trans>
          </li>
          <li>
            <Trans id="about.license.story">故事的情境與金額經陳彥宏老師授權使用，不在 CC 授權範圍內；重用前要另外取得老師同意。</Trans>
          </li>
          <li>
            <Trans id="about.license.name">「LedgerLand 會計樂園」的名稱與標誌另外保留，不隨開源授權授出。</Trans>
          </li>
          <li>
            <Trans id="about.license.materials">本站的授權不涵蓋老師的教材（投影片、Excel、題目、解答）；網站不收錄、不散布這些教材。</Trans>
          </li>
        </ul>
        <h2>
          <Trans id="about.version.title">版本</Trans>
        </h2>
        <p className="ll-num ll-about-version">
          {__LL_APP_VERSION__} · {__LL_BUILT_AT__}
        </p>
      </div>
      <NavList tone="neutral" title={t({ id: 'about.more', message: '更多', comment: '關於頁最後一組選單列的標題' })} className="ll-info-nav">
        <NavRow
          icon={<CompassIcon />}
          title={t({ id: 'about.design', message: '關於系統設計' })}
          description={t({ id: 'about.more.design.desc', message: '這個網站怎麼設計出來的', comment: '關於頁「關於系統設計」選單列的說明' })}
          href={localePath(locale, '/design/')}
        />
        <NavRow
          icon={<CodeIcon />}
          title={t({ id: 'about.more.repo', message: '原始碼與第三方授權聲明' })}
          description={t({
            id: 'about.more.source.desc',
            message: 'GitHub 上的程式碼與授權',
            comment: '關於頁「原始碼與第三方授權聲明」選單列的說明（外部網站）',
          })}
          href={site.repo}
          external
        />
        <NavRow
          icon={<HeartIcon />}
          title={t({ id: 'me.credits', message: '幕後', comment: '「我的」連到幕後（作者、老師與技術棧）' })}
          description={t({ id: 'me.credits.desc', message: '作者、老師，還有做網站的技術', comment: '「我的」幕後列的說明' })}
          href={localePath(locale, '/credits/')}
        />
        <NavRow
          icon={<PulseIcon />}
          title={t({ id: 'about.debug', message: '診斷資訊' })}
          description={t({ id: 'about.more.debug.desc', message: '版本、裝置與儲存的檢查結果', comment: '關於頁「診斷資訊」選單列的說明' })}
          href={localePath(locale, '/debug/')}
        />
      </NavList>
    </>
  );
}
