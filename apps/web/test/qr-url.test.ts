// 課堂 QR 的站內網址驗證（02 第 4.7 節、06 第 4.9 節）：只接受允許的 origin 與三種路徑格式，其餘一律 null
import { describe, expect, it } from 'vitest';
import { BASE_LOCALE } from '@ledgerland/i18n';
import { parseSiteQr } from '../src/features/quest-map/qr-url.ts';

const PROD = 'https://ledgerland.swift.moe';
const PREVIEW = 'http://127.0.0.1:8787';
const opts = { origin: PREVIEW, allowedOrigins: [PROD] };

describe('parseSiteQr', () => {
  it('接受正式 origin 的關卡、章節與故事步驟網址', () => {
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xd/`, opts)).toEqual({ kind: 'level', id: 'lv_k7m2q9xd', locale: BASE_LOCALE, path: '/level/lv_k7m2q9xd/' });
    expect(parseSiteQr(`${PROD}/chapter/ch_a1b2c3/`, opts)).toEqual({ kind: 'chapter', id: 'ch_a1b2c3', locale: BASE_LOCALE, path: '/chapter/ch_a1b2c3/' });
    expect(parseSiteQr(`${PROD}/lab/story/story_x1y2z3/st_0a0b0c/`, opts)).toEqual({
      kind: 'story',
      id: 'story_x1y2z3',
      stepId: 'st_0a0b0c',
      locale: BASE_LOCALE,
      path: '/lab/story/story_x1y2z3/st_0a0b0c/',
    });
  });

  it('/en 前綴：locale 是 en，path 去掉語系片段', () => {
    expect(parseSiteQr(`${PROD}/en/level/lv_k7m2q9xd/`, opts)).toEqual({ kind: 'level', id: 'lv_k7m2q9xd', locale: 'en', path: '/level/lv_k7m2q9xd/' });
    expect(parseSiteQr(`${PROD}/en/chapter/ch_a1b2c3/`, opts)?.locale).toBe('en');
  });

  it('查詢字串與 hash 一律忽略，結尾斜線可有可無', () => {
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xd/?mode=practice&utm_source=x#top`, opts)?.path).toBe('/level/lv_k7m2q9xd/');
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xd`, opts)?.path).toBe('/level/lv_k7m2q9xd/');
  });

  it('路徑大小寫錯誤先轉小寫再比對（02 第 4.4 節）；前後空白也容忍', () => {
    expect(parseSiteQr(`${PROD}/Level/LV_K7M2Q9XD/`, opts)?.id).toBe('lv_k7m2q9xd');
    expect(parseSiteQr(`${PROD}/EN/level/lv_k7m2q9xd/`, opts)?.locale).toBe('en');
    expect(parseSiteQr(`  ${PROD}/level/lv_k7m2q9xd/\n`, opts)?.id).toBe('lv_k7m2q9xd');
  });

  it('目前的 origin（預覽與本機環境）也接受', () => {
    expect(parseSiteQr(`${PREVIEW}/level/lv_k7m2q9xd/`, opts)?.kind).toBe('level');
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xd/`, { origin: PREVIEW })).toBeNull();
  });

  it('站外 origin 一律 null：別的網域、子網域、http 版的正式網址、帶帳號密碼', () => {
    expect(parseSiteQr('https://example.com/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('https://evil.ledgerland.swift.moe/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('https://ledgerland.swift.moe.evil.example/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('http://ledgerland.swift.moe/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('https://ledgerland.swift.moe:8443/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('https://ledgerland.swift.moe@example.com/level/lv_k7m2q9xd/', opts)).toBeNull();
  });

  it('不是網址的文字一律 null', () => {
    expect(parseSiteQr('', opts)).toBeNull();
    expect(parseSiteQr('lv_k7m2q9xd', opts)).toBeNull();
    expect(parseSiteQr('/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('ledgerland.swift.moe/level/lv_k7m2q9xd/', opts)).toBeNull();
    expect(parseSiteQr('javascript:alert(1)', opts)).toBeNull();
    expect(parseSiteQr('mailto:someone@example.com', opts)).toBeNull();
    expect(parseSiteQr('WIFI:S:classroom;T:WPA;P:secret;;', opts)).toBeNull();
  });

  it('路徑不符的站內網址也是 null：其他頁面、多餘片段、ID 長度或字元不對', () => {
    expect(parseSiteQr(`${PROD}/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/play/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/me/settings/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xd/extra/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9x/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xdd/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/level/lv_k7m2q9xu/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/level/ch_a1b2c3/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/chapter/ch_a1b2c3d/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/lab/story/story_x1y2z3/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/lab/story/story_x1y2z3/st_0a0b0c/more/`, opts)).toBeNull();
    expect(parseSiteQr(`${PROD}/zh-tw/level/lv_k7m2q9xd/`, opts)).toBeNull();
  });
});
