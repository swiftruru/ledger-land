// 科目表模組（04 第 4 節）：建索引、解析名稱、政策下是否啟用、正常餘額的符號。
// 科目資料不合法屬於建置期的程式錯誤（資料是程式的一部分），所以 buildChart 直接 throw；過帳時的預期內錯誤另由分錄驗證以 Result 回傳。
import type { PolicyDefinition } from '../policy/types.ts';
import { stableSortBy } from '../util/canonical.ts';
import type { Account, Chart } from './types.ts';

/** 名稱正規化：去頭尾空白、把連續空白縮成一個；英文不分大小寫 */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function* namesOf(account: Account): Generator<string> {
  yield account.id;
  yield account.labels.teacher['zh-TW'];
  yield account.labels.teacher.en;
  if (account.labels.currentTw !== null) yield account.labels.currentTw;
  if (account.labels.ifrsEn !== null) yield account.labels.ifrsEn;
  yield* account.labels.aliases['zh-TW'];
  yield* account.labels.aliases.en;
}

/**
 * 以 id 建索引並依 order 排序；檢查 id 唯一、contraOf 指向存在的科目、名稱與別名不會指到兩個不同的科目。
 * 資料不合法時 throw（建置期錯誤）。
 */
export function buildChart(accounts: readonly Account[]): Chart {
  const byId = new Map<string, Account>();
  for (const account of accounts) {
    if (byId.has(account.id)) throw new Error(`buildChart：科目 ID 重複 ${account.id}`);
    byId.set(account.id, account);
  }
  const byName = new Map<string, string>();
  for (const account of accounts) {
    if (account.contraOf !== null) {
      if (!byId.has(account.contraOf)) throw new Error(`buildChart：${account.id} 的 contraOf 指向不存在的科目 ${account.contraOf}`);
      if (account.contraOf === account.id) throw new Error(`buildChart：${account.id} 的 contraOf 指向自己`);
    }
    for (const raw of namesOf(account)) {
      const name = normaliseName(raw);
      if (name === '') throw new Error(`buildChart：${account.id} 有空白的名稱或別名`);
      const existing = byName.get(name);
      if (existing !== undefined && existing !== account.id) throw new Error(`buildChart：名稱「${raw}」同時指向 ${existing} 與 ${account.id}`);
      byName.set(name, account.id);
    }
  }
  const sorted = stableSortBy(accounts, (a) => [a.order, a.id]);
  return { accounts: sorted, byId, byName };
}

/** 以 ID、教材用語、現行用語、IFRS 英文或別名解析科目；找不到回傳 undefined */
export function resolveAccount(chart: Chart, nameOrAlias: string): Account | undefined {
  const id = chart.byName.get(normaliseName(nameOrAlias));
  return id === undefined ? undefined : chart.byId.get(id);
}

/**
 * 科目在某套政策下是否可入帳：科目存在、不在政策的停用清單內，且預設啟用、或被政策的 enabledAccounts 或實驗的 enabledExtensions 顯式啟用。
 * 延伸科目（flags 含 extension）預設停用，只有被顯式啟用才可入帳（04 第 4.5 節）。
 */
export function isAccountEnabled(chart: Chart, accountId: string, policy: PolicyDefinition, enabledExtensions: readonly string[] = []): boolean {
  const account = chart.byId.get(accountId);
  if (account === undefined) return false;
  if (policy.disabledAccounts.includes(accountId)) return false;
  return account.enabledByDefault || (policy.enabledAccounts?.includes(accountId) ?? false) || enabledExtensions.includes(accountId);
}

/** 正常餘額的符號：借方科目 1、貸方科目 -1（抵銷科目依自己的 normalSide） */
export function normalSign(account: Account): 1 | -1 {
  return account.normalSide === 'debit' ? 1 : -1;
}
