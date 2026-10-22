import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { useLocale } from '../lib/useLocale.ts';

export function NotFound() {
  const locale = useLocale();
  return (
    <>
      <h1>
        <Trans id="notfound.title">找不到這一頁</Trans>
      </h1>
      <p>
        <Trans id="notfound.body">這個網址沒有對應的頁面，可能是輸入錯誤，或內容已經下架。</Trans>
      </p>
      <p>
        <Link to={localePath(locale, '/')}>
          <Trans id="error.home">回到首頁</Trans>
        </Link>
      </p>
    </>
  );
}
