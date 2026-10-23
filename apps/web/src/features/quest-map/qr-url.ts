// 課堂 QR 的站內網址驗證（02 第 4.7 節、06 第 4.9 節）：純函式，不碰 DOM、不導覽。
// 只接受 origin 在允許清單內（正式站台，加上目前的 origin 給預覽與本機環境）、路徑是關卡、章節或故事步驟三種格式的網址；
// 可帶 /en 前綴、結尾斜線可有可無、路徑大小寫先轉小寫（02 第 4.4 節），查詢字串與 hash 一律忽略。其他一律回 null，呼叫端絕不開啟。
import { CROCKFORD, ID_RULES, type IdKind } from '@ledgerland/content-schema';
import { localeFromPath, stripLocale, type Locale } from '@ledgerland/i18n';

export type SiteQrTarget =
  | { kind: 'level'; id: string; locale: Locale; path: string }
  | { kind: 'chapter'; id: string; locale: Locale; path: string }
  | { kind: 'story'; id: string; stepId: string; locale: Locale; path: string };

export interface ParseSiteQrOptions {
  /** 目前頁面的 origin（預覽與本機環境印的 QR 也要能用） */
  origin: string;
  /** 另外接受的 origin，通常是 site.config 的正式 origin */
  allowedOrigins?: readonly string[];
}

const idGroup = (kind: IdKind) => `(${ID_RULES[kind].prefix}[${CROCKFORD}]{${ID_RULES[kind].length}})`;
const LEVEL_RE = new RegExp(`^/level/${idGroup('level')}/$`);
const CHAPTER_RE = new RegExp(`^/chapter/${idGroup('chapter')}/$`);
const STORY_RE = new RegExp(`^/lab/story/${idGroup('story')}/${idGroup('step')}/$`);

/** 解出的 QR 文字是不是本站的課堂網址；是就回傳目標（path 已去掉語系片段、帶結尾斜線），不是就回 null */
export function parseSiteQr(text: string, options: ParseSiteQrOptions): SiteQrTarget | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const allowed = new Set<string>([options.origin, ...(options.allowedOrigins ?? [])]);
  if (!allowed.has(url.origin)) return null;
  let pathname = url.pathname.toLowerCase();
  if (!pathname.endsWith('/')) pathname = `${pathname}/`;
  const locale = localeFromPath(pathname);
  const path = stripLocale(pathname);
  const level = LEVEL_RE.exec(path);
  if (level) return { kind: 'level', id: level[1]!, locale, path };
  const chapter = CHAPTER_RE.exec(path);
  if (chapter) return { kind: 'chapter', id: chapter[1]!, locale, path };
  const story = STORY_RE.exec(path);
  if (story) return { kind: 'story', id: story[1]!, stepId: story[2]!, locale, path };
  return null;
}
