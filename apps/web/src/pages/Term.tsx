// 名詞頁（站規 2.7、03 第 4.3 節）：TopBar 的返回是「圖鑑」（從圖鑑點進來時帶回原本的 ?q 與 ?group，finding glossary-4），h1 是名詞名稱，
// 下一行是類別 Badge、註記標籤（NoteTag：舊稱、簡化、非 IFRS 項目）與另一種語言的名稱。標題下方第一張是狀態卡（UnlockCard.tsx）：未收進是解鎖任務卡加 primary「前往這一關」，
// 已收進是金色印章，參考名詞只有一行說明。之後是定義、用語對照（兩種用語相同時合併成一列）、其餘段落、相關名詞（TermPill），
// 頁尾是 secondary「回到名詞圖鑑」。讀不到時是單一 ErrorState（h1 仍在，finding glossary-3）。
// 一次出現（維護者 2026-10-26）：名詞內容（兩種語言）、章節索引、相關名詞與定義引用的名稱、進度一起讀，全部到了才向 usePageReady 回報齊了、整頁一次淡入；
// 在那之前只有頁首的返回鍵與空的 h1（換頁的焦點落點），沒有骨架；狀態卡第一次出現就是最後的樣子（已收進或解鎖任務卡）。
// 中文換行（M3 驗收第 7 輪：375 的「現時經／濟資源」「存貨與設／備」「有形資／產」）：h1 的名詞名稱（第 9 輪）、定義、各段落、用語對照、狀態說明與解鎖任務卡的標題
// 文字照全站規則換行（07 第 3.5 節，2026-10-27 起：中文逐字換行、齊行，不再切詞）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { formatDate, getLocale, localePath, type Locale } from '@ledgerland/i18n';
import {
  BackButton,
  Badge,
  Button,
  Card,
  CardsIcon,
  ErrorState,
  NoteTag,
  TermCategoryIcon,
  TermPill,
  TermPillList,
  TopBar,
  useUiLabels,
} from '@ledgerland/web-ui';
import { meetInfo, useMeetText } from '../features/glossary/MeetLevel.tsx';
import { termNoteKinds } from '../features/glossary/note-kinds.ts';
import { CollectedCard, StatusNote, UnlockCard } from '../features/glossary/UnlockCard.tsx';
import {
  chapterOfLevelMap,
  glossaryReturnPath,
  glossaryReturnSearch,
  isReferenceTerm,
  meetLevelOf,
  termUnlockId,
  type GlossaryTerm,
} from '../features/glossary/unlocks.ts';
import { useCategoryLabel } from '../features/glossary/useCategoryLabel.ts';
import { loadGlossaryIndex, type GlossaryIndex } from '../features/glossary/useGlossaryIndex.ts';
import { useUnlocks } from '../features/glossary/useUnlocks.ts';
import { useLevelCodeFormatter } from '../features/home/codes.ts';
import { TERM_FIELD_ORDER, termFieldsOf, type TermField } from '../features/quiz/term-fields.ts';
import { hasTermRefs, plainParagraphs } from '../features/term-page/term-text.ts';
import { ContentLoadError, loadTermDetail, loadTermIndex, type TermSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import '../styles/glossary.css';

/** 狀態卡（03 第 2.10 節）：參考名詞不看進度；其他名詞看進度裡的 unlock（頁面在進度讀到之後才畫，傳進來的一定是讀好的） */
function TermStatus({ term, locale, index, unlocks }: { term: GlossaryTerm; locale: Locale; index: GlossaryIndex; unlocks: ReadonlyMap<string, string> }) {
  if (isReferenceTerm(term))
    return (
      <StatusNote kind="reference">
        <Trans id="term.reference" comment="名詞頁：參考名詞（目前沒有任何已發布題目用到）的說明；不顯示鎖定，也不說之後會收進圖鑑">
          參考名詞：目前還沒有關卡用到，隨時可以讀，不算在名詞圖鑑的收集數裡。
        </Trans>
      </StatusNote>
    );
  return <CollectibleStatus term={term} locale={locale} index={index} unlocks={unlocks} />;
}

/** 已收進是印章加日期；未收進是解鎖任務卡（章節索引和名詞內容一起讀，第一次繪製就有「在哪一關遇到」） */
function CollectibleStatus({
  term,
  locale,
  index,
  unlocks,
}: {
  term: GlossaryTerm;
  locale: Locale;
  index: GlossaryIndex;
  unlocks: ReadonlyMap<string, string>;
}) {
  const { t } = useLingui();
  const meetText = useMeetText();
  const codeOf = useLevelCodeFormatter();
  const chapterOfLevel = useMemo(() => chapterOfLevelMap(index.chapters), [index]);
  const at = unlocks.get(termUnlockId(term.id));
  if (at !== undefined) return <CollectedCard date={formatDate(at.slice(0, 10), locale, 'medium')} />;
  const meet = meetLevelOf(term, chapterOfLevel);
  if (!meet)
    return (
      <StatusNote kind="locked">
        <Trans id="term.lockedNoLevel" comment="還沒收進圖鑑、目前也沒有任何已發布關卡用到這個名詞時的說明（不能寫會在哪一關遇到）">
          目前還沒有關卡用到這個名詞；之後的關卡或報表實驗室用到時會自動收進圖鑑，現在也可以直接讀。
        </Trans>
      </StatusNote>
    );
  const info = meetInfo(index, meet, locale, codeOf);
  const title = info
    ? meetText.unlockTitle(info)
    : t({ id: 'term.unlock.titleUnknown', message: '在闖關地圖的關卡裡遇到', comment: '名詞頁解鎖任務卡的標題：讀不到章節索引、不知道是第幾章第幾關時' });
  return <UnlockCard title={title} subtitle={info?.levelTitle} href={localePath(locale, `/level/${meet.levelId}/`)} />;
}

/** 名詞頁的其餘段落，順序與名詞卡相同（03 第 4.3 節）：用語說明、公式、例子、常見誤解、IFRS 怎麼處理；沒有內容的段落省略 */
function TermSections({ term, locale, labelOf }: { term: TermSnapshot; locale: Locale; labelOf: (id: string) => string | undefined }) {
  const titles: Record<TermField, ReactNode> = {
    note: <Trans id="term.note">用語說明</Trans>,
    formula: <Trans id="term.formula">公式</Trans>,
    example: <Trans id="term.example">例子</Trans>,
    misconception: <Trans id="term.misconception">常見誤解</Trans>,
    ifrsNote: <Trans id="term.underIfrs">IFRS 怎麼處理</Trans>,
  };
  const fields = termFieldsOf(term);
  return (
    <>
      {TERM_FIELD_ORDER.map((key) => {
        const text = fields[key];
        if (text === undefined) return null;
        return (
          <Card as="section" key={key} className={`ll-term-section ll-term-section--${key}`} data-testid={`term-${key}`}>
            <h2 className="ll-term-section__title">{titles[key]}</h2>
            <div className={key === 'formula' ? 'll-num ll-term-section__formula' : undefined}>
              {plainParagraphs(text, locale, labelOf).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
}

/** 用語對照：教材用語與現行用語相同時合併成一列 */
function TermNames({ term }: { term: TermSnapshot }) {
  const same = term.currentTwLabel !== null && term.currentTwLabel === term.teacherLabel;
  return (
    <Card as="section" className="ll-termnames" data-testid="term-names">
      <dl className="ll-termnames__list">
        {same ? (
          <div className="ll-termnames__row">
            <dt>
              <Trans id="term.labels.same" comment="名詞頁的用語對照：教材用語與現行用語相同時合併成一列的欄位標題">
                教材與現行用語
              </Trans>
            </dt>
            <dd lang="zh-TW">{term.teacherLabel}</dd>
          </div>
        ) : (
          <>
            <div className="ll-termnames__row">
              <dt>
                <Trans id="term.teacherLabel">教材用語</Trans>
              </dt>
              <dd lang="zh-TW">{term.teacherLabel}</dd>
            </div>
            {term.currentTwLabel && (
              <div className="ll-termnames__row">
                <dt>
                  <Trans id="term.currentTwLabel">現行用語</Trans>
                </dt>
                <dd lang="zh-TW">{term.currentTwLabel}</dd>
              </div>
            )}
          </>
        )}
        {term.ifrsEnglish && (
          <div className="ll-termnames__row">
            <dt>
              <Trans id="term.ifrsEnglish">IFRS 英文</Trans>
            </dt>
            <dd lang="en">{term.ifrsEnglish}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

/** 「再試一次」換一個 key 整頁重新掛載（重讀名詞內容、章節索引與進度）；重試後焦點回到新的 h1 */
export default function Term() {
  const [attempt, setAttempt] = useState(0);
  return <TermPage key={attempt} retried={attempt > 0} onRetry={() => setAttempt((n) => n + 1)} />;
}

function TermPage({ retried, onRetry }: { retried: boolean; onRetry: () => void }) {
  const { t } = useLingui();
  const labels = useUiLabels();
  const { termId } = useParams();
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const categoryLabel = useCategoryLabel();
  const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
  const [term, setTerm] = useState<TermSnapshot | null | undefined>(undefined);
  const [alt, setAlt] = useState<TermSnapshot | null>(null);
  const [index, setIndex] = useState<GlossaryIndex>({ chapters: [], info: new Map() });
  /** 定義裡 {{term:…}} 與相關名詞的名稱（只有用得到時才讀名詞索引） */
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  // 進度（已收進的日期）和內容一起等；取不到進度時是空的 Map，不會一直是 null
  const unlocks = useUnlocks('term');
  const [error, setError] = useState<ContentLoadError | null>(null);
  const errorTitleId = useId();
  const relatedId = useId();

  // 從名詞圖鑑點進來時，history state 帶著圖鑑的搜尋與分組；返回時接回去。直接開啟、從作答頁或切換語言進來時是乾淨的 /terms/
  const fromList = glossaryReturnSearch(location.state);
  const listHref = glossaryReturnPath(localePath(locale, '/terms/'), fromList);
  const backLabel = t({ id: 'term.back', message: '回到名詞圖鑑', comment: '名詞頁返回按鈕的可讀名稱與頁尾按鈕' });
  const backShort = t({ id: 'term.back.short', message: '圖鑑', comment: '名詞頁返回按鈕在畫面上的短字（必須是「回到名詞圖鑑」的一部分）' });

  useEffect(() => {
    let alive = true;
    setTerm(undefined);
    setError(null);
    if (termId === undefined) {
      setTerm(null);
      return;
    }
    // 只讀這個名詞所在的完整內容檔（兩種語言各一檔、各約 5 個名詞）與章節索引，路由在載入頁面 chunk 的同時已經先發出請求（router.tsx）；
    // 另一種語言的名稱就在標題下面、「在哪一關遇到」在定義上面，一起等才不會晚出現把下面的內容往下推（06 第 8.2 節）
    Promise.all([
      loadTermDetail(termId, locale),
      loadTermDetail(termId, other).catch(() => undefined),
      loadGlossaryIndex(locale).catch((): GlossaryIndex => ({ chapters: [], info: new Map() })),
    ]).then(
      async ([mine, theirs, glossary]) => {
        // 定義等內文引用其他名詞、或頁尾有相關名詞時，名稱要和內容一起出現（不先畫 ID 或空膠囊再換字）；名詞索引已在 precache（約 11 KB）。
        // 第 7 輪曾把相關名詞的名稱延到第一次繪製之後才讀，維護者 2026-10-26 要求整頁一次出現，改回一起等
        const texts = mine === undefined ? [] : [mine.definition, mine.note, mine.formula, mine.example, mine.misconception, mine.ifrsNote];
        const needNames = hasTermRefs(...texts) || (mine?.related?.length ?? 0) > 0;
        const toMap = (list: readonly { id: string; label: string }[]) => new Map(list.map((x) => [x.id, x.label] as const));
        const map = needNames ? toMap(await loadTermIndex(locale).catch(() => [])) : new Map<string, string>();
        if (!alive) return;
        setNames(map);
        setTerm(mine ?? null);
        setAlt(theirs ?? null);
        setIndex(glossary);
      },
      (e: unknown) => alive && setError(e instanceof ContentLoadError ? e : new ContentLoadError(String(e), 'network')),
    );
    return () => {
      alive = false;
    };
  }, [locale, other, termId]);

  // 換頁時 Root 已把焦點放在載入中的 h1；讀不到時換成錯誤狀態的 h1（按「再試一次」之後換成新的 h1），
  // 焦點跟著過去，不掉到 body（07 第 8.2 節、finding glossary-3）
  const settled = term !== undefined || error !== null;
  // 第一次繪製要的資料：名詞內容（含另一種語言的名稱、章節索引、相關名詞的名稱，上面一起 await）與進度；讀不到內容（錯誤）或找不到名詞也算齊了
  usePageReady((term !== undefined && unlocks !== null) || error !== null);
  useEffect(() => {
    if (!settled || (!error && !retried)) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const h1 = error ? document.getElementById(errorTitleId) : document.querySelector<HTMLElement>('main h1');
    h1?.focus({ preventScroll: true });
  }, [settled, error, retried, errorTitleId]);

  // 相關名詞連到下一個名詞頁時，圖鑑的搜尋狀態跟著帶過去（返回仍回到原本的圖鑑）
  const keepState = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href, { state: location.state as unknown });
  };

  // 頁尾：手機撐滿（外層是 grid，按鈕自然拉伸），600 起照內容寬、靠左（M3 驗收第 5 輪：720 寬的整條次要按鈕在 1280 上太重）。
  // 320 寬加 200% 字級時按鈕字要兩行：排成「回到／名詞圖鑑」，不是「回到名詞／圖鑑」
  const backFooter = (
    <div className="ll-termpage__foot">
      <Button variant="secondary" size="md" icon={<CardsIcon />} href={listHref} data-testid="term-back">
        {backLabel}
      </Button>
    </div>
  );

  if (error)
    return (
      <div className="ll-termpage">
        <div className="ll-termpage__bar">
          <BackButton href={listHref} label={backLabel} shortLabel={backShort} />
        </div>
        <ErrorState
          titleAs="h1"
          titleId={errorTitleId}
          title={t({ id: 'term.error.title', message: '這個名詞讀不到', comment: '名詞頁讀不到內容（離線而且這一桶沒有快取）時的標題' })}
          description={t({ id: 'content.offlineMissing', message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。' })}
          onRetry={onRetry}
          action={
            <Button icon={<CardsIcon />} href={listHref}>
              {backLabel}
            </Button>
          }
          data-testid="term-error"
        />
      </div>
    );
  // 還在讀：整頁被 PageReveal 藏著，只放頁首的返回鍵與 h1（Root 換頁時把焦點放在 main h1，內容到了之後是同一個 h1 元素，焦點不掉）；沒有骨架
  if (term === undefined || unlocks === null)
    return (
      <div className="ll-termpage" aria-busy="true">
        <TopBar title={<span className="ll-sr-only">{labels.loading}</span>} backHref={listHref} backLabel={backLabel} backShortLabel={backShort} />
      </div>
    );
  if (term === null) return <NotFound />;

  const labelOf = (id: string) => names.get(id);
  const related = (term.related ?? []).flatMap((id) => {
    const label = names.get(id);
    return label === undefined || id === term.id ? [] : [{ id, label }];
  });
  const notes = termNoteKinds(term.flags);
  return (
    <div className="ll-termpage">
      <TopBar title={term.label} backHref={listHref} backLabel={backLabel} backShortLabel={backShort} />
      <p className="ll-termpage__meta">
        {/* 類別與註記標籤（舊稱、簡化、非 IFRS 項目，和名詞卡同一份 termNoteKinds）排成一組：手機換行時註記跟著類別留在第一列 */}
        <span className="ll-termpage__tags" data-testid="term-tags">
          <Badge className="ll-termpage__cat">
            <TermCategoryIcon category={term.category} size={16} />
            <span>{categoryLabel(term.category)}</span>
          </Badge>
          {notes.map((kind) => (
            <NoteTag key={kind} kind={kind} className="ll-termpage__note" />
          ))}
        </span>
        {alt && alt.label !== term.label && (
          <span className="ll-termpage__alt" lang={getLocale(other).htmlLang} data-testid="term-alt">
            {alt.label}
          </span>
        )}
      </p>
      <TermStatus term={term} locale={locale} index={index} unlocks={unlocks} />
      <Card className="ll-termpage__definition">
        <div className="ll-term-definition" data-testid="term-definition">
          {plainParagraphs(term.definition, locale, labelOf).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </Card>
      <TermNames term={term} />
      <TermSections term={term} locale={locale} labelOf={labelOf} />
      {related.length > 0 && (
        <Card as="section" className="ll-term-related" aria-labelledby={relatedId} data-testid="term-related">
          <h2 id={relatedId} className="ll-term-section__title">
            <Trans id="term.related" comment="名詞頁：相關名詞段落標題">
              相關名詞
            </Trans>
          </h2>
          <TermPillList aria-labelledby={relatedId} className="ll-term-related__pills">
            {related.map((r) => {
              const href = localePath(locale, `/terms/${r.id}/`);
              return (
                <TermPill key={r.id} href={href} onClick={keepState(href)} cellProps={{ 'data-term-id': r.id }}>
                  {r.label}
                </TermPill>
              );
            })}
          </TermPillList>
        </Card>
      )}
      {backFooter}
    </div>
  );
}
