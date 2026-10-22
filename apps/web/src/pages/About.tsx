// 關於與授權頁草稿（02 第 1.1 節、11 第 4.4 節）。具名致謝的段落要等老師看過文字與位置之後才加入（D6）。
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { useLocale } from '../lib/useLocale.ts';

export default function About() {
  const locale = useLocale();
  return (
    <>
      <h1>
        <Trans id="about.title">關於與授權</Trans>
      </h1>
      <p>
        <Trans id="about.intro">
          LedgerLand
          會計樂園是一個公開、開源、手機優先的會計入門學習網站：用闖關題目與報表實驗室，從一家小店的帳開始認識資產、負債、股東權益與三大財務報表，中英雙語，可離線使用。
        </Trans>
      </p>
      <h2>
        <Trans id="about.license.title">授權</Trans>
      </h2>
      <ul>
        <li>
          <Trans id="about.license.code">程式碼：MIT 授權。</Trans>
        </li>
        <li>
          <Trans id="about.license.content">原創教學內容（題目、名詞卡、解說、故事的敘述文字）：創用 CC 姓名標示 相同方式分享 4.0 國際（CC BY-SA 4.0）。</Trans>
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
      <p>
        <a href={site.repo} rel="noopener">
          <Trans id="about.repo">原始碼與第三方授權聲明（GitHub）</Trans>
        </a>
      </p>
      <h2>
        <Trans id="about.version.title">版本</Trans>
      </h2>
      <p className="ll-num">
        {__LL_APP_VERSION__} · {__LL_BUILT_AT__}
      </p>
      <p className="ll-small">
        <Link to={localePath(locale, '/debug/')}>
          <Trans id="about.debug">診斷資訊</Trans>
        </Link>
      </p>
    </>
  );
}
