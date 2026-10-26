// 作答頁的名詞資料與共用名詞卡（03 第 2.9 節第 5 項、第 4.3 節）：第一次繪製只等目前語系的名詞索引（名稱、科目與指標對照，約 10 KB gzip），
// 另一個語系的索引在第一次繪製後補讀（名詞卡的副標）；定義等長文在打開名詞卡時才讀該名詞所在的完整內容檔（08 第 7.3 節的兩層名詞快照，06 第 8.2 節）。
// {{term:tm_x}} 與回饋區的 TermChip 都透過 openTerm 開同一張 TermSheet；關閉後焦點回到開啟它的 chip（TermSheet 卸載時自己還焦點）。
// 名詞索引讀不到（離線又沒有 precache、部署時間差）時不永久停在空的索引：恢復連線或打開名詞卡時再讀一次；名詞卡不依賴索引，
// 完整內容讀得到就照樣打開，兩者都讀不到才以提示說明，不會點了沒反應。
// 中文的依詞換行（M3 驗收第 8 輪）：關卡與錯題本頁面把切詞模組（features/quiz-phrase/quiz-phrase.ts）傳進來，題幹、選項、回饋與解說依詞換行（Markup.tsx）。
import { Trans } from '@lingui/react/macro';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { getLocale, type Locale } from '@ledgerland/i18n';
import { Toast, type TermSheetData } from '@ledgerland/web-ui';
import { loadTermDetail, loadTermIndex, type TermIndexEntry, type TermSnapshot } from '../../lib/content.ts';
import { afterFirstPaint } from '../../lib/idle.ts';
import { termNoteKinds } from '../glossary/note-kinds.ts';
import { useCategoryLabel } from '../glossary/useCategoryLabel.ts';
import { MarkupParagraphs } from './Markup.tsx';
import type { PhraseModule } from '../quiz-phrase/quiz-phrase.ts';
import { termFieldsOf } from './term-fields.ts';

export interface TermsContextValue {
  readonly locale: Locale;
  /** 目前語系的名詞索引（沒有定義等長文；要長文用 useTermDetails 或 openTerm） */
  readonly terms: ReadonlyMap<string, TermIndexEntry>;
  /** 另一種語言的名詞索引（名詞卡副標；第一次繪製後才補上） */
  readonly otherTerms: ReadonlyMap<string, TermIndexEntry>;
  readonly ready: boolean;
  readonly labelOf: (id: string) => string | undefined;
  readonly openTerm: (id: string, returnFocusTo?: RefObject<HTMLElement | null>) => void;
  /** 中文的依詞換行（quiz-phrase.ts）：切詞模組與名詞資料的名稱（keep 清單）；英文介面或沒有傳切詞模組時是 null（Markup 照原字） */
  readonly phrase: QuizPhrase | null;
}

export interface QuizPhrase {
  readonly mod: PhraseModule;
  /** 名詞資料的中文名稱：名稱、教材用語、現行用語與別名（整塊不斷） */
  readonly names: readonly string[];
}

const TermsContext = createContext<TermsContextValue | null>(null);

export function useTerms(): TermsContextValue {
  const v = useContext(TermsContext);
  if (v === null) throw new Error('useTerms 要在 TermsProvider 之內使用');
  return v;
}

/** 名詞卡的資料：detail 是完整內容（讀不到時為 null，定義改成 missing 的提示） */
export function toSheetData(
  term: TermIndexEntry,
  detail: TermSnapshot | null,
  other: TermIndexEntry | undefined,
  otherLocale: Locale,
  missing: ReactNode,
  categoryLabel?: string,
): TermSheetData {
  const flags = termNoteKinds(term.flags);
  const f = detail === null ? {} : termFieldsOf(detail);
  return {
    label: term.label,
    category: term.category,
    ...(categoryLabel === undefined ? {} : { categoryLabel }),
    ...(other === undefined ? {} : { secondaryLabel: other.label, secondaryLang: getLocale(otherLocale).htmlLang }),
    teacherLabel: term.teacherLabel,
    currentTwLabel: term.currentTwLabel,
    ifrsEnglish: term.ifrsEnglish,
    definition: detail === null ? missing : <MarkupParagraphs text={detail.definition} />,
    // 每個欄位放在自己的段落（term-fields.ts），都可能含佔位符（{{raw:2027}}、{{date:…}}、{{term:…}}），一律交給 Markup，和名詞頁一致
    ...(f.note === undefined ? {} : { note: <MarkupParagraphs text={f.note} /> }),
    ...(f.formula === undefined ? {} : { formula: <MarkupParagraphs text={f.formula} /> }),
    ...(f.example === undefined ? {} : { example: <MarkupParagraphs text={f.example} /> }),
    ...(f.misconception === undefined ? {} : { misconception: <MarkupParagraphs text={f.misconception} /> }),
    ...(f.ifrsNote === undefined ? {} : { ifrsNote: <MarkupParagraphs text={f.ifrsNote} /> }),
    flags,
  };
}

/** 讀過的名詞完整內容（鍵是「語系|名詞 ID」；讀不到的記 null）：useTermDetails 先同步查這裡，回饋期間預讀過的下一題第一次渲染就有說明 */
const detailCache = new Map<string, TermSnapshot | null>();

function detailKey(id: string, locale: Locale): string {
  return `${locale}|${id}`;
}

/** 讀一個名詞的完整內容並記進同步快取；讀不到記 null（下一次打開名詞卡時 terms.tsx 會再讀 content.ts，這裡不重試） */
function fetchDetail(id: string, locale: Locale): Promise<TermSnapshot | null> {
  return loadTermDetail(id, locale).then(
    (d) => {
      const v = d ?? null;
      detailCache.set(detailKey(id, locale), v);
      return v;
    },
    () => {
      detailCache.set(detailKey(id, locale), null);
      return null;
    },
  );
}

/** 已經讀到的幾個名詞（同步）：有任何一個還沒讀過就回傳 null */
export function termDetailsNow(ids: readonly string[], locale: Locale): ReadonlyMap<string, TermSnapshot> | null {
  const map = new Map<string, TermSnapshot>();
  for (const id of ids) {
    const v = detailCache.get(detailKey(id, locale));
    if (v === undefined) return null;
    if (v !== null) map.set(id, v);
  }
  return map;
}

/** 預讀幾個名詞的完整內容（回饋期間替下一題的報表卡片預讀） */
export function prefetchTermDetails(ids: readonly string[], locale: Locale): void {
  for (const id of ids) if (!detailCache.has(detailKey(id, locale))) void fetchDetail(id, locale);
}

/** 幾個名詞的完整內容（例如報表卡片的一句說明）：null 代表還在讀；讀不到的名詞不在 Map 裡。已經讀過的同步給，不會先空一次 */
export function useTermDetails(ids: readonly string[], locale: Locale): ReadonlyMap<string, TermSnapshot> | null {
  const key = [...ids].sort().join(',');
  const list = useMemo(() => (key === '' ? [] : key.split(',')), [key]);
  const [value, setValue] = useState<{ key: string; map: ReadonlyMap<string, TermSnapshot> } | null>(null);
  const now = value !== null && value.key === `${locale}|${key}` ? value.map : termDetailsNow(list, locale);
  useEffect(() => {
    if (termDetailsNow(list, locale) !== null) return;
    let alive = true;
    void Promise.all(list.map((id) => fetchDetail(id, locale))).then(() => {
      if (!alive) return;
      setValue({ key: `${locale}|${key}`, map: termDetailsNow(list, locale) ?? new Map() });
    });
    return () => {
      alive = false;
    };
  }, [key, list, locale]);
  return now;
}

type TermSheetComponent = typeof import('./term-sheet.ts').TermSheet;

let sheetPromise: Promise<TermSheetComponent> | null = null;

/** 名詞卡元件（06 第 8.2 節）：不在作答頁第一波的 chunk 裡，第一次繪製送出後預載；打開名詞卡時和完整內容一起等，對話框照樣一次到位 */
function loadTermSheet(): Promise<TermSheetComponent> {
  // 載入失敗時不留著被拒絕的 Promise：下一次打開名詞卡重新 import
  sheetPromise ??= import('./term-sheet.ts').then(
    (m) => m.TermSheet,
    (e: unknown) => {
      sheetPromise = null;
      throw e;
    },
  );
  return sheetPromise;
}

/** phrase：中文依詞換行的切詞模組。關卡與錯題本頁面靜態 import 後傳進來（不在這裡 import）：
 *  - 這個檔案在 vite.config.ts 的 quiz-view 群組，靜態 import 會連名詞頁的切詞（term-page/prose.ts、prose-units）一起抓進作答頁的 chunk，名詞頁與說明頁反而要載 quiz-view；
 *  - 動態 import 要等 React 掛上之後才開始讀，題目第一次繪製晚一個往返（第 9 輪節流實測 LCP 多約 200ms）。
 *  由頁面 chunk 靜態 import 時，它和名詞頁的切詞是頁面的靜態依賴，殼層依路徑預先載入的第一波就一起讀，題目畫出來時已經在了 */
export function TermsProvider({ locale, phrase: mod, children }: { locale: Locale; phrase?: PhraseModule; children: ReactNode }) {
  const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
  // 目前語系的索引載好就能畫題目；另一個語系只給名詞卡的次要名稱，第一次繪製送出後再讀，不排在 LCP 前面（06 第 8.2 節）
  // 目前語系的索引：locale 不同代表還沒讀到這個語系的（list 當作 null）；failed 時 list 是 []，題目照樣畫，chip 退回名詞 ID
  const [index, setIndex] = useState<{ locale: Locale; list: TermIndexEntry[]; failed: boolean } | null>(null);
  // 讀取完成時語系已經換了就不寫（舊語系較慢的回應不能蓋掉新語系的索引）
  const localeRef = useRef(locale);
  const mine = index !== null && index.locale === locale ? index.list : null;
  const indexFailed = index !== null && index.locale === locale && index.failed;
  const [others, setOthers] = useState<TermIndexEntry[]>([]);
  // 名詞卡打不開（索引與完整內容都讀不到，或名詞卡元件載不到）時的提示
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState<{ id: string; returnFocusTo?: RefObject<HTMLElement | null> } | null>(null);
  // 打開的名詞的完整內容：value 為 null 代表讀不到（離線又沒有快取）；還在讀時是 undefined
  const [detail, setDetail] = useState<{ id: string; locale: Locale; value: TermSnapshot | null } | undefined>(undefined);
  // 名詞卡元件：第一次繪製後預載，打開名詞卡時一定等到
  const [Sheet, setSheet] = useState<TermSheetComponent | null>(null);
  const zh = locale !== 'en';
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const loadIndex = useCallback(() => {
    loadTermIndex(locale).then(
      (list) => localeRef.current === locale && setIndex({ locale, list, failed: false }),
      // 讀不到：已經有這個語系的清單（重試失敗）就保留，否則給空清單讓題目照樣畫
      () => localeRef.current === locale && setIndex((cur) => ({ locale, list: cur !== null && cur.locale === locale ? cur.list : [], failed: true })),
    );
  }, [locale]);
  useEffect(() => {
    loadIndex();
  }, [loadIndex]);
  // 索引讀不到時，恢復連線就再讀一次（content.ts 的快取在失敗時已經刪掉，會重新 fetch），chip 換回名詞名稱
  useEffect(() => {
    if (!indexFailed) return;
    window.addEventListener('online', loadIndex);
    return () => window.removeEventListener('online', loadIndex);
  }, [indexFailed, loadIndex]);
  useEffect(() => {
    let alive = true;
    setOthers([]);
    const cancel = afterFirstPaint(() => {
      loadTermIndex(other).then(
        (list) => alive && setOthers(list),
        () => {},
      );
      void loadTermSheet().catch(() => {});
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [other]);
  const openId = open?.id;
  useEffect(() => {
    if (openId === undefined) return;
    let alive = true;
    loadTermDetail(openId, locale).then(
      (value) => alive && setDetail({ id: openId, locale, value: value ?? null }),
      () => alive && setDetail({ id: openId, locale, value: null }),
    );
    loadTermSheet().then(
      (C) => alive && setSheet(() => C),
      () => {
        if (!alive) return;
        setOpen(null);
        setUnavailable(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [openId, locale]);
  const categoryLabel = useCategoryLabel();
  const terms = useMemo(() => new Map((mine ?? []).map((t) => [t.id, t] as const)), [mine]);
  const otherTerms = useMemo(() => new Map(others.map((t) => [t.id, t] as const)), [others]);
  const labelOf = useCallback((id: string) => terms.get(id)?.label, [terms]);
  // keep 清單：名詞資料的中文名稱（兩個字以上）
  const phrase = useMemo<QuizPhrase | null>(() => {
    if (!zh || !mod) return null;
    const names = new Set<string>();
    for (const t of mine ?? [])
      for (const n of [t.label, t.teacherLabel, t.currentTwLabel, ...(t.aliases?.['zh-TW'] ?? [])])
        if (n && n.length > 1 && /\p{Script=Han}/u.test(n)) names.add(n);
    return { mod, names: [...names] };
  }, [zh, mod, mine]);
  const openTerm = useCallback(
    (id: string, ref?: RefObject<HTMLElement | null>) => {
      setUnavailable(false);
      // 先前讀不到的完整內容不沿用（恢復連線後再打開要重新讀）；索引先前讀不到也順便再讀一次
      setDetail((d) => (d !== undefined && d.value === null ? undefined : d));
      if (indexFailed) loadIndex();
      setOpen(ref === undefined ? { id } : { id, returnFocusTo: ref });
    },
    [indexFailed, loadIndex],
  );
  const value = useMemo<TermsContextValue>(
    () => ({ locale, terms, otherTerms, ready: mine !== null, labelOf, openTerm, phrase }),
    [locale, terms, otherTerms, mine, labelOf, openTerm, phrase],
  );
  // 完整內容讀到（或確定讀不到）、名詞卡元件也到了才打開名詞卡：兩者都在 precache，通常只差幾毫秒，對話框不會先空著再撐高。
  // 以打開的名詞 ID 判斷，不依賴索引：索引讀不到時，完整內容（TermSnapshot 含索引的欄位）照樣當名稱來源
  const loaded = open !== null && detail !== undefined && detail.id === open.id && detail.locale === locale ? detail.value : undefined;
  const current = open === null ? undefined : (terms.get(open.id) ?? loaded ?? undefined);
  // 索引與完整內容都讀不到：不畫空的名詞卡，改以提示說明（effect 裡設定，避免在 render 裡改狀態）
  const nothing = open !== null && loaded === null && terms.get(open.id) === undefined;
  useEffect(() => {
    if (!nothing) return;
    setOpen(null);
    setUnavailable(true);
  }, [nothing]);
  return (
    <TermsContext.Provider value={value}>
      {children}
      {/* 名詞卡打不開的提示：固定在 Tab bar 上方（和作答頁的提示同一個位置），不出現在頁面最底下看不到的地方 */}
      {unavailable && (
        <div className="ll-float-toasts">
          <Toast kind="warning" onDismiss={() => setUnavailable(false)}>
            <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>
          </Toast>
        </div>
      )}
      {current && open && loaded !== undefined && Sheet !== null && (
        <Sheet
          open
          onClose={() => setOpen(null)}
          term={toSheetData(
            current,
            loaded,
            otherTerms.get(current.id),
            other,
            <Trans id="content.offlineMissing">這一頁還沒下載到這台裝置。連上網路後再試一次，已下載的內容現在也能繼續使用。</Trans>,
            categoryLabel(current.category),
          )}
          {...(open.returnFocusTo === undefined ? {} : { returnFocusTo: open.returnFocusTo })}
        />
      )}
    </TermsContext.Provider>
  );
}
