// 苦練區的裝置偏好（M4c）：選項順序「和講義一樣」或「打亂」，存 localStorage（lib/prefs.ts 的規則：不進 IndexedDB、不隨備份）。
// 預設和講義一樣（維護者 2026-11-04 的決定），所以只有打亂時才寫鍵。
import { readPref, writePref } from '../../lib/prefs.ts';
import { DEFAULT_RANDOM_COUNT, encodeMockSettings, parseCount, parseMockSettings, type CountOption, type MockSettings } from './options.ts';
import { encodeBrowsePos, parseBrowsePos, type BrowsePos } from './reading.ts';

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

/** 背題瀏覽上次所在的範圍與停的題（2026-11-06；reading.ts 的 BrowsePos）：還沒讀過時不寫鍵 */
export const EXAM_BROWSE_POS_KEY = 'll:exam-browse-pos';
export const readExamBrowsePos = (): BrowsePos => parseBrowsePos(readPref(EXAM_BROWSE_POS_KEY));
export function writeExamBrowsePos(pos: BrowsePos): void {
  writePref(EXAM_BROWSE_POS_KEY, encodeBrowsePos(pos));
}

/** 模擬考上次選的範圍、題數與每題秒數（M4c 第二批） */
export const EXAM_MOCK_KEY = 'll:exam-mock';
export const readExamMockSettings = (): MockSettings => parseMockSettings(readPref(EXAM_MOCK_KEY));
export function writeExamMockSettings(settings: MockSettings): void {
  writePref(EXAM_MOCK_KEY, encodeMockSettings(settings));
}
