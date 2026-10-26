// 地圖與章節頁共用的資料 hook：資料來源（正式或 fixture）、進度、關卡名稱的分段載入。
// 章節快照與進度一起讀、一起到才是 ready（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊，不可以先畫地圖、數字顯示「…」，進度到了再補星星）；
// 進度資料庫由 main.tsx 和頁面一起開始開啟，這裡不再延後。取不到進度（儲存壞掉）時是空的進度，地圖照樣要出來。
// ?ll-fixture=quest 時用 fixtures.ts 的 3 章 12 關（動態 import，不進正式 chunk）；?ll-fixture=quest-full 是 14 章的場景展示；?ll-fixture-progress= 選 fixture 進度。
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';
import { contentSource, type LevelMeta, type QuestMapData, type QuestMapSource } from './data.ts';
import { EMPTY_PROGRESS, loadMapProgress, type MapProgress } from './progress.ts';

export type QuestMapState =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: QuestMapData; progress: MapProgress; source: QuestMapSource };

export type FixtureKind = 'quest' | 'quest-full' | null;

export interface FixtureRequest {
  readonly fixture: FixtureKind;
  readonly variant: string | null;
}

export function fixtureRequestFrom(search: string): FixtureRequest {
  const params = new URLSearchParams(search);
  const f = params.get('ll-fixture');
  return { fixture: f === 'quest' || f === 'quest-full' ? f : null, variant: params.get('ll-fixture-progress') };
}

async function pickSource(req: FixtureRequest): Promise<{ source: QuestMapSource; progress: () => Promise<MapProgress> }> {
  if (!req.fixture) return { source: contentSource, progress: loadMapProgress };
  const f = await import('./fixtures.ts');
  if (req.fixture === 'quest-full') return { source: f.fullFixtureSource, progress: async () => f.EMPTY_FIXTURE_PROGRESS };
  const p = f.fixtureProgress(f.fixtureVariantFrom(req.variant));
  return { source: f.fixtureSource, progress: async () => p };
}

/** 章節快照與進度一起讀（並行），兩者都到了才回傳；進度讀不到時是空的進度，快照讀不到才算失敗（給 useQuestMap 用，單元測試直接測它） */
export async function loadQuestMap(locale: Locale, req: FixtureRequest): Promise<Extract<QuestMapState, { status: 'ready' }>> {
  const { source, progress } = await pickSource(req);
  const [data, prog] = await Promise.all([source.load(locale), progress().catch(() => EMPTY_PROGRESS)]);
  return { status: 'ready', data, progress: prog, source };
}

export function useQuestMap(locale: Locale, req: FixtureRequest) {
  const [state, setState] = useState<QuestMapState>({ status: 'loading' });
  const [metas, setMetas] = useState<ReadonlyMap<string, LevelMeta>>(new Map());
  /** 名稱請求已經結束（成功或失敗）的關卡：頁面用它判斷第一次繪製要的名稱齊了沒；失敗的不會卡住頁面，下次再試 */
  const [metaDone, setMetaDone] = useState<ReadonlySet<string>>(new Set());
  const requested = useRef(new Set<string>());
  const sourceRef = useRef<QuestMapSource>(contentSource);
  const { fixture, variant } = req;
  /** 錯誤狀態的「再試一次」：遞增後重新讀取（站規 2.2.7） */
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    requested.current = new Set();
    setMetas(new Map());
    setMetaDone(new Set());
    loadQuestMap(locale, { fixture, variant }).then(
      (ready) => {
        if (!alive) return;
        sourceRef.current = ready.source;
        setState(ready);
      },
      (error: unknown) => {
        if (alive) setState({ status: 'error', error });
      },
    );
    return () => {
      alive = false;
    };
    // attempt 不在 effect 裡讀：「再試一次」遞增它，只是為了讓這個 effect 重跑
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [locale, fixture, variant, attempt]);

  const data = state.status === 'ready' ? state.data : null;
  /** 載入一章所有關卡的名稱與目標（只載一次；失敗的下次再試） */
  const needChapterMeta = useCallback(
    (chapterId: string) => {
      const c = data?.chapterById.get(chapterId);
      if (!c) return;
      for (const l of c.levels) {
        if (requested.current.has(l.id)) continue;
        requested.current.add(l.id);
        const done = () => setMetaDone((prev) => (prev.has(l.id) ? prev : new Set(prev).add(l.id)));
        sourceRef.current.levelMeta(l.id, locale).then(
          (m) => {
            setMetas((prev) => (prev.get(l.id) === m ? prev : new Map(prev).set(l.id, m)));
            done();
          },
          () => {
            requested.current.delete(l.id);
            done();
          },
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

  return { state, metas, metaDone, needChapterMeta, needLevelMeta, retry };
}
