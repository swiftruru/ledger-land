// 自由實驗 /lab/sandbox/（03 第 3.7 節）：故事的步驟清單加學習者的修改（改金額、從範本插入步驟、刪除、上下移動），核心從第一步重播；
// 違反餘額規則時擋下並顯示可輸入的範圍；被修改影響的後續步驟列出前後金額；「重設為故事原本的金額」一鍵還原。
// 狀態存本機的 labSandbox（一份，sandbox-default），只存修改不存報表。?insert=<範本 ID> 從指標實驗室進來時先插入一步。
// 「先猜再改」：改金額前開預測面板（指標目標用六選項）。字串在第三層 catalog。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney, formatNumber, localePath } from '@ledgerland/i18n';
import type { LabSandbox as SandboxState } from '@ledgerland/progress';
import { Button, Card, Disclosure, ErrorState, FieldError, NumberInput, PlusIcon, TopBar, TrashIcon, normalizeInput } from '@ledgerland/web-ui';
import { CheckLights } from '../features/lab/CheckLights.tsx';
import type { LabReplay, ParamOverride } from '../features/lab/lab-core.ts';
import { lineAt, useLabLabels } from '../features/lab/labels.ts';
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
import { useFirstStoryId } from '../features/lab/useFirstStory.ts';
import { useLabStory } from '../features/lab/useLab.ts';
import { useWide } from '../features/lab/useWide.ts';
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
  const wide = useWide();
  const story = lab.story;
  const lastStep = [...story.steps].sort((a, b) => a.order - b.order).at(-1)!.id;
  const [sandbox, setSandbox] = useState<SandboxState>(() => (initial && initial.basedOn.story === story.id ? initial : newSandbox(story, lastStep, nowIso())));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState<{ key: string; text: string } | null>(null);
  const [focusStep, setFocusStep] = useState<string | null>(null);
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

  const edited = useMemo(() => sandboxStory(story, sandbox), [story, sandbox]);
  const overrides: ParamOverride[] = sandbox.overrides.map((o) => ({ stepId: o.stepId, eventId: o.eventId, param: o.param, value: o.value }));
  const replay: LabReplay = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(edited), overrides), [lab.core, edited, overrides]);
  const baseline = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(story)), [lab.core, story]);
  const layout = lab.core.labContext().layout;
  const { lineLabel, accountLabel } = useLabLabels(layout);
  const templateOf = (id: string) => lab.core.templates.find((x) => x.id === id);
  const text = (lt: { 'zh-TW': string; en: string } | undefined) => lt?.[locale] ?? lt?.['zh-TW'] ?? '';
  usePageReady(ready);

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
    if (!r.ok) {
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
    setSandbox(next);
  };
  const remove = (stepId: string) => setSandbox((sb) => withRemoved(sb, stepId, nowIso()));
  const move = (stepId: string, dir: -1 | 1) => setSandbox((sb) => withMoved(sb, stepId, dir, story, nowIso()) ?? sb);
  const insertAfter = (stepId: string, tpl: string) => {
    const spec = templateOf(tpl);
    const defaults = Object.fromEntries((spec?.params ?? []).map((p) => [p.name, p.default]));
    setSandbox((sb) => withInserted(sb, stepId, tpl, defaults, nowIso()));
  };
  const reset = () => {
    setSandbox((sb) => resetSandbox(sb, nowIso()));
    setDraft({});
    setBlocked(null);
    void clearSandbox(SANDBOX_ID);
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

  const last = replay.ok ? replay.value.step(replay.value.stepIds.length - 1) : null;
  const ratios = last ? ratioChanges(lab.core, 'excel', null, last.ratiosAfter) : [];
  const focused = focusStep && replay.ok ? replay.value.stepById(focusStep) : null;
  const shown = focused ?? last;
  return (
    <div className="ll-lab-sandbox" data-testid="lab-sandbox">
      <p className="ll-lab-sandbox__intro">
        <Trans id="lab.sandbox.intro" comment="自由實驗的導言">
          這是故事的副本：改任何一步的金額，或從範本插入一步，三表與指標馬上重算。故事本身不會被改動。
        </Trans>
      </p>
      <div className="ll-lab-sandbox__tools">
        <Button size="sm" variant="quiet" onClick={reset} data-testid="lab-sandbox-reset">
          {t({ id: 'lab.sandbox.reset', message: '重設為故事原本的金額', comment: '按鈕' })}
        </Button>
      </div>
      {!replay.ok && (
        <FieldError id="ll-lab-sandbox-error">
          {t({
            id: 'lab.sandbox.replayFailed',
            message: `目前的修改讓第 ${edited.steps.findIndex((s) => s.id === replay.error.at.stepId) + 1} 步無法過帳，請改回或刪除那一步`,
            comment: '整份重播失敗（例如插入的步驟不滿足前置條件）；數字已代入',
          })}
        </FieldError>
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
                  <Button size="sm" variant="quiet" onClick={() => setFocusStep(focusStep === s.id ? null : s.id)} aria-pressed={focusStep === s.id}>
                    {t({ id: 'lab.sandbox.show', message: '看報表', comment: '步驟卡的按鈕' })}
                  </Button>
                  {s.local && (
                    <>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => move(s.id, -1)}
                        aria-label={t({ id: 'lab.sandbox.moveUp', message: '上移', comment: '步驟卡的按鈕' })}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => move(s.id, 1)}
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
                    onClick={() => remove(s.id)}
                    aria-label={t({ id: 'lab.sandbox.remove', message: `刪除第 ${i + 1} 步`, comment: '步驟卡的按鈕；數字已代入' })}
                  >
                    {t({ id: 'lab.sandbox.removeShort', message: '刪除', comment: '步驟卡的按鈕' })}
                  </Button>
                </span>
              </div>
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
                <ul className="ll-lab-sandbox__templates">
                  {lab.core.templates.map((tp) => (
                    <li key={tp.id}>
                      <Button size="sm" variant="quiet" icon={<PlusIcon />} onClick={() => insertAfter(s.id, tp.id)}>
                        {text(tp.title)}
                      </Button>
                    </li>
                  ))}
                </ul>
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
      {shown && replay.ok && (
        <section className="ll-lab-sandbox__result" aria-labelledby="ll-lab-sandbox-result">
          <h2 id="ll-lab-sandbox-result">
            {focused
              ? t({
                  id: 'lab.sandbox.resultAt',
                  message: `第 ${edited.steps.findIndex((s) => s.id === focused.id) + 1} 步之後的報表`,
                  comment: '報表區標題；數字已代入',
                })
              : t({ id: 'lab.sandbox.result', message: '最後一步之後的報表', comment: '報表區標題' })}
          </h2>
          <p className="ll-lab-session__equation">
            {lineLabel('bs_total_assets')} {formatMoney(lineAt(shown.after, 'bs_total_assets'), locale)} ＝ {lineLabel('bs_total_liabilities')}{' '}
            {formatMoney(lineAt(shown.after, 'bs_total_liabilities'), locale)} ＋ {lineLabel('bs_total_equity')}{' '}
            {formatMoney(lineAt(shown.after, 'bs_total_equity'), locale)}
          </p>
          <CheckLights fiveStep={shown.fiveStep} layout={layout} compact />
          <div className="ll-lab-tables__grid">
            {(['income_statement', 'cash_flow_indirect', 'balance_sheet'] as const).map((k) => (
              <StatementTable
                key={k}
                caption={lineLabel(k === 'income_statement' ? 'is_net_income' : k === 'balance_sheet' ? 'bs_total_assets' : 'cf_cash_end')}
                statement={k}
                before={shown.before}
                after={shown.after}
                view={wide ? 'columns' : 'cumulative'}
                layout={layout}
              />
            ))}
          </div>
          <RatioList items={ratios} layout={layout} />
        </section>
      )}
    </div>
  );
}
