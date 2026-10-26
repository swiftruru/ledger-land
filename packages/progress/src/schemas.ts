// 進度資料模型的 Zod schema 與由它推導的型別（06 第 4.2 節的 object store、03 第 2.10 到 2.11 節、02 第 5.1 節）。Zod 4 是唯一來源，型別由 schema 推導。
// 常數、ID 規則與不需要 zod 的純函式放在 model.ts：儲存 runtime（store、derive、merge、migrations 與 apps/web 的 IndexedDB 實作）只引用 model.ts，
// 對這個檔案一律 `import type`，所以地圖與作答頁開進度資料庫時不必載入 zod（06 第 8.2 節、14 第 5.2 節）。驗證資料的地方（備份匯入、作答工作階段暫存）才 import 這裡的值。
// 判分不在這裡（packages/quiz）；attempts.answer 只存下來、不解讀，形狀依題型見 AttemptAnswerShapes。
import { VersionedId, idSchema } from '@ledgerland/content-schema';
import type { ReviewEntry as QuizReviewEntry, Stars as QuizStars } from '@ledgerland/quiz';
import { z } from 'zod';
import { ATTEMPT_ID_RE, DEVICE_ID_RE, ERROR_STACK_MAX_LENGTH, LOCAL_STEP_ID_RE } from './model.ts';
import { isIsoDateTime, isLocalDate } from './time.ts';

export const DeviceId = z.string().regex(DEVICE_ID_RE, 'deviceId 是 d_ 加 8 碼 Crockford Base32 小寫').meta({ id: 'DeviceId' });
export const AttemptId = z.string().regex(ATTEMPT_ID_RE, 'attemptId 是 a_ 加 Crockford Base32 小寫隨機字串').meta({ id: 'AttemptId' });

/** ISO 8601 時間字串（含 Z 或 ±HH:mm 位移）；本套件不讀時鐘，所有時間都由呼叫端傳入 */
export const IsoDateTime = z.string().refine(isIsoDateTime, '時間要是含時區的 ISO 8601 字串').meta({ id: 'IsoDateTime' });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** JSON 可表示的值（設定與答案都要能存進 IndexedDB 與備份檔） */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
export const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(JsonValue), z.record(z.string(), JsonValue)]),
);

export const AttemptSource = z.enum(['play', 'lab', 'review']);
export type AttemptSource = z.infer<typeof AttemptSource>;

/**
 * attempts.answer 的形狀依題型（06 第 4.2 節；正式型別以 content-schema 與 quiz 為準，本套件只存不解讀）：
 * - single_choice、pick_statement、ratio_interpret、judgment：選中的選項 ID（字串）
 * - multi_choice：選項 ID 陣列；any_correct 只有一個元素，all_correct 依 ID 排序
 * - true_false：布林值，選「對」為 true
 * - pick_line：選中的版面列 ID（字串）
 * - classify：以項目 ID 為鍵、所選分類為值的物件
 * - transaction_effect、five_step_fill：以 target ID 為鍵的物件，方向目標存方向代號、金額目標存數字
 * - ratio_numeric：quiz 的 NumericAnswer（數值，或按下 N/A 的狀態）
 * - journal_entry：quiz 的 EntryLine[][]
 */
export type AttemptAnswer = JsonValue;

/** 作答紀錄：只增不改，是合併的基礎（06 第 4.2 節）。score 是 0 到 1 的得分（03 第 2.10 節的部分分數）；省略時以 correct 推算 */
export const Attempt = z
  .object({
    attemptId: AttemptId,
    questionId: idSchema('question'),
    rev: z.number().int().min(1),
    chapterId: idSchema('chapter').optional(),
    levelId: idSchema('level').optional(),
    answer: JsonValue,
    correct: z.boolean(),
    score: z.number().min(0).max(1).optional(),
    guessed: z.boolean().optional(),
    durationMs: z.number().int().min(0).optional(),
    answeredAt: IsoDateTime,
    deviceId: DeviceId,
    source: AttemptSource,
  })
  .strict();
export type Attempt = z.infer<typeof Attempt>;

/** 星等與 quiz 的 Stars 相同（0 到 3） */
export type Stars = QuizStars;
export const Stars: z.ZodType<Stars> = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

/** 本地日期 YYYY-MM-DD（錯題本的到期日用裝置的本地日期計算，03 第 2.10 節；quiz 的 review 也用這個格式） */
export const LocalDate = z.string().refine(isLocalDate, '日期要是 YYYY-MM-DD').meta({ id: 'LocalDate' });
export type LocalDate = z.infer<typeof LocalDate>;

/** 關卡最佳成績：由 attempts 推導，另存以加速列表（06 第 4.2 節）。firstCompletedAt 省略表示玩過但沒有答完整關 */
export const LevelProgress = z
  .object({
    levelId: idSchema('level'),
    stars: Stars,
    bestScore: z.number().min(0).max(1),
    firstCompletedAt: IsoDateTime.optional(),
    lastPlayedAt: IsoDateTime,
  })
  .strict();
export type LevelProgress = z.infer<typeof LevelProgress>;

export const ReviewResult = z.enum(['correct', 'wrong']);
export type ReviewResult = z.infer<typeof ReviewResult>;
export const ReviewStatus = z.enum(['active', 'mastered', 'question_updated']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;
export const ReviewBox = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type ReviewBox = z.infer<typeof ReviewBox>;
export const ReviewAddedBy = z.enum(['auto', 'guessed']);
export const RevisionKind = z.enum(['text', 'answer']);

/** 錯題本與簡易間隔複習（06 第 4.2 節）：欄位與 quiz 的 ReviewEntry 相同，盒子規則與排程在 quiz；dueAt 是本地日期（byDue 索引用） */
export const ReviewQueueEntry = z
  .object({
    questionId: idSchema('question'),
    rev: z.number().int().min(1),
    lastResult: ReviewResult,
    lastAnsweredAt: IsoDateTime,
    box: ReviewBox,
    dueAt: LocalDate,
    wrongCount: z.number().int().min(0),
    status: ReviewStatus,
    addedBy: ReviewAddedBy,
    updateKind: RevisionKind.optional(),
  })
  .strict();
export type ReviewQueueEntry = z.infer<typeof ReviewQueueEntry>;
// 編譯期檢查：儲存的錯題本紀錄可以直接交給 quiz 的 nextReview、dueToday，反過來 quiz 產生的紀錄也能直接存
const _reviewToQuiz: QuizReviewEntry = null as unknown as ReviewQueueEntry;
const _quizToReview: ReviewQueueEntry = null as unknown as QuizReviewEntry;
void _reviewToQuiz;
void _quizToReview;

export const UnlockKind = z.enum(['term', 'badge']);
export type UnlockKind = z.infer<typeof UnlockKind>;

/** 名詞圖鑑與徽章：id 是 term:<名詞 ID> 或 badge:<徽章 ID> */
export const Unlock = z
  .object({
    id: z.string().regex(/^(term|badge):[A-Za-z0-9_.:-]+$/, 'unlock 的 id 是 term: 或 badge: 加上 ID'),
    kind: UnlockKind,
    unlockedAt: IsoDateTime,
  })
  .strict()
  .refine((u) => u.id.startsWith(`${u.kind}:`), 'unlock 的 kind 要和 id 的前綴一致');
export type Unlock = z.infer<typeof Unlock>;

/** 故事模式的進度（06 第 4.2 節） */
export const LabState = z.object({ storyId: idSchema('story'), stepId: idSchema('step'), updatedAt: IsoDateTime }).strict();
export type LabState = z.infer<typeof LabState>;

/** 自由實驗的狀態，形狀同 03 第 3.7 節的範例：只存修改，不存報表 */
export const LocalStepId = z.string().regex(LOCAL_STEP_ID_RE, '新增的步驟用 local_ 加流水號');
const StepRef = z.union([idSchema('step'), LocalStepId]);
export const SandboxOverride = z
  .object({ stepId: StepRef, eventId: z.string().regex(/^e[1-9]\d*$/), param: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/), value: z.number().finite() })
  .strict();
export type SandboxOverride = z.infer<typeof SandboxOverride>;
export const SandboxEvent = z
  .object({ id: z.string().regex(/^e[1-9]\d*$/), template: z.string().regex(/^tpl\.[a-z][a-z0-9_]*$/), params: z.record(z.string(), z.number().finite()) })
  .strict();
export const SandboxInsertedStep = z.object({ id: LocalStepId, after: StepRef, events: z.array(SandboxEvent).min(1) }).strict();
export const LabSandbox = z
  .object({
    id: z.string().min(1),
    basedOn: z.object({ story: idSchema('story'), storyRev: z.number().int().min(1), throughStep: idSchema('step') }).strict(),
    policy: VersionedId,
    layout: VersionedId,
    overrides: z.array(SandboxOverride),
    inserted: z.array(SandboxInsertedStep),
    removed: z.array(StepRef),
    updatedAt: IsoDateTime,
  })
  .strict();
export type LabSandbox = z.infer<typeof LabSandbox>;

/** 設定（06 第 4.2 節）：key 加 value 加 updatedAt；納入備份但預設不匯入（4.6） */
export const SettingEntry = z.object({ key: z.string().min(1), value: JsonValue, updatedAt: IsoDateTime }).strict();
export type SettingEntry = z.infer<typeof SettingEntry>;

/** 已知的設定鍵與各自的值 schema（其他鍵也允許，由畫面自行解讀） */
export const LabView = z
  .object({
    policy: VersionedId,
    window: z.enum(['cumulative', 'transaction']),
    statement: z.enum(['is', 'bs', 'cf']),
    journalLayerOpen: z.boolean(),
  })
  .strict();
export type LabView = z.infer<typeof LabView>;
export const PersistResult = z
  .object({ granted: z.boolean(), trigger: z.enum(['launch', 'first-level-complete', 'settings-button']), at: IsoDateTime })
  .strict();
export type PersistResult = z.infer<typeof PersistResult>;
/** 備份提醒的狀態（06 第 4.5 節）：完成幾關還沒匯出、上次匯出與上次提醒的時間 */
export const BackupReminderState = z
  .object({ levelsCompletedSinceExport: z.number().int().min(0), lastExportedAt: IsoDateTime.optional(), lastRemindedAt: IsoDateTime.optional() })
  .strict();
export type BackupReminderState = z.infer<typeof BackupReminderState>;

export const SETTING_SCHEMAS = {
  locale: z.string().min(2),
  timerEnabled: z.boolean(),
  labView: LabView,
  persistResult: PersistResult,
  backupReminder: BackupReminderState,
} as const;
export type SettingKey = keyof typeof SETTING_SCHEMAS;

/** 錯誤紀錄（06 第 4.2 節與第 9 節）：環狀保留最近 50 筆，由儲存實作負責 */
export const ErrorRecord = z
  .object({
    at: IsoDateTime,
    route: z.string(),
    message: z.string(),
    stack: z.string().max(ERROR_STACK_MAX_LENGTH).optional(),
    appVersion: z.string(),
    contentVersion: z.number().int().min(0),
  })
  .strict();
export type ErrorRecord = z.infer<typeof ErrorRecord>;

/** migration 轉換資料前存的舊資料（06 第 4.2 節）：保留到下一個 schema 版本 */
export const SnapshotRecord = z.object({ fromVersion: z.number().int().min(1), createdAt: IsoDateTime, payload: JsonValue }).strict();
export type SnapshotRecord = z.infer<typeof SnapshotRecord>;

export const ImportMode = z.enum(['merge', 'replace']);
export type ImportMode = z.infer<typeof ImportMode>;
/** 備份來源的執行環境（06 第 4.6 節 origin 與 mode 用來辨識來源） */
export const BackupMode = z.enum(['browser', 'app', 'in-app-browser']);
export type BackupMode = z.infer<typeof BackupMode>;

export const ImportHistoryEntry = z
  .object({
    importedAt: IsoDateTime,
    mode: ImportMode,
    sourceDeviceId: DeviceId,
    sourceOrigin: z.string().optional(),
    sourceMode: BackupMode.optional(),
    exportedAt: IsoDateTime.optional(),
    attempts: z.number().int().min(0),
  })
  .strict();
export type ImportHistoryEntry = z.infer<typeof ImportHistoryEntry>;

export const Meta = z
  .object({
    deviceId: DeviceId,
    createdAt: IsoDateTime,
    dbSchemaVersion: z.number().int().min(1),
    appVersion: z.string(),
    contentVersion: z.number().int().min(0),
    importHistory: z.array(ImportHistoryEntry),
  })
  .strict();
export type Meta = z.infer<typeof Meta>;

/** 會被合併與備份的學習資料（不含 meta、errors、snapshots） */
export const ProgressData = z
  .object({
    attempts: z.array(Attempt),
    levelProgress: z.array(LevelProgress),
    reviewQueue: z.array(ReviewQueueEntry),
    unlocks: z.array(Unlock),
    labState: z.array(LabState),
    labSandbox: z.array(LabSandbox),
    settings: z.array(SettingEntry),
  })
  .strict();
export type ProgressData = z.infer<typeof ProgressData>;

/** 整個資料庫在記憶體中的快照：exportAll 的輸出、migration 與合併的輸入 */
export const ProgressSnapshot = ProgressData.extend({
  meta: Meta,
  errors: z.array(ErrorRecord),
  snapshots: z.array(SnapshotRecord),
}).strict();
export type ProgressSnapshot = z.infer<typeof ProgressSnapshot>;
