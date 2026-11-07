// 自由實驗 /lab/sandbox/（03 第 3.7 節）：故事的步驟清單加學習者的修改（改金額、從範本插入步驟、刪除、上下移動），核心從第一步重播；
// 違反餘額規則時擋下並顯示可輸入的範圍；被修改影響的後續步驟列出前後金額；「還原成故事原本的樣子」一鍵還原。
// 刪除、插入、移動也先試算：會讓後面的步驟算不下去就擋下，在那一步的卡片上說明原因，所以畫面不會掉進「算不下去」的狀態；
// 步驟全部拿掉時出空白狀態（選第一步或還原）。舊版存下來、已經算不下去的狀態用橫幅說明哪一步、為什麼，並給還原的按鈕。
// 每次修改後出一則浮動提示：刪除與還原可以復原，套用金額可以直接跳到報表。
// 狀態存本機的 labSandbox（一份，sandbox-default），只存修改不存報表。?insert=<範本 ID> 從指標實驗室進來時先插入一步。
// 「先猜再改」：改金額前開預測面板（指標目標用六選項）。字串在第三層 catalog。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney, formatNumber, localePath } from '@ledgerland/i18n';
import type { LabSandbox as SandboxState } from '@ledgerland/progress';
import {
  Banner,
  Button,
  Card,
  Disclosure,
  ErrorState,
  FieldError,
  NumberInput,
  PlusIcon,
  RetryIcon,
  Toast,
  ToastRegion,
  TopBar,
  TrashIcon,
  normalizeInput,
} from '@ledgerland/web-ui';
import { CheckLights } from '../features/lab/CheckLights.tsx';
import type { LabReplay, LabRun, LabStep, ParamOverride } from '../features/lab/lab-core.ts';
import { loadTracePanel, tracePanelNow, type TraceViews } from '../features/lab/lazy-trace.ts';
import type { TraceTarget } from '../features/lab/TracePanel.tsx';
import { lineAt, useLabLabels } from '../features/lab/labels.ts';
import { labPrefersReducedMotion } from '../features/lab/motion.ts';
import { clearSandbox, readSandbox, writeSandbox } from '../features/lab/progress.ts';
import { RatioList } from '../features/lab/RatioList.tsx';
import { ratioChanges } from '../features/lab/ratio-changes.ts';
import {
  isLocalStepId,
  newSandbox,
  resetSandbox,
  sandboxStory,
  withInserted,
  withMoved,
  withOverride,
  withRemoved,
  type SandboxStep,
} from '../features/lab/sandbox.ts';
import { StatementTable } from '../features/lab/StatementTable.tsx';
import { BasisBanner } from '../features/lab/BasisBanner.tsx';
import { LabTag } from '../features/lab/LabTag.tsx';
import { IFRS_POLICY, TEACHER_POLICY } from '../features/lab/lab-policy.ts';
import { useLabView } from '../features/lab/lab-view.ts';
import { PolicyToggle } from '../features/lab/PolicyToggle.tsx';
import { useFirstStoryId } from '../features/lab/useFirstStory.ts';
import { useLabStory } from '../features/lab/useLab.ts';
import { useColumnsFit } from '../features/lab/useColumnsFit.ts';
import { MarkupParagraphs } from '../features/quiz/Markup.tsx';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { usePageReady } from '../lib/page-ready.tsx';
import { nowIso } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { useLabBack } from '../features/lab/useLabBack.ts';
import '../styles/lab.css';

const SANDBOX_ID = 'sandbox-default';

export default function LabSandbox() {
  const locale = useLocale();
  const { t } = useLingui();
  const back = useLabBack();
  const storyId = useFirstStoryId();
  const lab = useLabStory(storyId ?? undefined, locale);
  const [saved, setSaved] = useState<SandboxState | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    readSandbox(SANDBOX_ID).then((s) => alive && setSaved(s ?? null));
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(storyId === undefined || (lab.kind !== 'loading' && saved !== undefined));
  const href = (p: string) => localePath(locale, p);
  const top = (
    <TopBar
      title={t({ id: 'lab.sandbox.title', message: '自由實驗', comment: '頁面標題' })}
      backHref={href('/lab/')}
      backLabel={back.label}
      backShortLabel={back.short}
    />
  );
  if (storyId === undefined)
    return (
      <>
        {top}
        <ErrorState title={t({ id: 'lab.none.title', message: '目前沒有已發布的故事', comment: '快照裡沒有故事時' })} />
      </>
    );
  if (lab.kind === 'error')
    return (
      <>
        {top}
        <ErrorState title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室離線時的錯誤標題' })} onRetry={lab.retry} />
      </>
    );
  if (lab.kind !== 'ok' || saved === undefined) return top;
  return (
    <TermsProvider locale={locale}>
      {top}
      <SandboxBody lab={lab} initial={saved} />
    </TermsProvider>
  );
}

type Ok = Extract<ReturnType<typeof useLabStory>, { kind: 'ok' }>;

function SandboxBody({ lab, initial }: { lab: Ok; initial: SandboxState | null }) {
  const { t } = useLingui();
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const { ready } = useTerms();
  const [tablesRef, wide] = useColumnsFit();
  const story = lab.story;
  const lastStep = [...story.steps].sort((a, b) => a.order - b.order).at(-1)!.id;
  const [sandbox, setSandbox] = useState<SandboxState>(() => (initial && initial.basedOn.story === story.id ? initial : newSandbox(story, lastStep, nowIso())));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState<{ key: string; text: string } | null>(null);
  const [focusStep, setFocusStep] = useState<string | null>(null);
  // 刪除、插入、移動被擋下時，寫在那一步卡片上的原因
  const [issue, setIssue] = useState<{ stepId: string; text: string } | null>(null);
  // 修改後的浮動提示：undo 是可以復原回去的狀態，jump 是「看報表」
  const [note, setNote] = useState<{ n: number; text: string; undo?: SandboxState; jump?: boolean } | null>(null);
  const noteHeld = useRef(false);
  const noteSeq = useRef(0);
  const resultRef = useRef<HTMLElement>(null);
  const initialRef = useRef(initial);
  // 從指標實驗室帶 ?insert= 進來：在最後一步之後插入一筆，金額預設 0（03 流程 2）
  useEffect(() => {
    const tpl = params.get('insert');
    if (!tpl) return;
    setSandbox((sb) => {
      const steps = sandboxStory(story, sb).steps;
      const after = steps.at(-1)?.id ?? lastStep;
      // 金額預設 0（顯示「本筆無影響」，03 實驗室流程 2），其他參數用範本預設值
      const spec = lab.core.templates.find((x) => x.id === tpl);
      const params = Object.fromEntries((spec?.params ?? []).map((p) => [p.name, p.type === 'money' ? 0 : p.default]));
      return withInserted(sb, after, tpl, params, nowIso());
    });
    params.delete('insert');
    setParams(params, { replace: true });
  }, [params, setParams, story, lastStep, lab.core.templates]);
  // 每次修改存本機（一份）
  useEffect(() => {
    if (sandbox === initialRef.current) return;
    void writeSandbox(sandbox);
  }, [sandbox]);

  // 浮動提示 6 秒後自己收起；滑鼠或焦點停在上面時先不收
  useEffect(() => {
    if (!note) return;
    const id = window.setInterval(() => {
      if (!noteHeld.current) setNote((cur) => (cur?.n === note.n ? null : cur));
    }, 6000);
    return () => window.clearInterval(id);
  }, [note]);
  const say = (text: string, extra: { undo?: SandboxState; jump?: boolean } = {}) => setNote({ n: ++noteSeq.current, text, ...extra });

  const edited = useMemo(() => sandboxStory(story, sandbox), [story, sandbox]);
  const toOverrides = (sb: SandboxState): ParamOverride[] =>
    sb.overrides.map((o) => ({ stepId: o.stepId, eventId: o.eventId, param: o.param, value: o.value }));
  const overrides = useMemo(
    (): ParamOverride[] => sandbox.overrides.map((o) => ({ stepId: o.stepId, eventId: o.eventId, param: o.param, value: o.value })),
    [sandbox],
  );
  const replayOf = (sb: SandboxState): LabReplay => lab.core.replayLab(lab.core.asCoreStory(sandboxStory(story, sb)), toOverrides(sb));
  // 教材口徑的重播是基準：擋下、可輸入範圍、連動清單、儲存都照它；切到 IFRS 對照時用同一組修改再以 ifrs@1 重播一次只給報表區看（03 第 3.13 節）
  const replay: LabReplay = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(edited), overrides), [lab.core, edited, overrides]);
  const baseline = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(story)), [lab.core, story]);
  const labView = useLabView();
  const ifrs = labView.policy === IFRS_POLICY;
  const replayIfrs: LabReplay | null = useMemo(
    () => (ifrs ? lab.core.replayLab(lab.core.asCoreStory(edited), overrides, IFRS_POLICY) : null),
    [lab.core, edited, overrides, ifrs],
  );
  // IFRS 重播失敗而教材成功（理論上現金流相同，不應發生；防呆）：橫幅說明、數字維持教材口徑
  const ifrsFailed = ifrs && replay.ok && replayIfrs !== null && !replayIfrs.ok;
  const view: LabReplay = ifrs && replayIfrs !== null && replayIfrs.ok ? replayIfrs : replay;
  const layout = lab.core.labContext(view.ok ? view.value.policyId : TEACHER_POLICY).layout;
  const { lineLabel, accountLabel } = useLabLabels(layout);
  const templateOf = (id: string) => lab.core.templates.find((x) => x.id === id);
  const text = (lt: { 'zh-TW': string; en: string } | undefined) => lt?.[locale] ?? lt?.['zh-TW'] ?? '';
  usePageReady(ready);
  const titleOf = (s: SandboxStep) => (s.local ? text(templateOf(s.events[0]!.template)?.title) : s.title);
  type ReplayError = Extract<LabReplay, { ok: false }>['error'];
  /** 算不下去的原因，一句話（放在括號裡） */
  const whyOf = (e: ReplayError): string => {
    const account = typeof e['account'] === 'string' ? accountLabel(e['account']) : null;
    if (account) return t({ id: 'lab.sandbox.whyAccount', message: `${account}會變成負數`, comment: '算不下去的原因：某個科目的餘額會變成負數' });
    // 前置條件的說明是一整句（句尾有句號），放進括號前把句尾的標點拿掉
    const pre =
      e.code === 'precondition.failed' ? text(e['preconditionMessage'] as { 'zh-TW': string; en: string } | undefined).replace(/[。．.\s]+$/u, '') : '';
    return pre || t({ id: 'lab.sandbox.whyOther', message: '帳會算不下去', comment: '算不下去的原因：不知道是哪個科目' });
  };
  const changeCount = sandbox.overrides.length + sandbox.inserted.length + sandbox.removed.length;
  const jumpToResult = () => {
    requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: labPrefersReducedMotion() ? 'auto' : 'smooth' });
      el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    });
  };

  const applyAmount = (step: SandboxStep, eventId: string, param: string, raw: string, unit: 'money' | 'plain') => {
    const key = `${step.id}:${eventId}:${param}`;
    const parsed = normalizeInput(raw, unit);
    if (!parsed.ok) {
      setBlocked({
        key,
        text: t({ id: 'lab.sandbox.invalid', message: `請輸入 0 到 ${formatNumber(999_999_999_999, locale)} 的整數`, comment: '金額格式不對；上限已格式化' }),
      });
      return;
    }
    const value = parsed.value;
    const next = withOverride(sandbox, { stepId: step.id, eventId, param, value }, nowIso());
    const nextOverrides = next.overrides.map((o) => ({ stepId: o.stepId, eventId: o.eventId, param: o.param, value: o.value }));
    const r = lab.core.replayLab(lab.core.asCoreStory(sandboxStory(story, next)), nextOverrides);
    if (!r.ok && replay.ok) {
      const e = r.error;
      const range = e.allowedRange;
      const which = e.at.stepId === step.id ? null : edited.steps.find((s) => s.id === e.at.stepId);
      const account = typeof e['account'] === 'string' ? accountLabel(e['account']) : null;
      const min = formatMoney(range?.min ?? 0, locale);
      const max = formatMoney(range?.max ?? 0, locale);
      const order = which?.order ?? 0;
      const msg =
        range !== undefined && e.edited !== undefined
          ? which === null
            ? t({ id: 'lab.sandbox.range', message: `這一步最多可以輸入 ${max}，最少 ${min}`, comment: '被擋下時的可輸入範圍；數字已格式化' })
            : account
              ? t({
                  id: 'lab.sandbox.rangeDownstreamAccount',
                  message: `這樣改會讓第 ${order} 步的${account}變成負數；這一格可以輸入 ${min} 到 ${max}`,
                  comment: '上游改小讓下游某個科目違反餘額規則；數字已格式化',
                })
              : t({
                  id: 'lab.sandbox.rangeDownstream',
                  message: `這樣改會讓第 ${order} 步出現負數；這一格可以輸入 ${min} 到 ${max}`,
                  comment: '上游改小讓下游違反餘額規則；數字已格式化',
                })
          : e.code === 'precondition.failed'
            ? text(e['preconditionMessage'] as { 'zh-TW': string; en: string } | undefined) ||
              t({ id: 'lab.sandbox.precondition', message: '這一步的前置條件不成立', comment: '範本前置條件不成立' })
            : account
              ? t({ id: 'lab.sandbox.blocked', message: `這樣改會讓${account}變成負數，已擋下`, comment: '違反餘額規則而且算不出範圍' })
              : t({ id: 'lab.sandbox.blockedSome', message: '這樣改會讓某個科目變成負數，已擋下', comment: '違反餘額規則、算不出範圍也不知道科目' });
      setBlocked({ key, text: msg });
      return;
    }
    setBlocked(null);
    setIssue(null);
    setSandbox(next);
    if (r.ok) say(t({ id: 'lab.sandbox.applied', message: '已套用，三張報表與指標重算好了。', comment: '套用金額後的浮動提示' }), { jump: true });
  };
  // 刪除：先試算。會讓後面的步驟算不下去就留著，在這張卡片上說明是哪一步、為什麼（已經算不下去時不擋，讓人可以修好）
  const remove = (step: SandboxStep, shownOrder: number) => {
    const next = withRemoved(sandbox, step.id, nowIso());
    const r = replayOf(next);
    const name = titleOf(step);
    if (!r.ok && replay.ok) {
      const at = edited.steps.find((s) => s.id === r.error.at.stepId);
      const order = at?.order ?? 0;
      const title = at ? titleOf(at) : '';
      const why = whyOf(r.error);
      setIssue({
        stepId: step.id,
        text: t({
          id: 'lab.sandbox.removeBlocked',
          message: `這一步先留著：刪掉之後，第 ${order} 步「${title}」會做不到（${why}）。可以先刪後面的步驟，或改這一步的金額。`,
          comment: '刪除被擋下：後面某一步會算不下去；數字已代入，why 是一句原因',
        }),
      });
      return;
    }
    setIssue(null);
    setBlocked(null);
    if (focusStep === step.id) setFocusStep(null);
    setSandbox(next);
    say(t({ id: 'lab.sandbox.removed', message: `已刪除第 ${shownOrder} 步「${name}」。`, comment: '刪除後的浮動提示；數字已代入' }), { undo: sandbox });
  };
  const move = (step: SandboxStep, dir: -1 | 1) => {
    const next = withMoved(sandbox, step.id, dir, story, nowIso());
    if (!next) return;
    const r = replayOf(next);
    if (!r.ok && replay.ok) {
      const why = whyOf(r.error);
      setIssue({ stepId: step.id, text: t({ id: 'lab.sandbox.moveBlocked', message: `不能移到那裡（${why}）。`, comment: '移動被擋下；why 是一句原因' }) });
      return;
    }
    setIssue(null);
    setSandbox(next);
  };
  // 插入：先用範本的預設金額；放不下就改放 0（本筆無影響，金額讓學習者自己填，填的時候有可輸入範圍）；還是不行才擋下
  const insertAfter = (stepId: string, tpl: string) => {
    const spec = templateOf(tpl);
    const name = text(spec?.title);
    const defaults = Object.fromEntries((spec?.params ?? []).map((p) => [p.name, p.default]));
    const zeros = Object.fromEntries((spec?.params ?? []).map((p) => [p.name, p.type === 'money' ? 0 : p.default]));
    let next = withInserted(sandbox, stepId, tpl, defaults, nowIso());
    let r = replayOf(next);
    let zeroed = false;
    if (!r.ok && replay.ok) {
      next = withInserted(sandbox, stepId, tpl, zeros, nowIso());
      r = replayOf(next);
      zeroed = true;
    }
    if (!r.ok && replay.ok) {
      const why = whyOf(r.error);
      setIssue({
        stepId,
        text: t({
          id: 'lab.sandbox.insertBlocked',
          message: `這裡還不能加「${name}」（${why}）。可以換一個位置，或先把前面的金額改大。`,
          comment: '插入被擋下；why 是一句原因',
        }),
      });
      return;
    }
    setIssue(null);
    setSandbox(next);
    say(
      zeroed
        ? t({
            id: 'lab.sandbox.insertedZero',
            message: `已加入「${name}」，金額先放 0：這個位置放不下預設的金額，可以自己填。`,
            comment: '插入後的浮動提示：預設金額會違反餘額規則，所以先放 0',
          })
        : t({ id: 'lab.sandbox.inserted', message: `已加入「${name}」，可以改它的金額。`, comment: '插入後的浮動提示' }),
      { undo: sandbox },
    );
  };
  const reset = () => {
    const before = sandbox;
    setSandbox(resetSandbox(sandbox, nowIso()));
    setDraft({});
    setBlocked(null);
    setIssue(null);
    setFocusStep(null);
    void clearSandbox(SANDBOX_ID);
    say(t({ id: 'lab.sandbox.resetDone', message: '已還原成故事原本的樣子。', comment: '還原後的浮動提示' }), changeCount > 0 ? { undo: before } : {});
  };
  const undo = (to: SandboxState) => {
    setSandbox({ ...to, updatedAt: nowIso() });
    setDraft({});
    setBlocked(null);
    setIssue(null);
    setNote(null);
  };
  const showAt = (stepId: string) => {
    const on = focusStep !== stepId;
    setFocusStep(on ? stepId : null);
    if (on) jumpToResult();
  };

  // 因為修改而跟著變的後續步驟：和原故事的 run 逐步比較推導值
  const affected =
    replay.ok && baseline.ok
      ? edited.steps
          .map((s) => {
            const cur = replay.value.stepById(s.id);
            const base = baseline.value.stepById(s.id);
            if (!cur || !base || isLocalStepId(s.id)) return null;
            const diffs = Object.entries(cur.values).filter(
              ([k, v]) =>
                base.values[k] !== undefined &&
                base.values[k] !== v &&
                !k.endsWith('.amount') &&
                !sandbox.overrides.some((o) => `${o.eventId}.${o.param}` === k && o.stepId === s.id),
            );
            return diffs.length === 0 ? null : { step: s, diffs: diffs.map(([k, v]) => ({ key: k, before: base.values[k]!, after: v })) };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  // 報表區顯示的口徑（view）：教材或 IFRS 對照；對照用的教材數字由 replay 來
  const last = view.ok && view.value.stepIds.length > 0 ? view.value.step(view.value.stepIds.length - 1) : null;
  const baseStepOf = (id: string): LabStep | undefined => (replay.ok ? replay.value.stepById(id) : undefined);
  const failedAt = replay.ok ? null : (edited.steps.find((s) => s.id === replay.error.at.stepId) ?? null);
  const brokenOrder = failedAt?.order ?? 0;
  const brokenTitle = failedAt ? titleOf(failedAt) : '';
  const brokenWhy = replay.ok ? '' : whyOf(replay.error);
  const storyCount = formatNumber(story.steps.length, locale);
  const storyTitle = story.title;
  const changes = formatNumber(changeCount, locale);
  const resetLabel = t({ id: 'lab.sandbox.reset', message: '還原成故事原本的樣子', comment: '按鈕：清掉所有修改，回到故事原本的步驟與金額' });
  const templateList = (after: string) => (
    <ul className="ll-lab-sandbox__templates">
      {lab.core.templates.map((tp) => (
        <li key={tp.id}>
          <Button size="sm" variant="quiet" icon={<PlusIcon />} onClick={() => insertAfter(after, tp.id)}>
            {text(tp.title)}
          </Button>
        </li>
      ))}
    </ul>
  );
  const ratios = last ? ratioChanges(lab.core, 'excel', null, last.ratiosAfter) : [];
  const focused = focusStep && view.ok ? view.value.stepById(focusStep) : null;
  const shown = focused ?? last;
  const baseShown = ifrs && shown ? baseStepOf(shown.id) : undefined;
  const compare = view.ok && view.value.policyId === IFRS_POLICY && baseShown ? { after: baseShown.after, change: baseShown.change } : undefined;
  const compareRatios = compare && last ? baseStepOf(last.id)?.ratiosAfter : undefined;
  // 來源面板（M4b，03 第 3.9 節）：報表區的數字用顯示中的那一步、指標卡用最後一步；第一次點才載面板的模組。
  // 開面板時把當時的 run 一起記住：覆寫陣列每次重繪都是新的，replay 會重算，面板的報表要和它自己的 run 配對（核心會擋下不同 run 的報表）
  const [trace, setTrace] = useState<{ target: TraceTarget; step: LabStep; run: LabRun } | null>(null);
  const [traceViews, setTraceViews] = useState<TraceViews | null>(() => tracePanelNow());
  const traceReturn = useRef<HTMLElement | null>(null);
  const openTrace = (target: TraceTarget, step: LabStep, el: HTMLElement) => {
    if (!view.ok) return;
    traceReturn.current = el;
    setTrace({ target, step, run: view.value });
    if (traceViews === null) loadTracePanel().then(setTraceViews, () => setTrace(null));
  };
  const sandboxStepInfo = (id: string) => {
    const s = edited.steps.find((x) => x.id === id);
    return s === undefined || s.local ? undefined : { order: s.order, title: s.title };
  };
  // 本機插入的步驟沒有故事頁；故事的步驟連到它的步驟頁（練習模式）
  const sandboxStepHref = (id: string) => (story.steps.some((x) => x.id === id) ? localePath(locale, `/lab/story/${story.id}/${id}/`) : null);
  return (
    <div className="ll-lab-sandbox" data-testid="lab-sandbox">
      <p className="ll-lab-sandbox__intro">
        {t({
          id: 'lab.sandbox.intro',
          message: `這是「${storyTitle}」的副本，一共 ${storyCount} 步。在這裡怎麼改都沒關係，原本的故事不會變。`,
          comment: '自由實驗的導言；故事名稱與步數已代入',
        })}
      </p>
      <Card as="section" className="ll-lab-sbguide" aria-labelledby="ll-lab-sbguide-title" data-testid="lab-sandbox-guide">
        <h2 id="ll-lab-sbguide-title">
          <Trans id="lab.sandbox.guide.title" comment="玩法說明的標題">
            可以這樣玩
          </Trans>
        </h2>
        <ol className="ll-lab-sbguide__list">
          <li>
            <Trans id="lab.sandbox.guide.edit" comment="玩法說明第 1 點">
              改金額：挑一步，輸入新的數字，再按「套用」。
            </Trans>
          </li>
          <li>
            <Trans id="lab.sandbox.guide.insert" comment="玩法說明第 2 點">
              加一步或拿掉一步：打開「在這一步之後插入」選一種交易，或按「刪除」。
            </Trans>
          </li>
          <li>
            <Trans id="lab.sandbox.guide.result" comment="玩法說明第 3 點">
              看結果：每改一次，這一頁最下面的三張報表與指標就會重算。
            </Trans>
          </li>
        </ol>
        <p className="ll-lab-sbguide__note">
          <Trans id="lab.sandbox.guide.reset" comment="玩法說明的結尾">
            改亂了也沒關係，按「還原成故事原本的樣子」就能重來。
          </Trans>
        </p>
        {last && (
          <Button size="sm" onClick={jumpToResult} data-testid="lab-sandbox-jump">
            {t({ id: 'lab.sandbox.jump', message: '跳到報表', comment: '按鈕：捲到頁面下方的報表區' })}
          </Button>
        )}
      </Card>
      <div className="ll-lab-sandbox__tools">
        <p className="ll-lab-sandbox__status" data-testid="lab-sandbox-status">
          {changeCount === 0
            ? t({ id: 'lab.sandbox.untouched', message: '現在和故事原本一模一樣。', comment: '還沒有任何修改' })
            : t({ id: 'lab.sandbox.changes', message: `目前改了 ${changes} 個地方。`, comment: '修改的數量；數字已格式化' })}
        </p>
        {/* 算不下去或步驟全部拿掉時，還原的按鈕在下面的橫幅或卡片裡，這裡不重複 */}
        {changeCount > 0 && replay.ok && edited.steps.length > 0 && (
          <Button size="sm" icon={<RetryIcon />} onClick={reset} data-testid="lab-sandbox-reset">
            {resetLabel}
          </Button>
        )}
      </div>
      {!replay.ok && (
        <Banner
          kind="danger"
          role="alert"
          data-testid="lab-sandbox-broken"
          title={t({ id: 'lab.sandbox.broken.title', message: '這份實驗現在算不下去', comment: '存下來的修改重播失敗時的橫幅標題' })}
          actions={
            <Button size="sm" variant="primary" onClick={reset}>
              {resetLabel}
            </Button>
          }
        >
          {failedAt
            ? t({
                id: 'lab.sandbox.broken.body',
                message: `第 ${brokenOrder} 步「${brokenTitle}」做不到（${brokenWhy}），通常是因為它需要的前面步驟被拿掉了。可以刪掉這一步，或還原成故事原本的樣子重新開始。`,
                comment: '重播失敗的說明；數字已代入，括號裡是一句原因',
              })
            : t({ id: 'lab.sandbox.broken.bodyUnknown', message: '可以還原成故事原本的樣子重新開始。', comment: '重播失敗但找不到是哪一步' })}
        </Banner>
      )}
      {edited.steps.length === 0 && (
        <Card as="section" className="ll-lab-sbempty" aria-labelledby="ll-lab-sbempty-title" data-testid="lab-sandbox-empty">
          <h2 id="ll-lab-sbempty-title">
            <Trans id="lab.sandbox.empty.title" comment="步驟全部拿掉時的標題">
              步驟都拿掉了
            </Trans>
          </h2>
          <p>
            <Trans id="lab.sandbox.empty.body" comment="步驟全部拿掉時的說明">
              選一種交易當第一步，或還原成故事原本的樣子。
            </Trans>
          </p>
          {templateList(sandbox.basedOn.throughStep)}
          {issue?.stepId === sandbox.basedOn.throughStep && <FieldError id="ll-lab-sbempty-issue">{issue.text}</FieldError>}
          <Button variant="primary" icon={<RetryIcon />} onClick={reset} data-testid="lab-sandbox-empty-reset">
            {resetLabel}
          </Button>
        </Card>
      )}
      <ol className="ll-lab-sandbox__steps" data-testid="lab-sandbox-steps">
        {edited.steps.map((s, i) => {
          const run = replay.ok ? replay.value.stepById(s.id) : null;
          const ev = s.events[0]!;
          const tpl = templateOf(ev.template);
          const params = tpl?.params ?? [];
          return (
            <li
              key={s.id}
              className={`ll-lab-sbstep${s.local ? ' is-local' : ''}${focusStep === s.id ? ' is-focus' : ''}`}
              data-testid="lab-sandbox-step"
              data-step={s.id}
            >
              <div className="ll-lab-sbstep__head">
                <span className="ll-lab-sbstep__order" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="ll-lab-sbstep__title">{s.local ? text(tpl?.title) : s.title}</span>
                <span className="ll-lab-sbstep__actions">
                  <Button size="sm" variant="quiet" onClick={() => showAt(s.id)} aria-pressed={focusStep === s.id}>
                    {t({ id: 'lab.sandbox.show', message: '看報表', comment: '步驟卡的按鈕' })}
                  </Button>
                  {s.local && (
                    <>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => move(s, -1)}
                        aria-label={t({ id: 'lab.sandbox.moveUp', message: '上移', comment: '步驟卡的按鈕' })}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => move(s, 1)}
                        aria-label={t({ id: 'lab.sandbox.moveDown', message: '下移', comment: '步驟卡的按鈕' })}
                      >
                        ↓
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<TrashIcon />}
                    onClick={() => remove(s, i + 1)}
                    aria-label={t({ id: 'lab.sandbox.remove', message: `刪除第 ${i + 1} 步`, comment: '步驟卡的按鈕；數字已代入' })}
                  >
                    {t({ id: 'lab.sandbox.removeShort', message: '刪除', comment: '步驟卡的按鈕' })}
                  </Button>
                </span>
              </div>
              {issue?.stepId === s.id && (
                <FieldError id={`ll-lab-sbstep-issue-${s.id}`} className="ll-lab-sbstep__issue">
                  {issue.text}
                </FieldError>
              )}
              {run && (
                <p className="ll-lab-sbstep__summary">
                  <MarkupParagraphs
                    text={text(tpl?.summary)
                      .replace(/\{\{(\w+):param\.(\w+)\}\}/g, `{{$1:${ev.id}.$2}}`)
                      .replace(/\{\{(\w+):derived\.(\w+)\}\}/g, `{{$1:${ev.id}.$2}}`)}
                    ctx={{ values: run.values }}
                  />
                </p>
              )}
              {run?.posted.noEffect && (
                <p className="ll-lab-sbstep__none" data-testid="lab-sandbox-noeffect">
                  <Trans id="lab.effects.none">本筆無影響</Trans>
                </p>
              )}
              {params.length > 0 && (
                <div className="ll-lab-sbstep__params">
                  {params.map((p) => {
                    const key = `${s.id}:${ev.id}:${p.name}`;
                    const override = sandbox.overrides.find((o) => o.stepId === s.id && o.eventId === ev.id && o.param === p.name);
                    const current = override?.value ?? ev.params[p.name] ?? p.default;
                    const unit = p.type === 'money' ? 'money' : 'plain';
                    return (
                      <form
                        key={p.name}
                        className="ll-lab-sbstep__param"
                        onSubmit={(e) => {
                          e.preventDefault();
                          applyAmount(s, ev.id, p.name, draft[key] ?? String(current), unit);
                        }}
                      >
                        <NumberInput
                          label={text(p.label)}
                          unit={unit}
                          value={draft[key] ?? String(current)}
                          onChange={(raw) => setDraft((d) => ({ ...d, [key]: raw }))}
                          invalid={blocked?.key === key}
                          {...(blocked?.key === key ? { describedBy: `${key}-err` } : {})}
                          showParsed={false}
                        />
                        <Button type="submit" size="sm" data-testid="lab-sandbox-apply">
                          {t({ id: 'lab.sandbox.apply', message: '套用', comment: '改金額的按鈕' })}
                        </Button>
                        {blocked?.key === key && <FieldError id={`${key}-err`}>{blocked.text}</FieldError>}
                      </form>
                    );
                  })}
                </div>
              )}
              <Disclosure
                variant="plain"
                summary={t({ id: 'lab.sandbox.insertAfter', message: '在這一步之後插入', comment: '範本清單的展開標題' })}
                className="ll-lab-sbstep__insert"
              >
                {templateList(s.id)}
              </Disclosure>
            </li>
          );
        })}
      </ol>
      {affected.length > 0 && (
        <Card as="section" className="ll-lab-affected" data-testid="lab-affected">
          <h2>
            <Trans id="lab.sandbox.affected" comment="連動清單的標題">
              因為你的修改，後面這些步驟也跟著變了
            </Trans>
          </h2>
          <ul>
            {affected.map((a) => (
              <li key={a.step.id}>
                {t({ id: 'lab.sandbox.affectedStep', message: `第 ${a.step.order} 步`, comment: '連動清單的項目；數字已代入' })}：
                {a.diffs.map((d) => `${formatMoney(d.before, locale)} → ${formatMoney(d.after, locale)}`).join('、')}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {shown && view.ok && (
        <section
          className="ll-lab-sandbox__result"
          aria-labelledby="ll-lab-sandbox-result"
          ref={resultRef}
          data-testid="lab-sandbox-result"
          data-policy={view.value.policyId}
        >
          <div className="ll-lab-sandbox__head">
            <h2 id="ll-lab-sandbox-result" tabIndex={-1}>
              {focused
                ? t({
                    id: 'lab.sandbox.resultAt',
                    message: `第 ${edited.steps.findIndex((s) => s.id === focused.id) + 1} 步之後的報表`,
                    comment: '報表區標題；數字已代入',
                  })
                : t({ id: 'lab.sandbox.result', message: '最後一步之後的報表', comment: '報表區標題' })}
            </h2>
            {/* 報表口徑（03 第 3.13 節）：修改兩種口徑共用，切換只重算報表區 */}
            <PolicyToggle value={labView.policy} onChange={labView.setPolicy} />
          </div>
          {ifrs && <BasisBanner failed={ifrsFailed} />}
          <p className="ll-lab-session__equation">
            {lineLabel('bs_total_assets')} {formatMoney(lineAt(shown.after, 'bs_total_assets'), locale)} ＝ {lineLabel('bs_total_liabilities')}{' '}
            {formatMoney(lineAt(shown.after, 'bs_total_liabilities'), locale)} ＋ {lineLabel('bs_total_equity')}{' '}
            {formatMoney(lineAt(shown.after, 'bs_total_equity'), locale)}
          </p>
          <CheckLights fiveStep={shown.fiveStep} layout={layout} compact />
          <div className="ll-lab-tables__grid" ref={tablesRef}>
            {(['income_statement', 'cash_flow_indirect', 'balance_sheet'] as const).map((k) => (
              <StatementTable
                key={k}
                caption={lineLabel(k === 'income_statement' ? 'is_net_income' : k === 'balance_sheet' ? 'bs_total_assets' : 'cf_cash_end')}
                statement={k}
                before={shown.before}
                after={shown.after}
                view={wide ? 'columns' : 'cumulative'}
                layout={layout}
                onTrace={(lineId, window, el) => openTrace({ kind: 'line', lineId, window }, shown, el)}
                compare={compare}
              />
            ))}
          </div>
          <RatioList
            items={ratios}
            layout={layout}
            onTrace={(item, el) => last && openTrace({ kind: 'ratio', ratioRef: item.ratioRef, spec: item.spec, result: item.after }, last, el)}
            compareAfter={compareRatios}
          />
        </section>
      )}
      {traceViews && trace && (
        <traceViews.TracePanel
          open
          onClose={() => setTrace(null)}
          returnFocusTo={traceReturn}
          target={trace.target}
          run={trace.run}
          step={trace.step}
          trace={(window, lineId) => lab.core.traceLabLine(trace.run, trace.step, window, lineId)}
          entriesOf={(id) => lab.core.entriesOfStep(trace.run, id)}
          layout={trace.run.ctx.layout}
          basisTag={trace.run.policyId === IFRS_POLICY ? <LabTag kind="ifrs" testId="lab-trace-basis" /> : undefined}
          stepInfo={sandboxStepInfo}
          stepHref={sandboxStepHref}
        />
      )}
      <ToastRegion className="ll-float-toasts" data-testid="lab-sandbox-toasts" onHoldChange={(held) => (noteHeld.current = held)}>
        {note && (
          <Toast
            key={note.n}
            kind={note.undo ? 'info' : 'success'}
            onDismiss={() => setNote(null)}
            {...(note.undo
              ? {
                  action: {
                    label: t({ id: 'lab.sandbox.undo', message: '復原', comment: '浮動提示的動作：回到這次修改之前' }),
                    onClick: () => undo(note.undo!),
                  },
                }
              : note.jump && last
                ? {
                    action: {
                      label: t({ id: 'lab.sandbox.show', message: '看報表', comment: '步驟卡的按鈕' }),
                      onClick: () => {
                        setNote(null);
                        jumpToResult();
                      },
                    },
                  }
                : {})}
          >
            {note.text}
          </Toast>
        )}
      </ToastRegion>
    </div>
  );
}
