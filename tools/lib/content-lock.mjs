// published.lock.json（08 第 4.4 節、04 第 15.3 節）：已發布內容的比對基準。這個模組只算不讀檔：answerHash、目前內容的 lock 項目、
// 與舊 lock 合併成新 lock、以及 08 第 5.6 節的八條 id.* 規則。content-lock.mjs 與 content-check.mjs 負責讀寫檔與列印。
// 草稿不進 lock；只有 published 與 retired 的項目會出現。
import { createHash } from 'node:crypto';
import { canonicalJson } from '@ledgerland/core';

export const LOCK_VERSION = 1;
export const LOCK_COMMENT =
  '已發布內容的比對基準（08 第 4.4 節）。items 依 kind 與 id 排序；answerHash 是答案改版欄位加核心算出的答案的 canonical JSON 的 SHA-256；optionIds 只增不減，removedOptionIds 記下曾經發布後被移除的選項 ID（不得再次使用）。由 pnpm content:lock --write 產生，請勿手改。';

/** @typedef {'term' | 'chapter' | 'objective' | 'level' | 'template' | 'story' | 'question'} LockKind */
/** @typedef {{ id: string; kind: LockKind; rev: number; revKind: 'text' | 'answer'; answerRev: number; status: 'published' | 'retired'; answerHash?: string; optionIds: string[]; removedOptionIds?: string[]; supersededBy?: string }} LockItem */
/** @typedef {{ lockVersion: number; contentVersion: number; items: LockItem[] }} Lock */

const KIND_ORDER = ['term', 'chapter', 'objective', 'level', 'template', 'story', 'question'];
const sorted = (xs) => [...xs].sort();

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function stripExpected(scenario) {
  const { expected: _expected, ...rest } = scenario;
  return rest;
}

/**
 * 答案改版欄位（08 第 4.2 節）連同核心算出的答案（04 第 15.3 節）；純文字欄位與核心版本號都不納入。名詞與學習目標沒有 answerHash；
 * 章節看 levelIds、關卡看 questionIds（出題順序）。
 * @param {LockKind} kind
 * @param {any} d
 * @param {import('./content-rules.mjs').CompiledQuestion | undefined} [compiled]
 */
export function answerFields(kind, d, compiled) {
  switch (kind) {
    case 'term':
    case 'objective':
      return undefined;
    case 'chapter':
      return { levelIds: d.levelIds };
    case 'level':
      return { questionIds: d.questionIds };
    case 'template':
      return {
        params: d.params.map((p) => pick(p, ['name', 'type', 'min', 'max', 'default'])),
        derived: d.derived.map((x) => pick(x, ['name', 'type', 'expr'])),
        preconditions: d.preconditions.map((p) => pick(p, ['id', 'expr'])),
        lines: d.lines.map((l) => pick(l, ['id', 'account', 'side', 'amount', 'cf', 'tag', 'policyWhen'])),
      };
    case 'story':
      return {
        opening: d.opening ?? {},
        policy: d.policy,
        layout: d.layout,
        steps: [...d.steps]
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ id: s.id, order: s.order, events: s.events.map((e) => pick(e, ['id', 'template', 'params'])) })),
      };
    case 'question':
      return questionAnswerFields(d, compiled ?? {});
    default:
      throw new TypeError(`answerFields：不認得的 kind ${String(kind)}`);
  }
}

function questionAnswerFields(q, c) {
  const base = { type: q.type, scored: q.scored };
  const optionIds = 'options' in q ? sorted(q.options.map((o) => o.id)) : undefined;
  switch (q.type) {
    case 'single_choice':
    case 'pick_statement':
    case 'ratio_interpret':
      return { ...base, optionIds, correctOptionId: q.correctOptionId, ...pick(q, ['ratioRef', 'distractorExprs']) };
    case 'multi_choice':
      return { ...base, optionIds, scoringMode: q.scoringMode, correctOptionIds: sorted(q.correctOptionIds) };
    case 'true_false':
      return { ...base, correct: q.correct };
    case 'judgment':
      return { ...base, optionIds };
    case 'pick_line':
      return { ...base, scenario: stripExpected(q.scenario), correctLines: sorted(q.correctLines), expected: c.expected };
    case 'classify':
      return {
        ...base,
        dimension: q.dimension,
        items: q.items.map((it) => pick(it, ['id', 'account', 'ratio', 'allowContra'])),
        categories: c.categories ?? q.correctCategories ?? {},
      };
    case 'transaction_effect':
      return { ...base, scenario: stripExpected(q.scenario), ...pick(q, ['choices', 'scoring']), expected: c.expected };
    case 'five_step_fill':
      return { ...base, scenario: stripExpected(q.scenario), openCells: q.openCells, expected: c.expected };
    case 'ratio_numeric': {
      const compute = { ratioRef: q.compute.ratioRef };
      if (q.compute.scenario !== undefined) compute.scenario = stripExpected(q.compute.scenario);
      if (q.compute.measures !== undefined) {
        compute.measures = q.compute.measures;
        compute.vars = q.vars ?? {};
      }
      return {
        ...base,
        compute,
        decimals: q.decimals,
        tolerance: q.tolerance,
        acceptStatus: sorted(q.acceptStatus ?? []),
        expected: { answer: c.ratio, targets: c.expected },
      };
    }
    case 'journal_entry':
      return {
        ...base,
        scenario: stripExpected(q.scenario),
        accountChoices: sorted(q.accountChoices),
        ...pick(q, ['allowAliases']),
        expectedEntries: c.expectedEntries,
      };
    default:
      throw new TypeError(`answerFields：不認得的題型 ${String(q.type)}`);
  }
}

/** sha256:<hex>；名詞回傳 undefined */
export function answerHash(kind, data, compiled) {
  const fields = answerFields(kind, data, compiled);
  if (fields === undefined) return undefined;
  return `sha256:${createHash('sha256').update(canonicalJson(fields)).digest('hex')}`;
}

/**
 * 目前內容的 lock 項目（只有 published 與 retired）。題目的 answerHash 需要核心結果；compiled 沒有這一題（核心算不出來）時省略 answerHash，
 * 呼叫端應先確定 runAccountingChecks 沒有錯誤。
 * @param {import('./content-rules.mjs').ParsedBundle} parsed
 * @param {Map<string, import('./content-rules.mjs').CompiledQuestion>} compiled
 * @returns {Map<string, LockItem>}
 */
export function currentLockItems(parsed, compiled) {
  /** @type {Map<string, LockItem>} */
  const out = new Map();
  /** @type {[LockKind, import('./content-rules.mjs').Parsed[]][]} */
  const lists = [
    ['term', parsed.terms],
    ['chapter', parsed.chapters],
    ['objective', parsed.objectives ?? []],
    ['level', parsed.levels ?? []],
    ['template', parsed.templates],
    ['story', parsed.stories],
    ['question', parsed.questions],
  ];
  for (const [kind, entries] of lists) {
    for (const { data } of entries) {
      if (data.status !== 'published' && data.status !== 'retired') continue;
      const c = kind === 'question' ? compiled.get(data.id) : undefined;
      const hash = kind === 'question' && c === undefined ? undefined : answerHash(kind, data, c);
      /** @type {LockItem} */
      const item = {
        id: data.id,
        kind,
        rev: data.rev,
        revKind: data.revKind,
        answerRev: data.rev,
        status: data.status,
        ...(hash === undefined ? {} : { answerHash: hash }),
        optionIds: 'options' in data ? sorted(data.options.map((o) => o.id)) : [],
        ...(data.supersededBy === undefined ? {} : { supersededBy: data.supersededBy }),
      };
      out.set(data.id, item);
    }
  }
  return out;
}

/** 所有項目（含草稿）的 id 對 kind 與 status，給 id.reused 用 */
export function allEntityIds(parsed) {
  /** @type {Map<string, { kind: string; status: string }>} */
  const out = new Map();
  /** @type {[LockKind, import('./content-rules.mjs').Parsed[]][]} */
  const lists = [
    ['term', parsed.terms],
    ['chapter', parsed.chapters],
    ['objective', parsed.objectives ?? []],
    ['level', parsed.levels ?? []],
    ['template', parsed.templates],
    ['story', parsed.stories],
    ['question', parsed.questions],
  ];
  for (const [kind, entries] of lists) for (const { data } of entries) out.set(data.id, { kind, status: data.status });
  return out;
}

/**
 * 讀進來的 lock 正規化：M0b 的最小格式（terms、chapters 是 id 對 rev）升級成 items；沒有 answerHash 的舊項目視為「尚未記錄答案」。
 * @returns {Lock}
 */
export function normaliseLock(raw) {
  if (raw === undefined || raw === null) return { lockVersion: LOCK_VERSION, contentVersion: 1, items: [] };
  if (Array.isArray(raw.items)) return { lockVersion: raw.lockVersion ?? LOCK_VERSION, contentVersion: raw.contentVersion ?? 1, items: raw.items };
  /** @type {LockItem[]} */
  const items = [];
  /** @type {[LockKind, string][]} */
  const legacy = [
    ['term', 'terms'],
    ['chapter', 'chapters'],
  ];
  for (const [kind, key] of legacy) {
    for (const [id, rev] of Object.entries(raw[key] ?? {}))
      items.push({ id, kind, rev: Number(rev), revKind: 'text', answerRev: Number(rev), status: 'published', optionIds: [] });
  }
  return { lockVersion: LOCK_VERSION, contentVersion: raw.contentVersion ?? 1, items };
}

function compareItems(a, b) {
  const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  if (k !== 0) return k;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 舊項目與目前內容合併成新的 lock 項目：answerRev 在雜湊改變時取現在的 rev；optionIds 只增不減；被移除的選項記進 removedOptionIds */
export function mergeItem(prev, cur) {
  const hashChanged = prev === undefined || prev.answerHash !== cur.answerHash;
  const optionIds = sorted(new Set([...(prev?.optionIds ?? []), ...cur.optionIds]));
  const removed = sorted(new Set([...(prev?.removedOptionIds ?? []), ...(prev?.optionIds ?? []).filter((o) => !cur.optionIds.includes(o))]));
  /** @type {LockItem} */
  const item = {
    id: cur.id,
    kind: cur.kind,
    rev: cur.rev,
    revKind: cur.revKind,
    answerRev: hashChanged || prev === undefined ? cur.rev : prev.answerRev,
    status: cur.status,
    ...(cur.answerHash === undefined ? {} : { answerHash: cur.answerHash }),
    optionIds,
    ...(removed.length === 0 ? {} : { removedOptionIds: removed }),
    ...(cur.supersededBy === undefined ? {} : { supersededBy: cur.supersededBy }),
  };
  return item;
}

/**
 * 新 lock：目前內容的每個項目與舊項目合併；舊 lock 有、目前內容沒有的項目照舊保留（id.vanished 會回報，--write 不會寫入）。
 * @param {Lock} prev
 * @param {Map<string, LockItem>} current
 * @returns {Lock}
 */
export function nextLock(prev, current) {
  const prevById = new Map(prev.items.map((i) => [i.id, i]));
  const items = [];
  for (const cur of current.values()) items.push(mergeItem(prevById.get(cur.id), cur));
  for (const p of prev.items) if (!current.has(p.id)) items.push(p);
  items.sort(compareItems);
  return { lockVersion: LOCK_VERSION, contentVersion: prev.contentVersion, items };
}

/**
 * 08 第 5.6 節的八條規則：id.vanished、id.revNotBumped、id.revKindMismatch、id.revDecreased、id.reused、id.optionReused、id.lockStale、id.supersededInvalid。
 * @param {Lock} prev 目標分支上的 lock
 * @param {Map<string, LockItem>} current 目前內容算出的項目
 * @param {Map<string, { kind: string; status: string }>} allIds 所有項目（含草稿）
 * @param {Map<string, string>} [files] id 對檔案路徑（訊息用）
 * @returns {import('./content-rules.mjs').RuleIssue[]}
 */
export function checkLock(prev, current, allIds, files = new Map()) {
  /** @type {import('./content-rules.mjs').RuleIssue[]} */
  const issues = [];
  const lockFile = 'content/published.lock.json';
  const fileOf = (id) => files.get(id) ?? lockFile;
  const push = (rule, id, message) => issues.push({ rule, file: fileOf(id), path: 'id', message, severity: 'error' });
  const flagged = new Set();
  for (const p of prev.items) {
    const cur = current.get(p.id);
    if (cur === undefined) {
      const any = allIds.get(p.id);
      if (any !== undefined)
        push('id.reused', p.id, `${p.id} 已在 lock 中（${p.kind}，${p.status}），不得當成新項目或草稿重用（已發布的 ID 不得消失，也不得重用）`);
      else push('id.vanished', p.id, `lock 裡已發布的 ${p.kind} ${p.id} 在內容中消失了（已發布的 ID 必須維持 published 或 retired）`);
      flagged.add(p.id);
      continue;
    }
    let bad = false;
    if (cur.kind !== p.kind) {
      push('id.reused', p.id, `${p.id} 在 lock 裡是 ${p.kind}，現在是 ${cur.kind}（ID 不得重用）`);
      bad = true;
    }
    if (cur.rev < p.rev) {
      push('id.revDecreased', p.id, `${p.id} 的 rev ${cur.rev} 比 lock 的 ${p.rev} 小（rev 只能遞增）`);
      bad = true;
    }
    const hashChanged = p.answerHash !== undefined && cur.answerHash !== undefined && p.answerHash !== cur.answerHash;
    if (hashChanged && cur.rev <= p.rev) {
      push('id.revNotBumped', p.id, `${p.id} 的答案改變了（answerHash 不同），但 rev 仍是 ${cur.rev}（請把 rev 加一並設 revKind 為 answer）`);
      bad = true;
    } else if (hashChanged && cur.revKind !== 'answer') {
      push('id.revKindMismatch', p.id, `${p.id} 的答案改變了（answerHash 不同），revKind 必須是 answer，現在是 ${cur.revKind}`);
      bad = true;
    }
    const reusedOptions = cur.optionIds.filter((o) => (p.removedOptionIds ?? []).includes(o));
    if (reusedOptions.length > 0) {
      push('id.optionReused', p.id, `${p.id} 再次使用了曾經移除的選項 ID ${reusedOptions.join('、')}（選項 ID 不得重用，請產生新的 ID）`);
      bad = true;
    }
    if (!bad && canonicalJson(mergeItem(p, cur)) !== canonicalJson(p))
      push('id.lockStale', p.id, `${p.id} 的內容有改變但 lock 沒有更新，請執行 pnpm content:lock --write`);
    flagged.add(p.id);
  }
  for (const cur of current.values()) {
    if (flagged.has(cur.id)) continue;
    push('id.lockStale', cur.id, `${cur.kind} ${cur.id}（rev ${cur.rev}）是 ${cur.status} 但不在 lock 裡，請執行 pnpm content:lock --write`);
  }
  // supersededBy：同類、已發布、沒有循環
  for (const cur of current.values()) {
    if (cur.supersededBy === undefined) continue;
    const target = current.get(cur.supersededBy);
    if (target === undefined || target.kind !== cur.kind || target.status !== 'published') {
      push('id.supersededInvalid', cur.id, `${cur.id} 的 supersededBy ${cur.supersededBy} 必須指向同類（${cur.kind}）且 published 的項目`);
      continue;
    }
    const seen = new Set([cur.id]);
    let next = /** @type {LockItem | undefined} */ (target);
    while (next !== undefined && next.supersededBy !== undefined) {
      if (seen.has(next.id)) {
        push('id.supersededInvalid', cur.id, `${cur.id} 的 supersededBy 形成循環：${[...seen, next.id].join(' -> ')}`);
        break;
      }
      seen.add(next.id);
      next = current.get(next.supersededBy);
    }
  }
  return issues;
}
