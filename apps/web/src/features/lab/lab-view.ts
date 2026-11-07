// 實驗室的檢視設定（settings 的 labView，06 第 4.2 節；schema 在 packages/progress 的 LabView）：報表口徑（教材／IFRS 對照）與分錄層的展開狀態。
// 口徑的記憶規則（2026-11-07 的決定，03 第 3.13 節、10 第 11.2 節）：預設一律教材；同一次使用中換步驟、換頁都沿用；重新載入網站或直接開網址回到教材；
// 從題目開啟（?from=）一律先用教材。做法：模組層的旗標記「這個 document 內使用者已切換過口徑」，旗標沒有時第一次讀設定只回傳教材（設定值保留不改寫，
// 備份照常帶著），使用者切換後旗標設起、之後的頁面照設定值。寫不進去（儲存壞掉）時畫面照常。
import type { ProgressStore } from '@ledgerland/progress';
import { useCallback, useEffect, useState } from 'react';
import { getProgressStore, nowIso } from '../../lib/progress/index.ts';
import { IFRS_POLICY, TEACHER_POLICY, type LabPolicyId } from './lab-policy.ts';

export const LAB_VIEW_SETTING = 'labView';

export interface LabViewState {
  readonly policy: LabPolicyId;
  readonly journalLayerOpen: boolean;
}

export const DEFAULT_LAB_VIEW: LabViewState = { policy: TEACHER_POLICY, journalLayerOpen: false };

/** 設定裡存的整筆值（schema 是 strict：四個欄位都要在） */
interface StoredLabView {
  policy: string;
  window: 'cumulative' | 'transaction';
  statement: 'is' | 'bs' | 'cf';
  journalLayerOpen: boolean;
}

const STORED_DEFAULT: StoredLabView = { policy: TEACHER_POLICY, window: 'cumulative', statement: 'is', journalLayerOpen: false };

/** 這個 document 內使用者已經切換過口徑（重新載入就歸零） */
let switched = false;

export function labViewSwitched(): boolean {
  return switched;
}

/** 測試用：回到剛載入的狀態 */
export function resetLabViewForTests(): void {
  switched = false;
}

export function isLabPolicyId(v: unknown): v is LabPolicyId {
  return v === TEACHER_POLICY || v === IFRS_POLICY;
}

/** 設定值整理成畫面要的形狀；壞掉或缺欄位就用預設 */
export function normaliseLabView(value: unknown): LabViewState {
  if (typeof value !== 'object' || value === null) return DEFAULT_LAB_VIEW;
  const o = value as Partial<Record<keyof StoredLabView, unknown>>;
  return {
    policy: isLabPolicyId(o.policy) ? o.policy : TEACHER_POLICY,
    journalLayerOpen: typeof o.journalLayerOpen === 'boolean' ? o.journalLayerOpen : false,
  };
}

/**
 * 這一頁要用的口徑：設定裡存的是 stored；使用者這次使用中切換過（switched）而且不是從題目開啟（fromQuestion）才照設定，其餘一律教材。
 * 純函式，給 useLabView 與測試用。
 */
export function policyToShow(stored: LabPolicyId, opts: { readonly switched: boolean; readonly fromQuestion: boolean }): LabPolicyId {
  if (opts.fromQuestion || !opts.switched) return TEACHER_POLICY;
  return stored;
}

export async function readLabView(store: Pick<ProgressStore, 'getSetting'>): Promise<LabViewState> {
  try {
    return normaliseLabView((await store.getSetting(LAB_VIEW_SETTING))?.value);
  } catch {
    return DEFAULT_LAB_VIEW;
  }
}

/** 讀、改、寫一筆：其他欄位保留（window 與 statement 目前沒有畫面在用，維持 schema 要的預設） */
export async function writeLabView(store: Pick<ProgressStore, 'getSetting' | 'setSetting'>, patch: Partial<LabViewState>, now: string): Promise<void> {
  try {
    const cur = (await store.getSetting(LAB_VIEW_SETTING))?.value;
    const base: StoredLabView = typeof cur === 'object' && cur !== null ? { ...STORED_DEFAULT, ...(cur as Partial<StoredLabView>) } : STORED_DEFAULT;
    if (!isLabPolicyId(base.policy)) base.policy = TEACHER_POLICY;
    await store.setSetting(LAB_VIEW_SETTING, { ...base, ...patch }, now);
  } catch {
    /* 寫不進去不影響畫面 */
  }
}

export interface UseLabView {
  readonly policy: LabPolicyId;
  readonly setPolicy: (policy: LabPolicyId) => void;
  readonly journalLayerOpen: boolean;
  readonly setJournalLayerOpen: (open: boolean) => void;
}

/**
 * 口徑與分錄層的狀態：一開始是預設（教材、收合），讀到設定後依記憶規則補上；切換時先改畫面再寫設定。
 * fromQuestion：從題目開啟（?from=）的步驟頁，一律先用教材（切換後仍可改）。
 */
export function useLabView(opts: { readonly fromQuestion?: boolean } = {}): UseLabView {
  const fromQuestion = opts.fromQuestion === true;
  const [state, setState] = useState<LabViewState>(DEFAULT_LAB_VIEW);
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => readLabView(s))
      .then((v) => {
        if (!alive) return;
        setState((cur) => ({ policy: policyToShow(v.policy, { switched, fromQuestion }), journalLayerOpen: cur.journalLayerOpen || v.journalLayerOpen }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fromQuestion]);
  const setPolicy = useCallback((policy: LabPolicyId) => {
    switched = true;
    setState((cur) => (cur.policy === policy ? cur : { ...cur, policy }));
    void getProgressStore().then(
      (s) => writeLabView(s, { policy }, nowIso()),
      () => {},
    );
  }, []);
  const setJournalLayerOpen = useCallback((open: boolean) => {
    setState((cur) => (cur.journalLayerOpen === open ? cur : { ...cur, journalLayerOpen: open }));
    void getProgressStore().then(
      (s) => writeLabView(s, { journalLayerOpen: open }, nowIso()),
      () => {},
    );
  }, []);
  return { policy: state.policy, setPolicy, journalLayerOpen: state.journalLayerOpen, setJournalLayerOpen };
}
