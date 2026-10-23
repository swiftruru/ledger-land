import { Plural, Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Card } from '@ledgerland/web-ui';
import { ImportPromptCard } from '../components/ImportPromptCard.tsx';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { useDueCount } from '../features/quiz/useDueCount.ts';
import { useLocale } from '../lib/useLocale.ts';

export function Home() {
  const locale = useLocale();
  const due = useDueCount();
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
        <Link className="ll-btn ll-btn--primary" to={localePath(locale, '/play/')} data-testid="home-play">
          <Trans id="home.play" comment="首頁進入闖關地圖的主按鈕">
            開始闖關
          </Trans>
        </Link>
        {due !== null && due > 0 && (
          <Link className="ll-btn" to={localePath(locale, '/review/')} data-testid="home-due">
            <Plural id="home.due" comment="首頁的錯題本入口；due 是今天到期的題數，0 題時不顯示" value={due} other="今天要複習 # 題" />
          </Link>
        )}
        <LangSwitch />
      </div>
      <ImportPromptCard />
      <Card>
        <h2>
          <Trans id="home.build.title">目前的進度</Trans>
        </h2>
        <p>
          <Trans id="home.build.body">
            闖關區已經可以試用：前幾章的關卡、錯題本、進度備份與外觀設定都在這裡；報表實驗室與名詞圖鑑的完整版在之後的里程碑加入。
          </Trans>
        </p>
        <ul>
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
