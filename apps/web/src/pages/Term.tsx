import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getLocale, localePath, type Locale } from '@ledgerland/i18n';
import { Banner, Card } from '@ledgerland/web-ui';
import { ContentLoadError, loadTerms, type TermSnapshot } from '../lib/content.ts';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';

export default function Term() {
  const { termId } = useParams();
  const locale = useLocale();
  const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
  const [term, setTerm] = useState<TermSnapshot | null | undefined>(undefined);
  const [alt, setAlt] = useState<TermSnapshot | null>(null);
  const [error, setError] = useState<ContentLoadError | null>(null);
  useEffect(() => {
    let alive = true;
    setTerm(undefined);
    Promise.all([loadTerms(locale), loadTerms(other)]).then(
      ([ts, os]) => {
        if (!alive) return;
        setTerm(ts.find((t) => t.id === termId) ?? null);
        setAlt(os.find((t) => t.id === termId) ?? null);
      },
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale, other, termId]);
  if (error)
    return (
      <Banner kind="warning" role="alert">
        <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>
      </Banner>
    );
  if (term === undefined) return <h1 className="ll-muted">…</h1>;
  if (term === null) return <NotFound />;
  return (
    <>
      <h1>{term.label}</h1>
      {alt && (
        <p className="ll-muted" lang={getLocale(other).htmlLang}>
          {alt.label}
        </p>
      )}
      <Card>
        <p>{term.definition}</p>
        {term.note && <p className="ll-muted ll-small">{term.note}</p>}
      </Card>
      <Card as="section">
        <dl className="ll-dl">
          <dt>
            <Trans id="term.teacherLabel">教材用語</Trans>
          </dt>
          <dd lang="zh-TW">{term.teacherLabel}</dd>
          {term.currentTwLabel && (
            <>
              <dt>
                <Trans id="term.currentTwLabel">現行用語</Trans>
              </dt>
              <dd lang="zh-TW">{term.currentTwLabel}</dd>
            </>
          )}
          {term.ifrsEnglish && (
            <>
              <dt>
                <Trans id="term.ifrsEnglish">IFRS 英文</Trans>
              </dt>
              <dd lang="en">{term.ifrsEnglish}</dd>
            </>
          )}
        </dl>
      </Card>
      <p>
        <Link to={localePath(locale, '/terms/')}>
          <Trans id="term.back">回到名詞圖鑑</Trans>
        </Link>
      </p>
    </>
  );
}
