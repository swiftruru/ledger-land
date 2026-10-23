// 「輸入關卡代號」疊加層（02 第 4.7 節、06 第 4.9 節）：正規化後查 manifest 與墓碑，找到就導到 /level/lv_…/、已下架導所屬章節頁、找不到提示。
// 全部在本機完成，離線也能用（manifest 與墓碑都在預先快取）。
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { localePath, type Locale } from '@ledgerland/i18n';
import { LevelCodeInput, type LevelCodeStatus } from '@ledgerland/web-ui/map';
import type { QuestMapData, QuestMapSource } from './data.ts';
import { levelIdFromCode, normalizeLevelCode } from './level-code.ts';
import { Overlay } from './Overlay.tsx';
import { retiredChaptersOf } from './progress.ts';

export interface LevelCodeOverlayProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  data: QuestMapData | null;
  source: QuestMapSource;
  onNavigate: (href: string) => void;
  /** 已下架關卡所屬章節（由進度反查；沒有時只提示已下架） */
  retiredChapterOf?: ReadonlyMap<string, string>;
}

export function LevelCodeOverlay({ open, onClose, locale, data, source, onNavigate, retiredChapterOf }: LevelCodeOverlayProps) {
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
      testId="code-overlay"
    >
      <p className="ll-muted ll-small">
        {t({ id: 'play.code.hint', message: '老師寫在黑板或投影片上的 8 碼代號；大小寫、空白與連字號都可以省略。', comment: '關卡代號疊加層的說明' })}
      </p>
      <LevelCodeInput status={status} onSubmit={(raw) => void submit(raw)} onNavigate={onNavigate} focusOnOpen={open} />
    </Overlay>
  );
}
