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
  PlayIcon,
  RatioIcon,
  TermPill,
  TermPillList,
  TopBar,
  useUiLabels,
} from '@ledgerland/web-ui';
import { formulaReturnPath, formulaReturnSearch } from '../features/formulas/catalogue.ts';
import { FormulaSections } from '../features/formulas/FormulaSections.tsx';
import { useFormulaCategoryLabel } from '../features/formulas/useFormulaCategoryLabel.ts';
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
      <FormulaSections formula={formula} />
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
          {/* 一輪只練這些題（formula:<id> 題組，依講義順序；答完的回饋有「相關公式」膠囊回到這裡） */}
          <div className="ll-fx-practise">
            <Button variant="primary" size="md" icon={<PlayIcon />} href={localePath(locale, `/exam/formula:${formula.id}/`)} data-testid="formula-practise">
              {t({
                id: 'formula.practise',
                message: `練習相關題目（${questionTotalText} 題）`,
                comment: '公式條目頁的主要按鈕：開一輪只有這些題的練習；questionTotalText 已格式化',
              })}
            </Button>
            {/* 到背題瀏覽，清單只列這些題（?formula=，2026-11-08） */}
            <Button
              variant="secondary"
              size="md"
              icon={<CardsIcon />}
              href={localePath(locale, `/exam/browse/?formula=${formula.id}`)}
              data-testid="formula-browse"
            >
              {t({ id: 'formula.browse', message: '在背題瀏覽讀', comment: '公式條目頁的次要按鈕：到背題瀏覽，只列這條公式的相關題' })}
            </Button>
          </div>
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
                    href={localePath(locale, `/exam/browse/?formula=${formula.id}&q=${q.id}`)}
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
