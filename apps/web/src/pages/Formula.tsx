// 公式條目頁（02 第 1.1 節的 /formulas/<formulaId>/，2026-11-07）：TopBar 的返回是「公式」（從總覽點進來時帶回原本的 ?q 與 ?group），h1 是公式名稱，
// 下一行是分類 Badge 與另一種語言的名稱。由上而下：公式卡（公式一行，講義寫法不同時列各版本）、各項數值的意思（有名詞的項目連到名詞頁）、計算範例、怎麼看、
// 講義出處（講義與頁碼，只有這一區會出現頁碼，來自講義對照檔）、相關題目（三種關係各一張展開列，每題連到背題瀏覽的閱讀頁）、相關公式、
// 「在圖鑑看名詞說明」，頁尾「回到會計公式」。資料：完整內容檔（執行期快取）加公式索引（相關公式的名稱、另一語系的名稱），全部到了才一次出現。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useMemo, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { formatNumber, getLocale, localePath, type Locale } from '@ledgerland/i18n';
import {
  BackButton,
  Badge,
  Button,
  Card,
  CardsIcon,
  Disclosure,
  ErrorState,
  NavList,
  NavRow,
  RatioIcon,
  TermPill,
  TermPillList,
  TopBar,
  useUiLabels,
} from '@ledgerland/web-ui';
import { formulaReturnPath, formulaReturnSearch } from '../features/formulas/catalogue.ts';
import { useFormulaCategoryLabel } from '../features/formulas/useFormulaCategoryLabel.ts';
import { plainParagraphs } from '../features/term-page/term-text.ts';
import {
  ContentLoadError,
  loadFormulaDetail,
  loadFormulaIndex,
  type FormulaIndexEntry,
  type FormulaLinkRelation,
  type FormulaSnapshot,
} from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import '../styles/glossary.css';
import '../styles/formulas.css';

const RELATIONS: readonly FormulaLinkRelation[] = ['formula', 'numeric', 'concept'];

/** 「再試一次」換一個 key 整頁重新掛載；重試後焦點回到新的 h1 */
export default function Formula() {
  const [attempt, setAttempt] = useState(0);
  return <FormulaPage key={attempt} retried={attempt > 0} onRetry={() => setAttempt((n) => n + 1)} />;
}

function FormulaPage({ retried, onRetry }: { retried: boolean; onRetry: () => void }) {
  const { t } = useLingui();
  const labels = useUiLabels();
  const { formulaId } = useParams();
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const categoryLabel = useFormulaCategoryLabel();
  const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
  const [formula, setFormula] = useState<FormulaSnapshot | null | undefined>(undefined);
  const [index, setIndex] = useState<readonly FormulaIndexEntry[]>([]);
  const [altLabel, setAltLabel] = useState<string | null>(null);
  const [error, setError] = useState<ContentLoadError | null>(null);
  const errorTitleId = useId();
  const relatedId = useId();
  const questionsId = useId();

  const fromList = formulaReturnSearch(location.state);
  const listHref = formulaReturnPath(localePath(locale, '/formulas/'), fromList);
  const backLabel = t({ id: 'formula.back', message: '回到會計公式', comment: '公式條目頁返回按鈕的可讀名稱與頁尾按鈕' });
  const backShort = t({ id: 'formula.back.short', message: '公式', comment: '公式條目頁返回按鈕在畫面上的短字（必須是「回到會計公式」的一部分）' });

  useEffect(() => {
    let alive = true;
    setFormula(undefined);
    setError(null);
    if (formulaId === undefined) {
      setFormula(null);
      return;
    }
    Promise.all([
      loadFormulaDetail(formulaId, locale),
      loadFormulaIndex(locale).catch((): FormulaIndexEntry[] => []),
      loadFormulaIndex(other).catch((): FormulaIndexEntry[] => []),
    ]).then(
      ([mine, list, theirs]) => {
        if (!alive) return;
        setIndex(list);
        setAltLabel(theirs.find((f) => f.id === formulaId)?.label ?? null);
        setFormula(mine ?? null);
      },
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale, other, formulaId]);

  const settled = formula !== undefined || error !== null;
  usePageReady(settled);
  useEffect(() => {
    if (!settled || (!error && !retried)) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const h1 = error ? document.getElementById(errorTitleId) : document.querySelector<HTMLElement>('main h1');
    h1?.focus({ preventScroll: true });
  }, [settled, error, retried, errorTitleId]);

  const keepState = (href: string) => (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href, { state: location.state as unknown });
  };
  const labelOf = useMemo(() => new Map(index.map((f) => [f.id, f.label] as const)), [index]);

  const backFooter = (
    <div className="ll-termpage__foot">
      <Button variant="secondary" size="md" icon={<RatioIcon />} href={listHref} data-testid="formula-back">
        {backLabel}
      </Button>
    </div>
  );

  if (error)
    return (
      <div className="ll-termpage ll-fxpage">
        <div className="ll-termpage__bar">
          <BackButton href={listHref} label={backLabel} shortLabel={backShort} />
        </div>
        <ErrorState
          titleAs="h1"
          titleId={errorTitleId}
          title={t({ id: 'formula.error.title', message: '這條公式讀不到', comment: '公式條目頁讀不到內容（離線而且還沒快取）時的標題' })}
          description={t({ id: 'content.offlineMissing', message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。' })}
          onRetry={onRetry}
          action={
            <Button icon={<RatioIcon />} href={listHref}>
              {backLabel}
            </Button>
          }
          data-testid="formula-error"
        />
      </div>
    );
  if (formula === undefined)
    return (
      <div className="ll-termpage ll-fxpage" aria-busy="true">
        <TopBar title={<span className="ll-sr-only">{labels.loading}</span>} backHref={listHref} backLabel={backLabel} backShortLabel={backShort} />
      </div>
    );
  if (formula === null) return <NotFound />;

  const related = formula.related.flatMap((id) => {
    const label = labelOf.get(id);
    return label === undefined || id === formula.id ? [] : [{ id, label }];
  });
  const n = (x: number) => formatNumber(x, locale);
  const versionName = (v: FormulaSnapshot['versions'][number]) => {
    const code = v.deck?.code ?? '';
    return v.deck
      ? t({ id: 'formula.version.deck', message: `講義 ${code} 的寫法`, comment: '公式卡裡講義版本的小標；code 是講義編號（例如 0-2）' })
      : v.version === 'excel'
        ? t({ id: 'formula.version.excel', message: '課程 Excel 版', comment: '公式卡裡課程 Excel 模板的寫法的小標' })
        : t({ id: 'formula.version.dupont', message: '杜邦分解', comment: '公式卡裡杜邦分解式的小標' });
  };
  const relationTitle = (r: FormulaLinkRelation, count: number) => {
    const c = n(count);
    switch (r) {
      case 'formula':
        return t({ id: 'formula.questions.formula', message: `考這條公式的組成或關係（${c} 題）`, comment: '相關題目的第一類；c 是已格式化的題數' });
      case 'numeric':
        return t({ id: 'formula.questions.numeric', message: `情境裡有數字，可以拿公式驗算（${c} 題）`, comment: '相關題目的第二類；c 是已格式化的題數' });
      default:
        return t({ id: 'formula.questions.concept', message: `只考相關概念（${c} 題）`, comment: '相關題目的第三類；c 是已格式化的題數' });
    }
  };
  const questionTotal = RELATIONS.reduce((sum, r) => sum + formula.questions[r].length, 0);
  const questionTotalText = n(questionTotal);
  const pageList = (slides: readonly number[]) => slides.map((s) => n(s)).join(locale === 'en' ? ', ' : '、');
  const termHref = localePath(locale, `/terms/${formula.termRef}/`);

  return (
    <div className="ll-termpage ll-fxpage">
      <TopBar title={formula.label} backHref={listHref} backLabel={backLabel} backShortLabel={backShort} />
      <p className="ll-termpage__meta">
        <span className="ll-termpage__tags" data-testid="formula-tags">
          <Badge className="ll-termpage__cat">
            <RatioIcon size={16} />
            <span>{categoryLabel(formula.category)}</span>
          </Badge>
        </span>
        {altLabel && altLabel !== formula.label && (
          <span className="ll-termpage__alt" lang={getLocale(other).htmlLang} data-testid="formula-alt">
            {altLabel}
          </span>
        )}
      </p>
      <Card as="section" className="ll-fx-card ll-fx-card--formula" data-testid="formula-main">
        <h2 className="ll-term-section__title">
          <Trans id="formula.section.formula" comment="公式條目頁：公式卡的標題">
            公式
          </Trans>
        </h2>
        <p className="ll-num ll-fx-formula" data-testid="formula-line">
          <span className="ll-fx-formula__name">{formula.label}</span>
          <span className="ll-fx-formula__eq" aria-hidden="true">
            ＝
          </span>
          <span className="ll-sr-only">{t({ id: 'formula.equals', message: '等於', comment: '公式一行裡等號的讀法（給螢幕閱讀器）' })}</span>
          <span className="ll-fx-formula__body">{formula.formula}</span>
        </p>
        {formula.versions.length > 0 && (
          <dl className="ll-fx-versions" data-testid="formula-versions">
            {formula.versions.map((v) => (
              <div key={v.version} className="ll-fx-versions__row">
                <dt>{versionName(v)}</dt>
                <dd>
                  <span className="ll-num">{v.formula}</span>
                  {v.note && <span className="ll-fx-versions__note">{plainParagraphs(v.note, locale).join(' ')}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      <Card as="section" className="ll-fx-card" data-testid="formula-components">
        <h2 className="ll-term-section__title">
          <Trans id="formula.section.components" comment="公式條目頁：各項數值的意思那一段的標題">
            各項數值的意思
          </Trans>
        </h2>
        <dl className="ll-fx-parts">
          {formula.components.map((c, i) => (
            <div key={i} className="ll-fx-parts__row">
              <dt>
                {c.term ? (
                  <TermPill href={localePath(locale, `/terms/${c.term}/`)} cellProps={{ 'data-term-id': c.term }}>
                    {c.label}
                  </TermPill>
                ) : (
                  <span className="ll-fx-parts__plain">{c.label}</span>
                )}
              </dt>
              <dd>{plainParagraphs(c.meaning, locale).join(' ')}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card as="section" className="ll-fx-card ll-fx-card--example" data-testid="formula-example">
        <h2 className="ll-term-section__title">
          <Trans id="formula.section.example" comment="公式條目頁：計算範例那一段的標題">
            計算範例
          </Trans>
        </h2>
        <div className="ll-fx-example ll-num">
          {plainParagraphs(formula.example, locale).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </Card>
      <Card as="section" className="ll-fx-card" data-testid="formula-reading">
        <h2 className="ll-term-section__title">
          <Trans id="formula.section.reading" comment="公式條目頁：怎麼看那一段的標題（高低代表什麼、要和誰比）">
            怎麼看
          </Trans>
        </h2>
        {plainParagraphs(formula.reading, locale).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </Card>
      {formula.sources.length > 0 && (
        <Card as="section" className="ll-fx-card" data-testid="formula-sources">
          <h2 className="ll-term-section__title">
            <Trans id="formula.section.sources" comment="公式條目頁：講義出處那一段的標題（講義與頁碼）">
              講義出處
            </Trans>
          </h2>
          <ul className="ll-fx-sources">
            {formula.sources.map((s) => {
              const code = s.code;
              const title = s.title;
              const pages = pageList(s.slides);
              return (
                <li key={s.id} lang="zh-TW">
                  {t({
                    id: 'formula.source.item',
                    message: `講義 ${code}「${title}」第 ${pages} 頁`,
                    comment: '講義出處的一列；code 是講義編號、title 是講義名稱、pages 是已格式化、用頓號隔開的頁碼',
                  })}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {questionTotal > 0 && (
        <Card as="section" className="ll-fx-card" aria-labelledby={questionsId} data-testid="formula-questions">
          <h2 id={questionsId} className="ll-term-section__title">
            {t({
              id: 'formula.section.questions',
              message: `相關題目（${questionTotalText} 題）`,
              comment: '公式條目頁：相關講義題那一段的標題；questionTotalText 已格式化',
            })}
          </h2>
          <p className="ll-fx-qnote">
            {t({
              id: 'formula.questions.note',
              message: '都是講義的練習題，點一題會到背題瀏覽的閱讀頁。',
              comment: '相關題目的說明：題目來自講義題庫，點了會到閱讀頁',
            })}
          </p>
          {RELATIONS.filter((r) => formula.questions[r].length > 0).map((r, i) => (
            <Disclosure
              key={r}
              variant="plain"
              summary={relationTitle(r, formula.questions[r].length)}
              defaultOpen={i === 0}
              className="ll-fx-qgroup"
              data-testid={`formula-questions-${r}`}
            >
              <NavList aria-label={relationTitle(r, formula.questions[r].length)} inset={false} tone="neutral">
                {formula.questions[r].map((q) => (
                  <NavRow
                    key={q.id}
                    href={localePath(locale, `/exam/browse/?deck=${q.deck}&q=${q.id}`)}
                    icon={<CardsIcon />}
                    title={q.topic}
                    size="compact"
                    lang="zh-TW"
                    data-testid="formula-question"
                  />
                ))}
              </NavList>
            </Disclosure>
          ))}
        </Card>
      )}
      {related.length > 0 && (
        <Card as="section" className="ll-term-related" aria-labelledby={relatedId} data-testid="formula-related">
          <h2 id={relatedId} className="ll-term-section__title">
            <Trans id="formula.related" comment="公式條目頁：相關公式段落標題">
              相關公式
            </Trans>
          </h2>
          <TermPillList aria-labelledby={relatedId} className="ll-term-related__pills">
            {related.map((r) => {
              const href = localePath(locale, `/formulas/${r.id}/`);
              return (
                <TermPill key={r.id} href={href} onClick={keepState(href)} cellProps={{ 'data-formula-id': r.id }}>
                  {r.label}
                </TermPill>
              );
            })}
          </TermPillList>
        </Card>
      )}
      <div className="ll-fx-termlink">
        <Button variant="secondary" size="md" icon={<CardsIcon />} href={termHref} data-testid="formula-term">
          {t({ id: 'formula.term', message: '在圖鑑看名詞說明', comment: '公式條目頁連到名詞頁的按鈕（定義、用語對照、常見誤解都在名詞頁）' })}
        </Button>
      </div>
      {backFooter}
    </div>
  );
}
