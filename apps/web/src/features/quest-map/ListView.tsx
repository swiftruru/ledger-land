// 清單檢視（17 第 3.7 節）：章節折疊區段，每關一列（LevelCard，與章節頁共用）。功能與地圖完全相同，是正式的替代方式。
import { useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { Badge } from '@ledgerland/web-ui';
import { LevelCard, useChapterLabels, type LevelNodeStatus } from '@ledgerland/web-ui/map';
import type { LevelMeta, QuestMapData } from './data.ts';
import { chapterDone, starsOf, type MapProgress } from './progress.ts';

export interface ListViewProps {
  locale: Locale;
  data: QuestMapData;
  progress: MapProgress;
  metas: ReadonlyMap<string, LevelMeta>;
  currentId: string | null;
  onSelectLevel: (levelId: string, el: HTMLButtonElement) => void;
  onNavigate: (href: string) => void;
  onNeedMeta: (chapterId: string) => void;
  /** 預設展開的章（目前關卡所在章） */
  openChapterId: string | null;
}

export function levelStatus(levelId: string, stars: number, currentId: string | null): LevelNodeStatus {
  if (levelId === currentId) return 'current';
  return stars > 0 ? 'done' : 'todo';
}

export function ListView({ locale, data, progress, metas, currentId, onSelectLevel, onNavigate, onNeedMeta, openChapterId }: ListViewProps) {
  const { t } = useLingui();
  const labels = useChapterLabels();
  // 清單一次列出所有關卡，名稱全部載入
  useEffect(() => {
    for (const c of data.chapters) onNeedMeta(c.id);
  }, [data, onNeedMeta]);
  return (
    <div className="qm-list" data-testid="map-list">
      {data.chapters.map((c) => {
        const { done, total } = chapterDone(data, progress, c.id);
        return (
          <details key={c.id} className="qm-list__chapter" open={c.id === openChapterId}>
            <summary>
              <span>{c.extension ? labels.extChapter(c.chapterNo) : labels.chapter(c.chapterNo)}</span>
              <span>{c.title}</span>
              <Badge kind={done === total && total > 0 ? 'success' : 'neutral'}>{labels.progress(done, total)}</Badge>
            </summary>
            {c.extension && <p className="ll-muted ll-small">{labels.extensionTag}</p>}
            <ol className="qm-levels">
              {c.levels.map((l) => {
                const stars = starsOf(progress, l.id);
                return (
                  <LevelCard
                    key={l.id}
                    levelId={l.id}
                    chapterNo={c.chapterNo}
                    levelNo={l.levelNo}
                    title={metas.get(l.id)?.title}
                    stars={stars}
                    status={levelStatus(l.id, stars, currentId)}
                    extension={c.extension}
                    href={localePath(locale, `/level/${l.id}/`)}
                    onNavigate={onNavigate}
                    onInfo={onSelectLevel}
                  />
                );
              })}
            </ol>
            <p className="ll-small">
              <a
                href={localePath(locale, `/chapter/${c.id}/`)}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(localePath(locale, `/chapter/${c.id}/`));
                }}
              >
                {t({ id: 'play.list.chapterInfo', message: '章節資訊', comment: '清單檢視每章底下到章節頁的連結' })}
              </a>
            </p>
          </details>
        );
      })}
    </div>
  );
}
