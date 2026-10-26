// 「在哪一關遇到」的文字（03 第 2.10 節、站規 1.11.2 與 2.7）：名詞卡說明列的「在 1-1「誰的東西、誰的錢」遇到」，
// 與名詞頁解鎖任務卡的標題「在第 7 章第 3 關遇到」。只輸出文字：行內的「前往這一關」連結已刪除（站規 3.1 #19），改由 UnlockCard 的按鈕。
// 章序和地圖一樣主線與延伸區分開編（unlocks.ts 的 numberChapters）。名詞卡的代號和章節頁、地圖、首頁同一個寫法（延伸章是 E4-1，
// 看圖驗收第 3 輪），句子和主線相同；名詞頁解鎖卡的長句仍寫「延伸第 N 章第 M 關」。關卡名從章節索引取，取不到只寫代號或章序。
import { useLingui } from '@lingui/react/macro';
import { formatNumber, type Locale } from '@ledgerland/i18n';
import type { LevelCodeFormatter } from '../home/codes.ts';
import type { GlossaryIndex } from './useGlossaryIndex.ts';
import { levelCode, levelPosition } from './unlocks.ts';

export interface MeetInfo {
  readonly levelId: string;
  readonly chapterId: string;
  readonly extension: boolean;
  /** 已格式化的章序（主線與延伸區各自從 1 起算） */
  readonly chapterNo: string;
  /** 已格式化的章內關序；關卡不在章節清單裡時沒有 */
  readonly levelNo?: string;
  /** 「1-2」，延伸章「E1-2」（useLevelCodeFormatter） */
  readonly code?: string;
  readonly levelTitle?: string;
}

/** 名詞會遇到的關卡在地圖上的位置與名稱；章節不在索引裡時回 undefined。codeOf 是 useLevelCodeFormatter() 的結果 */
export function meetInfo(index: GlossaryIndex, meet: { levelId: string; chapterId: string }, locale: Locale, codeOf: LevelCodeFormatter): MeetInfo | undefined {
  const pos = levelPosition(index.chapters, meet.chapterId, meet.levelId);
  if (!pos) return undefined;
  const fmt = (n: number) => formatNumber(n, locale);
  const code = levelCode(pos, codeOf);
  const levelTitle = index.info.get(meet.chapterId)?.levelTitles.get(meet.levelId);
  return {
    levelId: meet.levelId,
    chapterId: meet.chapterId,
    extension: pos.extension,
    chapterNo: fmt(pos.chapterNo),
    ...(pos.levelNo === undefined ? {} : { levelNo: fmt(pos.levelNo) }),
    ...(code === undefined ? {} : { code }),
    ...(levelTitle === undefined ? {} : { levelTitle }),
  };
}

/** 名詞卡與名詞頁用的寫法：card 帶關卡名（依章節分組）、short 只有代號（依名稱分組，站規 2.6）、unlockTitle 是名詞頁解鎖任務卡的標題 */
export function useMeetText(): { card: (m: MeetInfo) => string; short: (m: MeetInfo) => string; unlockTitle: (m: MeetInfo) => string } {
  const { t } = useLingui();
  const chapterOnly = ({ chapterNo, extension }: MeetInfo) =>
    extension
      ? t({
          id: 'terms.meet.extChapter',
          message: `在延伸第 ${chapterNo} 章會遇到`,
          comment: '未收進名詞的說明，只知道是延伸區的哪一章；chapterNo 是延伸區自己的章序（和地圖的「延伸第 N 章」相同）',
        })
      : t({ id: 'terms.meet.chapter', message: `在第 ${chapterNo} 章會遇到`, comment: '未收進名詞的說明，只知道章；chapterNo 是已格式化的章序號' });
  // 主線與延伸章同一句：代號本身已分出延伸章（E4-1），和章節頁、地圖、首頁一致（看圖驗收第 3 輪）
  const short = (m: MeetInfo): string => {
    const { code } = m;
    if (code === undefined) return chapterOnly(m);
    return t({
      id: 'terms.meet.code',
      message: `在 ${code} 遇到`,
      comment: '名詞卡說明列：未收進名詞會在哪一關遇到；code 是關卡代號（例如 1-2，延伸章是 E1-2），依章節分組或讀不到關卡名時',
    });
  };
  const card = (m: MeetInfo): string => {
    const { code, levelTitle } = m;
    if (code === undefined || levelTitle === undefined) return short(m);
    return t({
      id: 'terms.meet',
      message: `在 ${code}「${levelTitle}」遇到`,
      comment: '名詞卡說明列：未收進名詞會在哪一關遇到；code 是關卡代號（例如 1-1，延伸章是 E1-1），levelTitle 是關卡名',
    });
  };
  const unlockTitle = (m: MeetInfo): string => {
    const { chapterNo, levelNo } = m;
    if (levelNo === undefined) return chapterOnly(m);
    return m.extension
      ? t({
          id: 'term.unlock.titleExt',
          message: `在延伸第 ${chapterNo} 章第 ${levelNo} 關遇到`,
          comment: '名詞頁解鎖任務卡的標題（延伸章）；chapterNo 是延伸區自己的章序，levelNo 是章內關序，都已格式化',
        })
      : t({
          id: 'term.unlock.title',
          message: `在第 ${chapterNo} 章第 ${levelNo} 關遇到`,
          comment: '名詞頁解鎖任務卡的標題；chapterNo、levelNo 是已格式化的章序與關序',
        });
  };
  return { card, short, unlockTitle };
}
