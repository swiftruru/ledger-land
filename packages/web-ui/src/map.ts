// 闖關地圖元件（17、07 第 9 節）的獨立進入點：只有地圖頁與章節頁用到，從 @ledgerland/web-ui/map 匯入，
// 讓 Vite 把它們切成地圖的 chunk，不進首次載入的共用 web-ui chunk（06 第 8.1 節的預算）。字串仍在 web-ui 自己的 catalog。
export { LevelNode, useLevelNodeName, useLevelNumber, type LevelNodeProps, type LevelNodeStatus } from './components/LevelNode.tsx';
export { LevelSheet, type LevelSheetProps, type LevelSheetData } from './components/LevelSheet.tsx';
export { ChapterBanner, useChapterLabels, type ChapterBannerProps } from './components/ChapterBanner.tsx';
export { ChapterEnd, type ChapterEndProps } from './components/ChapterEnd.tsx';
export { MapMarker, type MapMarkerProps, type MarkerPose, type MarkerExpression } from './components/MapMarker.tsx';
export { ChapterBadge, starPath, type ChapterBadgeProps, type ChapterBadgeState } from './components/ChapterBadge.tsx';
export { SpecialBadge, type SpecialBadgeProps, type SpecialBadgeState } from './components/SpecialBadge.tsx';
export { RollingNumber, type RollingNumberProps } from './components/RollingNumber.tsx';
export { NoteTag, type NoteTagKind } from './components/NoteTag.tsx';
export { MapHud, type MapHudProps, type MapHudTool } from './components/MapHud.tsx';
export { MapListToggle, useMapListLabels, type MapListToggleProps } from './components/MapListToggle.tsx';
export { LevelCode, levelCodeOf, formatLevelCode, type LevelCodeProps } from './components/LevelCode.tsx';
export { LevelCodeInput, type LevelCodeInputProps, type LevelCodeStatus } from './components/LevelCodeInput.tsx';
export { LevelCard, type LevelCardProps } from './components/LevelCard.tsx';
export { phrased } from './components/MapPhrase.tsx';
export {
  KeyboardIcon,
  QrIcon,
  LocateIcon,
  ListIcon,
  MapIcon,
  CopyIcon,
  MedalIcon,
  ReviewIcon,
  FlagIcon,
  DownloadIcon,
  LinkIcon,
} from './components/map-icons.tsx';
export { XIcon } from './components/icons.tsx';
