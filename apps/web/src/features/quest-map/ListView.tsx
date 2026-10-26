// 清單檢視（17 第 3.7 節、圖規第 4.11 節、站規 2.2.2 與 0.4 第 1 列）：每章一個 Disclosure（展開列），每關一列 LevelCard（與章節頁共用）。
// 功能與地圖完全相同，是正式的替代方式：章節徽章的狀態也在這裡（finding map-2）。summary 是兩列：章序與章名、展開箭頭；第二列是標籤、徽章與本章進度。
// 每章關卡清單最後一列是「章節資訊」（NavRow，說明「學習目標與徽章」在標題下方）。延伸區開頭一張說明卡（和地圖的海峽說明卡同文字），各延伸章不放標籤。
// 展開哪幾章由這裡保管（受控）；父層給的 openChapterId（目前章節或 ?chapter=）一定會展開，捲動定位與焦點由父層處理（圖規 4.11）。
// 每章帶 data-terrain（那一章地圖的地景底色）：章節列左緣一條 4px 的地景色條（quest-map.css，第 4 輪看圖驗收）；清單底色是 --ll-bg，不鋪全幅色帶（第 3 輪看圖驗收），
// expanded 以上整頁鋪地圖同一層地紋。「章節資訊」列包在 .qm-list__inforow 裡：版面（對齊關卡編號、上下留白）只調自己的外框，不改 NavList。
import { useLingui } from '@lingui/react/macro';
import { Fragment, useEffect, useState } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { Badge, Disclosure, InfoIcon, NavList, NavRow } from '@ledgerland/web-ui';
import { ChapterBadge, LevelCard, NoteTag, useChapterLabels, type LevelNodeStatus } from '@ledgerland/web-ui/map';
import type { LevelMeta, QuestMapData } from './data.ts';
import { badgeStateFor, chapterDone, levelDone, starsOf, type MapProgress } from './progress.ts';
import { sceneFor } from './scenes.tsx';
import { SCENE_TERRAIN } from './terrain.ts';

export interface ListViewProps {
  locale: Locale;
  data: QuestMapData;
  progress: MapProgress;
  metas: ReadonlyMap<string, LevelMeta>;
  currentId: string | null;
  onSelectLevel: (levelId: string, el: HTMLButtonElement) => void;
  onNeedMeta: (chapterId: string) => void;
  /** 一定要展開的章（目前關卡所在章，或 ?chapter= 指定的章） */
  openChapterId: string | null;
  /** 窄螢幕（compact）：本章進度用短版字串（英文 0/3 levels），summary 第二列從第一欄開始排 */
  compact?: boolean;
}

/** 節點狀態：done 可以是布林（關卡是否完成，含不計分關卡的已讀完）或星星數 */
export function levelStatus(levelId: string, done: boolean | number, currentId: string | null): LevelNodeStatus {
  if (levelId === currentId) return 'current';
  return (typeof done === 'number' ? done > 0 : done) ? 'done' : 'todo';
}

export function ListView({ locale, data, progress, metas, currentId, onSelectLevel, onNeedMeta, openChapterId, compact }: ListViewProps) {
  const { t } = useLingui();
  const labels = useChapterLabels();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(openChapterId ? [openChapterId] : []));
  // 父層要求展開的章（切換到清單、?chapter=）：加進展開的集合，使用者自己收起的其他章不動
  useEffect(() => {
    if (openChapterId) setOpen((s) => (s.has(openChapterId) ? s : new Set(s).add(openChapterId)));
  }, [openChapterId]);
  // 清單一次列出所有關卡，名稱全部載入
  useEffect(() => {
    for (const c of data.chapters) onNeedMeta(c.id);
  }, [data, onNeedMeta]);
  const firstExtension = data.chapters.find((c) => c.extension)?.id ?? null;
  return (
    <div className={`qm-list${compact ? ' qm-list--compact' : ''}`} data-testid="map-list">
      {data.chapters.some((c) => c.inExam) && (
        <p className="qm-list__scope" data-testid="exam-scope-note">
          {labels.examScopeNote}
        </p>
      )}
      {data.chapters.map((c) => {
        const { done, total } = chapterDone(data, progress, c.id);
        const badgeState = badgeStateFor(data, progress, c.id);
        const badgeLabel = c.badgeTitle
          ? badgeState === 'mastery'
            ? labels.badgeMastery(c.badgeTitle)
            : badgeState === 'done'
              ? labels.badgeUnlocked(c.badgeTitle)
              : labels.badgeLocked(c.badgeTitle)
          : null;
        const isOpen = open.has(c.id);
        const chapterHref = localePath(locale, `/chapter/${c.id}/`);
        return (
          <Fragment key={c.id}>
            {c.id === firstExtension && (
              <div className="qm-list__ext" data-testid="list-extension">
                <p className="qm-list__ext-title">{labels.extensionNote}</p>
                <p className="qm-list__ext-note">{labels.examScopeNote}</p>
              </div>
            )}
            <div className="qm-list__item" data-chapter-id={c.id} data-terrain={SCENE_TERRAIN[sceneFor(c.chapterNo, c.extension)]}>
              <Disclosure
                className="qm-list__chapter"
                summaryClassName="qm-chsum"
                open={isOpen}
                onToggle={(next) =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (next) n.add(c.id);
                    else n.delete(c.id);
                    return n;
                  })
                }
                summary={
                  <span className="qm-sum">
                    <span className="qm-sum__no">{c.extension ? labels.extChapter(c.chapterNo) : labels.chapter(c.chapterNo)}</span>
                    <span className="qm-sum__title">{c.title}</span>
                    <span className="qm-sum__meta">
                      {c.inExam && !c.extension && <NoteTag kind="midterm" />}
                      {badgeLabel && (
                        <span className="qm-sum__badge" data-badge-state={badgeState}>
                          <ChapterBadge state={badgeState} size={24} />
                          <span className="ll-sr-only">{badgeLabel}</span>
                        </span>
                      )}
                      <Badge kind={done === total && total > 0 ? 'success' : 'neutral'}>
                        {compact ? labels.progressShort(done, total) : labels.progress(done, total)}
                      </Badge>
                    </span>
                  </span>
                }
              >
                <ol className="qm-levels">
                  {c.levels.map((l) => (
                    <LevelCard
                      key={l.id}
                      levelId={l.id}
                      chapterNo={c.chapterNo}
                      levelNo={l.levelNo}
                      title={metas.get(l.id)?.title}
                      stars={starsOf(progress, l.id)}
                      status={levelStatus(l.id, levelDone(progress, l), currentId)}
                      extension={c.extension}
                      unscored={l.unscored}
                      read={levelDone(progress, l)}
                      href={localePath(locale, `/level/${l.id}/`)}
                      onInfo={onSelectLevel}
                    />
                  ))}
                </ol>
                <div className="qm-list__info">
                  <div className="qm-list__inforow">
                    <NavList
                      inset={false}
                      aria-label={t({ id: 'play.list.chapterLinks', message: '這一章的其他頁面', comment: '清單檢視每章底下「章節資訊」列的群組可讀名稱' })}
                    >
                      {/* 說明放在標題下面（不是右側的 trailing）：320 英文時右側的長字會把標題擠成一行一兩個字 */}
                      <NavRow
                        icon={<InfoIcon />}
                        title={t({ id: 'play.list.chapterInfo', message: '章節資訊', comment: '清單檢視每章底下到章節頁的列' })}
                        description={t({ id: 'play.list.chapterInfoTrail', message: '學習目標與徽章', comment: '清單檢視「章節資訊」列標題下方的說明' })}
                        href={chapterHref}
                      />
                    </NavList>
                  </div>
                </div>
              </Disclosure>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
