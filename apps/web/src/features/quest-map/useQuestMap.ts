// 地圖與章節頁共用的資料 hook：資料來源（正式或 fixture）、進度、關卡名稱的分段載入。
// ?ll-fixture=quest 時用 fixtures.ts 的 3 章 12 關（動態 import，不進正式 chunk）；?ll-fixture-progress= 選 fixture 進度。
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import { contentSource, type LevelMeta, type QuestMapData, type QuestMapSource } from './data.ts';
import { EMPTY_PROGRESS, loadMapProgress, type MapProgress } from './progress.ts';

export type QuestMapState =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: QuestMapData; progress: MapProgress; source: QuestMapSource };

export interface FixtureRequest {
  readonly fixture: boolean;
  readonly variant: string | null;
}

export function fixtureRequestFrom(search: string): FixtureRequest {
  const params = new URLSearchParams(search);
  return { fixture: params.get('ll-fixture') === 'quest', variant: params.get('ll-fixture-progress') };
}

async function pickSource(req: FixtureRequest): Promise<{ source: QuestMapSource; progress: () => Promise<MapProgress> }> {
  if (!req.fixture) return { source: contentSource, progress: loadMapProgress };
  const f = await import('./fixtures.ts');
  const p = f.fixtureProgress(f.fixtureVariantFrom(req.variant));
  return { source: f.fixtureSource, progress: async () => p };
}

export function useQuestMap(locale: Locale, req: FixtureRequest) {
  const [state, setState] = useState<QuestMapState>({ status: 'loading' });
  const [metas, setMetas] = useState<ReadonlyMap<string, LevelMeta>>(new Map());
  const requested = useRef(new Set<string>());
  const sourceRef = useRef<QuestMapSource>(contentSource);
  const { fixture, variant } = req;

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    requested.current = new Set();
    setMetas(new Map());
    (async () => {
      try {
        const { source, progress } = await pickSource({ fixture, variant });
        sourceRef.current = source;
        const [data, prog] = await Promise.all([source.load(locale), progress().catch(() => EMPTY_PROGRESS)]);
        if (alive) setState({ status: 'ready', data, progress: prog, source });
      } catch (error) {
        if (alive) setState({ status: 'error', error });
      }
    })();
    return () => {
      alive = false;
    };
  }, [locale, fixture, variant]);

  const data = state.status === 'ready' ? state.data : null;
  /** 載入一章所有關卡的名稱與目標（只載一次；失敗的下次再試） */
  const needChapterMeta = useCallback(
    (chapterId: string) => {
      const c = data?.chapterById.get(chapterId);
      if (!c) return;
      for (const l of c.levels) {
        if (requested.current.has(l.id)) continue;
        requested.current.add(l.id);
        sourceRef.current.levelMeta(l.id, locale).then(
          (m) => setMetas((prev) => (prev.get(l.id) === m ? prev : new Map(prev).set(l.id, m))),
          () => requested.current.delete(l.id),
        );
      }
    },
    [data, locale],
  );
  const needLevelMeta = useCallback(
    (levelId: string) => {
      const l = data?.levelById.get(levelId);
      if (l) needChapterMeta(l.chapterId);
    },
    [data, needChapterMeta],
  );

  return { state, metas, needChapterMeta, needLevelMeta };
}
