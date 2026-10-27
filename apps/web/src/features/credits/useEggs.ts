// 幕後頁彩蛋的狀態：掛載時讀進度設定（找過哪些）與徽章解鎖；mark 立即更新畫面再寫回設定；找齊且還沒有徽章時寫入 unlock（冪等）並宣告慶祝一次。
// 頁面把 found 與 unlocks 是不是 null 算進 usePageReady（維護者 2026-10-26：資料齊了才整頁出現）。
import { useCallback, useEffect, useState } from 'react';
import { getProgressStore, nowIso } from '../../lib/progress/index.ts';
import { useUnlocks } from '../glossary/useUnlocks.ts';
import { CREDITS_BADGE_UNLOCK_ID, CREDITS_EGGS_SETTING_KEY, isComplete, readFound, toSetting, withFound, type EggId } from './eggs.ts';

export interface EggsState {
  /** 找到的彩蛋；null 是還在讀 */
  found: ReadonlySet<EggId> | null;
  /** 徽章解鎖的 Map（id 對 unlockedAt）；null 是還在讀 */
  unlocks: Map<string, string> | null;
  /** 這一次造訪找齊、剛解鎖徽章（顯示 Toast 一次）；重訪不再是 true */
  celebrating: boolean;
  dismissCelebration: () => void;
  mark: (id: EggId) => void;
}

export function useEggs(): EggsState {
  const [found, setFound] = useState<ReadonlySet<EggId> | null>(null);
  const unlocks = useUnlocks('badge');
  const [celebrating, setCelebrating] = useState(false);
  const [badgeWritten, setBadgeWritten] = useState(false);

  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => s.getSetting(CREDITS_EGGS_SETTING_KEY))
      .then(
        (entry) => alive && setFound(readFound(entry?.value)),
        () => alive && setFound(new Set()),
      );
    return () => {
      alive = false;
    };
  }, []);

  const hasBadge = badgeWritten || (unlocks?.has(CREDITS_BADGE_UNLOCK_ID) ?? false);

  const mark = useCallback(
    (id: EggId) => {
      setFound((prev) => {
        const base = prev ?? new Set<EggId>();
        const next = withFound(base, id);
        if (next === base) return prev;
        const list = toSetting(next);
        void getProgressStore()
          .then((s) => s.setSetting(CREDITS_EGGS_SETTING_KEY, list, nowIso()))
          .catch(() => undefined);
        if (isComplete(next) && !hasBadge) {
          setBadgeWritten(true);
          setCelebrating(true);
          void getProgressStore()
            .then((s) => s.addUnlock({ id: CREDITS_BADGE_UNLOCK_ID, kind: 'badge', unlockedAt: nowIso() }))
            .catch(() => undefined);
        }
        return next;
      });
    },
    [hasBadge],
  );

  const dismissCelebration = useCallback(() => setCelebrating(false), []);

  return { found, unlocks, celebrating, dismissCelebration, mark };
}
