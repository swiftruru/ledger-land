// 「我的 › 備份」（站規 2.10、06 第 4.5、4.6 節；路由 /me/backup/，noindex）：TopBar 返回「我的」；狀態卡（上次匯出、統計、保護進度與用量）、
// 匯出卡（主按鈕「匯出備份檔」、次要「複製備份碼」）、匯入卡（「選擇備份檔」按鈕代替瀏覽器的檔案欄位、備份碼文字框與「檢查備份碼」）。
// 匯入先驗證（packages/progress 的 validateBackup）並顯示預覽卡（含收藏數），確認後才寫入；預設合併，「覆蓋現有進度」在進階選項裡，
// 是 danger 按鈕，按下先開確認面板，確認後先自動匯出一份目前的進度、匯出沒有完成就不覆蓋（06 第 4.6 節）。
// 錯誤只有一種紅色（站規 1.2.4）：備份碼的錯誤在文字框下方（框變紅），檔案的錯誤在「選擇備份檔」下方，同樣的圖示與顏色。所有文字欄位當純文字顯示。
// 第 5 輪看圖驗收：「附上錯誤紀錄」的用途移到開關的說明行；三個統計膠囊和玩家卡同一套排法（me.css）。
// 統計（作答、關卡、徽章、上次匯出、用量）與保留許可的現況讀齊才經 usePageReady 回報、整頁一次出現（維護者 2026-10-26）；
// 讀到之前整頁看不見，所以膠囊沒有「…」、上次匯出沒有骨架。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { formatDate, formatNumber, localePath } from '@ledgerland/i18n';
import { markExportedToApp } from '../features/install/exported.ts';
import {
  DB_SCHEMA_VERSION,
  MAX_BACKUP_CODE_LENGTH,
  backupFileName,
  buildBackup,
  decodeBackupCode,
  encodeBackupCode,
  serialiseBackup,
  validateBackup,
  type BackupFile,
  type BackupMode,
  type BackupReminderState,
  type ProgressErrorCode,
  type ValidatedBackup,
} from '@ledgerland/progress';
import {
  Badge,
  Button,
  Card,
  CheckCircleIcon,
  ConfirmSheet,
  DeviceIcon,
  Disclosure,
  ExportIcon,
  FieldError,
  FileIcon,
  SearchIcon,
  StarIcon,
  StatChip,
  Switch,
  TopBar,
  TrashIcon,
} from '@ledgerland/web-ui';
import { CopyIcon, MedalIcon } from '@ledgerland/web-ui/map';
import { readBackupStats, type BackupStats } from '../features/me/progress-reads.ts';
import { environmentKind } from '../lib/env.ts';
import { appVersion, getContentVersion, nowIso, todayLocal } from '../lib/progress/app-info.ts';
import { deflateRaw, hasCompressionStream, inflateRaw, sha256 } from '../lib/progress/codec.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { refreshPersisted } from '../lib/progress/persist.ts';
import { useStorageStatus } from '../lib/progress/status.ts';
import { usePageReady, useRevealed } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/me.css';

function backupMode(): BackupMode {
  const kind = environmentKind();
  return kind === 'app' ? 'app' : kind === 'in-app-browser' ? 'in-app-browser' : 'browser';
}

/** 已達成、但還沒寫進進度的章節徽章先補寫（03 第 2.10 節；features/badges/award.ts），統計與匯出檔才會帶著它們。
 *  只在打開備份頁讀統計時做（refresh）；按下匯出時不再多等，分享表單要在使用者手勢後盡快呼叫 */
async function reconcileBadges(locale: 'zh-TW' | 'en'): Promise<void> {
  await import('../features/badges/award.ts').then(({ awardChapterBadges }) => awardChapterBadges(locale)).catch(() => undefined);
}

async function buildCurrentBackup(includeErrors: boolean): Promise<BackupFile> {
  const store = await getProgressStore();
  const snapshot = await store.exportAll();
  return buildBackup(
    snapshot,
    { app: { version: appVersion(), contentVersion: getContentVersion() }, origin: location.origin, mode: backupMode(), exportedAt: nowIso(), includeErrors },
    sha256,
  );
}

async function markExported(): Promise<void> {
  const store = await getProgressStore();
  const now = nowIso();
  const prev = (await store.getSetting('backupReminder'))?.value as BackupReminderState | undefined;
  const next: BackupReminderState = { ...(prev ?? { levelsCompletedSinceExport: 0 }), levelsCompletedSinceExport: 0, lastExportedAt: now };
  await store.setSetting('backupReminder', next, now);
}

type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

async function saveFile(text: string, name: string): Promise<SaveOutcome> {
  const blob = new Blob([text], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // 分享失敗就改用下載
    }
  }
  // 程式產生的下載連結（站規 2.10、4.1 的例外清單、R9）：不插進 DOM，直接 click()（目前的 Chromium、Firefox、Safari 都支援分離的連結下載）
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

function dateOf(iso: string, locale: 'zh-TW' | 'en'): string {
  return formatDate(iso.slice(0, 10), locale, 'medium');
}

type Notice = { readonly kind: 'ok' | 'error'; readonly text: string };
type ImportError = { readonly source: 'file' | 'code'; readonly text: string };

export default function Backup() {
  const locale = useLocale();
  const { t } = useLingui();
  const [params] = useSearchParams();
  const location = useLocation();
  const status = useStorageStatus();
  const [stats, setStats] = useState<BackupStats | null>(null);
  // navigator.storage.persisted() 問過一次了（status.persisted 才是現況，不然「保護進度」那一行會在頁面出現後才換字）
  const [persistChecked, setPersistChecked] = useState(false);
  const [includeErrors, setIncludeErrors] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<Notice | null>(null);
  const [pasted, setPasted] = useState('');
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [validated, setValidated] = useState<ValidatedBackup | null>(null);
  const [applySettings, setApplySettings] = useState(false);
  const [importNotice, setImportNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<null | 'file' | 'code' | 'check' | 'pick' | 'merge' | 'replace'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const codeInput = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const replaceTrigger = useRef<HTMLElement | null>(null);
  const uid = useId();
  const ids = {
    fileButton: `${uid}-file`,
    fileError: `${uid}-file-error`,
    codeLabel: `${uid}-code-label`,
    codeError: `${uid}-code-error`,
    exportError: `${uid}-export-error`,
    outLabel: `${uid}-out-label`,
  };

  const refresh = useCallback(async () => {
    await reconcileBadges(locale);
    setStats(await readBackupStats(await getProgressStore()));
  }, [locale]);

  useEffect(() => {
    void refresh();
    let alive = true;
    void refreshPersisted().finally(() => alive && setPersistChecked(true));
    return () => {
      alive = false;
    };
  }, [refresh]);
  usePageReady(stats !== null && persistChecked);
  const revealed = useRevealed();
  // 「匯出到 App」捷徑（Safari 分頁提示、安裝建議、安裝教學第 0 步）帶 ?to=app 進來：最上面多一張「把進度搬到主畫面的 App」的三步引導卡
  // （維護者 2026-10-27 實機回饋：按了只是換頁、再按沒反應，而且備份檔在 iOS 的分享表單裡找不到主畫面的 App，搬進度只能靠備份碼）。
  // 焦點移到卡的標題；布幕掀開時換頁的焦點會先移到 h1（PageReveal 在 requestAnimationFrame 裡做），所以排到再下一個影格；
  // 已經在備份頁再按一次捷徑（react-router 的同路徑導覽，location.key 會換）也會再捲、再移焦點
  const toApp = params.get('to') === 'app';
  const toAppJump = toApp ? location.key : null;
  useEffect(() => {
    if (toAppJump === null || !revealed) return;
    let id = 0;
    const run = () => {
      const heading = document.getElementById('ll-backup-toapp');
      if (!heading) return;
      const reduced = document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      heading.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      heading.focus({ preventScroll: true });
    };
    id = requestAnimationFrame(() => {
      id = requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(id);
  }, [toAppJump, revealed]);

  // 匯入提示卡（ImportPromptCard）帶 ?import=code 或 ?import=file 進來：焦點放到對應的欄位或按鈕。
  // 等布幕真的掀開（useRevealed）才移：隱形的元素拿不到焦點，自己回報齊了的那一次 commit 畫面還沒換
  useEffect(() => {
    if (!revealed) return;
    const target = params.get('import');
    if (target === 'code') codeInput.current?.focus();
    else if (target === 'file') document.getElementById(ids.fileButton)?.focus();
  }, [params, ids.fileButton, revealed]);

  // 預覽出現時把預覽卡捲到畫面上緣、焦點移到它的標題（螢幕閱讀器知道下一步在哪裡；畫面上同時只看得到一顆主按鈕「合併匯入」）
  useEffect(() => {
    const h = previewHeading.current;
    if (!validated || !h) return;
    h.closest('section')?.scrollIntoView({ block: 'start' });
    h.focus({ preventScroll: true });
  }, [validated]);

  const errorText = (c: ProgressErrorCode): string => {
    switch (c) {
      case 'backup.schema_newer':
        return t({ id: 'backup.error.newer', message: '這份備份的版本比網站新，請先更新網站再匯入。' });
      case 'backup.checksum':
      case 'backup.too_large':
      case 'backup.code_corrupt':
      case 'backup.code_encoding':
        return t({ id: 'backup.error.incomplete', message: '檔案不完整，請重新選擇或重新貼上。' });
      case 'backup.code_prefix':
        return t({ id: 'backup.error.notCode', message: '這不是 LedgerLand 的備份碼。' });
      case 'backup.code_too_long':
        return t({ id: 'backup.error.codeTooLong', message: '備份碼太長，請改用備份檔。' });
      case 'migration.backwards':
      case 'migration.unknown_version':
      case 'migration.failed':
        return t({ id: 'backup.error.migration', message: '這份備份無法轉成目前的版本，請先更新網站再試一次。' });
      default:
        return t({ id: 'backup.error.format', message: '格式不是 LedgerLand 備份。' });
    }
  };
  const exportFailed = () => t({ id: 'backup.export.failed', message: '匯出失敗，請再試一次。' });

  const exportFile = async () => {
    if (busy) return;
    setBusy('file');
    setExportNotice(null);
    try {
      const backup = await buildCurrentBackup(includeErrors);
      const outcome = await saveFile(serialiseBackup(backup), backupFileName(todayLocal().replaceAll('-', '')));
      if (outcome !== 'cancelled') {
        await markExported();
        markExportedToApp();
        await refresh();
        setExportNotice({
          kind: 'ok',
          text:
            outcome === 'shared'
              ? t({ id: 'backup.export.shared', message: '已交給分享表單。' })
              : t({ id: 'backup.export.downloaded', message: '備份檔已開始下載。' }),
        });
      }
    } catch {
      setExportNotice({ kind: 'error', text: exportFailed() });
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (busy) return;
    setBusy('code');
    setExportNotice(null);
    try {
      const backup = await buildCurrentBackup(includeErrors);
      const encoded = await encodeBackupCode(backup, deflateRaw);
      if (!encoded.ok) {
        setCode(null);
        setExportNotice({ kind: 'error', text: errorText(encoded.error.code) });
        return;
      }
      setCode(encoded.value.code);
      let copied = false;
      try {
        await navigator.clipboard.writeText(encoded.value.code);
        copied = true;
      } catch {
        copied = false;
      }
      await markExported();
      markExportedToApp();
      await refresh();
      setExportNotice({
        kind: 'ok',
        text: copied
          ? t({ id: 'backup.code.copied', message: '備份碼已複製，貼到另一台裝置或 App 的「貼上備份碼」就能匯入。' })
          : t({ id: 'backup.code.copyFailed', message: '無法自動複製，請自己選取下方的備份碼。' }),
      });
    } catch {
      setExportNotice({ kind: 'error', text: exportFailed() });
    } finally {
      setBusy(null);
    }
  };

  const validateText = async (text: string, source: ImportError['source']) => {
    setImportError(null);
    setValidated(null);
    setImportNotice(null);
    const result = await validateBackup(text, { currentSchemaVersion: DB_SCHEMA_VERSION, sha256, now: nowIso() });
    if (!result.ok) {
      setImportError({ source, text: errorText(result.error.code) });
      return;
    }
    setApplySettings(false);
    setValidated(result.value);
  };

  const checkCode = async () => {
    if (busy) return;
    setBusy('check');
    try {
      const decoded = await decodeBackupCode(pasted, inflateRaw);
      if (!decoded.ok) {
        setValidated(null);
        setImportNotice(null);
        setImportError({ source: 'code', text: errorText(decoded.error.code) });
        return;
      }
      await validateText(decoded.value, 'code');
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (file === undefined) return;
    setBusy('pick');
    try {
      await validateText(await file.text(), 'file');
    } catch {
      setImportError({ source: 'file', text: t({ id: 'backup.error.incomplete', message: '檔案不完整，請重新選擇或重新貼上。' }) });
    } finally {
      setBusy(null);
      // 同一個檔案可以再選一次
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const writeImport = async (mode: 'merge' | 'replace') => {
    if (validated === null) return;
    const store = await getProgressStore();
    const b = validated.backup;
    await store.importAll(validated.data, {
      mode,
      settings: applySettings,
      importedAt: nowIso(),
      source: { deviceId: b.deviceId, origin: b.origin, mode: b.mode, exportedAt: b.exportedAt },
    });
    setValidated(null);
    setPasted('');
    setImportNotice({
      kind: 'ok',
      text:
        mode === 'replace'
          ? t({ id: 'backup.import.replaced', message: '已覆蓋為備份裡的進度。' })
          : t({ id: 'backup.import.merged', message: '已合併，兩邊的紀錄都保留。' }),
    });
    await refresh();
  };

  const doMerge = async () => {
    if (busy) return;
    setBusy('merge');
    try {
      await writeImport('merge');
    } catch {
      setImportNotice({ kind: 'error', text: t({ id: 'backup.import.failed', message: '寫入失敗，請重新整理後再試一次。' }) });
    } finally {
      setBusy(null);
    }
  };

  // 覆蓋：先自動匯出一份目前的進度（06 第 4.6 節），匯出沒有完成（例如分享表單被取消）就不覆蓋
  const doReplace = async () => {
    if (busy) return;
    setBusy('replace');
    try {
      const current = await buildCurrentBackup(false);
      const outcome = await saveFile(serialiseBackup(current), backupFileName(todayLocal().replaceAll('-', '')));
      if (outcome === 'cancelled') {
        setConfirmOpen(false);
        setImportNotice({
          kind: 'error',
          text: t({ id: 'backup.replace.cancelled', message: '目前的進度沒有匯出，所以沒有覆蓋。', comment: '覆蓋前的自動匯出被取消（例如關掉分享表單）' }),
        });
        return;
      }
      await writeImport('replace');
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
      setImportNotice({ kind: 'error', text: t({ id: 'backup.import.failed', message: '寫入失敗，請重新整理後再試一次。' }) });
    } finally {
      setBusy(null);
    }
  };

  const fmt = (n: number) => formatNumber(n, locale);
  // 狀態卡的三個統計膠囊：讀到之前整頁看不見，先用 0 排版面
  const attempts = fmt(stats?.attempts ?? 0);
  const levels = fmt(stats?.levels ?? 0);
  const badges = fmt(stats?.badges ?? 0);
  const usageKb = stats?.usageBytes === null || stats?.usageBytes === undefined ? null : fmt(Math.round(stats.usageBytes / 1024));
  const previewAttempts = fmt(validated?.preview.attempts ?? 0);
  const previewLevels = fmt(validated?.preview.levels ?? 0);
  const previewBadges = fmt(validated?.preview.badges ?? 0);
  const previewFavourites = fmt(validated?.preview.favourites ?? 0);
  const triggerLabel =
    stats?.persistResult === null || stats?.persistResult === undefined
      ? null
      : stats.persistResult.trigger === 'launch'
        ? t({ id: 'backup.status.trigger.launch', message: '啟動時詢問' })
        : stats.persistResult.trigger === 'first-level-complete'
          ? t({ id: 'backup.status.trigger.level', message: '完成第一關時詢問' })
          : t({ id: 'backup.status.trigger.button', message: '在設定頁按下' });
  const persistDate = stats?.persistResult ? dateOf(stats.persistResult.at, locale) : null;
  const sourceLabel =
    validated === null
      ? ''
      : validated.backup.mode === 'app'
        ? t({ id: 'backup.mode.app', message: '主畫面 App' })
        : validated.backup.mode === 'in-app-browser'
          ? t({ id: 'backup.mode.inApp', message: 'App 內建瀏覽器' })
          : t({ id: 'backup.mode.browser', message: '瀏覽器分頁' });
  const sourceDate = validated === null ? '' : dateOf(validated.backup.exportedAt, locale);
  const canCode = hasCompressionStream();
  const codeError = importError?.source === 'code' ? importError.text : null;
  const fileError = importError?.source === 'file' ? importError.text : null;

  // 複製的結果與備份碼：在匯出卡裡；帶 ?to=app 進來時改放在引導卡裡（使用者的眼睛在那裡）
  const exportResult = (
    <>
      <div role="status" className="ll-backup__status" data-testid="export-message">
        {exportNotice?.kind === 'ok' && (
          <p className="ll-backup__ok">
            <CheckCircleIcon size={16} />
            <span>{exportNotice.text}</span>
          </p>
        )}
        {exportNotice?.kind === 'error' && <FieldError id={ids.exportError}>{exportNotice.text}</FieldError>}
      </div>
      {code !== null && (
        <div className="ll-backup__field">
          <label className="ll-backup__label" id={ids.outLabel} htmlFor={`${uid}-out`}>
            <Trans id="backup.code.label">備份碼</Trans>
          </label>
          <textarea
            id={`${uid}-out`}
            className="ll-input ll-backup__code"
            readOnly
            value={code}
            rows={4}
            data-testid="backup-code"
            onFocus={(e) => {
              const el = e.currentTarget;
              el.select();
              // 聚焦時全選會讓 Chrome 略過聚焦本身的捲動（E2E 量到：375 寬時框停在 Tab bar 後面）；自己捲進 scroll-padding 以內
              el.scrollIntoView({ block: 'nearest' });
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="ll-backup">
      <TopBar
        title={t({ id: 'backup.title', message: '備份' })}
        backHref={localePath(locale, '/me/')}
        backLabel={t({ id: 'me.back', message: '回到我的', comment: '子頁返回「我的」的可讀名稱（必須包含短字「我的」）' })}
        backShortLabel={t({ id: 'me.back.short', message: '我的', comment: '子頁返回「我的」在畫面上的短字' })}
      />
      <p className="ll-backup__intro">
        {t({ id: 'backup.intro', message: '進度只存在這台裝置。換裝置、重灌，或把 Safari 的進度搬進主畫面 App 時，用備份檔或備份碼轉移。' })}
      </p>

      {/* 狀態卡（第 3 輪看圖驗收）：標題和其他卡片同一種 title-3；學習紀錄改成三個統計膠囊（和玩家卡同一種語言，膠囊下面一行短標籤），
          其餘三項是兩欄的清單（標籤 footnote、值 body 600） */}
      {toApp && (
        <Card as="section" aria-labelledby="ll-backup-toapp" className="ll-backup__card ll-backup__toapp" data-testid="backup-to-app">
          <h2 id="ll-backup-toapp" className="ll-backup__title" tabIndex={-1}>
            <Trans id="backup.toApp.title" comment="帶 ?to=app 進備份頁時最上面那張引導卡的標題">
              把進度搬到主畫面的 App
            </Trans>
          </h2>
          <p className="ll-backup__note">
            <Trans id="backup.toApp.intro" comment="引導卡的說明：Safari 分頁與主畫面 App 不共享進度">
              Safari 分頁和主畫面的 App 各存各的進度，搬過去只有這一條路：
            </Trans>
          </p>
          <ol className="ll-backup__steps">
            <li>
              <p>
                <Trans id="backup.toApp.step1" comment="引導卡第一步">
                  先複製備份碼。
                </Trans>
              </p>
              <Button
                icon={<CopyIcon />}
                busy={busy === 'code'}
                disabled={!canCode || (busy !== null && busy !== 'code')}
                onClick={() => void copyCode()}
                data-testid="to-app-copy"
              >
                <Trans id="backup.export.code">複製備份碼</Trans>
              </Button>
              {!canCode && (
                <p className="ll-backup__note">
                  <Trans id="backup.export.codeUnsupported" comment="瀏覽器不支援壓縮（備份碼要壓縮），「複製備份碼」停用時的說明">
                    這個瀏覽器不支援備份碼，請改用備份檔。
                  </Trans>
                </p>
              )}
              {exportResult}
            </li>
            <li>
              <p>
                <Trans id="backup.toApp.step2" comment="引導卡第二步">
                  打開主畫面的會計樂園。
                </Trans>
              </p>
              {/* 匯出成功後升成 secondary、帶 ?step=2：安裝教學把第 1 步畫成已完成、焦點接到第 2 步（2026-10-28 維護者實機回饋：
                  按了教學第 1 步的「匯出到 App」就離開教學頁，回來要接得上） */}
              <Button
                variant={exportNotice?.kind === 'ok' ? 'secondary' : 'quiet'}
                size="sm"
                icon={<DeviceIcon />}
                href={localePath(locale, '/install/') + (exportNotice?.kind === 'ok' ? '?step=2' : '')}
                data-testid="to-app-install"
              >
                <Trans id="backup.toApp.install" comment="引導卡第二步：還沒加入主畫面的人連到安裝教學">
                  還沒加入主畫面？看安裝教學
                </Trans>
              </Button>
            </li>
            <li>
              <p>
                <Trans id="backup.toApp.step3" comment="引導卡第三步">
                  App 第一次打開會問要不要匯入，貼上備份碼就會和那裡的紀錄合併；已經打開過的話，到 App 的「我的 › 備份 › 貼上備份碼」。
                </Trans>
              </p>
            </li>
          </ol>
        </Card>
      )}
      <Card as="section" aria-labelledby="ll-backup-status" className="ll-backup__card">
        <h2 id="ll-backup-status" className="ll-backup__title">
          <Trans id="backup.status.title">這台裝置</Trans>
        </h2>
        <ul
          className="ll-backup__stats"
          aria-label={t({ id: 'backup.status.records', message: '學習紀錄', comment: '備份頁狀態卡：這台裝置上的學習紀錄數（三個統計膠囊的清單名稱）' })}
          data-testid="backup-stats"
        >
          <li className="ll-backup__stat">
            <StatChip
              icon={<CheckCircleIcon />}
              value={attempts}
              label={t({
                id: 'backup.stat.attempts',
                message: `${attempts} 筆作答紀錄`,
                comment: '備份頁狀態卡的作答紀錄數；attempts 已格式化',
              })}
              data-testid="backup-stat-attempts"
              className="ll-backup__chip"
            />
            <span className="ll-backup__cap" aria-hidden="true">
              {t({ id: 'backup.stat.attempts.cap', message: '作答紀錄', comment: '備份頁作答紀錄膠囊下面的短標籤' })}
            </span>
          </li>
          <li className="ll-backup__stat">
            <StatChip
              icon={<StarIcon filled />}
              tone="star"
              value={levels}
              label={t({
                id: 'backup.stat.levels',
                message: `${levels} 個有星星的關卡`,
                comment: '備份頁狀態卡：拿到星星的關卡數；levels 已格式化',
              })}
              data-testid="backup-stat-levels"
              className="ll-backup__chip"
            />
            <span className="ll-backup__cap" aria-hidden="true">
              {t({ id: 'backup.stat.levels.cap', message: '有星星的關卡', comment: '備份頁關卡膠囊下面的短標籤（數字是拿到星星的關卡數，不是星星總數）' })}
            </span>
          </li>
          <li className="ll-backup__stat">
            <StatChip
              icon={<MedalIcon />}
              tone="badge"
              value={badges}
              label={t({ id: 'backup.stat.badges', message: `${badges} 個徽章`, comment: '備份頁狀態卡的徽章數；badges 已格式化' })}
              data-testid="backup-stat-badges"
              className="ll-backup__chip"
            />
            <span className="ll-backup__cap" aria-hidden="true">
              {t({ id: 'backup.stat.badges.cap', message: '徽章', comment: '備份頁徽章膠囊下面的短標籤' })}
            </span>
          </li>
        </ul>
        <dl className="ll-backup__dl">
          <dt>
            <Trans id="backup.status.lastExport">上次匯出</Trans>
          </dt>
          <dd>
            {stats?.lastExportedAt ? (
              <span className="ll-num">{dateOf(stats.lastExportedAt, locale)}</span>
            ) : (
              <Badge kind="warning">{t({ id: 'me.backup.never', message: '還沒備份', comment: '「我的」備份列右側與備份頁：從來沒有匯出過' })}</Badge>
            )}
          </dd>
          <dt>
            <Trans id="backup.status.persist">保護進度</Trans>
          </dt>
          <dd>
            {status.persisted === true
              ? t({ id: 'backup.status.persisted', message: '瀏覽器已同意保留' })
              : status.persisted === false
                ? t({ id: 'backup.status.notPersisted', message: '尚未取得保留許可' })
                : t({ id: 'backup.status.persistUnknown', message: '這個瀏覽器無法查詢' })}
            {triggerLabel !== null && persistDate !== null && (
              <span className="ll-backup__aside">
                {' '}
                <Trans id="backup.status.persistDetail" comment="triggerLabel 是觸發來源的文字，persistDate 是已格式化的日期">
                  （{triggerLabel}，{persistDate}）
                </Trans>
              </span>
            )}
          </dd>
          {usageKb !== null && (
            <>
              <dt>
                <Trans id="backup.status.usage" comment="備份頁狀態卡的欄位標籤，後面是 KB 數（保持短字：320 寬時標籤欄太寬會把日期擠成兩行）">
                  已用空間
                </Trans>
              </dt>
              <dd className="ll-num">
                <Trans id="backup.status.usageValue" comment="usageKb 是已格式化的 KB 數字">
                  {usageKb} KB
                </Trans>
              </dd>
            </>
          )}
        </dl>
      </Card>

      <Card as="section" aria-labelledby="ll-backup-export" className="ll-backup__card">
        <h2 id="ll-backup-export" className="ll-backup__title">
          <Trans id="backup.export.title">匯出</Trans>
        </h2>
        <div className="ll-backup__actions">
          {/* 有預覽卡時它的「合併匯入」是這一步唯一的主按鈕，匯出降成 secondary（第 1 輪看圖驗收） */}
          <Button
            variant={validated === null ? 'primary' : 'secondary'}
            block
            icon={<ExportIcon />}
            busy={busy === 'file'}
            disabled={busy !== null && busy !== 'file'}
            onClick={() => void exportFile()}
          >
            <Trans id="backup.export.fileButton" comment="備份頁的主按鈕：存成備份檔（手機上交給分享表單）">
              存成備份檔
            </Trans>
          </Button>
          <Button block icon={<CopyIcon />} busy={busy === 'code'} disabled={!canCode || (busy !== null && busy !== 'code')} onClick={() => void copyCode()}>
            <Trans id="backup.export.code">複製備份碼</Trans>
          </Button>
        </div>
        {!canCode && (
          <p className="ll-backup__note">
            <Trans id="backup.export.codeUnsupported" comment="瀏覽器不支援壓縮（備份碼要壓縮），「複製備份碼」停用時的說明">
              這個瀏覽器不支援備份碼，請改用備份檔。
            </Trans>
          </p>
        )}
        <p className="ll-backup__note">
          <Trans
            id="backup.export.fileNote"
            comment="匯出卡裡兩顆按鈕下面的說明：備份檔與備份碼各自的用途（維護者 2026-10-27：iOS 的分享表單找不到主畫面的 App）"
          >
            備份檔可以存到「檔案」或 AirDrop 到別台裝置；要搬進主畫面的 App，請用備份碼。
          </Trans>
        </p>
        <Switch
          checked={includeErrors}
          onChange={setIncludeErrors}
          label={t({ id: 'backup.export.includeErrors', message: '附上錯誤紀錄', comment: '匯出卡的開關標籤（用途寫在下面的說明行）' })}
          description={t({ id: 'backup.export.includeErrorsDesc', message: '只用於回報問題。', comment: '「附上錯誤紀錄」開關的說明' })}
          className="ll-backup__switch"
        />
        {!toApp && exportResult}
      </Card>

      <Card as="section" aria-labelledby="ll-backup-import" className="ll-backup__card">
        <h2 id="ll-backup-import" className="ll-backup__title">
          <Trans id="backup.import.title">匯入</Trans>
        </h2>
        {/* 第 6 輪看圖驗收：冒號後面一句縮到 20 個字（「作答紀錄都保留、星星取最高、徽章不會少。」）；2026-10-27 起照全站規則逐字換行 */}
        <p className="ll-backup__hint">
          <Trans id="backup.import.hint" comment="匯入卡的說明。冒號後面一句保持 20 個字以內">
            預設會和這台裝置的紀錄合併：作答紀錄都保留、星星取最高、徽章不會少。
          </Trans>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          tabIndex={-1}
          aria-hidden="true"
          data-testid="import-file"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
        <Button
          id={ids.fileButton}
          block
          icon={<FileIcon />}
          busy={busy === 'pick'}
          disabled={busy !== null && busy !== 'pick'}
          aria-describedby={fileError ? ids.fileError : undefined}
          onClick={() => fileInput.current?.click()}
        >
          <Trans id="backup.import.file">選擇備份檔</Trans>
        </Button>
        {fileError && (
          <div data-testid="import-error-file">
            <FieldError id={ids.fileError}>{fileError}</FieldError>
          </div>
        )}
        <div className="ll-backup__field">
          <label className="ll-backup__label" id={ids.codeLabel} htmlFor={`${uid}-code`}>
            <Trans id="backup.import.code">貼上備份碼</Trans>
          </label>
          <textarea
            id={`${uid}-code`}
            ref={codeInput}
            className="ll-input ll-backup__code"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={codeError ? 'true' : undefined}
            aria-describedby={codeError ? ids.codeError : undefined}
            data-testid="paste-code"
          />
          {codeError && (
            <FieldError id={ids.codeError} className="ll-backup__error">
              <span data-testid="import-error">{codeError}</span>
            </FieldError>
          )}
          {pasted.length > MAX_BACKUP_CODE_LENGTH && (
            <p className="ll-backup__note">
              <Trans id="backup.import.codeLong">備份碼比預期長，貼上時請確認沒有夾帶其他文字。</Trans>
            </p>
          )}
        </div>
        <Button
          icon={<SearchIcon />}
          busy={busy === 'check'}
          disabled={!canCode || pasted.trim() === '' || (busy !== null && busy !== 'check')}
          onClick={() => void checkCode()}
        >
          <Trans id="backup.import.check">檢查備份碼</Trans>
        </Button>
        {importNotice && (
          <div role="status" className="ll-backup__status" data-testid="import-message">
            {importNotice.kind === 'ok' ? (
              <p className="ll-backup__ok">
                <CheckCircleIcon size={16} />
                <span>{importNotice.text}</span>
              </p>
            ) : (
              <FieldError id={`${uid}-import-notice`}>{importNotice.text}</FieldError>
            )}
          </div>
        )}
      </Card>

      {validated && (
        <Card as="section" aria-labelledby="ll-backup-preview" className="ll-backup__card ll-backup__preview" data-testid="import-preview-card">
          <h2 id="ll-backup-preview" ref={previewHeading} tabIndex={-1} className="ll-backup__title">
            <Trans id="backup.preview.title">預覽</Trans>
          </h2>
          <p className="ll-backup__summary" data-testid="import-preview">
            {/* 數字和後面的量詞之間是不換行空白（U+00A0）；其他字照全站規則逐字換行 */}
            <Trans
              id="backup.preview.summaryWithFavourites"
              comment="previewAttempts、previewLevels、previewBadges、previewFavourites 是已格式化的數字；數字和量詞（筆、個、題）之間是不換行空白"
            >
              將匯入 {previewAttempts} 筆作答紀錄、{previewLevels} 個關卡的星星、{previewBadges} 個徽章、{previewFavourites} 題收藏
            </Trans>
          </p>
          {validated.migratedFrom !== undefined && (
            <p className="ll-backup__note">
              <Trans id="backup.preview.migrated">這份備份來自較舊的版本，已先轉成目前的格式。</Trans>
            </p>
          )}
          <p className="ll-backup__note">
            <Trans id="backup.preview.source" comment="sourceLabel 是來源環境的文字，sourceDate 是已格式化的日期">
              來源：{sourceLabel}，{sourceDate}
            </Trans>
          </p>
          {validated.preview.hasSettings && (
            <Switch
              checked={applySettings}
              onChange={setApplySettings}
              label={t({ id: 'backup.preview.applySettings', message: '也套用語言與計時設定' })}
              className="ll-backup__switch"
            />
          )}
          <div className="ll-backup__actions">
            <Button
              variant="primary"
              block
              busy={busy === 'merge'}
              disabled={busy !== null && busy !== 'merge'}
              onClick={() => void doMerge()}
              data-testid="import-confirm"
            >
              <Trans id="backup.preview.confirmMerge">合併匯入</Trans>
            </Button>
            <Button variant="quiet" block disabled={busy !== null} onClick={() => setValidated(null)}>
              <Trans id="backup.preview.cancel">取消</Trans>
            </Button>
          </div>
          <Disclosure
            variant="plain"
            summary={t({ id: 'backup.preview.advancedOptions', message: '進階選項', comment: '備份預覽卡的展開列：覆蓋現有進度' })}
            className="ll-backup__advanced"
          >
            <p className="ll-backup__hint">
              {t({
                id: 'backup.preview.replaceHint',
                message: '覆蓋：除了語言、計時這類偏好設定之外，全部（包括收藏）改成備份裡的內容。覆蓋之前會先自動匯出一份目前的進度。',
                comment: '進階選項裡覆蓋的說明',
              })}
            </p>
            <Button
              variant="danger"
              block
              icon={<TrashIcon />}
              disabled={busy !== null}
              onClick={(e) => {
                replaceTrigger.current = e.currentTarget;
                setConfirmOpen(true);
              }}
              data-testid="import-replace"
            >
              <Trans id="backup.preview.replaceButton" comment="進階選項裡的破壞性按鈕；按下先開確認面板">
                覆蓋現有進度
              </Trans>
            </Button>
          </Disclosure>
        </Card>
      )}
      <ConfirmSheet
        open={confirmOpen}
        onClose={() => {
          if (busy !== 'replace') setConfirmOpen(false);
        }}
        onConfirm={() => void doReplace()}
        title={t({ id: 'backup.confirm.title', message: '要覆蓋現有進度嗎？', comment: '覆蓋現有進度的確認面板標題' })}
        description={t({
          id: 'backup.confirm.body',
          message: '這台裝置上的星星、錯題本與收藏會換成備份檔裡的內容。按下後會先自動匯出一份目前的進度；覆蓋之後不能復原。',
          comment: '覆蓋現有進度的確認面板說明',
        })}
        confirmLabel={t({ id: 'backup.preview.replaceButton', message: '覆蓋現有進度' })}
        confirmIcon={<TrashIcon />}
        busy={busy === 'replace'}
        returnFocusTo={replaceTrigger}
        data-testid="replace-confirm"
      />
    </div>
  );
}
