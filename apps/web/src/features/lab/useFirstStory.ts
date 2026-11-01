// 實驗室的子頁（自由實驗、勾稽練習、指標實驗室）都用快照裡的第一個故事：讀 manifest 取 ID；null 代表還在讀，undefined 代表沒有故事
import { useEffect, useState } from 'react';
import { loadManifest } from '../../lib/content.ts';

export function useFirstStoryId(): string | null | undefined {
  const [id, setId] = useState<string | null | undefined>(null);
  useEffect(() => {
    let alive = true;
    loadManifest().then(
      (m) => alive && setId((m.stories ?? [])[0]?.id),
      () => alive && setId(undefined),
    );
    return () => {
      alive = false;
    };
  }, []);
  return id;
}
