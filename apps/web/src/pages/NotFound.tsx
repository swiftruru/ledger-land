// 找不到頁面（站規 2.16、2.18 第 3 點）：未知網址與內容不存在（章節、名詞、關卡下架）共用。只有一個 EmptyState（鈴托腮），h1 是標題（換頁焦點）；
// 主動作 primary md「回到首頁」帶 HouseIcon、secondary md「去闖關地圖」帶 MapIcon。沒有頁首返回鍵（站規 2.0：用頁面內的按鈕）。
import { Trans } from '@lingui/react/macro';
import { localePath } from '@ledgerland/i18n';
import { Button, EmptyState, HouseIcon } from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { useLocale } from '../lib/useLocale.ts';

export function NotFound() {
  const locale = useLocale();
  return (
    <EmptyState
      className="ll-notfound"
      data-testid="not-found"
      pose="cheek"
      titleAs="h1"
      title={<Trans id="notfound.title">找不到這一頁</Trans>}
      description={<Trans id="notfound.body">這個網址沒有對應的頁面，可能是輸入錯誤，或內容已經下架。</Trans>}
      action={[
        <Button key="home" variant="primary" icon={<HouseIcon />} href={localePath(locale, '/')}>
          <Trans id="error.home">回到首頁</Trans>
        </Button>,
        <Button key="map" icon={<MapIcon />} href={localePath(locale, '/play/')}>
          <Trans id="notFound.goMap" comment="找不到頁面的第二顆按鈕">
            去闖關地圖
          </Trans>
        </Button>,
      ]}
    />
  );
}
