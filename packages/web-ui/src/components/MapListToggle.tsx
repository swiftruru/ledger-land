// 清單檢視切換（17 第 3.7 節、站規 2.2.1 與 3.2）：medium 以上是頂部統計列的 IconButton chrome；compact 時在「更多」選單裡（MapHud 的 tools）。
// 它是動作按鈕，不是切換鈕：在地圖上叫「清單檢視」、畫清單圖示；在清單裡叫「地圖檢視」、畫地圖圖示，不輸出 aria-pressed（第 1 輪看圖驗收）。
// 偏好由頁面存在 localStorage ll:map-view。
import { useLingui } from '@lingui/react/macro';
import { IconButton } from './IconButton.tsx';
import { ListIcon, MapIcon } from './map-icons.tsx';

export interface MapListToggleProps {
  list: boolean;
  onToggle: (list: boolean) => void;
  className?: string;
}

/** 切換鈕的可讀名稱與選單文字 */
export function useMapListLabels() {
  const { t } = useLingui();
  return {
    list: t({ id: 'map.tool.list', message: '清單檢視', comment: '工具：從地圖切換成清單檢視的按鈕（清單裡改叫地圖檢視）' }),
    map: t({ id: 'map.tool.map', message: '地圖檢視', comment: '工具與「更多」選單：從清單切回地圖的按鈕' }),
  };
}

export function MapListToggle({ list, onToggle, className }: MapListToggleProps) {
  const labels = useMapListLabels();
  return (
    <IconButton
      variant="chrome"
      icon={list ? <MapIcon /> : <ListIcon />}
      label={list ? labels.map : labels.list}
      onClick={() => onToggle(!list)}
      className={className}
      data-testid="map-list-toggle"
    />
  );
}
