// 章節主卡頂端的場景縮圖（站規 2.3）：插圖模組和章節資料一起載入（Chapter.tsx 掛載時就先呼叫 loadThumbArt），畫好時回報 onReady，
// 頁面等它齊了才掀開布幕（維護者 2026-10-26：不先畫底色再補插圖）。載入失敗時只剩地景底色，照樣回報，頁面不會卡住。
// 純裝飾：外層 aria-hidden，svg 不可聚焦。強制色彩時整個隱藏（chapter.css）。
import { useEffect, useState, type ComponentType } from 'react';
import { terrainOf, type ThumbKind } from './model.ts';

type ThumbArt = ComponentType<{ kind: ThumbKind }>;
const EmptyArt: ThumbArt = () => null;
let artPromise: Promise<ThumbArt> | null = null;
let loadedArt: ThumbArt | null = null;

/** 載入插圖模組（只載一次；失敗改成空插圖）。頁面掛載時先呼叫，讓它和章節快照並行 */
export function loadThumbArt(): Promise<ThumbArt> {
  artPromise ??= import('./thumb-art.tsx').then(
    (m) => (loadedArt = m.default),
    () => (loadedArt = EmptyArt),
  );
  return artPromise;
}

export interface ChapterThumbProps {
  /** 章節題材（model.ts 的 thumbKindFor）；延伸章是外海小島，底色是深海 */
  kind: ThumbKind;
  /** 只給版面用 */
  className?: string;
  /** 插圖畫出來了（含載入失敗） */
  onReady?: () => void;
}

export function ChapterThumb({ kind, className, onReady }: ChapterThumbProps) {
  const [Art, setArt] = useState<ThumbArt | null>(() => loadedArt);
  useEffect(() => {
    let alive = true;
    void loadThumbArt().then((C) => {
      if (!alive) return;
      setArt(() => C);
      onReady?.();
    });
    return () => {
      alive = false;
    };
  }, [onReady]);
  return (
    <div className={`ch-thumb ch-thumb--${terrainOf(kind)}${className ? ` ${className}` : ''}`} aria-hidden="true" data-thumb={kind}>
      <svg className="ch-thumb__svg" viewBox="0 0 720 160" preserveAspectRatio="xMidYMid slice" focusable="false" data-loaded={Art ? 'true' : undefined}>
        {Art && <Art key={kind} kind={kind} />}
      </svg>
    </div>
  );
}
