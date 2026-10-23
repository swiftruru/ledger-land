// 06 第 4.6 節：備份檔 round-trip（build → validate → merge）、checksum、版本較新拒絕、較舊 migration、大小上限、備份碼 encode/decode
import { describe, expect, it } from 'vitest';
import {
  BACKUP_CODE_PREFIX,
  type Migration,
  type MigrationRegistry,
  MemoryProgressStore,
  backupFileName,
  buildBackup,
  computeChecksum,
  decodeBackupCode,
  encodeBackupCode,
  mergeSnapshots,
  migrations,
  serialiseBackup,
  settingsFromRecord,
  settingsToRecord,
  validateBackup,
} from '../src/index.ts';
import { DEVICE_A, DEVICE_B, T2, T3, deflate, identity, inflate, meta, populatedSnapshot, setting, sha256, snapshot } from './fixtures.ts';

const info = { app: { version: '0.2.0', contentVersion: 3 }, origin: 'https://example.test', mode: 'browser' as const, exportedAt: T2 };
const validateOpts = { currentSchemaVersion: 1, sha256, now: T3 };

describe('備份檔', () => {
  it('build → validate → merge 的 round-trip；errors 預設空；settings 寫成鍵值物件', async () => {
    const source = populatedSnapshot();
    const backup = await buildBackup(source, info, sha256);
    expect(backup.format).toBe('ledgerland-backup');
    expect(backup.formatVersion).toBe(1);
    expect(backup.dbSchemaVersion).toBe(1);
    expect(backup.deviceId).toBe(DEVICE_A);
    expect(backup.errors).toEqual([]);
    expect(backup.data.settings).toEqual({
      labView: { policy: 'teacher@1', window: 'cumulative', statement: 'bs', journalLayerOpen: false },
      locale: 'zh-TW',
      timerEnabled: false,
    });
    expect(backup.checksum).toMatch(/^sha256-[A-Za-z0-9_-]{43}$/);

    const text = serialiseBackup(backup);
    const v = await validateBackup(text, validateOpts);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.preview).toEqual({ attempts: 2, levels: 1, badges: 1, terms: 1, reviewEntries: 1, hasSettings: true });
    expect(v.value.migratedFrom).toBeUndefined();
    expect(v.value.data.settings).toEqual(settingsFromRecord(backup.data.settings, T2));

    const target = snapshot({ meta: meta({ deviceId: DEVICE_B }) });
    const merged = mergeSnapshots(target, v.value.data, {
      mode: 'merge',
      settings: true,
      importedAt: T3,
      source: { deviceId: backup.deviceId, exportedAt: backup.exportedAt },
    });
    expect(merged.attempts).toEqual(source.attempts);
    expect(merged.unlocks).toEqual([...source.unlocks].sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(merged.settings.map((s) => s.key)).toEqual(['labView', 'locale', 'timerEnabled']);
    expect(merged.meta.deviceId).toBe(DEVICE_B);
  });
  it('也接受已解析的物件；附上錯誤紀錄時 errors 不為空；同一份資料的 checksum 固定', async () => {
    const store = MemoryProgressStore.empty(meta());
    await store.appendError({ at: T2, route: '/play/', message: 'boom', appVersion: '0.2.0', contentVersion: 3 });
    const withErrors = await buildBackup(await store.exportAll(), { ...info, includeErrors: true }, sha256);
    expect(withErrors.errors).toHaveLength(1);
    const v = await validateBackup(JSON.parse(serialiseBackup(withErrors)), validateOpts);
    expect(v.ok).toBe(true);
    const again = await buildBackup(await store.exportAll(), { ...info, includeErrors: true }, sha256);
    expect(again.checksum).toBe(withErrors.checksum);
    expect(await computeChecksum(withErrors, sha256)).toBe(withErrors.checksum);
  });
  it('依序失敗：JSON 壞掉、format、formatVersion、checksum（被改過或截斷）', async () => {
    const backup = await buildBackup(populatedSnapshot(), info, sha256);
    expect(await validateBackup('{not json', validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.parse' } });
    expect(await validateBackup({ ...backup, format: 'other' }, validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.format' } });
    expect(await validateBackup({ ...backup, formatVersion: 2 }, validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.format_version' } });
    expect(await validateBackup({ ...backup, exportedAt: T3 }, validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.checksum' } });
    expect(await validateBackup({ ...backup, checksum: 'sha256-' + 'A'.repeat(43) }, validateOpts)).toMatchObject({
      ok: false,
      error: { code: 'backup.checksum' },
    });
    expect(await validateBackup(serialiseBackup(backup).slice(0, -20) + '"}', validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.checksum' } });
  });
  it('dbSchemaVersion 比 App 新：拒絕', async () => {
    const backup = await buildBackup(snapshot({ meta: meta({ dbSchemaVersion: 2 }) }), info, sha256);
    expect(await validateBackup(backup, validateOpts)).toMatchObject({
      ok: false,
      error: { code: 'backup.schema_newer', backupVersion: 2, currentVersion: 1 },
    });
  });
  it('dbSchemaVersion 比 App 舊：在記憶體中跑同一套 migration 後再驗證', async () => {
    const v2: Migration = {
      version: 2,
      description: '測試：舊備份的 unlocks 沒有 kind，從 id 推出來',
      describe: () => ({ createStores: [], createIndexes: [], transformsData: true }),
      transform(s) {
        const unlocks = Array.isArray(s['unlocks']) ? (s['unlocks'] as Record<string, unknown>[]) : [];
        return { ...s, unlocks: unlocks.map((u) => ({ ...u, kind: String(u['id']).split(':')[0] })) };
      },
    };
    const registry: MigrationRegistry = { ...migrations, 2: v2 };
    const old = await buildBackup(snapshot({ unlocks: [{ id: 'badge:b1', kind: 'badge', unlockedAt: T2 }] }), info, sha256);
    const oldData = { ...old.data, unlocks: [{ id: 'badge:b1', unlockedAt: T2 }] };
    const oldBody = { ...old, data: oldData };
    const oldBackup = { ...oldBody, checksum: await computeChecksum(oldBody as never, sha256) };
    const v = await validateBackup(oldBackup, { ...validateOpts, currentSchemaVersion: 2, registry });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.migratedFrom).toBe(1);
    expect(v.value.backup.dbSchemaVersion).toBe(2);
    expect(v.value.data.unlocks).toEqual([{ id: 'badge:b1', kind: 'badge', unlockedAt: T2 }]);
    // 沒有 migration 就會被 Zod 擋下
    expect(await validateBackup(oldBackup, validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.invalid', field: 'data.unlocks.0.kind' } });
  });
  it('Zod 驗證全部欄位；大小上限', async () => {
    const backup = await buildBackup(populatedSnapshot(), info, sha256);
    const bad = { ...backup, deviceId: 'd_bad' };
    const badSigned = { ...bad, checksum: await computeChecksum(bad, sha256) };
    expect(await validateBackup(badSigned, validateOpts)).toMatchObject({ ok: false, error: { code: 'backup.invalid', field: 'deviceId' } });
    const text = serialiseBackup(backup);
    expect(await validateBackup(text, { ...validateOpts, maxBytes: 100 })).toMatchObject({ ok: false, error: { code: 'backup.too_large', max: 100 } });
  });
  it('settings 鍵值物件與條目互轉；檔名', () => {
    const entries = [setting('locale', 'zh-TW'), setting('timerEnabled', true)];
    expect(settingsFromRecord(settingsToRecord(entries), T2)).toEqual([setting('locale', 'zh-TW', T2), setting('timerEnabled', true, T2)]);
    expect(backupFileName('20261105')).toBe('ledgerland-backup-20261105.json');
    expect(() => backupFileName('2026-11-05')).toThrow(RangeError);
  });
});

describe('文字備份碼', () => {
  it('encode → decode → validate；LL1: 前綴；貼上時夾帶的空白與換行會被忽略', async () => {
    const backup = await buildBackup(populatedSnapshot(), info, sha256);
    const encoded = await encodeBackupCode(backup, deflate);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.code.startsWith(BACKUP_CODE_PREFIX)).toBe(true);
    expect(encoded.value.code).toMatch(/^LL1:[A-Za-z0-9_-]+$/);
    expect(encoded.value.length).toBeLessThan(serialiseBackup(backup).length);
    const pasted = encoded.value.code.replace(/(.{40})/g, '$1\n ');
    const decoded = await decodeBackupCode(pasted, inflate);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toBe(serialiseBackup(backup));
    const v = await validateBackup(decoded.value, validateOpts);
    expect(v.ok).toBe(true);
  });
  it('identity 壓縮也能 round-trip（中文字元的 UTF-8 正確）', async () => {
    const backup = await buildBackup(snapshot({ settings: [setting('locale', '繁體中文 試試 😀')] }), info, sha256);
    const encoded = await encodeBackupCode(backup, identity);
    if (!encoded.ok) throw new Error('應該成功');
    const decoded = await decodeBackupCode(encoded.value.code, identity);
    if (!decoded.ok) throw new Error('應該成功');
    expect(JSON.parse(decoded.value).data.settings.locale).toBe('繁體中文 試試 😀');
  });
  it('超過上限時回 backup.code_too_long，附長度與上限', async () => {
    const backup = await buildBackup(populatedSnapshot(), info, sha256);
    expect(await encodeBackupCode(backup, identity, 50)).toMatchObject({ ok: false, error: { code: 'backup.code_too_long', max: 50 } });
  });
  it('前綴錯、字元錯、截斷或解壓失敗各有錯誤碼', async () => {
    expect(await decodeBackupCode('LL2:abcd', inflate)).toMatchObject({ ok: false, error: { code: 'backup.code_prefix' } });
    expect(await decodeBackupCode('LL1:ab$d', inflate)).toMatchObject({ ok: false, error: { code: 'backup.code_encoding' } });
    expect(await decodeBackupCode('LL1:', inflate)).toMatchObject({ ok: false, error: { code: 'backup.code_encoding' } });
    const backup = await buildBackup(populatedSnapshot(), info, sha256);
    const encoded = await encodeBackupCode(backup, deflate);
    if (!encoded.ok) throw new Error('應該成功');
    expect(await decodeBackupCode(encoded.value.code.slice(0, 30), inflate)).toMatchObject({ ok: false, error: { code: 'backup.code_corrupt' } });
    expect(await decodeBackupCode('LL1:gA', identity)).toMatchObject({ ok: false, error: { code: 'backup.code_corrupt' } });
  });
});
