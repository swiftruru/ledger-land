// 報表實驗室的占位頁（Tab bar 的頂層頁，站規 2.16）：PageHeader「實驗室」加一個 EmptyState（鈴），用對學生說的話介紹實驗室，
// 主動作 primary md「先去闖關」帶 MapIcon、secondary md「看名詞圖鑑」帶 CardsIcon。占位頁也一樣不得有未設計的連結（07「確定要做」）。
// 下面三張不可點的小卡預告實驗室能做的事（02 第 1.1 節、關於系統設計），手機一欄、600 以上三欄，大螢幕不只剩一張孤單的卡。
// 第 1 輪驗收：小卡原本和 NavRow 長得一樣（圖示方塊、陰影），看起來像壞掉的連結；改成虛線外框、沒有陰影、圖示不加底色的靜態預告，
// 右上角 Badge neutral「即將開放」（虛線空位是名詞圖鑑「還沒收進」的同一種語言）。
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { localePath } from '@ledgerland/i18n';
import { Badge, BookIcon, Button, CardsIcon, EmptyState, PageHeader, ProcessIcon, StatementIcon } from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/lab.css';

function Feature({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <li className="ll-lab-feature">
      <span className="ll-lab-feature__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="ll-lab-feature__title">{title}</h3>
      <Badge className="ll-lab-feature__badge">
        <Trans id="lab.feature.soon" comment="實驗室占位頁預告小卡右上角的標示：還不能用">
          即將開放
        </Trans>
      </Badge>
      <p className="ll-lab-feature__desc">{children}</p>
    </li>
  );
}

export default function Placeholder() {
  const { t } = useLingui();
  const locale = useLocale();
  return (
    <>
      <PageHeader title={t({ id: 'lab.page.title', message: '實驗室', comment: '實驗室頁（Tab bar 頂層頁）的頁首標題' })} />
      <EmptyState
        className="ll-lab-soon"
        data-testid="lab-placeholder"
        pose="wave"
        title={<Trans id="lab.placeholder.soon">報表實驗室即將開放</Trans>}
        description={
          <Trans id="lab.placeholder.body" comment="實驗室占位頁的說明，對學生說話">
            在實驗室裡，你可以自己改一筆交易，看三張報表跟著一起變。開放之前，先到闖關地圖把基本功練起來吧。
          </Trans>
        }
        action={[
          <Button key="play" variant="primary" icon={<MapIcon />} href={localePath(locale, '/play/')}>
            <Trans id="lab.placeholder.go">先去闖關</Trans>
          </Button>,
          <Button key="terms" icon={<CardsIcon />} href={localePath(locale, '/terms/')}>
            <Trans id="lab.placeholder.terms" comment="實驗室占位頁的第二顆按鈕">
              看名詞圖鑑
            </Trans>
          </Button>,
        ]}
      />
      <ul
        className="ll-lab-features"
        aria-label={t({ id: 'lab.features.label', message: '實驗室裡可以做的事', comment: '實驗室占位頁三張預告小卡的清單名稱' })}
      >
        <Feature icon={<ProcessIcon />} title={<Trans id="lab.feature.edit.title">改一筆交易</Trans>}>
          <Trans id="lab.feature.edit.note">自己決定金額與科目，看看怎麼記帳。</Trans>
        </Feature>
        <Feature icon={<StatementIcon />} title={<Trans id="lab.feature.link.title">三張報表一起動</Trans>}>
          <Trans id="lab.feature.link.desc" comment="實驗室預告小卡的說明（1280 三欄時一行約 13 字）">
            同一組分錄，同時更新資產負債表、損益表與現金流量表。
          </Trans>
        </Feature>
        <Feature icon={<BookIcon />} title={<Trans id="lab.feature.rules.title">課程版與準則版</Trans>}>
          <Trans id="lab.feature.rules.desc">同一組交易切換兩種版面，看數字差在哪裡。</Trans>
        </Feature>
      </ul>
    </>
  );
}
