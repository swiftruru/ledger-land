// 分錄題的科目選項（03 第 2.6 節）：只延後載入核心的科目表（lazy-data.ts，不帶判分與 zod），取要素與別名；顯示名稱優先用名詞資料（accountRef），
// 沒有名詞卡的科目退回科目表的教材用語。判分不在這裡。accountOptionsIn(core, …) 是同步版（題目元件已經拿到核心資料），accountOptionsOf 等 loadCoreData。
import type { Locale } from '@ledgerland/i18n';
import { loadCoreData, type CoreData } from './lazy-data.ts';

export type AccountElement = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface AccountData {
  readonly id: string;
  readonly order: number;
  readonly element: AccountElement;
  readonly labels: {
    readonly teacher: { readonly 'zh-TW': string; readonly en: string };
    readonly currentTw: string | null;
    readonly ifrsEn: string | null;
    readonly aliases: { readonly 'zh-TW': readonly string[]; readonly en: readonly string[] };
  };
}

function accountsOf(core: CoreData): readonly AccountData[] {
  return core.defaultAccounts as unknown as readonly AccountData[];
}

/** 科目表（模組 Promise 已經在 loadCoreData 快取，這裡不再多快取一層，否則失敗會被永久留住） */
export function loadAccounts(): Promise<readonly AccountData[]> {
  return loadCoreData().then(accountsOf);
}

export interface AccountOption {
  id: string;
  label: string;
  element: AccountElement;
  aliases: readonly string[];
}

/** 題目 accountChoices 的科目選項（同步，已有核心資料），依科目表 order 排序；labelOf 給的是名詞資料的顯示名稱 */
export function accountOptionsIn(core: CoreData, ids: readonly string[], locale: Locale, labelOf: (accountId: string) => string | undefined): AccountOption[] {
  const byId = new Map(accountsOf(core).map((a) => [a.id, a] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is AccountData => a !== undefined)
    .sort((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      label: labelOf(a.id) ?? a.labels.teacher[locale],
      element: a.element,
      aliases: [
        a.labels.teacher['zh-TW'],
        a.labels.teacher.en,
        ...(a.labels.currentTw === null ? [] : [a.labels.currentTw]),
        ...(a.labels.ifrsEn === null ? [] : [a.labels.ifrsEn]),
        ...a.labels.aliases['zh-TW'],
        ...a.labels.aliases.en,
      ],
    }));
}

/** 題目 accountChoices 的科目選項（等核心資料） */
export async function accountOptionsOf(ids: readonly string[], locale: Locale, labelOf: (accountId: string) => string | undefined): Promise<AccountOption[]> {
  return accountOptionsIn(await loadCoreData(), ids, locale, labelOf);
}

export const ELEMENT_ORDER: readonly AccountElement[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
