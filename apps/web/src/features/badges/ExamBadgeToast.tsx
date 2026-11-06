// 取得苦練徽章時的浮動提示（背題瀏覽的閱讀頁、模擬考的成績、苦練首頁共用）：收集類的提示，左邊是徽章的圖，幾秒後自己收起來。
// 一次拿到幾枚時合成一則（名稱用頓號接起來），圖用最後一枚（定義的順序裡比較後面、比較難的那一枚）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';
import { Toast, ToastRegion } from '@ledgerland/web-ui';
import { EXAM_BADGES, type ExamBadgeKey } from './exam.ts';
import { ExamBadgeArt } from './ExamBadgeArt.tsx';
import { useExamBadgeText } from './exam-text.ts';

const SHOW_MS = 7000;

export function ExamBadgeToast({ keys, onDismiss }: { keys: readonly ExamBadgeKey[]; onDismiss: () => void }) {
  const { t } = useLingui();
  const text = useExamBadgeText();
  const held = useRef(false);
  const signature = keys.join(',');
  useEffect(() => {
    if (signature === '') return;
    const timer = window.setInterval(() => {
      if (!held.current) onDismiss();
    }, SHOW_MS);
    return () => window.clearInterval(timer);
    // onDismiss 每次重繪都是新的函式，不列進相依（只在徽章換了的時候重設計時）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const last = EXAM_BADGES.find((b) => b.key === keys[keys.length - 1]);
  return (
    <ToastRegion className="ll-float-toasts" data-testid="exam-badge-toasts" onHoldChange={(h) => (held.current = h)}>
      {last && (
        <Toast
          key={signature}
          kind="collect"
          title={t({ id: 'badges.exam.earned', message: '取得苦練徽章', comment: '取得苦練徽章時浮動提示的標題' })}
          media={<ExamBadgeArt step={last.step} tier={last.tier} state="done" size={34} />}
          onDismiss={onDismiss}
        >
          {keys.map((k) => text(k).title).join(t({ id: 'badges.exam.listSep', message: '、', comment: '一次取得幾枚苦練徽章時，名稱之間的分隔' }))}
        </Toast>
      )}
    </ToastRegion>
  );
}
