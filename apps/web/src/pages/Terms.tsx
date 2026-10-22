import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Banner } from '@ledgerland/web-ui';
import { ContentLoadError, loadTerms, type TermSnapshot } from '../lib/content.ts';
import { useLocale } from '../lib/useLocale.ts';

export default function Terms() {
  const locale = useLocale();
  const [terms, setTerms] = useState<TermSnapshot[] | null>(null);
  const [error, setError] = useState<ContentLoadError | null>(null);
  useEffect(() => {
    let alive = true;
    setTerms(null);
    loadTerms(locale).then(
      (t) => alive && setTerms(t),
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return (
    <>
      <h1>
        <Trans id="terms.title" comment="名詞圖鑑的頁面標題（模組全名）">
          名詞圖鑑
        </Trans>
      </h1>
      {error && (
        <Banner kind="warning" role="alert">
          <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>
        </Banner>
      )}
      {terms && (
        <ul className="ll-list" data-testid="term-list">
          {terms.map((t) => (
            <li key={t.id}>
              <Link to={localePath(locale, `/terms/${t.id}/`)}>{t.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
