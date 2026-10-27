// 「輸入關卡代號」疊加層（02 第 4.7 節、06 第 4.9 節）：正規化後查 manifest 與墓碑，找到就導到 /level/lv_…/、已下架導所屬章節頁、找不到提示。
// 全部在本機完成，離線也能用（manifest 與墓碑都在預先快取）。按鈕依站規 2.2.5：送出是 primary md block；已下架時錯誤句下一行是
// secondary sm「前往所屬章節」（LevelCodeInput 處理）。
// 放在 quest-map 資料夾外（第 5 輪看圖驗收後的體積調整）：不進地圖的共用 chunk，Play 在地圖畫好 1.5 秒後（或第一次打開時）才載入
import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type RefObject } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { LevelCodeInput, type LevelCodeStatus } from '@ledgerland/web-ui/map';
import type { QuestMapData, QuestMapSource } from '../quest-map/data.ts';
import { levelIdFromCode, normalizeLevelCode } from '../quest-map/level-code.ts';
import { Overlay } from '../quest-map/Overlay.tsx';
import { retiredChaptersOf } from '../quest-map/progress.ts';

export interface LevelCodeOverlayProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  data: QuestMapData | null;
  source: QuestMapSource;
  onNavigate: (href: string) => void;
  /** 已下架關卡所屬章節（由進度反查；沒有時只提示已下架） */
  retiredChapterOf?: ReadonlyMap<string, string>;
  /** 關閉後焦點要回到的元素 */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function LevelCodeOverlay({ open, onClose, locale, data, source, onNavigate, retiredChapterOf, returnFocusTo }: LevelCodeOverlayProps) {
  const { t } = useLingui();
  const [status, setStatus] = useState<LevelCodeStatus>({ kind: 'idle' });
  const submit = async (raw: string) => {
    const n = normalizeLevelCode(raw);
    if (!n.ok) {
      setStatus({ kind: 'format' });
      return;
    }
    const levelId = levelIdFromCode(n.code);
    if (data?.levelById.has(levelId)) {
      onNavigate(localePath(locale, `/level/${levelId}/`));
      return;
    }
    setStatus({ kind: 'busy' });
    let resolved: Awaited<ReturnType<QuestMapSource['resolve']>>;
    try {
      resolved = await source.resolve(levelId);
    } catch {
      resolved = { status: 'unknown' };
    }
    if (resolved.status === 'active' && resolved.kind === 'level') {
      onNavigate(localePath(locale, `/level/${levelId}/`));
      return;
    }
    if (resolved.status === 'retired') {
      // 有替代關卡就直接進替代關卡（02 第 4.4 節）；沒有就提示並連到所屬章節
      if (resolved.supersededBy && data?.levelById.has(resolved.supersededBy)) {
        onNavigate(localePath(locale, `/level/${resolved.supersededBy}/`));
        return;
      }
      // 所屬章節：fixture 進度直接給；正式進度從該關卡的作答紀錄反查 chapterId
      const chapterId = retiredChapterOf?.get(levelId) ?? (await retiredChaptersOf([levelId])).get(levelId);
      const chapterHref = chapterId && data?.chapterById.has(chapterId) ? localePath(locale, `/chapter/${chapterId}/`) : undefined;
      setStatus(chapterHref === undefined ? { kind: 'retired' } : { kind: 'retired', chapterHref });
      return;
    }
    setStatus({ kind: 'notFound' });
  };
  return (
    <Overlay
      open={open}
      onClose={() => {
        setStatus({ kind: 'idle' });
        onClose();
      }}
      title={t({ id: 'play.code.title', message: '輸入關卡代號', comment: '關卡代號疊加層的標題' })}
      returnFocusTo={returnFocusTo}
      testId="code-overlay"
    >
      <p className="qm-overlay__hint">
        {/* 數字和量詞整塊不斷（.ll-keep，07 第 3.5 節）；其他字照全站規則逐字換行 */}
        <Trans id="play.code.hint" comment="關卡代號疊加層的說明；<0> 包住的「8 碼」整塊不斷行">
          老師寫在黑板或投影片上的 <span className="ll-keep">8 碼</span>代號；大小寫、空白與連字號都可以省略。
        </Trans>
      </p>
      <LevelCodeInput status={status} onSubmit={(raw) => void submit(raw)} focusOnOpen={open} />
    </Overlay>
  );
}
