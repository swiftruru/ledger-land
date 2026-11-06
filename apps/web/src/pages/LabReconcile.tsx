// 勾稽練習 /lab/reconcile/（03 第 3.8 節）：選故事的一步，三張表顯示該步之後的累計報表，開放的格子是輸入框（基本：現金流量表起算的稅前淨利、
// 資產負債表的現金、未分配盈餘；進階再開期末存貨兩處與現金流量表的調整列），每填一格燈號立刻更新（核心 fiveStepCheck 代入學習者的值）；
// 提示三層（哪一張表、哪一列、顯示答案），用到第三層記為「看過答案」；全部相符後顯示完成卡並連到下一步。結果逐格記在本機，不進星星。
// 勾稽練習固定用教材口徑。字串在第三層 catalog。
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatMoney, localePath } from '@ledgerland/i18n';
import { Button, Card, ErrorState, NumberInput, Segmented, Switch, TopBar, normalizeInput } from '@ledgerland/web-ui';
import { CheckLights } from '../features/lab/CheckLights.tsx';
import { lineAt, useLabLabels } from '../features/lab/labels.ts';
import { saveReconcile } from '../features/lab/progress.ts';
import { StatementTable } from '../features/lab/StatementTable.tsx';
import { useFirstStoryId } from '../features/lab/useFirstStory.ts';
import { useLabStory } from '../features/lab/useLab.ts';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { useLabBack } from '../features/lab/useLabBack.ts';
import '../styles/lab.css';

const BASIC_CELLS = ['cf_pretax_income', 'bs_cash', 'bs_retained_earnings'] as const;
const ADVANCED_EXTRA = [
  'is_closing_inventory',
  'bs_inventory',
  'cf_depreciation',
  'cf_interest_expense_addback',
  'cf_income_tax_paid',
  'cf_receivables_increase',
  'cf_inventory_increase',
  'cf_payables_increase',
  'cf_share_issue',
  'cf_capex',
] as const;
const STATEMENT_OF = (id: string): 'is' | 'cf' | 'bs' => (id.startsWith('is_') ? 'is' : id.startsWith('cf_') ? 'cf' : 'bs');

export default function LabReconcile() {
  const locale = useLocale();
  const { t } = useLingui();
  const back = useLabBack();
  const storyId = useFirstStoryId();
  const lab = useLabStory(storyId ?? undefined, locale);
  usePageReady(storyId === undefined || lab.kind !== 'loading');
  const href = (p: string) => localePath(locale, p);
  const top = (
    <TopBar
      title={t({ id: 'lab.reconcile.title', message: '勾稽練習', comment: '頁面標題' })}
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
  if (lab.kind !== 'ok') return top;
  return (
    <TermsProvider locale={locale}>
      {top}
      <ReconcileBody lab={lab} />
    </TermsProvider>
  );
}

type Ok = Extract<ReturnType<typeof useLabStory>, { kind: 'ok' }>;

function ReconcileBody({ lab }: { lab: Ok }) {
  const { t } = useLingui();
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const { ready } = useTerms();
  const story = lab.story;
  const steps = useMemo(() => [...story.steps].sort((a, b) => a.order - b.order), [story]);
  const replay = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(story)), [lab.core, story]);
  if (!replay.ok) throw new Error(`故事重播失敗：${replay.error.code}`);
  const run = replay.value;
  const requested = params.get('step');
  const stepId = requested && run.stepIds.includes(requested) ? requested : (lab.progress.state?.stepId ?? run.stepIds[6] ?? run.stepIds[0]!);
  const step = run.stepById(stepId)!;
  const [advanced, setAdvanced] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const layout = run.ctx.layout;
  const { lineLabel } = useLabLabels(layout);
  usePageReady(ready);
  const cells = advanced ? [...BASIC_CELLS, ...ADVANCED_EXTRA.filter((id) => step.after.lines.get(id)?.visible)] : [...BASIC_CELLS];
  const parsed: Record<string, number> = {};
  const pending = new Set<string>();
  for (const id of cells) {
    const raw = values[id];
    const r = raw === undefined || raw.trim() === '' ? null : normalizeInput(raw, 'money');
    if (r !== null && r.ok) parsed[id] = id === 'is_closing_inventory' ? r.value : r.value;
    else pending.add(id);
  }
  const check = lab.core.reconcileCheck(step.after, parsed);
  // 哪些燈號用到還沒填的格子：②看現金流量表起算的稅前淨利與損益表的列；③看現金流量表的列與資產負債表的現金；④看未分配盈餘與損益表的列；⑤看資產負債表兩邊（現金、未分配盈餘、存貨都算）
  const pendingSteps = new Set<number>();
  for (const id of pending) {
    if (id === 'cf_pretax_income' || id.startsWith('is_')) pendingSteps.add(2);
    if (id.startsWith('cf_') || id === 'bs_cash') pendingSteps.add(3);
    if (id === 'bs_retained_earnings' || id.startsWith('is_')) pendingSteps.add(4);
    if (id.startsWith('bs_') || id.startsWith('is_')) pendingSteps.add(5);
  }
  const allFilled = pending.size === 0;
  const allPass = allFilled && check.checks.every((c) => c.pass);
  const complete = () => {
    if (done) return;
    setDone(true);
    void saveReconcile(story.id, stepId, {
      done: true,
      sawAnswer: Object.entries(hints)
        .filter(([, n]) => n >= 3)
        .map(([id]) => id),
    });
  };
  if (allPass && !done) complete();
  const pick = (id: string) => {
    setParams({ step: id }, { replace: true });
    setValues({});
    setHints({});
    setDone(false);
  };
  const hintText = (id: string, level: number): string => {
    const st = STATEMENT_OF(id);
    const names = {
      is: t({ id: 'lab.stage.income', message: '損益表' }),
      cf: t({ id: 'lab.stage.cashflow', message: '現金流量表' }),
      bs: t({ id: 'lab.stage.balance', message: '資產負債表' }),
    };
    if (level === 1) return t({ id: 'lab.reconcile.hint1', message: `看${names[st]}`, comment: '第一層提示：哪一張表' });
    if (level === 2) return t({ id: 'lab.reconcile.hint2', message: `看「${lineLabel(id)}」這一列`, comment: '第二層提示：哪一列' });
    return t({ id: 'lab.reconcile.hint3', message: `答案是 ${formatMoney(lineAt(step.after, id), locale)}`, comment: '第三層提示：答案；數字已格式化' });
  };
  const inputs: Record<string, React.ReactNode> = {};
  for (const id of cells) {
    inputs[id] = (
      <span className="ll-lab-reconcile__cell" data-testid={`lab-cell-${id}`}>
        <NumberInput label={lineLabel(id)} unit="money" value={values[id] ?? ''} onChange={(raw) => setValues((v) => ({ ...v, [id]: raw }))} />
        <Button
          size="sm"
          variant="quiet"
          onClick={() => setHints((h) => ({ ...h, [id]: Math.min(3, (h[id] ?? 0) + 1) }))}
          // 可讀名稱以看得到的字（「需要提示」）開頭，後面才接是哪一列：用語音控制的人念畫面上的字就點得到（WCAG 2.5.3）
          aria-label={t({
            id: 'lab.reconcile.hintFor',
            message: `需要提示：${lineLabel(id)}`,
            comment: '提示按鈕的可讀名稱；開頭要和按鈕上看得到的字（lab.reconcile.hint）一樣，後面接這一列的名稱',
          })}
        >
          {t({ id: 'lab.reconcile.hint', message: '需要提示', comment: '提示按鈕' })}
        </Button>
        {(hints[id] ?? 0) > 0 && (
          <span className="ll-lab-reconcile__hint" role="status">
            {hintText(id, hints[id]!)}
          </span>
        )}
      </span>
    );
  }
  const firstFailed = check.firstFailedStep;
  const nextStepId = run.stepIds[step.index + 1];
  return (
    <div className="ll-lab-reconcile" data-testid="lab-reconcile">
      <p className="ll-lab-reconcile__intro">
        <Trans id="lab.reconcile.intro" comment="勾稽練習的導言">
          三張表之間沒有公式連結：請自己把勾稽點需要的數字填進去，燈號會立刻告訴你對不對。期末存貨以正數輸入。
        </Trans>
      </p>
      <div className="ll-lab-reconcile__controls">
        <label className="ll-lab-reconcile__pick">
          {t({ id: 'lab.reconcile.pick', message: '故事的哪一步之後', comment: '選步驟的下拉選單名稱' })}
          <select value={stepId} onChange={(e) => pick(e.target.value)} data-testid="lab-reconcile-step">
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {t({ id: 'lab.story.stepN', message: `第 ${s.order} 步` })} {s.title}
              </option>
            ))}
          </select>
        </label>
        <Switch
          checked={advanced}
          onChange={setAdvanced}
          label={t({ id: 'lab.reconcile.advanced', message: '進階模式（開放更多格子）', comment: '進階模式的開關' })}
        />
      </div>
      <p className="ll-lab-reconcile__order">
        <Trans id="lab.reconcile.order" comment="建議的填表順序（T14）">
          建議順序：先填損益表的結果，再填現金流量表，最後填資產負債表；一格填錯會讓多個燈號變紅，先修正最上游的格子。
        </Trans>
      </p>
      <CheckLights fiveStep={check} layout={layout} pendingSteps={pendingSteps} />
      {firstFailed !== null && allFilled && (
        <p className="ll-lab-reconcile__upstream" role="status">
          {t({ id: 'lab.reconcile.upstream', message: `先修正步驟 ${firstFailed} 用到的格子`, comment: '燈號紅時的提示；數字已代入' })}
        </p>
      )}
      <div className="ll-lab-tables__grid" data-testid="lab-reconcile-tables">
        {(['income_statement', 'cash_flow_indirect', 'balance_sheet'] as const).map((k) => (
          <StatementTable
            key={k}
            caption={lineLabel(k === 'income_statement' ? 'is_net_income' : k === 'balance_sheet' ? 'bs_total_assets' : 'cf_cash_end')}
            statement={k}
            before={step.before}
            after={step.after}
            view="cumulative"
            layout={layout}
            inputs={inputs}
          />
        ))}
      </div>
      {done && (
        <Card as="section" className="ll-lab-finished" data-testid="lab-reconcile-done">
          <h2>
            <Trans id="lab.reconcile.done" comment="完成卡標題">
              四個勾稽點都相符
            </Trans>
          </h2>
          <div className="ll-lab-finished__actions">
            {nextStepId && (
              <Button size="md" variant="primary" onClick={() => pick(nextStepId)}>
                {t({ id: 'lab.reconcile.next', message: '練下一步', comment: '完成卡按鈕' })}
              </Button>
            )}
            <Button size="md" href={localePath(locale, `/lab/story/${story.id}/`)}>
              {t({ id: 'lab.finish.map', message: '回到故事地圖' })}
            </Button>
          </div>
        </Card>
      )}
      <p className="ll-lab-reconcile__excel">
        <Trans id="lab.reconcile.excelNote" comment="期末存貨的加註（T07）">
          老師的 Excel 裡期末存貨要輸入負數；網站以正數輸入並在小計中扣除。
        </Trans>
      </p>
      <Segmented
        value="teacher"
        options={[{ value: 'teacher', label: t({ id: 'lab.reconcile.policy', message: '勾稽練習以教材口徑進行', comment: '口徑標示' }) }]}
        onChange={() => {}}
        label={t({ id: 'lab.reconcile.policyLabel', message: '口徑', comment: '口徑標示的名稱' })}
        size="sm"
      />
    </div>
  );
}
