// 苦練徽章的名稱與取得條件（features/badges/exam.ts 的六枚）：苦練首頁、徽章頁與取得時的提示共用。
// 條件裡的題數與比例用格式化函式當參數（不寫死在字串裡）。新增徽章時這裡與 exam.ts 一起加。
import { useLingui } from '@lingui/react/macro';
import { formatNumber, formatPercent } from '@ledgerland/i18n';
import { useLocale } from '../../lib/useLocale.ts';
import { MOCK_BADGE_MIN_QUESTIONS, MOCK_BADGE_PASS_RATIO, type ExamBadgeKey } from './exam.ts';

export function useExamBadgeText(): (key: ExamBadgeKey) => { title: string; cond: string } {
  const { t } = useLingui();
  const locale = useLocale();
  const min = formatNumber(MOCK_BADGE_MIN_QUESTIONS, locale);
  const pass = formatPercent(MOCK_BADGE_PASS_RATIO, locale, { digits: 0 });
  return (key) => {
    switch (key) {
      case 'readDeck':
        return {
          title: t({ id: 'badges.exam.readDeck', message: '讀完一份', comment: '苦練徽章的名稱：背題瀏覽讀完任一份講義' }),
          cond: t({ id: 'badges.exam.readDeck.cond', message: '任一份講義的題目全部讀完', comment: '苦練徽章「讀完一份」的取得條件' }),
        };
      case 'readAll':
        return {
          title: t({ id: 'badges.exam.readAll', message: '讀遍題庫', comment: '苦練徽章的名稱：背題瀏覽讀完全部題目' }),
          cond: t({ id: 'badges.exam.readAll.cond', message: '全部題目都讀完', comment: '苦練徽章「讀遍題庫」的取得條件' }),
        };
      case 'practisedAll':
        return {
          title: t({ id: 'badges.exam.practisedAll', message: '題題練過', comment: '苦練徽章的名稱：每一題都作答過' }),
          cond: t({ id: 'badges.exam.practisedAll.cond', message: '每一題都作答過一次', comment: '苦練徽章「題題練過」的取得條件' }),
        };
      case 'noWrong':
        return {
          title: t({ id: 'badges.exam.noWrong', message: '錯題歸零', comment: '苦練徽章的名稱：每一題都練過而且沒有停在答錯的題' }),
          cond: t({ id: 'badges.exam.noWrong.cond', message: '每一題都練過，而且沒有一題停在答錯', comment: '苦練徽章「錯題歸零」的取得條件' }),
        };
      case 'mockFirst':
        return {
          title: t({ id: 'badges.exam.mockFirst', message: '初次上場', comment: '苦練徽章的名稱：交卷第一次夠長的模擬考' }),
          cond: t({
            id: 'badges.exam.mockFirst.cond',
            message: `交卷一次 ${min} 題以上的模擬考`,
            comment: '苦練徽章「初次上場」的取得條件；min 是已格式化的題數',
          }),
        };
      case 'mockPass':
        return {
          title: t({ id: 'badges.exam.mockPass', message: '模擬考過關', comment: '苦練徽章的名稱：夠長的模擬考答對八成' }),
          cond: t({
            id: 'badges.exam.mockPass.cond',
            message: `一次 ${min} 題以上的模擬考答對 ${pass} 以上`,
            comment: '苦練徽章「模擬考過關」的取得條件；min 是已格式化的題數，pass 是已格式化的百分比',
          }),
        };
    }
  };
}
