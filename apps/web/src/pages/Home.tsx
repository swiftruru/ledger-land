import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Card } from '@ledgerland/web-ui';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { DEMO_LEVEL_ID } from '../content/sample.ts';
import { useLocale } from '../lib/useLocale.ts';

export function Home() {
  const locale = useLocale();
  return (
    <>
      <h1>
        <Trans id="home.title" comment="首頁大標題，站名">
          LedgerLand 會計樂園
        </Trans>
      </h1>
      <p className="ll-muted">
        <Trans id="home.tagline">用闖關與報表實驗室學會計入門，中英雙語，可離線使用。</Trans>
      </p>
      <div className="ll-row">
        <LangSwitch />
      </div>
      <Card>
        <h2>
          <Trans id="home.build.title">目前的進度</Trans>
        </h2>
        <p>
          <Trans id="home.build.body">
            這是基礎建設階段（M0b）的殼層網站：導覽列、語言切換、外觀設定、名詞圖鑑的範例資料與作答示範頁都已經可以試用；闖關關卡與報表實驗室在之後的里程碑加入。
          </Trans>
        </p>
        <ul>
          <li>
            <Link to={localePath(locale, `/level/${DEMO_LEVEL_ID}/`)}>
              <Trans id="home.link.demo">作答示範頁（語言切換時保留作答狀態）</Trans>
            </Link>
          </li>
          <li>
            <Link to={localePath(locale, '/terms/')}>
              <Trans id="home.link.terms">名詞圖鑑</Trans>
            </Link>
          </li>
          <li>
            <Link to={localePath(locale, '/me/settings/')}>
              <Trans id="home.link.settings">設定（語言、外觀、深色風味）</Trans>
            </Link>
          </li>
        </ul>
      </Card>
    </>
  );
}
