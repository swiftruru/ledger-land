// 名詞頁的狀態卡（站規 2.7）：只組合 web-ui 的 Card、圖示、CollectedStamp 與 Button，不手寫連結或按鈕外觀。
// - 未收進：解鎖任務卡。左邊 44px 虛線空位加鎖頭、標題「在第 7 章第 3 關遇到」、副標關卡名稱、primary「前往這一關」（手機撐滿一列）。
// - 已收進：左邊 32px 金色印章、「已收進圖鑑」與收進日期。
// - 參考名詞或還沒有關卡用到：一行 footnote 加 InfoIcon，不顯示鎖頭。
// 沒有「讀取中」的樣子（維護者 2026-10-26）：名詞頁在進度讀到之後才畫，狀態卡第一次出現就是最後的樣子。
import { Trans } from '@lingui/react/macro';
import type { ReactElement, ReactNode } from 'react';
import type { TransRenderProps } from '@lingui/react';
import { ArrowRightIcon, Button, Card, CollectedStamp, InfoIcon, LockIcon } from '@ledgerland/web-ui';

/** title、subtitle 由名詞頁傳進來，照全站規則換行（07 第 3.5 節；
 *  切詞程式跟著名詞頁的 chunk，名詞列表與徽章頁不必載入） */
export function UnlockCard({
  title,
  subtitle,
  href,
  labelRender,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href: string;
  labelRender?: (props: TransRenderProps) => ReactElement;
}) {
  return (
    <Card className="ll-unlock" data-testid="term-status" data-unlocked="locked">
      <span className="ll-unlock__slot" aria-hidden="true">
        <LockIcon size={20} />
      </span>
      <div className="ll-unlock__text">
        <p className="ll-unlock__eyebrow">
          <Trans id="term.unlock.eyebrow" comment="名詞頁解鎖任務卡的眉標：這個名詞還沒收進圖鑑（只是收藏狀態，內容照樣能讀）">
            還沒收進圖鑑
          </Trans>
        </p>
        <p className="ll-unlock__title" data-testid="term-meet">
          {title}
        </p>
        {subtitle && <p className="ll-unlock__sub">{subtitle}</p>}
      </div>
      <Button variant="primary" iconEnd={<ArrowRightIcon />} href={href} className="ll-unlock__go" data-testid="term-go-level">
        <Trans id="terms.meet.go" comment="名詞頁解鎖任務卡的主按鈕：前往會遇到這個名詞的關卡" render={labelRender}>
          前往這一關
        </Trans>
      </Button>
    </Card>
  );
}

export function CollectedCard({ date }: { date: string }) {
  return (
    <Card className="ll-collected" data-testid="term-status" data-unlocked="unlocked">
      <CollectedStamp size={32} className="ll-collected__stamp" />
      <div className="ll-collected__text">
        <p className="ll-collected__title">
          <Trans id="term.collected" comment="名詞頁：這個名詞已收進圖鑑">
            已收進圖鑑
          </Trans>
        </p>
        <p className="ll-collected__date">
          <Trans id="term.unlockedAt" comment="名詞卡上的收進日期；date 是已格式化的日期">
            {date} 收進名詞圖鑑
          </Trans>
        </p>
      </div>
    </Card>
  );
}

/** 參考名詞與還沒有關卡用到的名詞：一行說明，不顯示鎖頭 */
export function StatusNote({ kind, children }: { kind: 'reference' | 'locked'; children: ReactNode }) {
  return (
    <p className="ll-termnote" data-testid="term-status" data-unlocked={kind}>
      <span className="ll-termnote__icon" aria-hidden="true">
        <InfoIcon size={16} />
      </span>
      <span>{children}</span>
    </p>
  );
}
