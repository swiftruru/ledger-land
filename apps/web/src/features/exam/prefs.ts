// 苦練區的裝置偏好（M4c）：選項順序「和講義一樣」或「打亂」，存 localStorage（lib/prefs.ts 的規則：不進 IndexedDB、不隨備份）。
// 預設和講義一樣（維護者 2026-11-04 的決定），所以只有打亂時才寫鍵。
import { readPref, writePref } from '../../lib/prefs.ts';
import { DEFAULT_RANDOM_COUNT, parseCount, type CountOption } from './options.ts';

export const EXAM_SHUFFLE_KEY = 'll:exam-shuffle';

export const readExamShuffle = (): boolean => readPref(EXAM_SHUFFLE_KEY) === '1';
export function writeExamShuffle(on: boolean): void {
  writePref(EXAM_SHUFFLE_KEY, on ? '1' : null);
}

/** 隨機練習抽幾題（M4c 第二批）：20 是預設，不寫鍵 */
export const EXAM_RANDOM_COUNT_KEY = 'll:exam-random-n';
export const readExamRandomCount = (): CountOption => parseCount(readPref(EXAM_RANDOM_COUNT_KEY), DEFAULT_RANDOM_COUNT);
export function writeExamRandomCount(count: CountOption): void {
  writePref(EXAM_RANDOM_COUNT_KEY, count === DEFAULT_RANDOM_COUNT ? null : String(count));
}

/** 背題瀏覽頁「遮住答案與解析」的開關：預設不遮（維護者 2026-11-05 的決定） */
export const EXAM_BROWSE_HIDE_KEY = 'll:exam-browse-hide';
export const readExamBrowseHide = (): boolean => readPref(EXAM_BROWSE_HIDE_KEY) === '1';
export function writeExamBrowseHide(on: boolean): void {
  writePref(EXAM_BROWSE_HIDE_KEY, on ? '1' : null);
}
