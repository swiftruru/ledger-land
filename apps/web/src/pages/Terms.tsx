// 名詞圖鑑（站規 2.6、03 第 2.10 節、02 第 2.4 節）：寬版頁。頁首 PageHeader 加收集數 StatChip；收集進度卡、搜尋框與分組切換；
// 名詞是收集卡（GlossaryGrid 加 GlossaryItem，375 一欄、600 起兩欄、寬版三欄）：已收進蓋金色印章、未收進是虛線空位，內容在任何狀態都能讀。
// 搜尋時不分組，命中的名詞排成一個「搜尋結果」格（寬版不會每章只有一張卡、右邊三分之二空白）。
// 沒有任何已發布題目用到的名詞（unlocks.ts 的 isReferenceTerm）放在最後的「參考名詞」展開列（預設收合，搜尋命中時自動展開），
// 不顯示鎖定、不算進收集數。搜尋字與分組放在查詢字串 ?q= 與 ?group=；搜尋框的字由本頁自己保管、只把結果寫回網址（finding glossary-1），
// 注音等輸入法組字中不會被打斷。資料全部來自 precache 的快照與本機進度。
// 一次出現（維護者 2026-10-26）：名詞索引、章節索引與進度一掛載就一起讀，三樣都到了才向 usePageReady 回報齊了、整頁一次淡入；在那之前只有頁首標題，
// 沒有骨架、沒有「…」的數字，印章和卡片同一次繪製出現。另一語系的名詞索引只給搜尋用（第一屏看不到），不算進 ready 的條件，到了也不改版面。
import { useLingui } from '@lingui/react/macro';
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { formatNumber, formatPercent, getLocale, localePath, type Locale } from '@ledgerland/i18n';
import {
  Badge,
  BookIcon,
  Button,
  Card,
  CardsIcon,
  Disclosure,
  EmptyState,
  ErrorState,
  GlossaryGrid,
  GlossaryItem,
  PageHeader,
  ProgressBar,
  SearchField,
  Segmented,
  StatChip,
  TermPill,
  TermPillList,
  XIcon,
} from '@ledgerland/web-ui';
import { meetInfo, useMeetText } from '../features/glossary/MeetLevel.tsx';
import { useCategoryLabel } from '../features/glossary/useCategoryLabel.ts';
import {
  chapterOfLevelMap,
  collectedRatio,
  collectionCounts,
  groupGlossary,
  groupProgress,
  hasOtherLabels,
  isReferenceTerm,
  matchesQuery,
  meetLevelOf,
  newlyCollected,
  unlockedTermMap,
  withOtherLabels,
  type GlossaryGroup,
  type GlossaryGrouping,
  type GlossaryReturnState,
  type GlossaryTerm,
} from '../features/glossary/unlocks.ts';
import { useGlossaryIndex, type GlossaryIndex } from '../features/glossary/useGlossaryIndex.ts';
import { useUnlocks } from '../features/glossary/useUnlocks.ts';
import { useLevelCodeFormatter } from '../features/home/codes.ts';
import { ContentLoadError, loadTermIndex, type TermIndexEntry } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/glossary.css';

/** 上次離開圖鑑時已收進的名詞 ID（蓋章動畫的比對基準，站規 1.11.2）；讀寫都包 try/catch，讀不到就不播 */
const SEEN_KEY = 'll:terms-seen';

function readSeen(): string[] | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) return null;
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function writeSeen(ids: readonly string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // 私密瀏覽或儲存空間滿了：下次就不播動畫，不影響其他功能
  }
}

/** 「再試一次」換一個 key 整頁重新掛載：名詞索引、章節索引與進度都重讀 */
export default function Terms() {
  const [attempt, setAttempt] = useState(0);
  return <TermsPage key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function TermsPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useLingui();
  const locale = useLocale();
  const navigate = useNavigate();
  const [terms, setTerms] = useState<GlossaryTerm[] | null>(null);
  const [error, setError] = useState<ContentLoadError | null>(null);
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const grouping: GlossaryGrouping = params.get('group') === 'name' ? 'name' : 'chapter';

  // 搜尋框的字由本頁保管（同步、高優先的 state），網址只是寫回去的副本：router 的更新是非同步的 transition，
  // 直接把 input 綁在網址上會在每次輸入後先回彈成舊字（finding glossary-1）。網址從外面改變（帶 ?q= 的連結、上一頁、切換語言）時才跟著換
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

  const index = useGlossaryIndex(locale);
  const unlockMap = useUnlocks('term');
  const inputRef = useRef<HTMLInputElement | null>(null);
  // E2E 與其他頁面的測試用的 data-testid 放在輸入框本身（SearchField 的 data-testid 在外框上）
  const setInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.setAttribute('data-testid', 'terms-search');
  }, []);
  const resultId = useId();
  const categoryLabel = useCategoryLabel();
  const meetText = useMeetText();
  const codeOf = useLevelCodeFormatter();

  useEffect(() => {
    let alive = true;
    setTerms(null);
    setError(null);
    loadTermIndex(locale).then(
      (list) => alive && setTerms(list),
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  // 雙語搜尋（finding glossary-2）：索引還沒帶另一種語言的名稱時，讀另一語系的名詞索引（已在 precache）補上。只給搜尋比對用，
  // 第一屏看不到它的結果，所以不算進 ready 的條件；到了也只換 searchable，搜尋框與卡片不會因此跳動
  const [other, setOther] = useState<{ locale: Locale; list: readonly TermIndexEntry[] } | null>(null);
  const needOther = terms !== null && !hasOtherLabels(terms) && other?.locale !== locale;
  useEffect(() => {
    if (!needOther) return;
    let alive = true;
    const otherLocale: Locale = locale === 'en' ? 'zh-TW' : 'en';
    loadTermIndex(otherLocale).then(
      (list) => alive && setOther({ locale, list }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [needOther, locale]);
  const searchable = useMemo(() => (terms && other?.locale === locale ? withOtherLabels(terms, other.list) : terms), [terms, other, locale]);

  const collator = useMemo(() => new Intl.Collator(getLocale(locale).intlLocale), [locale]);
  const unlocked = useMemo(
    () => (unlockMap === null ? null : unlockedTermMap([...unlockMap].map(([id, unlockedAt]) => ({ id, kind: 'term' as const, unlockedAt })))),
    [unlockMap],
  );

  // 蓋章動畫：和上次離開圖鑑時的清單比，新收進的卡片播一次。要播哪幾張在進度讀到的同一次繪製就算好（不是先畫沒有動畫的印章、下一個影格才加 class）；
  // 寫回現在的清單在 effect 裡做，重新整理後清單相同就不再播
  const fresh = useMemo(() => newlyCollected(unlocked === null ? null : readSeen(), unlocked), [unlocked]);
  useEffect(() => {
    if (unlocked !== null) writeSeen([...unlocked.keys()]);
  }, [unlocked]);

  const chapterOfLevel = useMemo(() => chapterOfLevelMap(index?.chapters ?? []), [index]);
  const groups = useMemo(() => {
    if (!searchable || !index) return null;
    const filtered = searchable.filter((x) => matchesQuery(x, deferredQuery));
    return groupGlossary(filtered, grouping, index.chapters, locale, collator);
  }, [searchable, index, deferredQuery, grouping, collator, locale]);
  // 第一次繪製要的資料：名詞索引、章節索引（分組標題與「在哪一關遇到」）、進度（印章與收集數）。三樣都到了才畫卡片、才回報齊了；
  // 讀不到名詞索引時是錯誤狀態，也算齊了（畫面照樣要出來）
  const view = terms !== null && index !== null && unlocked !== null && groups !== null ? { terms, index, unlocked, groups } : null;
  const loaded = view !== null;
  usePageReady(loaded || error !== null);
  // 蓋章動畫從布幕拉開的那一次繪製開始：PageReveal 收到回報後下一次 commit 才把 data-ready 換成 true，這裡的 revealed 在同一批更新裡跟著變 true，
  // 卡片在同一個 commit 加上 is-just-collected，印章不會在整頁還看不見時就先播完
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (loaded) setRevealed(true);
  }, [loaded]);
  const collectGroups = view?.groups.filter((g) => g.key !== 'reference') ?? null;
  // 搜尋時不分組：每章常常只命中一兩張，分組會在寬版留下一排排「左邊一張、右邊空白」。命中的收集區名詞排成一個扁平的結果格（順序沿用目前的分組）
  const searchHits = searching && collectGroups ? collectGroups.flatMap((g) => g.terms) : null;
  const refGroup = view?.groups.find((g) => g.key === 'reference');
  const refTotal = useMemo(() => (terms ?? []).filter(isReferenceTerm).length, [terms]);
  const hits = view?.groups.reduce((n, g) => n + g.terms.length, 0) ?? 0;
  const hitsText = formatNumber(hits, locale);
  const shownQuery = deferredQuery.trim();

  // 參考名詞的展開列：預設收合；搜尋命中時自動展開。自動展開時使用者手動收合，這次搜尋（清空之前）就不再自動展開
  const [refManual, setRefManual] = useState(false);
  const [refDismissed, setRefDismissed] = useState(false);
  useEffect(() => {
    if (!searching) setRefDismissed(false);
  }, [searching]);
  const refHits = refGroup?.terms.length ?? 0;
  const refAuto = searching && refHits > 0 && !refDismissed;
  const refOpen = refAuto || refManual;
  const onRefToggle = (next: boolean) => {
    setRefManual(next);
    if (!next && refAuto) setRefDismissed(true);
  };

  const setParam = useCallback(
    (key: 'q' | 'group', value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value.trim() === '' || (key === 'group' && value === 'chapter')) next.delete(key);
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

  // 點進名詞頁時把目前的搜尋與分組放進 history state，名詞頁的返回才帶得回來（finding glossary-4）；
  // 修飾鍵或中鍵照瀏覽器原本的行為（新分頁）
  const returnSearch = (() => {
    const n = new URLSearchParams();
    if (query.trim() !== '') n.set('q', query);
    if (grouping === 'name') n.set('group', 'name');
    return n.toString();
  })();
  const openTerm = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href, { state: { llGlossarySearch: returnSearch } satisfies GlossaryReturnState });
  };

  // 參考名詞不算分子也不算分母（collectionCounts）；資料齊了才有數字，齊了之前整頁還沒出現（沒有「…」的佔位）
  const counts = view === null ? null : collectionCounts(view.terms, view.unlocked);
  const doneText = counts === null ? '' : formatNumber(counts.done, locale);
  const totalText = counts === null ? '' : formatNumber(counts.total, locale);
  // 收集進度卡的大數字是百分比（看圖驗收第 2 輪）：頁首的統計膠囊已寫「0／107」，進度卡不再重複同一個數字。
  // 無條件捨去，還沒收齊不會顯示 100%；收進一個以上就至少 1%（不會收了卻還是 0%）
  const pctText = counts === null ? '' : formatPercent(collectedRatio(counts.done, counts.total), locale, { digits: 0 });
  const progressLabel = t({
    id: 'terms.stat.label',
    message: `已收進 ${doneText}／${totalText} 個名詞`,
    comment: '名詞圖鑑收集數的可讀名稱（頁首統計膠囊與收集進度卡）；doneText、totalText 是已格式化的數字',
  });

  const card = (v: NonNullable<typeof view>) => (x: GlossaryTerm) => {
    const state = v.unlocked.has(x.id) ? 'unlocked' : 'locked';
    const m = meetLevelOf(x, chapterOfLevel);
    const info = m ? meetInfo(v.index, m, locale, codeOf) : undefined;
    const href = localePath(locale, `/terms/${x.id}/`);
    // 依章節分組時章名已在分組標題上：畫面只寫「在 1-1 遇到」，可讀名稱仍帶關卡名；依名稱與搜尋結果看不到章名，寫完整的「在 1-1「關卡名」遇到」
    const long = info ? meetText.card(info) : undefined;
    const inChapter = grouping === 'chapter' && !searching;
    // 代號排成小膠囊（看圖驗收第 2 輪）：依名稱與搜尋結果是「[6-1] 關卡名」兩部分，整句只給螢幕閱讀器；
    // 依章節分組與讀不到關卡名時是「在 [1-1] 遇到」，膠囊只換句子裡的代號。延伸章的代號是 E4-1（和章節頁、地圖、首頁同一個，看圖驗收第 3 輪）
    const code = info?.code;
    const levelTitle = inChapter ? undefined : info?.levelTitle;
    return (
      <GlossaryItem
        key={x.id}
        href={href}
        name={x.label}
        english={locale === 'zh-TW' ? x.ifrsEnglish : null}
        category={x.category}
        categoryLabel={categoryLabel(x.category)}
        element={x.element}
        state={state}
        stateLabel={
          state === 'unlocked'
            ? t({ id: 'terms.state.unlocked', message: '已收進', comment: '名詞卡的狀態（給螢幕閱讀器）：已收進圖鑑' })
            : t({ id: 'terms.state.locked', message: '未收進', comment: '名詞卡的狀態（給螢幕閱讀器）：還沒收進圖鑑；只是收藏狀態，內容照樣能讀' })
        }
        meet={info ? (inChapter ? meetText.short(info) : long) : undefined}
        meetLabel={inChapter ? long : undefined}
        meetTitle={code === undefined ? undefined : levelTitle}
        meetCode={code}
        justCollected={revealed && fresh.has(x.id)}
        onClick={openTerm(href)}
        cellProps={{ 'data-term-id': x.id, 'data-unlocked': state }}
      />
    );
  };

  return (
    <div className="ll-glossary">
      <PageHeader
        title={t({ id: 'terms.title', message: '名詞圖鑑', comment: '名詞圖鑑的頁面標題（模組全名）' })}
        end={
          counts !== null && (
            <StatChip
              icon={<CardsIcon />}
              tone="terms"
              value={t({
                id: 'terms.stat.value',
                message: `${doneText}／${totalText}`,
                comment: '頁首統計膠囊上的收集數（畫面上的短字，可讀名稱另有 terms.stat.label）；doneText、totalText 是已格式化的數字',
              })}
              label={progressLabel}
              data-testid="terms-stat"
            />
          )
        }
      />
      {error ? (
        <ErrorState
          title={t({ id: 'terms.error.title', message: '名詞圖鑑載入失敗', comment: '名詞圖鑑讀不到名詞索引時的標題' })}
          description={t({ id: 'content.offlineMissing', message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。' })}
          onRetry={onRetry}
          data-testid="terms-error"
        />
      ) : view === null || counts === null || collectGroups === null ? null : (
        <>
          <div className="ll-glossary__top">
            <Card className="ll-glossary__progress" data-testid="terms-progress">
              <p className="ll-glossary__eyebrow">{t({ id: 'terms.progress.label', message: '圖鑑收集', comment: '名詞圖鑑收集進度卡的小標' })}</p>
              <p className="ll-glossary__count">
                <span className="ll-glossary__done ll-num" aria-hidden="true" data-testid="terms-progress-pct">
                  {pctText}
                </span>
                <span className="ll-sr-only">{progressLabel}</span>
              </p>
              <ProgressBar value={counts.done} max={counts.total} className="ll-glossary__bar" />
              <p className="ll-glossary__hint">
                {t({ id: 'terms.progress.hint', message: '還沒收進的名詞也可以直接讀。', comment: '收集進度卡最後一行：鎖住的只是收藏狀態，內容照樣能讀' })}
              </p>
            </Card>
            <div className="ll-glossary__tools">
              <SearchField
                label={t({ id: 'terms.search.label', message: '搜尋名詞（中文或英文）', comment: '名詞圖鑑搜尋欄的標籤' })}
                value={query}
                onChange={onSearch}
                placeholder={t({ id: 'terms.search.placeholder', message: '名稱、現行用語或英文', comment: '搜尋欄的提示文字（只是例子，標籤另外寫）' })}
                inputRef={setInput}
                describedBy={searching ? resultId : undefined}
                className="ll-glossary__search"
                data-testid="terms-search-field"
              />
              <Segmented<GlossaryGrouping>
                value={grouping}
                label={t({ id: 'terms.group.label', message: '分組方式', comment: '名詞圖鑑分組的群組名稱' })}
                onChange={(v) => setParam('group', v)}
                className="ll-glossary__seg"
                options={[
                  { value: 'chapter', label: t({ id: 'terms.group.chapter', message: '依章節', comment: '名詞圖鑑分組選項' }) },
                  { value: 'name', label: t({ id: 'terms.group.name', message: '依名稱', comment: '名詞圖鑑分組選項' }) },
                ]}
              />
            </div>
          </div>
          {/* 搜尋結果數給螢幕閱讀器（輸入時禮貌地唸出，不搶焦點） */}
          <p id={resultId} className="ll-sr-only" aria-live="polite">
            {searching
              ? t({ id: 'terms.search.count', message: `找到 ${hitsText} 個名詞`, comment: '搜尋結果數（給螢幕閱讀器）；hitsText 是已格式化的數字' })
              : ''}
          </p>
          {hits === 0 ? (
            <EmptyState
              title={t({
                id: 'terms.search.empty',
                message: `找不到「${shownQuery}」`,
                comment: '名詞圖鑑搜尋沒有結果時的標題；shownQuery 是使用者輸入的搜尋字',
              })}
              description={t({
                id: 'terms.search.emptyHint',
                message: '換個說法試試，例如中文名稱、現行用語或英文。',
                comment: '名詞圖鑑搜尋沒有結果時的說明',
              })}
              action={
                <Button icon={<XIcon />} onClick={clearSearch}>
                  {t({ id: 'terms.search.clear', message: '清除搜尋', comment: '搜尋沒有結果時的按鈕：清除搜尋字，焦點回到搜尋框' })}
                </Button>
              }
              data-testid="terms-empty"
            />
          ) : searchHits ? (
            searchHits.length > 0 && (
              <section className="ll-glossary__group" aria-labelledby="ll-terms-search" data-group="search">
                <div className="ll-glossary__ghead">
                  <h2 id="ll-terms-search" className="ll-glossary__heading">
                    <span className="ll-glossary__gtitle">
                      {t({ id: 'terms.search.results', message: '搜尋結果', comment: '名詞圖鑑搜尋時的結果標題（搜尋時不分章節，命中的名詞排成一格）' })}
                    </span>
                  </h2>
                  <GroupCount progress={groupProgress(searchHits, view.unlocked)} locale={locale} />
                </div>
                <GlossaryGrid aria-labelledby="ll-terms-search" data-testid="term-list">
                  {searchHits.map(card(view))}
                </GlossaryGrid>
              </section>
            )
          ) : (
            collectGroups.map((g) => (
              <section key={g.key} className="ll-glossary__group" aria-labelledby={`ll-terms-${g.key}`} data-group={g.key}>
                <GroupHeading group={g} index={view.index} locale={locale} progress={groupProgress(g.terms, view.unlocked)} />
                {g.key === 'none' && (
                  <p className="ll-glossary__gnote">
                    {t({
                      id: 'terms.group.none.note',
                      message: '這些名詞目前還沒有關卡用到，可以先讀。',
                      comment: '「還沒有關卡用到的名詞」那一組的說明（只出現一次，卡片上不再重複）',
                    })}
                  </p>
                )}
                <GlossaryGrid aria-labelledby={`ll-terms-${g.key}`} data-testid="term-list">
                  {g.terms.map(card(view))}
                </GlossaryGrid>
              </section>
            ))
          )}
          {refGroup && (
            <section
              className="ll-glossary__group ll-glossary__group--reference"
              aria-label={t({
                id: 'terms.reference.toggle',
                message: '參考名詞',
                comment: '名詞圖鑑最後的展開列：目前沒有任何已發布題目用到的名詞（不算收集數、不顯示鎖定）',
              })}
              data-testid="terms-reference"
              data-group="reference"
            >
              <Disclosure
                variant="card"
                icon={<BookIcon />}
                summary={t({ id: 'terms.reference.toggle', message: '參考名詞' })}
                trailing={<Badge>{formatNumber(searching ? refHits : refTotal, locale)}</Badge>}
                open={refOpen}
                onToggle={onRefToggle}
                data-testid="terms-reference-toggle"
              >
                <p className="ll-glossary__refnote" data-testid="terms-reference-note">
                  {t({
                    id: 'terms.reference.note',
                    message: '目前還沒有關卡用到這些名詞，隨時可以讀，不算在上面「已收進圖鑑」的數量裡；之後有關卡用到時會自動移進收集。',
                    comment: '「參考名詞」區的說明：隨時可讀、不算收集數；之後有關卡用到會自動移到收集區',
                  })}
                </p>
                <TermPillList aria-label={t({ id: 'terms.reference.toggle', message: '參考名詞' })} data-testid="term-pills">
                  {refGroup.terms.map((x) => {
                    const href = localePath(locale, `/terms/${x.id}/`);
                    return (
                      <TermPill key={x.id} href={href} onClick={openTerm(href)} cellProps={{ 'data-term-id': x.id, 'data-unlocked': 'reference' }}>
                        {x.label}
                      </TermPill>
                    );
                  })}
                </TermPillList>
              </Disclosure>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** 分組標題：章號小膠囊（延伸章是六角形「E1」）、章名，右側「3／7 已收進」。螢幕閱讀器唸完整的「第 1 章：章名」 */
function GroupHeading({
  group,
  index,
  locale,
  progress,
}: {
  group: GlossaryGroup;
  index: GlossaryIndex;
  locale: Locale;
  progress: { done: number; total: number };
}) {
  const { t } = useLingui();
  const id = `ll-terms-${group.key}`;
  const entry = group.chapterId === undefined ? undefined : index.chapters.find((c) => c.id === group.chapterId);
  const info = group.chapterId === undefined ? undefined : index.info.get(group.chapterId);
  let pill: string | undefined;
  let full: string;
  let visible: string;
  if (entry) {
    const no = formatNumber(entry.chapterNo, locale);
    pill = entry.extension
      ? t({ id: 'terms.chapterPill.ext', message: `E${no}`, comment: '名詞圖鑑分組標題左側的延伸章章號（六角形小膠囊）；no 是延伸區自己的章序' })
      : no;
    const title = info?.title;
    if (title !== undefined) {
      visible = title;
      full = entry.extension
        ? t({
            id: 'terms.group.extChapterName',
            message: `延伸第 ${no} 章：${title}`,
            comment: '依章節分組、延伸章的標題（螢幕閱讀器唸的完整名稱）；no 是延伸區自己的章序（和地圖的「延伸第 N 章」相同），title 是章節名',
          })
        : t({
            id: 'terms.group.chapterName',
            message: `第 ${no} 章：${title}`,
            comment: '依章節分組的標題（螢幕閱讀器唸的完整名稱）；no 是已格式化的章序號，title 是章節名',
          });
    } else {
      full = entry.extension
        ? t({ id: 'terms.group.extChapterNo', message: `延伸第 ${no} 章`, comment: '依章節分組、延伸章且讀不到章節名時的標題；no 是延伸區自己的章序' })
        : t({ id: 'terms.group.chapterNo', message: `第 ${no} 章`, comment: '依章節分組、讀不到章節名時的標題；no 是已格式化的章序號' });
      visible = full;
    }
  } else if (group.key === 'none') {
    full = visible = t({ id: 'terms.group.other', message: '還沒有關卡用到的名詞', comment: '還沒有任何已發布關卡用到的名詞那一組（不知道會在哪一關遇到）' });
  } else if (group.key === 'all') {
    full = visible = t({ id: 'terms.group.all', message: '全部名詞', comment: '依名稱排序、不分組時的標題' });
  } else {
    // 英文介面依名稱分組的首字母
    full = visible = group.key;
  }
  // 有章號膠囊時加修飾 class：標題換行時（英文的長章名）收集數從章名的左緣開始，不貼到膠囊下方（看圖驗收第 4 輪）
  const indent = pill === undefined ? '' : entry?.extension ? ' ll-glossary__ghead--ext' : ' ll-glossary__ghead--pill';
  return (
    <div className={`ll-glossary__ghead${indent}`}>
      <h2 id={id} className="ll-glossary__heading">
        {pill !== undefined && (
          <span className={`ll-glossary__chno${entry?.extension ? ' ll-glossary__chno--ext' : ''}`} aria-hidden="true">
            {pill}
          </span>
        )}
        {full === visible ? (
          <span className="ll-glossary__gtitle">{visible}</span>
        ) : (
          <>
            <span className="ll-sr-only">{full}</span>
            <span className="ll-glossary__gtitle" aria-hidden="true">
              {visible}
            </span>
          </>
        )}
      </h2>
      {/* 「全部名詞」只有一個 h2：收集數已在頁首與進度卡，不再寫第三次 */}
      {group.key !== 'all' && <GroupCount progress={progress} locale={locale} />}
    </div>
  );
}

/** 分組標題右側的「3／7 已收進」（章節分組、英文的字母分組與搜尋結果） */
function GroupCount({ progress, locale }: { progress: { done: number; total: number }; locale: Locale }) {
  const { t } = useLingui();
  const done = formatNumber(progress.done, locale);
  const total = formatNumber(progress.total, locale);
  return (
    <span className="ll-glossary__gcount" data-testid="terms-group-count">
      {t({
        id: 'terms.group.count',
        message: `${done}／${total} 已收進`,
        comment: '分組標題右側：這一組已收進幾個；done、total 是已格式化的數字',
      })}
    </span>
  );
}
