// 右側懸浮工具列（17 第 2 節）：「跳到目前關卡」「輸入關卡代號」「掃描課堂 QR」「清單檢視」四個 44px 圓形按鈕，直向排列在 Tab bar 之上。
// 「掃描課堂 QR」只在 App 模式、不是 App 內建瀏覽器、而且有 getUserMedia 時顯示（06 第 4.9 節）。
import { useLingui } from '@lingui/react/macro';
import { KeyboardIcon, LocateIcon, MapListToggle, QrIcon } from '@ledgerland/web-ui/map';

export interface MapToolbarProps {
  list: boolean;
  onToggleList: (list: boolean) => void;
  onLocate: () => void;
  onCode: () => void;
  onScan: () => void;
  showScan: boolean;
}

export function MapToolbar({ list, onToggleList, onLocate, onCode, onScan, showScan }: MapToolbarProps) {
  const { t } = useLingui();
  return (
    <div className="qm-toolbar" role="toolbar" aria-label={t({ id: 'play.toolbar', message: '地圖工具', comment: '闖關地圖右側工具列的可讀名稱' })}>
      <button
        type="button"
        className="ll-maptool"
        onClick={onLocate}
        aria-label={t({ id: 'play.tool.locate', message: '跳到目前關卡', comment: '工具列：捲到目前關卡的按鈕' })}
        data-testid="map-locate"
      >
        <LocateIcon size={22} />
      </button>
      <button
        type="button"
        className="ll-maptool"
        onClick={onCode}
        aria-label={t({ id: 'play.tool.code', message: '輸入關卡代號', comment: '工具列：開啟關卡代號輸入的按鈕' })}
        data-testid="map-code"
      >
        <KeyboardIcon size={22} />
      </button>
      {showScan && (
        <button
          type="button"
          className="ll-maptool"
          onClick={onScan}
          aria-label={t({ id: 'play.tool.scan', message: '掃描課堂 QR', comment: '工具列：開啟課堂 QR 掃描的按鈕' })}
          data-testid="map-scan"
        >
          <QrIcon size={22} />
        </button>
      )}
      <MapListToggle list={list} onToggle={onToggleList} />
    </div>
  );
}
