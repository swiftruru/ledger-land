// 進度資料模型的常數、ID 規則與不需要 zod 的純函式（06 第 4.2 節）。Zod schema 與由它推導的型別在 schemas.ts。
// 這個檔案是儲存 runtime（store、derive、merge、migrations 與 apps/web 的 IndexedDB 實作）唯一要在執行期載入的模型檔：
// 不 import zod，也不 import 任何會在模組頂層建立 zod schema 的模組（@ledgerland/content-schema 的 common.ts 也算），
// 這樣地圖與作答頁開進度資料庫時只載 runtime、不載 zod（06 第 8.2 節、14 第 5.2 節）；對 schemas.ts 只做 import type。
import type { Meta, ProgressData, ProgressSnapshot } from './schemas.ts';

/** 本機資料庫的 schema 版本（06 第 4.2 節：從 1 開始；與 08 的內容 schemaVersion 是兩回事） */
export const DB_SCHEMA_VERSION = 1;
export const DB_NAME = 'ledgerland';

/** 錯誤紀錄環狀保留的筆數（06 第 4.2 與第 9 節）與 stack 的截斷長度 */
export const ERRORS_MAX = 50;
export const ERROR_STACK_MAX_LENGTH = 2000;

/** meta 是固定 key 的單一筆 */
export const META_KEY = 'meta';
/** 自由實驗目前只存一份（06 第 4.2 節） */
export const LAB_SANDBOX_DEFAULT_ID = 'sandbox-default';

/** 取捨題的收藏（03 第 2.7 節）：存在 settings 的這個鍵，值是題目 ID 的陣列（apps/web 的 features/quiz/favourites.ts） */
export const FAVOURITES_SETTING_KEY = 'favourites';
/** 「幕後」頁找到的彩蛋（03 第 2.10 節的特別徽章）：存在 settings 的這個鍵，值是彩蛋 ID 的陣列；找齊時由 apps/web 寫入 badge:special:credits-eggs 的 unlock */
export const CREDITS_EGGS_SETTING_KEY = 'creditsEggs';
/**
 * settings 裡屬於學習資料、不是偏好的鍵（2026-10-25，core-2；2026-10-27 加彩蛋）：匯入時不受「也套用語言與計時設定」控制，
 * 合併模式取兩邊的聯集，覆蓋模式取備份的值（備份沒有就清掉）；備份預覽另外計數，不算進 hasSettings
 */
export const LEARNING_SETTING_KEYS: readonly string[] = Object.freeze([FAVOURITES_SETTING_KEY, CREDITS_EGGS_SETTING_KEY]);

/** 設定值轉成不重複的題目 ID 清單（收藏用）：不是陣列的值當作空清單；略過非字串與空字串，保留第一次出現的順序 */
export function idListOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string' || v === '' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** Crockford Base32 小寫（不含 i、l、o、u）；與 @ledgerland/content-schema 的 CROCKFORD 相同，為了不把 content-schema 的 zod schema 拉進 runtime 而在這裡另抄一份（測試會比對兩者一致） */
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const crockfordClass = `[${CROCKFORD}]`;

/** ID 規則：deviceId 是 d_ 加 8 碼、attemptId 是 a_ 加 12 碼 Crockford Base32 小寫（產生時）；驗證時 attemptId 接受 8 到 26 碼 */
export const ID_LENGTHS = { device: 8, attempt: 12 } as const;
export const DEVICE_ID_RE = new RegExp(`^d_${crockfordClass}{${ID_LENGTHS.device}}$`);
export const ATTEMPT_ID_RE = new RegExp(`^a_${crockfordClass}{8,26}$`);

/** 自由實驗新增步驟的本機 ID：local_ 加流水號（03 第 3.7 節） */
export const LOCAL_STEP_ID_RE = /^local_[0-9]+$/;

/** 由注入的亂數產生 ID（random 回傳 [0, 1) 的數，呼叫端用 crypto.getRandomValues 之類提供；本套件不用 Math.random） */
export function generateDeviceId(random: () => number): string {
  return `d_${randomCrockford(ID_LENGTHS.device, random)}`;
}

export function generateAttemptId(random: () => number): string {
  return `a_${randomCrockford(ID_LENGTHS.attempt, random)}`;
}

function randomCrockford(length: number, random: () => number): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    const r = random();
    if (!(r >= 0 && r < 1)) throw new RangeError(`random() 必須回傳 [0, 1) 的數，收到 ${String(r)}`);
    s += CROCKFORD[Math.floor(r * CROCKFORD.length)];
  }
  return s;
}

export const DATA_STORES = ['attempts', 'levelProgress', 'reviewQueue', 'unlocks', 'labState', 'labSandbox', 'settings'] as const;
export type DataStoreName = (typeof DATA_STORES)[number];
export const ALL_STORES = ['meta', ...DATA_STORES, 'errors', 'snapshots'] as const;
export type StoreName = (typeof ALL_STORES)[number];

export function emptyProgressData(): ProgressData {
  return { attempts: [], levelProgress: [], reviewQueue: [], unlocks: [], labState: [], labSandbox: [], settings: [] };
}

export function emptySnapshot(meta: Meta): ProgressSnapshot {
  return { ...emptyProgressData(), meta, errors: [], snapshots: [] };
}

export function dataOf(snapshot: ProgressSnapshot): ProgressData {
  const { attempts, levelProgress, reviewQueue, unlocks, labState, labSandbox, settings } = snapshot;
  return { attempts, levelProgress, reviewQueue, unlocks, labState, labSandbox, settings };
}
