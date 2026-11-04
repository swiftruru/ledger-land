// 苦練區的裝置偏好（M4c）：選項順序「和講義一樣」或「打亂」，存 localStorage（lib/prefs.ts 的規則：不進 IndexedDB、不隨備份）。
// 預設和講義一樣（維護者 2026-11-04 的決定），所以只有打亂時才寫鍵。
import { readPref, writePref } from '../../lib/prefs.ts';

export const EXAM_SHUFFLE_KEY = 'll:exam-shuffle';

export const readExamShuffle = (): boolean => readPref(EXAM_SHUFFLE_KEY) === '1';
export function writeExamShuffle(on: boolean): void {
  writePref(EXAM_SHUFFLE_KEY, on ? '1' : null);
}
