// 備份檔與備份碼在 apps/web 的平台函式上 round-trip（06 第 4.6 節）：WebCrypto 的 SHA-256 與 CompressionStream 的 deflate-raw（Node 22 以上都有）
import { DB_SCHEMA_VERSION, buildBackup, decodeBackupCode, encodeBackupCode, emptySnapshot, serialiseBackup, validateBackup } from '@ledgerland/progress';
import { describe, expect, it } from 'vitest';
import { deflateRaw, hasCompressionStream, inflateRaw, sha256 } from '../src/lib/progress/codec.ts';
import { NOW, attempt, badge, level, meta } from './fixtures.ts';

const info = { app: { version: '0.0.0+test', contentVersion: 3 }, origin: 'https://example.test', mode: 'browser' as const, exportedAt: NOW };

function snapshot() {
  const s = emptySnapshot(meta());
  return {
    ...s,
    attempts: [attempt(1), attempt(2)],
    levelProgress: [level()],
    unlocks: [badge()],
    settings: [{ key: 'locale', value: 'zh-TW', updatedAt: NOW }],
  };
}

describe('備份碼 round-trip', () => {
  it('CompressionStream 可用', () => {
    expect(hasCompressionStream()).toBe(true);
  });

  it('sha256 回傳 32 個位元組，相同輸入相同輸出', async () => {
    const a = await sha256('ledgerland');
    const b = await sha256('ledgerland');
    expect(a).toHaveLength(32);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(await sha256('ledgerlane'))).not.toEqual(Array.from(a));
  });

  it('deflate 與 inflate 互逆', async () => {
    const bytes = new TextEncoder().encode('會計樂園 '.repeat(100));
    const packed = await deflateRaw(bytes);
    expect(packed.length).toBeLessThan(bytes.length);
    expect(new TextDecoder().decode(await inflateRaw(packed))).toBe('會計樂園 '.repeat(100));
  });

  it('buildBackup → encodeBackupCode → decodeBackupCode → validateBackup：預覽與資料一致', async () => {
    const backup = await buildBackup(snapshot(), info, sha256);
    const encoded = await encodeBackupCode(backup, deflateRaw);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.code.startsWith('LL1:')).toBe(true);
    const decoded = await decodeBackupCode(`  ${encoded.value.code}\n`, inflateRaw);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toBe(serialiseBackup(backup));
    const validated = await validateBackup(decoded.value, { currentSchemaVersion: DB_SCHEMA_VERSION, sha256, now: NOW });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.preview).toEqual({ attempts: 2, levels: 1, badges: 1, terms: 0, reviewEntries: 0, hasSettings: true });
    expect(validated.value.data.attempts.map((a) => a.attemptId)).toEqual(['a_000000000001', 'a_000000000002']);
  });

  it('備份碼被截斷或改字：checksum 或解壓失敗，回固定錯誤碼', async () => {
    const backup = await buildBackup(snapshot(), info, sha256);
    const encoded = await encodeBackupCode(backup, deflateRaw);
    if (!encoded.ok) throw new Error('encode failed');
    const truncated = await decodeBackupCode(encoded.value.code.slice(0, -20), inflateRaw);
    expect(truncated.ok).toBe(false);
    const text = serialiseBackup(backup).replace('"contentVersion":3', '"contentVersion":4');
    const tampered = await validateBackup(text, { currentSchemaVersion: DB_SCHEMA_VERSION, sha256, now: NOW });
    expect(tampered).toMatchObject({ ok: false, error: { code: 'backup.checksum' } });
    const wrongPrefix = await decodeBackupCode('XX1:abc', inflateRaw);
    expect(wrongPrefix).toMatchObject({ ok: false, error: { code: 'backup.code_prefix' } });
  });
});
