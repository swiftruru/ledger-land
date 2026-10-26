// 章節頁 /chapter/<chapterId>/（站規 2.3，寬版）：頁首（返回「地圖」、h1 章名）、主卡（場景縮圖、進度、徽章預覽、開始或繼續、在地圖上看這一章、說明）、
// 學習目標（圓形編號）、關卡列表（與地圖清單檢視共用 LevelCard，主卡主按鈕的那一關有外框與播放圖示）、相關實驗室步驟（故事已發布才顯示，找不到故事就不顯示壞連結）、
// 「已下架的關卡」（進度有、內容沒有，依作答紀錄的 chapterId 歸到本章）。手機一欄；1024 以上左 5/12（頁首與主卡，夠高時 sticky）、右 7/12。
// 讀不到內容（離線）是頁首的返回「地圖」加一個 ErrorState（再試一次），不再同時出現 Banner（站規 2.18）。
// 布幕（維護者 2026-10-26，lib/page-ready.tsx）：沒有骨架；章節快照、進度（一起到）、本章關卡名稱、固定聲明、已下架的關卡與場景縮圖全部齊了
// 才 usePageReady(true)，整頁一次淡入；離線與找不到的畫面本身就是完整畫面，直接回報。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { localePath, type Locale } from '@ledgerland/i18n';
import { BackButton, ErrorState, FlaskIcon, NavList, NavRow, TopBar } from '@ledgerland/web-ui';
import { LevelCard } from '@ledgerland/web-ui/map';
import { ChapterHero } from '../features/chapter/ChapterHero.tsx';
import { loadThumbArt } from '../features/chapter/ChapterThumb.tsx';
import { chapterNextLevel, chapterStats } from '../features/chapter/model.ts';
import { ObjectiveList } from '../features/chapter/ObjectiveList.tsx';
import { availableEndLinks, type LevelMeta, type MapChapter } from '../features/quest-map/data.ts';
import { levelStatus } from '../features/quest-map/ListView.tsx';
import { currentLevelId, levelDone, orphanLevelIds, retiredChaptersOf, starsOf } from '../features/quest-map/progress.ts';
import { fixtureRequestFrom, useQuestMap, type QuestMapState } from '../features/quest-map/useQuestMap.ts';
import { loadChapterIndex } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import '../styles/chapter.css';

/** 章節的固定聲明代號（packages/content-schema 的 ChapterNotice；作答頁的 level-notes.ts 用同一個值，這裡不匯入它，免得連作答頁的 chunk 一起載） */
const NOT_INVESTMENT_ADVICE = 'not_investment_advice';

export default function Chapter() {
  // 「再試一次」：重新掛載整頁，資料 hook 重新讀（失敗的請求不會留在快取裡）
  const [attempt, setAttempt] = useState(0);
  return <ChapterPage key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function ChapterPage({ onRetry }: { onRetry: () => void }) {
  const { chapterId = '' } = useParams();
  const locale = useLocale();
  const location = useLocation();
  const { t } = useLingui();
  const req = useMemo(() => fixtureRequestFrom(location.search), [location.search]);
  const { state, metas, metaDone, needChapterMeta } = useQuestMap(locale, req);
  const ready = state.status === 'ready' ? state : null;
  const chapter = ready?.data.chapterById.get(chapterId) ?? null;
  // null 表示還沒查到（布幕的條件）
  const [retired, setRetired] = useState<readonly string[] | null>(null);
  const [notices, setNotices] = useState<readonly string[] | null>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const onThumbReady = useCallback(() => setThumbReady(true), []);

  // 場景縮圖的模組和章節快照並行載入，不等資料到了才開始
  useEffect(() => {
    void loadThumbArt();
  }, []);
  useEffect(() => {
    if (chapter) needChapterMeta(chapter.id);
  }, [chapter, needChapterMeta]);

  // 已下架的關卡：進度有、內容沒有；fixture 進度直接給所屬章，正式進度由作答紀錄反查（查不到就當沒有）
  useEffect(() => {
    if (!ready || !chapter) return;
    let alive = true;
    const orphans = orphanLevelIds(ready.data, ready.progress);
    const known = ready.progress.retiredChapterOf;
    (known ? Promise.resolve(known) : retiredChaptersOf(orphans)).then(
      (map) => {
        if (alive) setRetired(orphans.filter((id) => map.get(id) === chapter.id));
      },
      () => {
        if (alive) setRetired([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [ready, chapter]);

  // 章節的固定聲明（非投資建議）在章節索引裡（地圖的資料已經讀過同一檔，這裡只是從快取取）；fixture 沒有聲明
  useEffect(() => {
    if (!chapter) return;
    if (req.fixture) {
      setNotices([]);
      return;
    }
    let alive = true;
    loadChapterIndex(locale).then(
      (list) => {
        if (alive) setNotices(list.find((c) => c.id === chapter.id)?.notices ?? []);
      },
      () => {
        if (alive) setNotices([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [chapter, locale, req.fixture]);

  // 布幕：快照與進度、本章關卡名稱的請求都結束、固定聲明、已下架的關卡、場景縮圖。錯誤與找不到的畫面直接算齊；掀開之後不再放下
  const loaded = ready && chapter && retired !== null && notices !== null ? { ready, chapter, retired, notices } : null;
  const readyNow = state.status === 'error' || (!!ready && !chapter) || (!!loaded && thumbReady && loaded.chapter.levels.every((l) => metaDone.has(l.id)));
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (readyNow) setRevealed(true);
  }, [readyNow]);
  usePageReady(revealed || readyNow);

  const mapHref = `${localePath(locale, '/play/')}?chapter=${encodeURIComponent(chapter?.id ?? chapterId)}`;
  const backLabel = t({ id: 'chapter.back', message: '回到闖關地圖', comment: '章節頁返回按鈕的可讀名稱（畫面上是短字「地圖」）' });
  const backShortLabel = t({ id: 'chapter.back.short', message: '地圖', comment: '章節頁返回按鈕在畫面上的短字；可讀名稱「回到闖關地圖」必須包含這兩個字' });

  // 讀不到內容：頁首放和載入中、載入完成同一顆返回「地圖」（同一個位置，從載入切到離線不跳）；
  // 回到上一層就是這顆膠囊，ErrorState 只留「再試一次」，同一個去處不在畫面上出現兩種樣子（第 2 輪看圖驗收）
  if (state.status === 'error') {
    return (
      <div className="ch-page ch-page--state" data-testid="chapter-offline">
        <header className="ll-topbar ll-topbar--page ch-page__head">
          <div className="ll-topbar__bar">
            <BackButton href={mapHref} label={backLabel} shortLabel={backShortLabel} />
          </div>
        </header>
        <ErrorState
          className="ch-state"
          titleAs="h1"
          title={t({ id: 'chapter.error.title', message: '章節載入失敗', comment: '章節頁讀不到內容（多半是離線、這一頁還沒下載）時的標題' })}
          description={t({
            id: 'content.offlineMissing',
            message: '這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。',
          })}
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (ready && !chapter) return <NotFound />;

  // 載入中（在布幕後面）與載入完成用同一個 TopBar（同一個 h1 元素）：換頁時 Root 把焦點放在 h1，內容到了只換字，焦點不會掉到 body
  return (
    <div
      className="ch-page"
      aria-busy={loaded ? undefined : true}
      data-testid={loaded ? 'chapter-page' : 'chapter-loading'}
      data-extension={loaded?.chapter.extension ? 'true' : undefined}
    >
      <div className="ch-page__aside">
        <TopBar title={loaded ? loaded.chapter.title : ''} backHref={mapHref} backLabel={backLabel} backShortLabel={backShortLabel} className="ch-page__head" />
        {loaded && (
          <ChapterHero
            locale={locale}
            chapter={loaded.chapter}
            stats={chapterStats(loaded.ready.data, loaded.ready.progress, loaded.chapter)}
            metas={metas}
            notAdvice={loaded.notices.includes(NOT_INVESTMENT_ADVICE)}
            mapHref={mapHref}
            onThumbReady={onThumbReady}
          />
        )}
      </div>
      {loaded && <ChapterMain ready={loaded.ready} chapter={loaded.chapter} metas={metas} retired={loaded.retired} locale={locale} />}
    </div>
  );
}

interface ChapterMainProps {
  ready: Extract<QuestMapState, { status: 'ready' }>;
  chapter: MapChapter;
  metas: ReadonlyMap<string, LevelMeta>;
  retired: readonly string[];
  locale: Locale;
}

/** 右欄（手機在主卡下面）：學習目標、關卡、相關實驗室步驟、已下架的關卡 */
function ChapterMain({ ready, chapter, metas, retired, locale }: ChapterMainProps) {
  const { t } = useLingui();
  const objectivesId = useId();
  const levelsId = useId();
  const labId = useId();
  const retiredId = useId();
  // 關卡列標出主卡主按鈕的那一關（本章第一個還沒完成的；本章全部完成時不標）
  const next = chapterNextLevel(chapter, ready.progress, currentLevelId(ready.data, ready.progress));
  const endLinks = availableEndLinks(ready.data, chapter);
  return (
    <div className="ch-page__main">
      {chapter.objectives.length > 0 && (
        <section className="ch-section" aria-labelledby={objectivesId}>
          <h2 id={objectivesId} className="ch-section__title">
            <Trans id="chapter.objectives" comment="章節頁學習目標段落的標題">
              學習目標
            </Trans>
          </h2>
          <ObjectiveList objectives={chapter.objectives} labelledBy={objectivesId} />
        </section>
      )}

      <section className="ch-section" aria-labelledby={levelsId}>
        <h2 id={levelsId} className="ch-section__title">
          <Trans id="chapter.levels" comment="章節頁關卡列表的標題">
            關卡
          </Trans>
        </h2>
        {chapter.levels.length === 0 ? (
          <p className="ch-section__empty">
            <Trans id="chapter.noLevels" comment="章節還沒有發布關卡時的文字">
              這一章的關卡還在準備中。
            </Trans>
          </p>
        ) : (
          <ol className="ch-levels" data-testid="chapter-levels">
            {chapter.levels.map((l) => {
              const done = levelDone(ready.progress, l);
              // 一個畫面一顆主按鈕（站規 1.0 原則 5）：主卡的「開始／繼續」就是這張卡，關卡列用目前關的外框與播放圖示對準它，
              // 但動作鈕用 secondary（actionVariant），桌面兩欄不會同時看到兩顆 primary。
              // 「建議下一關」膠囊只給全站的目前關卡（地圖、首頁指的同一關）；延伸章、還沒輪到的主線章傳 suggestedBadge={false}（外框與播放圖示照樣保留）
              const status = levelStatus(l.id, done, next?.id ?? null);
              const localNext = next !== null && next.id === l.id && !next.suggested;
              return (
                <LevelCard
                  key={l.id}
                  levelId={l.id}
                  chapterNo={chapter.chapterNo}
                  levelNo={l.levelNo}
                  title={metas.get(l.id)?.title}
                  stars={starsOf(ready.progress, l.id)}
                  status={status}
                  actionVariant="secondary"
                  suggestedBadge={!localNext}
                  extension={chapter.extension}
                  unscored={l.unscored}
                  read={done}
                  href={localePath(locale, `/level/${l.id}/`)}
                />
              );
            })}
          </ol>
        )}
      </section>

      {endLinks.length > 0 && (
        <section className="ch-section" aria-labelledby={labId} data-testid="chapter-end-links">
          <h2 id={labId} className="ch-section__title">
            <Trans id="chapter.endLinks" comment="章節頁章末連到實驗室的段落標題">
              相關實驗室步驟
            </Trans>
          </h2>
          <NavList aria-label={t({ id: 'chapter.endLinks', message: '相關實驗室步驟' })}>
            {endLinks.map((link) => (
              <NavRow
                key={`${link.story}/${link.step}`}
                icon={<FlaskIcon />}
                title={t({ id: 'chapter.endLink', message: '到實驗室看這一章的故事步驟', comment: '章末連到實驗室故事步驟的連結文字' })}
                href={localePath(locale, `/lab/story/${link.story}/${link.step}/`)}
              />
            ))}
          </NavList>
        </section>
      )}

      {retired.length > 0 && (
        <section className="ch-section" aria-labelledby={retiredId} data-testid="chapter-retired">
          <h2 id={retiredId} className="ch-section__title">
            <Trans id="chapter.retired" comment="章節頁已下架關卡段落的標題">
              已下架的關卡
            </Trans>
          </h2>
          <p className="ch-section__note">
            <Trans id="chapter.retiredNote" comment="已下架關卡段落的說明">
              這些關卡已經下架，星星仍計入總數。
            </Trans>
          </p>
          <ol className="ch-levels">
            {retired.map((id, i) => (
              <LevelCard
                key={id}
                levelId={id}
                chapterNo={chapter.chapterNo}
                levelNo={chapter.levels.length + i + 1}
                stars={starsOf(ready.progress, id)}
                status="done"
                extension={chapter.extension}
                retired
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
