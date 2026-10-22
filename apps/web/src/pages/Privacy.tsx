// 隱私說明頁草稿（02 第 7 節、09 第 11.4 節）：中英雙語、可離線、列入 sitemap。統計服務定案為 Cloudflare Web Analytics（D7，2026-10-22）。
import { Trans } from '@lingui/react/macro';
import { site } from '../../site.config.ts';

export default function Privacy() {
  return (
    <>
      <h1>
        <Trans id="privacy.title">隱私說明</Trans>
      </h1>
      <p>
        <Trans id="privacy.summary">你的學習紀錄只存在這台裝置的這個瀏覽器裡；網站沒有帳號、不用 cookie，只有不收集個資的匿名流量統計。</Trans>
      </p>
      <h2>
        <Trans id="privacy.stored.title">存了哪些資料</Trans>
      </h2>
      <p>
        <Trans id="privacy.stored.body">
          作答紀錄、星星、錯題本、徽章、名詞解鎖、設定與語言偏好，以及最近 50 筆錯誤紀錄。這些資料存在 IndexedDB、localStorage 與 Service Worker
          快取，都屬於這個網站的來源（origin）。Safari 分頁與主畫面 App 的資料是分開的兩份。
        </Trans>
      </p>
      <h2>
        <Trans id="privacy.not.title">不做哪些事</Trans>
      </h2>
      <p>
        <Trans id="privacy.not.body">
          不登入、不收集姓名或學號、不寫入 cookie、不把作答資料送出裝置；除了下面的流量統計腳本，不載入任何第三方腳本、字型或圖片。
        </Trans>
      </p>
      <h2>
        <Trans id="privacy.analytics.title">流量統計</Trans>
      </h2>
      <p>
        <Trans id="privacy.analytics.body">
          本站使用 Cloudflare Web Analytics（服務由 Cloudflare 提供與保存），只用來了解有多少人在用、哪些頁面被開啟與載入速度。它不使用
          cookie，也不收集姓名、email
          或任何識別個人的資料；收集的內容是瀏覽的頁面路徑（只有路徑，不含查詢字串）、來源網站、瀏覽器與作業系統類型、國家或地區，以及頁面載入效能指標。統計不含作答內容、進度或錯誤紀錄，只在正式網址
          {site.productionOrigin} 啟用；離線時不送出，載入失敗也不影響學習。
        </Trans>
      </p>
      <h2>
        <Trans id="privacy.camera.title">相機</Trans>
      </h2>
      <p>
        <Trans id="privacy.camera.body">
          只有在你按下「掃描課堂 QR」時才要求相機權限；影像只在這台裝置上解讀
          QR，不錄影、不截圖、不上傳，離開掃描畫面就關閉相機。（這個功能在之後的里程碑加入。）
        </Trans>
      </p>
      <h2>
        <Trans id="privacy.host.title">主機會記錄什麼</Trans>
      </h2>
      <p>
        <Trans id="privacy.host.body">網站主機 Cloudflare 的伺服器紀錄會包含 IP 位址與瀏覽器資訊，由主機商依其政策處理。</Trans>
      </p>
      <h2>
        <Trans id="privacy.loss.title">資料可能消失的情況</Trans>
      </h2>
      <p>
        <Trans id="privacy.loss.body">
          清除瀏覽器資料，或長時間未使用時瀏覽器主動清除（例如 Safari
          的規則），都可能讓進度消失。網站會盡量降低被清除的機率，但不保證不會發生；之後的里程碑會提供備份與匯出。
        </Trans>
      </p>
      <h2>
        <Trans id="privacy.delete.title">如何刪除</Trans>
      </h2>
      <p>
        <Trans id="privacy.delete.body">在瀏覽器裡清除這個網站的資料即可；「我的 › 設定」的「清除這台裝置上的資料」會在之後的里程碑加入。</Trans>
      </p>
      <h2>
        <Trans id="privacy.contact.title">聯絡方式</Trans>
      </h2>
      <p>
        <a href={site.issues} rel="noopener">
          <Trans id="privacy.contact.body">GitHub repo 的 issue 頁面</Trans>
        </a>
      </p>
      <p className="ll-muted ll-small">
        <Trans id="privacy.updated">最後更新：2026 年 10 月 22 日</Trans>
      </p>
    </>
  );
}
