import { Trans } from '@lingui/react/macro';
import { Card } from '@ledgerland/web-ui';
import { AppearanceSetting } from '../components/AppearanceSetting.tsx';
import { LangSwitch } from '../components/LangSwitch.tsx';

export default function Settings() {
  return (
    <>
      <h1>
        <Trans id="settings.title">設定</Trans>
      </h1>
      <Card as="section">
        <h2 className="ll-small ll-muted">
          <Trans id="lang.label">語言</Trans>
        </h2>
        <LangSwitch />
      </Card>
      <Card as="section">
        <AppearanceSetting />
      </Card>
    </>
  );
}
