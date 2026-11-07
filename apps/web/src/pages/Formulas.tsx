// 會計公式總覽（02 第 1.1 節的 /formulas/，2026-11-07）：寬版頁。頁首是標題與條目數；搜尋框（名稱、別名、公式裡的項目、另一語系的名稱）與分類切換。
// 「全部」時每一類收成一張展開列（類名與個數，只有第一類預設展開），點開才看到該類的列，一進來不會是一長串公式；選一類或搜尋時直接列出。
// 每一列是名稱加公式一行，右側是相關講義題的題數。搜尋字與分類放在查詢字串 ?q= 與 ?group=，進條目再返回時帶得回來（和圖鑑同一套做法）。
// 資料來自 precache 的公式索引；畫好後請 Service Worker 把完整內容檔抓進快取（features/exam/prefetch.ts），之後離線也能開條目。
import { useLingui } from '@lingui/react/macro';
import { startTransition, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatNumber, getLocale, localePath, type Locale } from '@ledgerland/i18n';
import {
  Badge,
  Button,
  Disclosure,
  EmptyState,
  ErrorState,
  NavList,
  NavRow,
  PageHeader,
  RatioIcon,
  SearchField,
  Segmented,
  StatChip,
  XIcon,
} from '@ledgerland/web-ui';
import { scheduleFormulaPrefetch } from '../features/exam/prefetch.ts';
import {
  FORMULA_CATEGORY_ORDER,
  groupFormulas,
  isFormulaCategory,
  matchesFormulaQuery,
  type FormulaCategory,
  type FormulaReturnState,
} from '../features/formulas/catalogue.ts';
import { useFormulaCategoryLabel } from '../features/formulas/useFormulaCategoryLabel.ts';
import { ContentLoadError, loadFormulaIndex, loadManifest, type FormulaIndexEntry } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/formulas.css';

type Group = FormulaCategory | 'all';

/** 「再試一次」換一個 key 整頁重新掛載 */
export default function Formulas() {
  const [attempt, setAttempt] = useState(0);
  return <FormulasPage key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function FormulasPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  const navigate = useNavigate();
  const categoryLabel = useFormulaCategoryLabel();
  const [list, setList] = useState<FormulaIndexEntry[] | null>(null);
  const [alt, setAlt] = useState<ReadonlyMap<string, string> | null>(null);
  const [error, setError] = useState<ContentLoadError | null>(null);
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const urlGroup = params.get('group') ?? '';
  const group: Group = isFormulaCategory(urlGroup) ? urlGroup : 'all';

  // 搜尋框的字由本頁保管，網址只是寫回去的副本（和圖鑑一樣，輸入法組字中不會被打斷）
  const [query, setQuery] = useState(urlQuery);
  const written = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery !== written.current) {
      written.current = urlQuery;
      setQuery(urlQuery);
    }
  }, [urlQuery]);
  const deferredQuery = useDeferredValue(query);
  const searching = deferredQuery.trim() !== '';
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.setAttribute('data-testid', 'formulas-search');
  }, []);
  const resultId = useId();

  useEffect(() => {
    let alive = true;
    setList(null);
    setError(null);
    loadFormulaIndex(locale).then(
      (x) => alive && startTransition(() => setList(x)),
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  // 另一語系的名稱只給搜尋用（例如中文站打 ROE 的英文全名）：到了才換，不算進 ready
  useEffect(() => {
    let alive = true;
    const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
    loadFormulaIndex(other).then(
      (x) => alive && startTransition(() => setAlt(new Map(x.map((f) => [f.id, f.label])))),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  // 畫好之後請 SW 把完整內容檔抓進快取（兩個語系）
  useEffect(() => {
    if (list === null) return;
    let cancel = () => {};
    let alive = true;
    void loadManifest().then((m) => {
      if (alive) cancel = scheduleFormulaPrefetch(m);
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [list]);

  const collator = useMemo(() => new Intl.Collator(getLocale(locale).intlLocale), [locale]);
  const groups = useMemo(() => {
    if (list === null) return null;
    const filtered = list.filter((f) => matchesFormulaQuery(f, deferredQuery, alt?.get(f.id)));
    return groupFormulas(filtered, collator);
  }, [list, deferredQuery, alt, collator]);
  usePageReady(groups !== null || error !== null);

  const setParam = useCallback(
    (key: 'q' | 'group', value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value.trim() === '' || (key === 'group' && value === 'all')) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const onSearch = (v: string) => {
    setQuery(v);
    written.current = v.trim() === '' ? '' : v;
    setParam('q', v);
  };
  const clearSearch = () => {
    onSearch('');
    inputRef.current?.focus();
  };
  const returnSearch = (() => {
    const n = new URLSearchParams();
    if (query.trim() !== '') n.set('q', query);
    if (group !== 'all') n.set('group', group);
    return n.toString();
  })();
  const openFormula = (href: string) => (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href, { state: { llFormulaSearch: returnSearch } satisfies FormulaReturnState });
  };

  const total = list?.length ?? 0;
  const totalText = formatNumber(total, locale);
  const shown = group === 'all' ? groups : (groups?.filter((g) => g.category === group) ?? null);
  const hits = shown?.reduce((n, g) => n + g.formulas.length, 0) ?? 0;
  const hitsText = formatNumber(hits, locale);
  const shownQuery = deferredQuery.trim();
  // 分類切換只列有條目的分類（搜尋時仍列全部，換分類才看得到別類的結果）
  const present = useMemo(() => new Set((list ?? []).map((f) => f.category)), [list]);
  const options: { value: Group; label: string }[] = [
    { value: 'all', label: t({ id: 'formulas.group.all', message: '全部', comment: '公式總覽的分類切換：不分類' }) },
    ...FORMULA_CATEGORY_ORDER.filter((c) => present.has(c)).map((c) => ({ value: c, label: categoryLabel(c) })),
  ];
  const countText = (n: number) => formatNumber(n, locale);
  const questionsLabel = (n: number) => {
    const count = countText(n);
    return t({ id: 'formulas.row.questions', message: `${count} 題`, comment: '公式總覽每一列右側：相關講義題的題數；count 已格式化' });
  };

  const row = (f: FormulaIndexEntry) => {
    const href = localePath(locale, `/formulas/${f.id}/`);
    return (
      <NavRow
        key={f.id}
        href={href}
        onClick={openFormula(href)}
        icon={<RatioIcon />}
        title={f.label}
        description={<span className="ll-num ll-fx-row__formula">{f.formula}</span>}
        trailing={f.questionIds.length > 0 ? <Badge>{questionsLabel(f.questionIds.length)}</Badge> : undefined}
        data-testid="formula-row"
        id={`fx-${f.id}`}
      />
    );
  };

  return (
    <div className="ll-fx">
      <PageHeader
        title={t({ id: 'formulas.title', message: '會計公式', comment: '會計公式總覽的頁面標題' })}
        end={
          list !== null && (
            <StatChip
              icon={<RatioIcon />}
              tone="terms"
              value={totalText}
              label={t({ id: 'formulas.stat.label', message: `共 ${totalText} 條公式`, comment: '頁首統計膠囊的可讀名稱；totalText 已格式化' })}
              data-testid="formulas-stat"
            />
          )
        }
      />
      {error ? (
        <ErrorState
          title={t({ id: 'formulas.error.title', message: '會計公式載入失敗', comment: '公式總覽讀不到公式索引時的標題' })}
          description={t({ id: 'content.offlineMissing', message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。' })}
          onRetry={onRetry}
          data-testid="formulas-error"
        />
      ) : shown === null ? null : (
        <>
          <p className="ll-fx__intro" data-testid="formulas-intro">
            {t({
              id: 'formulas.intro',
              message: '講義裡會算的比率與報表關係都在這裡：先找公式，再看各項數值的意思、數字範例與講義出處，接著練相關的題。',
              comment: '公式總覽頁首的一句說明',
            })}
          </p>
          <div className="ll-fx__tools">
            <SearchField
              label={t({ id: 'formulas.search.label', message: '搜尋公式（名稱或公式裡的項目）', comment: '公式總覽搜尋欄的標籤' })}
              value={query}
              onChange={onSearch}
              placeholder={t({ id: 'formulas.search.placeholder', message: '例如 ROE、週轉、淨利', comment: '公式搜尋欄的提示文字（只是例子）' })}
              inputRef={setInput}
              describedBy={searching ? resultId : undefined}
              className="ll-fx__search"
              data-testid="formulas-search-field"
            />
            <Segmented<Group>
              value={group}
              label={t({ id: 'formulas.group.label', message: '分類', comment: '公式總覽分類切換的群組名稱' })}
              onChange={(v) => setParam('group', v)}
              className="ll-fx__seg"
              options={options}
            />
          </div>
          <p id={resultId} className="ll-sr-only" aria-live="polite">
            {searching ? t({ id: 'formulas.search.count', message: `找到 ${hitsText} 條公式`, comment: '搜尋結果數（給螢幕閱讀器）；hitsText 已格式化' }) : ''}
          </p>
          {hits === 0 ? (
            <EmptyState
              title={
                searching
                  ? t({ id: 'formulas.search.empty', message: `找不到「${shownQuery}」`, comment: '公式搜尋沒有結果時的標題；shownQuery 是使用者輸入的字' })
                  : t({ id: 'formulas.group.empty', message: '這一類還沒有公式', comment: '選了一個目前沒有條目的分類' })
              }
              description={t({
                id: 'formulas.search.emptyHint',
                message: '換個說法試試，例如指標的中文名稱、英文縮寫，或公式裡的項目。',
                comment: '公式搜尋沒有結果時的說明',
              })}
              action={
                searching ? (
                  <Button icon={<XIcon />} onClick={clearSearch}>
                    {t({ id: 'formulas.search.clear', message: '清除搜尋', comment: '搜尋沒有結果時的按鈕' })}
                  </Button>
                ) : undefined
              }
              data-testid="formulas-empty"
            />
          ) : group === 'all' && !searching ? (
            <div className="ll-fx__groups" data-testid="formula-groups">
              {shown.map((g, i) => (
                <Disclosure
                  key={g.category}
                  variant="card"
                  icon={<RatioIcon />}
                  summary={categoryLabel(g.category)}
                  trailing={<Badge>{countText(g.formulas.length)}</Badge>}
                  defaultOpen={i === 0}
                  className="ll-fx__group"
                  data-testid={`formula-group-${g.category}`}
                >
                  <NavList aria-label={categoryLabel(g.category)} inset={false} tone="neutral" className="ll-fx__list">
                    {g.formulas.map(row)}
                  </NavList>
                </Disclosure>
              ))}
            </div>
          ) : (
            <div className="ll-fx__flat">
              {shown.map((g) => (
                <section key={g.category} className="ll-fx__section" aria-labelledby={`fx-group-${g.category}`} data-testid={`formula-section-${g.category}`}>
                  <h2 id={`fx-group-${g.category}`} className="ll-fx__heading">
                    {categoryLabel(g.category)}
                    <span className="ll-fx__hcount">{countText(g.formulas.length)}</span>
                  </h2>
                  <NavList aria-labelledby={`fx-group-${g.category}`} inset={false} tone="neutral" className="ll-fx__list">
                    {g.formulas.map(row)}
                  </NavList>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
