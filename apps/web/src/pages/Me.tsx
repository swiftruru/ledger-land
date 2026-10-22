import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Card } from '@ledgerland/web-ui';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { useLocale } from '../lib/useLocale.ts';

export function Me() {
  const locale = useLocale();
  return (
    <>
      <h1>
        <Trans id="me.title" comment="「我的」頁面標題">
          我的
        </Trans>
      </h1>
      <Card>
        <LangSwitch />
      </Card>
      <Card as="section">
        <ul className="ll-list">
          <li>
            <Link to={localePath(locale, '/me/settings/')}>
              <Trans id="me.settings">設定</Trans>
            </Link>
          </li>
          <li>
            <Link to={localePath(locale, '/privacy/')}>
              <Trans id="me.privacy">隱私說明</Trans>
            </Link>
          </li>
          <li>
            <Link to={localePath(locale, '/about/')}>
              <Trans id="me.about">關於與授權</Trans>
            </Link>
          </li>
        </ul>
      </Card>
      <p className="ll-muted ll-small">
        <Trans id="me.progressLater">學習進度、徽章與備份會在之後的里程碑加入。</Trans>
      </p>
    </>
  );
}
