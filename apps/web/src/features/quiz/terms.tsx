// 作答頁的名詞資料與共用名詞卡（03 第 2.9 節第 5 項、第 4.3 節）：兩種語系的名詞快照用既有的 loadTerms 讀進來，
// {{term:tm_x}} 與回饋區的 TermChip 都透過 openTerm 開同一張 TermSheet；關閉後焦點回到開啟它的 chip。
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { getLocale, type Locale } from '@ledgerland/i18n';
import { TermSheet, type NoteTagKind, type TermSheetData } from '@ledgerland/web-ui';
import { loadTerms, type TermSnapshot } from '../../lib/content.ts';
import { Markup } from './Markup.tsx';

export interface TermsContextValue {
  readonly locale: Locale;
  readonly terms: ReadonlyMap<string, TermSnapshot>;
  /** 另一種語言的名詞（名詞卡副標） */
  readonly otherTerms: ReadonlyMap<string, TermSnapshot>;
  readonly ready: boolean;
  readonly labelOf: (id: string) => string | undefined;
  readonly openTerm: (id: string, returnFocusTo?: RefObject<HTMLElement | null>) => void;
}

const TermsContext = createContext<TermsContextValue | null>(null);

export function useTerms(): TermsContextValue {
  const v = useContext(TermsContext);
  if (v === null) throw new Error('useTerms 要在 TermsProvider 之內使用');
  return v;
}

const NOTE_KINDS: readonly string[] = ['old_name', 'simplified', 'single_period', 'not_ifrs_line', 'ifrs_not_scored', 'design_note'];

function toSheetData(term: TermSnapshot, other: TermSnapshot | undefined, otherLocale: Locale): TermSheetData {
  const flags = term.flags.filter((f): f is NoteTagKind => NOTE_KINDS.includes(f));
  return {
    label: term.label,
    ...(other === undefined ? {} : { secondaryLabel: other.label, secondaryLang: getLocale(otherLocale).htmlLang }),
    teacherLabel: term.teacherLabel,
    currentTwLabel: term.currentTwLabel,
    ifrsEnglish: term.ifrsEnglish,
    definition: <Markup text={term.definition} />,
    ...(term.note === undefined ? {} : { example: term.note }),
    ...(term.ifrsNote === undefined ? {} : { ifrsNote: <Markup text={term.ifrsNote} /> }),
    flags,
  };
}

export function TermsProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const other: Locale = locale === 'en' ? 'zh-TW' : 'en';
  const [lists, setLists] = useState<{ mine: TermSnapshot[]; other: TermSnapshot[] } | null>(null);
  const [open, setOpen] = useState<{ id: string; returnFocusTo?: RefObject<HTMLElement | null> } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([loadTerms(locale), loadTerms(other)]).then(
      ([mine, others]) => alive && setLists({ mine, other: others }),
      () => alive && setLists({ mine: [], other: [] }),
    );
    return () => {
      alive = false;
    };
  }, [locale, other]);
  const terms = useMemo(() => new Map((lists?.mine ?? []).map((t) => [t.id, t] as const)), [lists]);
  const otherTerms = useMemo(() => new Map((lists?.other ?? []).map((t) => [t.id, t] as const)), [lists]);
  const labelOf = useCallback((id: string) => terms.get(id)?.label, [terms]);
  const openTerm = useCallback((id: string, ref?: RefObject<HTMLElement | null>) => {
    setOpen(ref === undefined ? { id } : { id, returnFocusTo: ref });
  }, []);
  const value = useMemo<TermsContextValue>(
    () => ({ locale, terms, otherTerms, ready: lists !== null, labelOf, openTerm }),
    [locale, terms, otherTerms, lists, labelOf, openTerm],
  );
  const current = open === null ? undefined : terms.get(open.id);
  return (
    <TermsContext.Provider value={value}>
      {children}
      {current && open && (
        <TermSheet
          open
          onClose={() => setOpen(null)}
          term={toSheetData(current, otherTerms.get(current.id), other)}
          {...(open.returnFocusTo === undefined ? {} : { returnFocusTo: open.returnFocusTo })}
        />
      )}
    </TermsContext.Provider>
  );
}
