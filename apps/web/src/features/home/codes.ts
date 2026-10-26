// 關卡的短代號「1-2」（延伸章「E1-1」，圖規 4.1）：首頁的主卡、章節小地圖與收藏卡共用。數字先用 packages/i18n 格式化再當參數。
import { useLingui } from '@lingui/react/macro';
import { formatNumber } from '@ledgerland/i18n';
import { useLocale } from '../../lib/useLocale.ts';

export type LevelCodeFormatter = (chapterNo: number, levelNo: number, extension: boolean) => string;

export function useLevelCodeFormatter(): LevelCodeFormatter {
  const { t } = useLingui();
  const locale = useLocale();
  return (chapterNo, levelNo, extension) => {
    const c = formatNumber(chapterNo, locale);
    const l = formatNumber(levelNo, locale);
    return extension
      ? t({ id: 'home.code.ext', message: `E${c}-${l}`, comment: '延伸章關卡的短代號（E 是 Extension）；c 章序、l 關序，都已格式化' })
      : t({ id: 'home.code', message: `${c}-${l}`, comment: '關卡的短代號；c 章序、l 關序，都已格式化' });
  };
}
