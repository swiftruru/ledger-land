// content:coverage 的純函式（08 第 1.2 節）：每個學習目標的預計題數、草稿數、已發布數、題型與難度分布、迷思是否被練到、待確認編號。
// coverageShortfalls 列出「已發布題數未達 plannedQuestions」的目標（10 第 10 節 M3 完成標準第一條），content:coverage --check 以它判定失敗。
// 不讀檔也不列印；content-coverage.mjs 負責輸出。
import { QUESTION_TYPES } from '@ledgerland/content-schema';

/**
 * @typedef {{ objectiveId: string; file: string; path: string; chapterId: string; chapterOrder: number; chapterTitle: string; chapterStatus: string; order: number;
 *   statement: string; skill: string; suggestedTypes: string[]; misconceptions: { id: string; text: string; used: number }[]; planned: number; draft: number;
 *   published: number; retired: number; byType: Record<string, number>; byDifficulty: Record<'1' | '2' | '3', number>; pendingRefs: string[]; status: string }} ObjectiveCoverage
 *   file 與 path 是目標在 content/objectives/<chapterId>.json 裡的位置（items.<i>），給 --check 的錯誤訊息定位
 */

/**
 * @param {import('./content-rules.mjs').ParsedBundle} parsed
 * @returns {{ rows: ObjectiveCoverage[]; unassigned: { id: string; objectiveId: string; file: string }[]; totals: { planned: number; draft: number; published: number } }}
 */
export function coverage(parsed) {
  const chapters = new Map(parsed.chapters.map((c) => [c.data.id, c.data]));
  const byObjective = new Map();
  for (const o of parsed.objectives) byObjective.set(o.data.id, []);
  const unassigned = [];
  for (const q of parsed.questions) {
    const list = byObjective.get(q.data.objectiveId);
    if (list === undefined) unassigned.push({ id: q.data.id, objectiveId: q.data.objectiveId, file: q.file });
    else list.push(q.data);
  }
  const rows = parsed.objectives
    .map(({ data: o, file, path }) => {
      const qs = byObjective.get(o.id) ?? [];
      const ch = chapters.get(o.chapterId);
      const byType = /** @type {Record<string, number>} */ ({});
      for (const t of QUESTION_TYPES) byType[t] = 0;
      const byDifficulty = { 1: 0, 2: 0, 3: 0 };
      for (const q of qs) {
        if (q.status === 'retired') continue;
        byType[q.type] = (byType[q.type] ?? 0) + 1;
        byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
      }
      const mcUse = new Map();
      for (const q of qs) {
        const ids = [];
        if ('options' in q) for (const opt of q.options) if (opt.misconceptionId) ids.push(opt.misconceptionId);
        if (q.type === 'true_false' && q.misconceptionId) ids.push(q.misconceptionId);
        for (const id of ids) mcUse.set(id, (mcUse.get(id) ?? 0) + 1);
      }
      return {
        objectiveId: o.id,
        file,
        path: path ?? '(root)',
        chapterId: o.chapterId,
        chapterOrder: ch?.order ?? Number.MAX_SAFE_INTEGER,
        chapterTitle: ch?.title?.['zh-TW'] ?? o.chapterId,
        chapterStatus: ch?.status ?? 'missing',
        order: o.order,
        statement: o.statement['zh-TW'],
        skill: o.skill,
        suggestedTypes: o.suggestedTypes ?? [],
        misconceptions: (o.misconceptions ?? []).map((m) => ({ id: m.id, text: m.text['zh-TW'], used: mcUse.get(m.id) ?? 0 })),
        planned: o.plannedQuestions,
        draft: qs.filter((q) => q.status === 'draft').length,
        published: qs.filter((q) => q.status === 'published').length,
        retired: qs.filter((q) => q.status === 'retired').length,
        byType,
        byDifficulty,
        pendingRefs: o.pendingRefs ?? [],
        status: o.status,
      };
    })
    .sort((a, b) => a.chapterOrder - b.chapterOrder || a.order - b.order);
  const totals = rows.reduce((t, r) => ({ planned: t.planned + r.planned, draft: t.draft + r.draft, published: t.published + r.published }), {
    planned: 0,
    draft: 0,
    published: 0,
  });
  return { rows, unassigned, totals };
}

/**
 * 已發布題數未達預計題數的目標（M3 完成標準第一條）。已下架的目標不算；草稿目標照算（完成時不該還有草稿），訊息會標出來。
 * 每一條附檔案、JSON 路徑、訊息與建議修正（08 第 5.8 節的錯誤訊息格式）。
 * @param {{ rows: ObjectiveCoverage[]; unassigned: { id: string; objectiveId: string; file: string }[] }} result
 * @returns {{ rule: string; file: string; path: string; message: string }[]}
 */
export function coverageShortfalls(result) {
  const out = [];
  for (const r of result.rows) {
    if (r.status === 'retired') continue;
    if (r.published >= r.planned) continue;
    const missing = r.planned - r.published;
    const draftNote = r.draft > 0 ? `，草稿 ${r.draft} 題` : '';
    const statusNote = r.status === 'draft' ? '（目標本身仍是草稿）' : '';
    out.push({
      rule: 'coverage.planned',
      file: r.file,
      path: `${r.path}.plannedQuestions`,
      message: `${r.objectiveId}${statusNote}（${r.chapterTitle}）已發布 ${r.published} / 預計 ${r.planned} 題${draftNote}；再發布 ${missing} 題，或依審稿結論調整 plannedQuestions`,
    });
  }
  for (const u of result.unassigned)
    out.push({ rule: 'coverage.unassigned', file: u.file, path: 'objectiveId', message: `題目 ${u.id} 的學習目標 ${u.objectiveId} 不存在，無法計入覆蓋表` });
  return out;
}

const dist = (obj) =>
  Object.entries(obj)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join('、') || '（無）';

/** Markdown 報表（08 第 1.2 節的覆蓋表欄位加自動統計） */
export function coverageMarkdown(result, { builtAt = new Date().toISOString() } = {}) {
  const lines = [];
  lines.push('# 觀念覆蓋表（content:coverage）');
  lines.push('');
  lines.push(`產生時間：${builtAt}。預計 ${result.totals.planned} 題，草稿 ${result.totals.draft} 題，已發布 ${result.totals.published} 題。`);
  lines.push('');
  lines.push('| objectiveId | 章節 | 學習目標 | 能力層次 | 建議題型 | 迷思（被練到的次數） | 預計 | 草稿 | 已發布 | 題型分布 | 難度分布 | 待確認 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of result.rows) {
    const mc = r.misconceptions.map((m) => `${m.text}（${m.used}）`).join('；') || '（無）';
    lines.push(
      `| ${r.objectiveId}${r.status === 'draft' ? '（草稿）' : ''} | ${r.chapterTitle} | ${r.statement} | ${r.skill} | ${r.suggestedTypes.map((t) => `\`${t}\``).join('、') || '（無）'} | ${mc} | ${r.planned} | ${r.draft} | ${r.published} | ${dist(r.byType)} | ${dist(r.byDifficulty)} | ${r.pendingRefs.join('、') || ''} |`,
    );
  }
  if (result.rows.length === 0) lines.push('| （還沒有學習目標） | | | | | | | | | | | |');
  const short = result.rows.filter((r) => r.published < r.planned);
  if (short.length > 0) {
    lines.push('');
    lines.push('## 尚未達到預計題數的目標');
    lines.push('');
    for (const r of short) lines.push(`- ${r.objectiveId}（${r.chapterTitle}）：已發布 ${r.published} / 預計 ${r.planned}，草稿 ${r.draft}`);
  }
  if (result.unassigned.length > 0) {
    lines.push('');
    lines.push('## objectiveId 不存在的題目');
    lines.push('');
    for (const u of result.unassigned) lines.push(`- ${u.id}（${u.file}）引用 ${u.objectiveId}`);
  }
  lines.push('');
  return lines.join('\n');
}
