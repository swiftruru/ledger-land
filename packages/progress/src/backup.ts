// 備份檔與文字備份碼（06 第 4.6 節）。formatVersion 1；checksum 是「去掉 checksum 欄位後的 canonical JSON」的 SHA-256，寫成 sha256-<base64url>。
// SHA-256 與壓縮都由呼叫端注入（apps/web 用 WebCrypto 與 CompressionStream 的 deflate-raw），本套件維持純 TypeScript。
import { z } from 'zod';
import { migrateSnapshot, type MigrationRegistry } from './migrations.ts';
import {
  Attempt,
  BackupMode,
  DeviceId,
  ErrorRecord,
  IsoDateTime,
  JsonValue,
  LabSandbox,
  LabState,
  LevelProgress,
  type ProgressData,
  type ProgressSnapshot,
  ReviewQueueEntry,
  SettingEntry,
  Unlock,
} from './schemas.ts';
import { FAVOURITES_SETTING_KEY, LEARNING_SETTING_KEYS, emptyProgressData, idListOf } from './model.ts';
import { type ProgressError, type Result, err, ok, progressError } from './result.ts';
import { base64urlDecode, base64urlEncode, canonicalJson, compareCodeUnits, finiteJson, utf8ByteLength, utf8Decode, utf8Encode } from './util.ts';

export const BACKUP_FORMAT = 'ledgerland-backup';
export const BACKUP_FORMAT_VERSION = 1;
/** 檔案大小上限暫定 5 MB（06 第 4.6 節第 4 步） */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
/** 文字備份碼的長度上限（暫定，M2 依實際大小調整）；超過時建議改用備份檔 */
export const MAX_BACKUP_CODE_LENGTH = 8000;
export const BACKUP_CODE_PREFIX = 'LL1:';

/** 備份檔的 data：settings 寫成鍵值物件（06 第 4.6 節的範例） */
export const BackupData = z
  .object({
    attempts: z.array(Attempt),
    levelProgress: z.array(LevelProgress),
    reviewQueue: z.array(ReviewQueueEntry),
    unlocks: z.array(Unlock),
    labState: z.array(LabState),
    labSandbox: z.array(LabSandbox),
    settings: z.record(z.string(), JsonValue),
  })
  .strict();
export type BackupData = z.infer<typeof BackupData>;

export const BackupFile = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    formatVersion: z.literal(BACKUP_FORMAT_VERSION),
    dbSchemaVersion: z.number().int().min(1),
    app: z.object({ version: z.string(), contentVersion: z.number().int().min(0) }).strict(),
    origin: z.string(),
    deviceId: DeviceId,
    mode: BackupMode,
    exportedAt: IsoDateTime,
    data: BackupData,
    errors: z.array(ErrorRecord),
    checksum: z.string().regex(/^sha256-[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export type BackupFile = z.infer<typeof BackupFile>;

/** SHA-256：輸入文字（UTF-8），回傳 32 個位元組；可同步或非同步 */
export type Sha256 = (text: string) => Uint8Array | Promise<Uint8Array>;
/** 壓縮與解壓（deflate-raw 之類）；由呼叫端注入 */
export type Compress = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>;

export interface BackupInfo {
  readonly app: { readonly version: string; readonly contentVersion: number };
  readonly origin: string;
  readonly mode: BackupMode;
  readonly exportedAt: string;
  /** 使用者勾選「附上錯誤紀錄」時為 true；預設不附 */
  readonly includeErrors?: boolean;
}

/** 去掉 checksum 後的 canonical JSON，是 checksum 的輸入 */
export function backupChecksumInput(backup: Omit<BackupFile, 'checksum'> | BackupFile): string {
  const { checksum: _omit, ...rest } = backup as BackupFile;
  return canonicalJson(rest);
}

export async function computeChecksum(backup: Omit<BackupFile, 'checksum'> | BackupFile, sha256: Sha256): Promise<string> {
  const digest = await sha256(backupChecksumInput(backup));
  return `sha256-${base64urlEncode(digest)}`;
}

export function settingsToRecord(settings: readonly SettingEntry[]): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const s of [...settings].sort((x, y) => compareCodeUnits(x.key, y.key))) out[s.key] = s.value;
  return out;
}

export function settingsFromRecord(record: Readonly<Record<string, JsonValue>>, updatedAt: string): SettingEntry[] {
  return Object.keys(record)
    .sort(compareCodeUnits)
    .map((key) => ({ key, value: record[key]!, updatedAt }));
}

/** 備份檔的 data 轉成可合併的 ProgressData（settings 的 updatedAt 用備份的 exportedAt） */
export function backupToProgressData(backup: Pick<BackupFile, 'data' | 'exportedAt'>): ProgressData {
  const { settings, ...rest } = backup.data;
  return { ...emptyProgressData(), ...rest, settings: settingsFromRecord(settings, backup.exportedAt) };
}

/** 由快照建立備份檔（06 第 4.6 節的形狀）。作答答案與設定值裡的 NaN、Infinity 寫成 null（finiteJson），舊資料裡有壞掉的數字也能匯出 */
export async function buildBackup(snapshot: ProgressSnapshot, info: BackupInfo, sha256: Sha256): Promise<BackupFile> {
  const body: Omit<BackupFile, 'checksum'> = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    dbSchemaVersion: snapshot.meta.dbSchemaVersion,
    app: { version: info.app.version, contentVersion: info.app.contentVersion },
    origin: info.origin,
    deviceId: snapshot.meta.deviceId,
    mode: info.mode,
    exportedAt: info.exportedAt,
    data: {
      attempts: snapshot.attempts.map((a) => ({ ...a, answer: finiteJson(a.answer) })),
      levelProgress: snapshot.levelProgress,
      reviewQueue: snapshot.reviewQueue,
      unlocks: snapshot.unlocks,
      labState: snapshot.labState,
      labSandbox: snapshot.labSandbox,
      settings: settingsToRecord(snapshot.settings.map((s) => ({ ...s, value: finiteJson(s.value) }))),
    },
    errors: info.includeErrors === true ? snapshot.errors : [],
  };
  return { ...body, checksum: await computeChecksum(body, sha256) };
}

/** 備份檔的 JSON 文字（存檔與備份碼共用；用 canonical JSON，同一份資料永遠得到同一串文字） */
export function serialiseBackup(backup: BackupFile): string {
  return canonicalJson(backup);
}

/** 備份檔名：ledgerland-backup-YYYYMMDD.json（日期由呼叫端以 exportedAt 的本地日期給） */
export function backupFileName(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) throw new RangeError('備份檔名的日期要是 8 位數字');
  return `ledgerland-backup-${yyyymmdd}.json`;
}

/** 預覽摘要（06 第 4.6 節第 5 步）：將匯入幾筆作答紀錄、幾個關卡的星星、幾個徽章、幾個名詞、幾題收藏 */
export interface BackupPreview {
  readonly attempts: number;
  readonly levels: number;
  readonly badges: number;
  readonly terms: number;
  readonly reviewEntries: number;
  /** 收藏的題目數（settings 的 favourites，不重複的題目 ID）；沒有收藏欄位的舊版備份是 0 */
  readonly favourites: number;
  /** 備份裡有沒有偏好設定（語言、計時等，畫面決定要不要顯示「也套用語言與計時設定」）；收藏等學習資料的鍵不算 */
  readonly hasSettings: boolean;
}

export interface ValidatedBackup {
  readonly backup: BackupFile;
  readonly data: ProgressData;
  readonly preview: BackupPreview;
  /** 備份比 App 舊、已在記憶體中升級時，記錄原本的版本 */
  readonly migratedFrom?: number;
}

export interface ValidateOptions {
  readonly currentSchemaVersion: number;
  readonly sha256: Sha256;
  /** 匯入舊版時的 migration 登錄檔與存快照用的時間 */
  readonly now: string;
  readonly registry?: MigrationRegistry;
  readonly maxBytes?: number;
}

function previewOf(data: ProgressData): BackupPreview {
  return {
    attempts: data.attempts.length,
    levels: data.levelProgress.length,
    badges: data.unlocks.filter((u) => u.kind === 'badge').length,
    terms: data.unlocks.filter((u) => u.kind === 'term').length,
    reviewEntries: data.reviewQueue.length,
    favourites: idListOf(data.settings.find((s) => s.key === FAVOURITES_SETTING_KEY)?.value).length,
    hasSettings: data.settings.some((s) => !LEARNING_SETTING_KEYS.includes(s.key)),
  };
}

const Envelope = z.object({ format: z.unknown(), formatVersion: z.unknown(), dbSchemaVersion: z.unknown(), checksum: z.unknown() }).loose();

/**
 * 匯入驗證（06 第 4.6 節，依序）：1 format 與 formatVersion；2 checksum；3 dbSchemaVersion 比 App 新就拒絕、比 App 舊就在記憶體中跑 migration；
 * 4 Zod 驗證全部欄位與大小上限；回傳備份、可合併的資料與預覽摘要（第 5 步由畫面顯示；第 6 步的純文字顯示由畫面負責）。
 * raw 可以是 JSON 文字或已解析的物件；文字時先 JSON.parse（失敗回 backup.parse）。
 */
export async function validateBackup(raw: unknown, options: ValidateOptions): Promise<Result<ValidatedBackup, ProgressError>> {
  const maxBytes = options.maxBytes ?? MAX_BACKUP_BYTES;
  let parsed: unknown = raw;
  let byteLength: number | undefined;
  if (typeof raw === 'string') {
    byteLength = utf8ByteLength(raw);
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err(progressError('backup.parse'));
    }
  }
  const env = Envelope.safeParse(parsed);
  if (!env.success) return err(progressError('backup.format'));
  const e = env.data;
  if (e.format !== BACKUP_FORMAT) return err(progressError('backup.format'));
  if (e.formatVersion !== BACKUP_FORMAT_VERSION) return err(progressError('backup.format_version', { formatVersion: String(e.formatVersion) }));
  if (typeof e.checksum !== 'string') return err(progressError('backup.checksum'));
  const expected = await computeChecksum(e as unknown as BackupFile, options.sha256);
  if (expected !== e.checksum) return err(progressError('backup.checksum'));
  if (typeof e.dbSchemaVersion !== 'number' || !Number.isInteger(e.dbSchemaVersion) || e.dbSchemaVersion < 1)
    return err(progressError('backup.invalid', { field: 'dbSchemaVersion' }));
  if (e.dbSchemaVersion > options.currentSchemaVersion) {
    return err(progressError('backup.schema_newer', { backupVersion: e.dbSchemaVersion, currentVersion: options.currentSchemaVersion }));
  }
  let candidate: unknown = e;
  let migratedFrom: number | undefined;
  if (e.dbSchemaVersion < options.currentSchemaVersion) {
    const data = e['data'];
    if (data === null || typeof data !== 'object') return err(progressError('backup.invalid', { field: 'data' }));
    const migrated = migrateSnapshot(
      { ...(data as Record<string, unknown>), meta: { dbSchemaVersion: e.dbSchemaVersion } },
      e.dbSchemaVersion,
      options.currentSchemaVersion,
      {
        now: options.now,
        ...(options.registry === undefined ? {} : { registry: options.registry }),
      },
    );
    if (!migrated.ok) return migrated;
    const { meta: _meta, snapshots: _snapshots, errors: _errors, ...rest } = migrated.value;
    candidate = { ...e, dbSchemaVersion: options.currentSchemaVersion, data: rest };
    migratedFrom = e.dbSchemaVersion;
  }
  const result = BackupFile.safeParse(candidate);
  if (!result.success) {
    const first = result.error.issues[0];
    return err(progressError('backup.invalid', { field: first === undefined ? '' : first.path.map(String).join('.') }, { issues: result.error.issues }));
  }
  if (byteLength !== undefined && byteLength > maxBytes) return err(progressError('backup.too_large', { bytes: byteLength, max: maxBytes }));
  const backup = result.data;
  const data = backupToProgressData(backup);
  const out: ValidatedBackup = { backup, data, preview: previewOf(data) };
  return ok(migratedFrom === undefined ? out : { ...out, migratedFrom });
}

/** 文字備份碼：LL1: 加上壓縮後的 base64url；超過上限回 backup.code_too_long（畫面建議改用備份檔） */
export async function encodeBackupCode(
  backup: BackupFile,
  deflate: Compress,
  maxLength: number = MAX_BACKUP_CODE_LENGTH,
): Promise<Result<{ readonly code: string; readonly length: number }, ProgressError>> {
  const bytes = utf8Encode(serialiseBackup(backup));
  const compressed = await deflate(bytes);
  const code = `${BACKUP_CODE_PREFIX}${base64urlEncode(compressed)}`;
  if (code.length > maxLength) return err(progressError('backup.code_too_long', { length: code.length, max: maxLength }));
  return ok({ code, length: code.length });
}

/** 解出備份碼裡的 JSON 文字（之後交給 validateBackup）；去掉前後空白與換行，容忍貼上時夾帶的空白 */
export async function decodeBackupCode(code: string, inflate: Compress): Promise<Result<string, ProgressError>> {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(BACKUP_CODE_PREFIX)) return err(progressError('backup.code_prefix'));
  const bytes = base64urlDecode(trimmed.slice(BACKUP_CODE_PREFIX.length));
  if (bytes === undefined || bytes.length === 0) return err(progressError('backup.code_encoding'));
  let inflated: Uint8Array;
  try {
    inflated = await inflate(bytes);
  } catch {
    return err(progressError('backup.code_corrupt'));
  }
  const text = utf8Decode(inflated);
  if (text === undefined) return err(progressError('backup.code_corrupt'));
  return ok(text);
}
