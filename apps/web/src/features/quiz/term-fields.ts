// 名詞卡與名詞頁的欄位對應（03 第 4.3 節）：完整內容的每個欄位各放在自己的段落，順序與標題由名詞卡（web-ui 的 TermSheet）與名詞頁（pages/Term.tsx）共用。
// note 是用語本身的說明（教材異寫、舊稱或日式用語的原因，04 第 16.3 節），放在「用語說明」，不放在「例子」；和其他欄位一樣可能含佔位符
// （{{raw:2027}}、{{date:…}}），名詞卡與名詞頁都要換成格式化文字。純函式，不碰 React。
import type { TermSnapshot } from '../../lib/content.ts';

export type TermField = 'note' | 'formula' | 'example' | 'misconception' | 'ifrsNote';

/** 畫面上的段落順序：定義與名稱之後依序是用語說明、公式、例子、常見誤解、IFRS 怎麼處理 */
export const TERM_FIELD_ORDER: readonly TermField[] = ['note', 'formula', 'example', 'misconception', 'ifrsNote'];

/** 每個段落的文字；沒有內容（缺欄位或空字串）的段落省略 */
export function termFieldsOf(detail: Pick<TermSnapshot, TermField>): Partial<Record<TermField, string>> {
  const out: Partial<Record<TermField, string>> = {};
  for (const f of TERM_FIELD_ORDER) {
    const v = detail[f];
    if (typeof v === 'string' && v.trim() !== '') out[f] = v;
  }
  return out;
}
