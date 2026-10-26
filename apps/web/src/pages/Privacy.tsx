// 隱私說明頁（02 第 7 節、09 第 11.4 節、站規 2.14）：中英雙語、可離線、列入 sitemap。統計服務定案為 Cloudflare Web Analytics（D7，2026-10-22）。
// 頁首 TopBar 的返回是「我的」；頂部提示接在導言後面（data-ll-banner-after，h1 和導言不被拆開）；內文在 .ll-prose（65ch）；聯絡方式是段落後的單列 NavRow（外部網站），最後更新日期用 packages/i18n 格式化。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatDate, localePath } from '@ledgerland/i18n';
import { CodeIcon, NavList, NavRow, TextLink, TopBar } from '@ledgerland/web-ui';
import { site } from '../../site.config.ts';
import { ProseWords } from '../components/ProseWords.tsx';
import { useBackToMe } from '../components/useBackLabels.ts';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

/** 這一頁的內容最後一次修改的日期（改內文時一起改） */
const PRIVACY_UPDATED = '2026-10-25';

export default function Privacy() {
  const { t } = useLingui();
  const locale = useLocale();
  const back = useBackToMe();
  const updated = formatDate(PRIVACY_UPDATED, locale, 'long');
  return (
    <>
      <TopBar
        title={t({ id: 'privacy.title', message: '隱私說明' })}
        backHref={localePath(locale, '/me/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      <div className="ll-prose">
        <p className="ll-lede" data-ll-banner-after="">
          <Trans id="privacy.summary" render={ProseWords}>
            你的學習紀錄只存在這台裝置的這個瀏覽器裡；網站沒有帳號、不用 cookie，只有不收集個資的匿名流量統計。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.stored.title">存了哪些資料</Trans>
        </h2>
        <p>
          <Trans id="privacy.stored.body" render={ProseWords}>
            作答紀錄、星星、錯題本、徽章、名詞解鎖、設定與語言偏好，以及最近 50 筆錯誤紀錄。這些資料存在 IndexedDB、localStorage 與 Service Worker
            快取，都屬於這個網站的來源（origin）。Safari 分頁與主畫面 App 的資料是分開的兩份。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.not.title">不做哪些事</Trans>
        </h2>
        <p>
          <Trans id="privacy.not.body" render={ProseWords}>
            不登入、不收集姓名或學號、不寫入 cookie、不把作答資料送出裝置；除了下面的流量統計腳本，不載入任何第三方腳本、字型或圖片。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.analytics.title">流量統計</Trans>
        </h2>
        <p>
          {/* 網址前後的空白要寫成 {' '}：JSX 換行接 {…} 時空白會被吃掉（第 2 輪驗收）；網址整個一起換行（ll-url，比欄寬還長時才在網址裡斷） */}
          <Trans id="privacy.analytics.body" comment="<0> 是正式網址（不從中間斷行）" render={ProseWords}>
            本站使用 Cloudflare Web Analytics（服務由 Cloudflare 提供與保存），只用來了解有多少人在用、哪些頁面被開啟與載入速度。它不使用
            cookie，也不收集姓名、email
            或任何識別個人的資料；收集的內容是瀏覽的頁面路徑（只有路徑，不含查詢字串）、來源網站、瀏覽器與作業系統類型、國家或地區，以及頁面載入效能指標。統計不含作答內容、進度或錯誤紀錄，只在正式網址{' '}
            <span lang="en" className="ll-url">
              {site.productionOrigin}
            </span>{' '}
            啟用；離線時不送出，載入失敗也不影響學習。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.camera.title">相機</Trans>
        </h2>
        <p>
          <Trans id="privacy.camera.text" render={ProseWords}>
            只有在你按下「掃描課堂 QR」裡的「開始掃描」時才要求相機權限，網站載入時與掃碼開啟的頁面都不會要求。相機只用來辨識課堂
            QR：影像只在這台裝置上處理，不錄影、不截圖、不上傳，也不保存掃到的內容；辨識完成、按取消、離開掃描畫面或 App
            退到背景時都會立刻關閉相機。只接受本站的關卡、章節與故事步驟網址，其他網址不會開啟。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.host.title">主機會記錄什麼</Trans>
        </h2>
        <p>
          <Trans id="privacy.host.body" render={ProseWords}>
            網站主機 Cloudflare 的伺服器紀錄會包含 IP 位址與瀏覽器資訊，由主機商依其政策處理。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.loss.title">資料可能消失的情況</Trans>
        </h2>
        <p>
          <Trans id="privacy.loss.text" comment="「我的 › 備份」是文中連結" render={ProseWords}>
            清除瀏覽器資料，或長時間未使用時瀏覽器主動清除（例如 Safari 的規則），都可能讓進度消失。網站會盡量降低被清除的機率，但不保證不會發生；請定期到
            <TextLink href={localePath(locale, '/me/backup/')} className="ll-nowrap">
              我的 › 備份
            </TextLink>
            匯出一份。
          </Trans>
        </p>
        <h2>
          <Trans id="privacy.delete.title">如何刪除</Trans>
        </h2>
        <p>
          {/* 第 4 輪驗收：不寫還在製作中的按鈕；和上一段一樣，「我的 › 備份」是文中連結（刪除前先匯出一份），連結文字不從中間斷行 */}
          <Trans id="privacy.delete.how" comment="「如何刪除」段；「我的 › 備份」是文中連結" render={ProseWords}>
            在瀏覽器的網站設定裡清除這個網站的資料，進度、設定與離線快取會一起刪除。主畫面 App 的那一份，在 iPhone、iPad 上把 App
            從主畫面移除就會一併刪除。想先留一份，到
            <TextLink href={localePath(locale, '/me/backup/')} className="ll-nowrap">
              我的 › 備份
            </TextLink>
            匯出。
          </Trans>
        </p>
        <h2 id="ll-privacy-contact">
          <Trans id="privacy.contact.title">聯絡方式</Trans>
        </h2>
        <p>
          <Trans id="privacy.contact.lead" comment="隱私說明「聯絡方式」段的說明，下面是「回報問題」的選單列" render={ProseWords}>
            對隱私有疑問，或發現資料處理有問題，請到 GitHub 回報。
          </Trans>
        </p>
      </div>
      <NavList tone="neutral" aria-label={t({ id: 'privacy.contact.title', message: '聯絡方式' })} className="ll-info-nav">
        <NavRow
          icon={<CodeIcon />}
          title={t({ id: 'privacy.contact.row', message: '回報問題', comment: '隱私說明的聯絡方式：連到 GitHub issue 頁面的選單列' })}
          description={t({ id: 'privacy.contact.body', message: 'GitHub repo 的 issue 頁面' })}
          href={site.issues}
          external
        />
      </NavList>
      <p className="ll-muted ll-small ll-info-updated">
        <Trans id="privacy.updatedOn" comment="updated 是已依語言格式化的日期">
          最後更新：{updated}
        </Trans>
      </p>
    </>
  );
}
