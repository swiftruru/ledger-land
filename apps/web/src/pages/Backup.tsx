// 「我的 › 備份」（06 第 4.5、4.6 節；路由 /me/backup/，noindex）：存成備份檔或複製備份碼；選擇備份檔或貼上備份碼匯入。
// 匯入先驗證（packages/progress 的 validateBackup）並顯示預覽摘要，確認後才寫入；預設合併，「覆蓋」放在進階選項（先自動匯出一份再二次確認）。
// 另外顯示 persist() 的結果、estimate() 的用量與上次匯出時間。所有文字欄位當純文字顯示。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDate, formatNumber } from '@ledgerland/i18n';
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
  type ImportMode,
  type PersistResult,
  type ProgressErrorCode,
  type ValidatedBackup,
} from '@ledgerland/progress';
import { Banner, Button, Card } from '@ledgerland/web-ui';
import { environmentKind } from '../lib/env.ts';
import { appVersion, getContentVersion, nowIso, todayLocal } from '../lib/progress/app-info.ts';
import { deflateRaw, hasCompressionStream, inflateRaw, sha256 } from '../lib/progress/codec.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { refreshPersisted } from '../lib/progress/persist.ts';
import { useStorageStatus } from '../lib/progress/status.ts';
import { useLocale } from '../lib/useLocale.ts';

interface Stats {
  attempts: number;
  levels: number;
  badges: number;
  persistResult: PersistResult | null;
  lastExportedAt: string | null;
  usageBytes: number | null;
}

function backupMode(): BackupMode {
  const kind = environmentKind();
  return kind === 'app' ? 'app' : kind === 'in-app-browser' ? 'in-app-browser' : 'browser';
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

function dateOf(iso: string, locale: 'zh-TW' | 'en'): string {
  return formatDate(iso.slice(0, 10), locale, 'medium');
}

export default function Backup() {
  const locale = useLocale();
  const { t } = useLingui();
  const [params] = useSearchParams();
  const status = useStorageStatus();
  const [stats, setStats] = useState<Stats | null>(null);
  const [includeErrors, setIncludeErrors] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [validated, setValidated] = useState<ValidatedBackup | null>(null);
  const [applySettings, setApplySettings] = useState(false);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [replaceStep, setReplaceStep] = useState<0 | 1>(0);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const store = await getProgressStore();
    const [attempts, levels, badges, persist, reminder] = await Promise.all([
      store.listAttempts(),
      store.listLevelProgress(),
      store.listUnlocks('badge'),
      store.getSetting('persistResult'),
      store.getSetting('backupReminder'),
    ]);
    let usageBytes: number | null = null;
    try {
      usageBytes = (await navigator.storage?.estimate?.())?.usage ?? null;
    } catch {
      usageBytes = null;
    }
    setStats({
      attempts: attempts.length,
      levels: levels.length,
      badges: badges.length,
      persistResult: (persist?.value as PersistResult | undefined) ?? null,
      lastExportedAt: (reminder?.value as BackupReminderState | undefined)?.lastExportedAt ?? null,
      usageBytes,
    });
  }, []);

  useEffect(() => {
    void refresh();
    void refreshPersisted();
  }, [refresh]);

  useEffect(() => {
    const target = params.get('import');
    if (target === 'code') codeInput.current?.focus();
    else if (target === 'file') fileInput.current?.focus();
  }, [params]);

  const errorText = (code: ProgressErrorCode): string => {
    switch (code) {
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

  const exportFile = async () => {
    setBusy(true);
    setExportMessage(null);
    try {
      const backup = await buildCurrentBackup(includeErrors);
      const outcome = await saveFile(serialiseBackup(backup), backupFileName(todayLocal().replaceAll('-', '')));
      if (outcome !== 'cancelled') {
        await markExported();
        await refresh();
        setExportMessage(
          outcome === 'shared'
            ? t({ id: 'backup.export.shared', message: '已交給分享表單。' })
            : t({ id: 'backup.export.downloaded', message: '備份檔已開始下載。' }),
        );
      }
    } catch {
      setExportMessage(t({ id: 'backup.export.failed', message: '匯出失敗，請再試一次。' }));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    setBusy(true);
    setExportMessage(null);
    try {
      const backup = await buildCurrentBackup(includeErrors);
      const encoded = await encodeBackupCode(backup, deflateRaw);
      if (!encoded.ok) {
        setCode(null);
        setExportMessage(errorText(encoded.error.code));
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
      await refresh();
      setExportMessage(
        copied
          ? t({ id: 'backup.code.copied', message: '備份碼已複製，貼到另一台裝置或 App 的「貼上備份碼」就能匯入。' })
          : t({ id: 'backup.code.copyFailed', message: '無法自動複製，請自己選取下方的備份碼。' }),
      );
    } catch {
      setExportMessage(t({ id: 'backup.export.failed', message: '匯出失敗，請再試一次。' }));
    } finally {
      setBusy(false);
    }
  };

  const validateText = async (text: string) => {
    setImportError(null);
    setValidated(null);
    setImportMessage(null);
    setReplaceStep(0);
    const result = await validateBackup(text, { currentSchemaVersion: DB_SCHEMA_VERSION, sha256, now: nowIso() });
    if (!result.ok) {
      setImportError(errorText(result.error.code));
      return;
    }
    setValidated(result.value);
  };

  const checkCode = async () => {
    setBusy(true);
    try {
      const decoded = await decodeBackupCode(pasted, inflateRaw);
      if (!decoded.ok) {
        setValidated(null);
        setImportMessage(null);
        setImportError(errorText(decoded.error.code));
        return;
      }
      await validateText(decoded.value);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (file === undefined) return;
    setBusy(true);
    try {
      await validateText(await file.text());
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (validated === null) return;
    if (mode === 'replace' && replaceStep === 0) {
      // 覆蓋前自動匯出一份目前的進度，再要求二次確認（06 第 4.6 節）
      setBusy(true);
      try {
        const backup = await buildCurrentBackup(false);
        await saveFile(serialiseBackup(backup), backupFileName(todayLocal().replaceAll('-', '')));
        setReplaceStep(1);
      } catch {
        setImportError(t({ id: 'backup.export.failed', message: '匯出失敗，請再試一次。' }));
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
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
      setReplaceStep(0);
      setMode('merge');
      setImportMessage(
        mode === 'replace'
          ? t({ id: 'backup.import.replaced', message: '已覆蓋為備份裡的進度。' })
          : t({ id: 'backup.import.merged', message: '已合併，兩邊的紀錄都保留。' }),
      );
      await refresh();
    } catch {
      setImportError(t({ id: 'backup.import.failed', message: '寫入失敗，請重新整理後再試一次。' }));
    } finally {
      setBusy(false);
    }
  };

  const attempts = stats?.attempts ?? 0;
  const levels = stats?.levels ?? 0;
  const badges = stats?.badges ?? 0;
  const usageKb = stats?.usageBytes === null || stats?.usageBytes === undefined ? null : formatNumber(Math.round(stats.usageBytes / 1024), locale);
  const previewAttempts = validated?.preview.attempts ?? 0;
  const previewLevels = validated?.preview.levels ?? 0;
  const previewBadges = validated?.preview.badges ?? 0;
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

  return (
    <>
      <h1>
        <Trans id="backup.title">備份</Trans>
      </h1>
      <p className="ll-muted ll-small">
        <Trans id="backup.intro">進度只存在這台裝置。換裝置、重灌，或把 Safari 的進度搬進主畫面 App 時，用備份檔或備份碼轉移。</Trans>
      </p>

      <Card as="section" aria-labelledby="ll-backup-status">
        <h2 id="ll-backup-status" className="ll-small ll-muted">
          <Trans id="backup.status.title">這台裝置</Trans>
        </h2>
        <p data-testid="backup-stats">
          <Trans id="backup.status.counts" comment="attempts、levels、badges 是數字">
            {attempts} 筆作答紀錄、{levels} 個關卡的星星、{badges} 個徽章
          </Trans>
        </p>
        <dl className="ll-dl">
          <dt>
            <Trans id="backup.status.lastExport">上次匯出</Trans>
          </dt>
          <dd>{stats?.lastExportedAt ? dateOf(stats.lastExportedAt, locale) : t({ id: 'backup.status.never', message: '還沒匯出過' })}</dd>
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
              <span className="ll-small ll-muted">
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
                <Trans id="backup.status.usage">已使用的儲存空間</Trans>
              </dt>
              <dd>
                <Trans id="backup.status.usageValue" comment="usageKb 是已格式化的 KB 數字">
                  {usageKb} KB
                </Trans>
              </dd>
            </>
          )}
        </dl>
      </Card>

      <Card as="section" aria-labelledby="ll-backup-export">
        <h2 id="ll-backup-export">
          <Trans id="backup.export.title">匯出</Trans>
        </h2>
        <div className="ll-row">
          <Button variant="primary" onClick={() => void exportFile()} disabled={busy}>
            <Trans id="backup.export.file">存成備份檔</Trans>
          </Button>
          <Button onClick={() => void copyCode()} disabled={busy || !hasCompressionStream()}>
            <Trans id="backup.export.code">複製備份碼</Trans>
          </Button>
        </div>
        <label className="ll-check">
          <input type="checkbox" checked={includeErrors} onChange={(e) => setIncludeErrors(e.target.checked)} />{' '}
          <Trans id="backup.export.includeErrors">附上錯誤紀錄（只用於回報問題）</Trans>
        </label>
        {exportMessage && (
          <output className="ll-small" data-testid="export-message">
            {exportMessage}
          </output>
        )}
        {code !== null && (
          <div className="ll-field">
            <span className="ll-small ll-muted" id="ll-backup-code-label">
              <Trans id="backup.code.label">備份碼</Trans>
            </span>
            <textarea
              className="ll-code"
              readOnly
              value={code}
              rows={4}
              aria-labelledby="ll-backup-code-label"
              data-testid="backup-code"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="ll-backup-import">
        <h2 id="ll-backup-import">
          <Trans id="backup.import.title">匯入</Trans>
        </h2>
        <p className="ll-small ll-muted">
          <Trans id="backup.import.hint">預設會和這台裝置的紀錄合併：作答紀錄取聯集、星星取最高、徽章只會變多。</Trans>
        </p>
        <div className="ll-field">
          <span id="ll-import-file-label">
            <Trans id="backup.import.file">選擇備份檔</Trans>
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-labelledby="ll-import-file-label"
            onChange={(e) => void pickFile(e.target.files?.[0])}
            disabled={busy}
          />
        </div>
        <div className="ll-field">
          <span id="ll-import-code-label">
            <Trans id="backup.import.code">貼上備份碼</Trans>
          </span>
          <textarea
            ref={codeInput}
            aria-labelledby="ll-import-code-label"
            className="ll-code"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            data-testid="paste-code"
          />
        </div>
        <div className="ll-row">
          <Button onClick={() => void checkCode()} disabled={busy || pasted.trim() === '' || !hasCompressionStream()}>
            <Trans id="backup.import.check">檢查備份碼</Trans>
          </Button>
        </div>
        {pasted.length > MAX_BACKUP_CODE_LENGTH && (
          <p className="ll-small ll-muted">
            <Trans id="backup.import.codeLong">備份碼比預期長，貼上時請確認沒有夾帶其他文字。</Trans>
          </p>
        )}
        {importError && (
          <Banner kind="danger" role="alert">
            <p data-testid="import-error">{importError}</p>
          </Banner>
        )}
        {validated && (
          <Card as="section" className="ll-preview" aria-labelledby="ll-backup-preview">
            <h3 id="ll-backup-preview" className="ll-small ll-muted">
              <Trans id="backup.preview.title">預覽</Trans>
            </h3>
            <p data-testid="import-preview">
              <Trans id="backup.preview.summary" comment="previewAttempts、previewLevels、previewBadges 是數字">
                將匯入 {previewAttempts} 筆作答紀錄、{previewLevels} 個關卡的星星、{previewBadges} 個徽章
              </Trans>
            </p>
            {validated.migratedFrom !== undefined && (
              <p className="ll-small ll-muted">
                <Trans id="backup.preview.migrated">這份備份來自較舊的版本，已先轉成目前的格式。</Trans>
              </p>
            )}
            <p className="ll-small ll-muted">
              <Trans id="backup.preview.source" comment="sourceLabel 是來源環境的文字，sourceDate 是已格式化的日期">
                來源：{sourceLabel}，{sourceDate}
              </Trans>
            </p>
            <label className="ll-check">
              <input type="checkbox" checked={applySettings} onChange={(e) => setApplySettings(e.target.checked)} />{' '}
              <Trans id="backup.preview.applySettings">也套用語言與計時設定</Trans>
            </label>
            <details className="ll-advanced">
              <summary>
                <Trans id="backup.preview.advanced">進階</Trans>
              </summary>
              <label className="ll-check">
                <input
                  type="checkbox"
                  checked={mode === 'replace'}
                  onChange={(e) => {
                    setMode(e.target.checked ? 'replace' : 'merge');
                    setReplaceStep(0);
                  }}
                />{' '}
                <Trans id="backup.preview.replace">覆蓋：除了設定之外，全部改成備份裡的內容（會先自動匯出一份目前的進度）</Trans>
              </label>
            </details>
            {mode === 'replace' && replaceStep === 1 && (
              <Banner kind="warning" role="alert">
                <p>
                  <Trans id="backup.preview.replaceConfirm">目前的進度已匯出。確定要覆蓋嗎？這個動作無法復原。</Trans>
                </p>
              </Banner>
            )}
            <div className="ll-row">
              <Button variant="primary" onClick={() => void doImport()} disabled={busy} data-testid="import-confirm">
                {mode === 'replace' ? (
                  replaceStep === 1 ? (
                    <Trans id="backup.preview.confirmReplace">確定覆蓋</Trans>
                  ) : (
                    <Trans id="backup.preview.exportThenReplace">先匯出，再覆蓋</Trans>
                  )
                ) : (
                  <Trans id="backup.preview.confirmMerge">合併匯入</Trans>
                )}
              </Button>
              <Button
                onClick={() => {
                  setValidated(null);
                  setReplaceStep(0);
                }}
                disabled={busy}
              >
                <Trans id="backup.preview.cancel">取消</Trans>
              </Button>
            </div>
          </Card>
        )}
        {importMessage && (
          <output className="ll-ok" data-testid="import-message">
            {importMessage}
          </output>
        )}
      </Card>
    </>
  );
}
