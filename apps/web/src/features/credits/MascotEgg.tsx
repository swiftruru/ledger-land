// 幕後頁的第一個彩蛋：鈴（闖關地圖的吉祥物，地圖 chunk 的 MapMarker）站在作者那一段旁邊，是一顆 quiet 按鈕；按了就揮手（wave／joy，joy 本來就有靜態小星）
// 並說一句話。沒有動畫：姿勢直接換。模組載不到時整個不畫（頁面照常）。
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button } from '@ledgerland/web-ui';
import type { MapModule } from './useMapModule.ts';

export function MascotEgg({ mod, found, onFound }: { mod: MapModule | null; found: boolean; onFound: () => void }) {
  const { t } = useLingui();
  const [greeted, setGreeted] = useState(false);
  if (mod === null) return null;
  const { MapMarker } = mod;
  const waved = greeted || found;
  const greet = () => {
    setGreeted(true);
    onFound();
  };
  return (
    <div className="ll-credits-mascot" data-testid="egg-mascot">
      <Button
        variant="quiet"
        size="md"
        onClick={greet}
        aria-label={t({ id: 'eggs.mascot.name', message: '跟鈴打個招呼', comment: '幕後頁吉祥物按鈕的可讀名稱（彩蛋）' })}
        data-testid="egg-mascot-button"
      >
        <MapMarker pose={waved ? 'wave' : 'cheek'} expression={waved ? 'joy' : 'smile'} size={64} />
      </Button>
      {waved && (
        <p className="ll-credits-mascot__say" role="status" data-testid="egg-mascot-text">
          {t({ id: 'eggs.mascot.text', message: '鈴：嗨！謝謝你跑來看幕後。', comment: '按了吉祥物之後說的話' })}
        </p>
      )}
    </div>
  );
}
