// 章節頁 /chapter/<chapterId>/（02 第 1.1 節、17 評估六）：標題、簡介、學習目標、關卡列表（與地圖清單檢視共用 LevelCard）、
// 章末連結（chapterEndLinks 有才顯示）、「已下架的關卡」（進度有、內容沒有，依作答紀錄的 chapterId 歸到本章）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { Badge, Banner, Skeleton, TopBar } from '@ledgerland/web-ui';
import { LevelCard, useChapterLabels } from '@ledgerland/web-ui/map';
import { levelStatus } from '../features/quest-map/ListView.tsx';
import { chapterDone, currentLevelId, orphanLevelIds, retiredChaptersOf, starsOf } from '../features/quest-map/progress.ts';
import { fixtureRequestFrom, useQuestMap } from '../features/quest-map/useQuestMap.ts';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import '../styles/quest-map.css';

export default function Chapter() {
  const { chapterId = '' } = useParams();
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLingui();
  const labels = useChapterLabels();
  const req = useMemo(() => fixtureRequestFrom(location.search), [location.search]);
  const { state, metas, needChapterMeta } = useQuestMap(locale, req);
  const ready = state.status === 'ready' ? state : null;
  const chapter = ready?.data.chapterById.get(chapterId) ?? null;
  const [retired, setRetired] = useState<readonly string[]>([]);

  useEffect(() => {
    if (chapter) needChapterMeta(chapter.id);
  }, [chapter, needChapterMeta]);

  // 已下架的關卡：進度有、內容沒有；fixture 進度直接給所屬章，正式進度由作答紀錄反查
  useEffect(() => {
    if (!ready || !chapter) return;
    let alive = true;
    const orphans = orphanLevelIds(ready.data, ready.progress);
    const known = ready.progress.retiredChapterOf;
    (known ? Promise.resolve(known) : retiredChaptersOf(orphans)).then((map) => {
      if (alive) setRetired(orphans.filter((id) => map.get(id) === chapter.id));
    });
    return () => {
      alive = false;
    };
  }, [ready, chapter]);

  const go = (href: string) => navigate(href);
  const backHref = localePath(locale, '/play/');

  if (state.status === 'error') {
    return (
      <>
        <TopBar title={t({ id: 'chapter.title.loading', message: '章節', comment: '章節頁還沒載入時的標題' })} backHref={backHref} />
        <Banner kind="warning" role="alert">
          <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>
        </Banner>
      </>
    );
  }
  if (!ready) {
    return (
      <>
        <TopBar title={t({ id: 'chapter.title.loading', message: '章節', comment: '章節頁還沒載入時的標題' })} backHref={backHref} />
        <div aria-busy="true">
          <Skeleton variant="text" lines={3} />
          <Skeleton variant="card" />
        </div>
      </>
    );
  }
  if (!chapter) return <NotFound />;

  const { done, total } = chapterDone(ready.data, ready.progress, chapter.id);
  const currentId = currentLevelId(ready.data, ready.progress);
  return (
    <>
      <TopBar title={chapter.title} backHref={backHref} backLabel={t({ id: 'chapter.back', message: '回到闖關地圖', comment: '章節頁返回按鈕的可讀名稱' })} />
      <p className="ll-muted ll-small">
        {chapter.extension ? labels.extChapter(chapter.chapterNo) : labels.chapter(chapter.chapterNo)}
        {' · '}
        <span className="ll-num">{labels.progress(done, total)}</span> {chapter.extension && <Badge kind="info">{labels.extensionTag}</Badge>}
      </p>
      {chapter.summary && <p className="qm-chapter__summary">{chapter.summary}</p>}
      {chapter.objectives.length > 0 && (
        <section>
          <h2>
            <Trans id="chapter.objectives" comment="章節頁學習目標段落的標題">
              學習目標
            </Trans>
          </h2>
          <ul className="qm-chapter__objectives">
            {chapter.objectives.map((o) => (
              <li key={o.id}>{o.statement}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>
          <Trans id="chapter.levels" comment="章節頁關卡列表的標題">
            關卡
          </Trans>
        </h2>
        {chapter.levels.length === 0 ? (
          <p className="ll-muted">
            <Trans id="chapter.noLevels" comment="章節還沒有發布關卡時的文字">
              這一章的關卡還在準備中。
            </Trans>
          </p>
        ) : (
          <ol className="qm-levels" data-testid="chapter-levels">
            {chapter.levels.map((l) => {
              const stars = starsOf(ready.progress, l.id);
              return (
                <LevelCard
                  key={l.id}
                  levelId={l.id}
                  chapterNo={chapter.chapterNo}
                  levelNo={l.levelNo}
                  title={metas.get(l.id)?.title}
                  stars={stars}
                  status={levelStatus(l.id, stars, currentId)}
                  extension={chapter.extension}
                  href={localePath(locale, `/level/${l.id}/`)}
                  onNavigate={go}
                />
              );
            })}
          </ol>
        )}
      </section>
      {chapter.chapterEndLinks.length > 0 && (
        <section>
          <h2>
            <Trans id="chapter.endLinks" comment="章節頁章末連到實驗室的段落標題">
              相關實驗室步驟
            </Trans>
          </h2>
          <ul className="ll-list">
            {chapter.chapterEndLinks.map((link) => {
              const href = localePath(locale, `/lab/story/${link.story}/${link.step}/`);
              return (
                <li key={`${link.story}/${link.step}`}>
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      go(href);
                    }}
                  >
                    {t({ id: 'chapter.endLink', message: '到實驗室看這一章的故事步驟', comment: '章末連到實驗室故事步驟的連結文字' })}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {retired.length > 0 && (
        <section data-testid="chapter-retired">
          <h2>
            <Trans id="chapter.retired" comment="章節頁已下架關卡段落的標題">
              已下架的關卡
            </Trans>
          </h2>
          <p className="ll-muted ll-small">
            <Trans id="chapter.retiredNote" comment="已下架關卡段落的說明">
              這些關卡已經下架，星星仍計入總數。
            </Trans>
          </p>
          <ol className="qm-levels">
            {retired.map((id, i) => (
              <LevelCard
                key={id}
                levelId={id}
                chapterNo={chapter.chapterNo}
                levelNo={chapter.levels.length + i + 1}
                stars={starsOf(ready.progress, id)}
                status="done"
                retired
              />
            ))}
          </ol>
        </section>
      )}
      <p>
        <a
          href={`${backHref}?chapter=${chapter.id}`}
          onClick={(e) => {
            e.preventDefault();
            go(`${backHref}?chapter=${chapter.id}`);
          }}
        >
          {t({ id: 'chapter.onMap', message: '在地圖上看這一章', comment: '章節頁回到地圖並捲到該章的連結' })}
        </a>
      </p>
    </>
  );
}
