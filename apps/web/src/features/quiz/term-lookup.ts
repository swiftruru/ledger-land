// 名詞資料以 accountRef 或 ratioRef 對應科目與指標（04 第 16.3 節）：純函式，作答頁的分類題、交易影響題、指標計算與指標小表格共用。
// 名詞索引的 ratioRef 帶版本（例如 current_ratio@excel），一個指標只有一張名詞卡；題目裡分類題的指標卡只寫 ID（roe），
// 交易影響題的目標與指標計算題帶版本，版本也可能和名詞卡不同，所以指標先比完整的 ratioRef、再比 @ 前面的 ID。
import type { TermIndexEntry } from '../../lib/content.ts';

const ratioIdOf = (ref: string): string => ref.split('@')[0] ?? ref;

export function termByRef(terms: ReadonlyMap<string, TermIndexEntry>, field: 'accountRef' | 'ratioRef', value: string): TermIndexEntry | undefined {
  if (field === 'accountRef') {
    for (const tm of terms.values()) if (tm.accountRef === value) return tm;
    return undefined;
  }
  const id = ratioIdOf(value);
  let sameId: TermIndexEntry | undefined;
  for (const tm of terms.values()) {
    const ref = tm.ratioRef;
    if (ref === undefined) continue;
    if (ref === value) return tm;
    if (sameId === undefined && ratioIdOf(ref) === id) sameId = tm;
  }
  return sameId;
}
