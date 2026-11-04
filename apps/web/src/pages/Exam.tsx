// 期中考苦練首頁（M4c，02 第 1.1 節）：只收陳老師三份講義的練習題，題目與答案照講義。只讀 manifest.handouts 的小索引與這台裝置的紀錄（features/exam/db.ts），
// 不載題庫本身。整體進度、三顆入口（依講義順序、隨機抽 20 題、只練錯過的）、選項順序的開關、三份講義各一張卡與各段的入口。
// 紀錄只在這台裝置、不在備份裡（06 第 4.6 節）；英文站的介面是英文，題目仍是中文。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber, formatPercent, localePath } from '@ledgerland/i18n';
import { BookIcon, Button, Card, Disclosure, ErrorState, NavList, NavRow, PlayIcon, ProgressBar, RetryIcon, Switch, TopBar } from '@ledgerland/web-ui';
import { getExamDb, type QuestionState } from '../features/exam/db.ts';
import { readExamShuffle, writeExamShuffle } from '../features/exam/prefs.ts';
import type { ExamRun } from '../features/exam/run.ts';
import { allQuestionIds } from '../features/exam/sets.ts';
import { statsOf, wrongIdsOf } from '../features/exam/stats.ts';
import { loadHandoutIndex, type HandoutManifestEntry } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type IndexState = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'ok'; index: HandoutManifestEntry };

export default function Exam() {
  const { t } = useLingui();
  const locale = useLocale();
  const href = (p: string) => localePath(locale, p);
  const [state, setState] = useState<IndexState>({ kind: 'loading' });
  const [states, setStates] = useState<ReadonlyMap<string, QuestionState> | null>(null);
  const [resume, setResume] = useState<ExamRun | null | undefined>(undefined);
  const [shuffle, setShuffle] = useState(readExamShuffle);

  useEffect(() => {
    let alive = true;
    loadHandoutIndex().then(
      (index) => alive && setState(index ? { kind: 'ok', index } : { kind: 'none' }),
      () => alive && setState({ kind: 'error' }),
    );
    const db = getExamDb();
    void db.allStates().then(
      (list) => alive && setStates(new Map(list.map((s) => [s.questionId, s]))),
      () => alive && setStates(new Map()),
    );
    void db.getRun('all:handout').then(
      (run) => alive && setResume(run && run.finishedAt === undefined && run.index > 0 ? run : null),
      () => alive && setResume(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(state.kind !== 'loading' && states !== null && resume !== undefined);

  const index = state.kind === 'ok' ? state.index : null;
  const all = useMemo(() => (index ? allQuestionIds(index) : []), [index]);
  const stats = useMemo(() => statsOf(all, states ?? new Map()), [all, states]);
  const wrongCount = useMemo(() => (states ? [...wrongIdsOf(states)].filter((id) => all.includes(id)).length : 0), [states, all]);

  const topBar = (
    <TopBar
      title={t({ id: 'exam.title', message: '期中考苦練', comment: '苦練區首頁的標題；入口與 Tab 的 also 都用這個名稱' })}
      titleId="ll-exam-title"
      backHref={href('/play/')}
      backLabel={t({ id: 'exam.back', message: '回到闖關地圖', comment: '苦練區頁首返回按鈕的可讀名稱（苦練區在 Tab bar 的「闖關」底下）' })}
      backShortLabel={t({ id: 'exam.back.short', message: '地圖', comment: '苦練區頁首返回按鈕上的短字（必須是「回到闖關地圖」的一部分）' })}
    />
  );
  if (state.kind === 'loading' || states === null) return topBar;
  if (state.kind !== 'ok') {
    return (
      <>
        {topBar}
        <ErrorState
          title={
            state.kind === 'none'
              ? t({ id: 'exam.none.title', message: '這個版本還沒有講義題庫', comment: '苦練區：快照裡沒有講義題庫時的標題' })
              : t({ id: 'exam.error.title', message: '題庫載入不到', comment: '苦練區：manifest 讀不到時的標題' })
          }
          description={t({ id: 'exam.error.desc', message: '重新整理再試一次；離線時要先在有網路時開過這一頁。', comment: '苦練區載入失敗的說明' })}
          onRetry={() => window.location.reload()}
        />
      </>
    );
  }
  const n = (x: number) => formatNumber(x, locale);
  const bank = state.index;
  const decks = [...bank.decks].sort((a, b) => a.order - b.order);
  return (
    <>
      {topBar}
      <p className="ll-exam-intro">
        <Trans id="exam.intro" comment="苦練首頁的一句說明">
          只收陳老師三份講義的練習題，題目、選項與解答都照講義；範圍以老師公告為準。
        </Trans>
      </p>
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-hero-title" data-testid="exam-hero">
        <h2 id="ll-exam-hero-title" className="ll-exam-hero__title">
          {t({ id: 'exam.hero.title', message: `講義 ${n(bank.questionCount)} 題`, comment: '苦練首頁主卡的標題；count 是收錄的題數（已格式化）' })}
        </h2>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={stats.practised} max={stats.total || 1} />
          <span className="ll-exam-hero__count ll-num" data-testid="exam-progress">
            {stats.accuracy === null
              ? t({ id: 'exam.hero.untouched', message: '還沒開始練', comment: '主卡進度：這台裝置還沒練過任何一題' })
              : t({
                  id: 'exam.hero.progress',
                  message: `練過 ${n(stats.practised)}／${n(stats.total)} 題，答對率 ${formatPercent(stats.accuracy, locale)}`,
                  comment: '主卡進度；數字都已格式化',
                })}
          </span>
        </div>
        <div className="ll-exam-hero__actions">
          <Button variant="primary" size="md" icon={<PlayIcon />} href={href('/exam/all/')} data-testid="exam-start-order">
            {resume
              ? t({
                  id: 'exam.start.resume',
                  message: `繼續依講義順序練（第 ${n(resume.index + 1)} 題）`,
                  comment: '主按鈕：有做到一半的一輪時；n 是題號（已格式化）',
                })
              : t({ id: 'exam.start.order', message: '依講義順序練', comment: '主按鈕：全部題目依講義順序' })}
          </Button>
          <Button size="md" icon={<RetryIcon />} href={href('/exam/all/?order=random')} data-testid="exam-start-random">
            {t({ id: 'exam.start.random', message: '隨機抽 20 題', comment: '次要按鈕：全部題目裡隨機抽 20 題' })}
          </Button>
          {wrongCount > 0 ? (
            <Button size="md" variant="quiet" icon={<BookIcon />} href={href('/exam/wrong/')} data-testid="exam-start-wrong">
              {t({ id: 'exam.start.wrong', message: `只練錯過的（${n(wrongCount)} 題）`, comment: '按鈕：只練這台裝置上一次答錯的題；count 已格式化' })}
            </Button>
          ) : (
            <Button size="md" variant="quiet" icon={<BookIcon />} disabled data-testid="exam-start-wrong">
              {t({ id: 'exam.start.wrongNone', message: '只練錯過的（還沒有）', comment: '按鈕（停用）：還沒有答錯的題' })}
            </Button>
          )}
        </div>
        <Switch
          className="ll-exam-hero__switch"
          checked={shuffle}
          onChange={(on) => {
            setShuffle(on);
            writeExamShuffle(on);
          }}
          label={t({ id: 'exam.shuffle.label', message: '打亂選項順序', comment: '苦練首頁的開關' })}
          description={t({
            id: 'exam.shuffle.desc',
            message: '關閉時 A、B、C 的位置和講義一樣；打開後每次隨機，確認答案後會標出講義的字母。',
            comment: '打亂選項開關的說明',
          })}
        />
        <p className="ll-exam-hero__note">
          <Trans id="exam.note.device" comment="主卡下方的說明：紀錄只在這台裝置">
            練習紀錄只存在這台裝置，不在備份檔裡。
          </Trans>
          {locale !== 'zh-TW' && (
            <>
              {' '}
              <Trans id="exam.note.zhOnly" comment="英文站多一句：題目只有中文">
                題庫只有中文。
              </Trans>
            </>
          )}
        </p>
        <p className="ll-exam-hero__licence">
          <Trans id="exam.licence" comment="授權標示（D6、2026-11-04 老師同意）">
            題目經陳彥宏老師授權使用。
          </Trans>
        </p>
      </Card>
      {decks.map((d) => {
        const ids = d.sections.flatMap((s) => s.questionIds);
        const ds = statsOf(ids, states);
        return (
          <Card as="section" key={d.id} className="ll-exam-deck" aria-labelledby={`ll-exam-deck-${d.id}`} data-testid={`exam-deck-${d.id}`}>
            <p className="ll-exam-deck__code ll-num">
              {t({ id: 'exam.deck.code', message: `講義 ${d.code}`, comment: '講義卡的小標；code 是講義編號，例如 0-1' })}
            </p>
            <h2 id={`ll-exam-deck-${d.id}`} className="ll-exam-deck__title" lang="zh-TW">
              {d.title}
            </h2>
            <div className="ll-exam-deck__progress">
              <ProgressBar size="sm" value={ds.practised} max={ds.total || 1} />
              <span className="ll-exam-deck__count ll-num">
                {t({ id: 'exam.deck.count', message: `練過 ${n(ds.practised)}／${n(ds.total)} 題`, comment: '講義卡的進度；數字已格式化' })}
              </span>
            </div>
            <div className="ll-exam-deck__actions">
              <Button size="sm" variant="primary" icon={<PlayIcon />} href={href(`/exam/${d.id}/`)}>
                {t({ id: 'exam.deck.practise', message: '練這份講義', comment: '講義卡的按鈕' })}
              </Button>
            </div>
            <Disclosure
              summary={t({ id: 'exam.deck.sections', message: '各段分開練', comment: '講義卡的展開列：列出這份講義的各段' })}
              variant="plain"
              className="ll-exam-deck__sections"
            >
              <NavList>
                {d.sections.map((s) => {
                  const ss = statsOf(s.questionIds, states);
                  return (
                    <NavRow
                      key={s.id}
                      icon={<BookIcon />}
                      title={<span lang="zh-TW">{s.title}</span>}
                      description={
                        ss.practised === 0
                          ? t({ id: 'exam.section.untouched', message: `${n(ss.total)} 題`, comment: '段的說明（還沒練）；total 已格式化' })
                          : t({ id: 'exam.section.count', message: `練過 ${n(ss.practised)}／${n(ss.total)} 題`, comment: '段的說明；數字已格式化' })
                      }
                      href={href(`/exam/${s.id}/`)}
                      data-testid={`exam-section-${s.id}`}
                    />
                  );
                })}
              </NavList>
            </Disclosure>
          </Card>
        );
      })}
    </>
  );
}
