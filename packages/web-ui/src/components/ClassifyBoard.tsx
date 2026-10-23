// 分類題（03 第 2.5 節、07 第 8.1 節）：點選模式（點卡片拿起、點分類格放入、再點已放入的卡片拿回）與鍵盤
// （Enter 或 Space 拿起、方向鍵選格、Enter 放入、Esc 取消）；aria-live 播報「已拿起：應收帳款」「應收帳款放入資產，第 3 張，共 6 張」。
// 拖放這次不做（M0a 的 dnd-kit 留給後續），介面留 onDrop 擴充點。判分在父層：checked 後給逐卡片 results。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CheckCircleIcon, HandIcon, XCircleIcon } from './icons.tsx';

export interface ClassifyCard {
  id: string;
  label: ReactNode;
  /** 純文字版，給播報用 */
  text: string;
}

export interface ClassifyCategory {
  id: string;
  label: string;
}

export interface ClassifyResult {
  correct: boolean;
  /** 放錯時應該放的分類格 */
  expectedCategoryId?: string;
  feedback?: ReactNode;
}

export interface ClassifyBoardProps {
  cards: readonly ClassifyCard[];
  categories: readonly ClassifyCategory[];
  /** 卡片 ID 對分類格 ID；沒放的卡片不在裡面或為 undefined */
  placement: Readonly<Partial<Record<string, string>>>;
  /** 放入分類格，或拿回（categoryId 為 null） */
  onPlace: (cardId: string, categoryId: string | null) => void;
  checked: boolean;
  results?: Readonly<Partial<Record<string, ClassifyResult>>>;
  /** 拖放擴充點：日後接 dnd-kit 時由 adapter 呼叫；目前的點選與鍵盤流程不經過它 */
  onDrop?: (cardId: string, categoryId: string) => void;
  /** 整個板子的名稱（題幹）所在元素的 id */
  labelledBy?: string;
}

/** 全部卡片都放好才可以確認（03 第 2.5 節操作 3） */
export function isClassifyComplete(cards: readonly ClassifyCard[], placement: Readonly<Partial<Record<string, string>>>): boolean {
  return cards.every((c) => placement[c.id] !== undefined);
}

export function ClassifyBoard({ cards, categories, placement, onPlace, checked, results, labelledBy }: ClassifyBoardProps) {
  const { t } = useLingui();
  const baseId = useId();
  const [held, setHeld] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current) {
      buttons.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });
  const total = cards.length;
  const placedCount = cards.filter((c) => placement[c.id] !== undefined).length;
  const pool = cards.filter((c) => placement[c.id] === undefined);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  const pickUp = (card: ClassifyCard) => {
    const text = card.text;
    setHeld(card.id);
    setTarget(null);
    setAnnounce(t({ id: 'quiz.classify.pickedUp', message: `已拿起：${text}`, comment: '分類題拿起卡片時的播報；text 是卡片文字' }));
  };
  const cancel = (card: ClassifyCard) => {
    const text = card.text;
    setHeld(null);
    setTarget(null);
    setAnnounce(t({ id: 'quiz.classify.cancelled', message: `已放下：${text}`, comment: '分類題取消拿起時的播報；text 是卡片文字' }));
  };
  const place = (card: ClassifyCard, cat: ClassifyCategory) => {
    const text = card.text;
    const label = cat.label;
    onPlace(card.id, cat.id);
    const n = placedCount + (placement[card.id] === undefined ? 1 : 0);
    setHeld(null);
    setTarget(null);
    pendingFocus.current = card.id;
    setAnnounce(
      t({
        id: 'quiz.classify.placed',
        message: `${text}放入${label}，第 ${n} 張，共 ${total} 張`,
        comment: '分類題放入卡片時的播報；text 是卡片文字、label 是分類格、n 是已放好的張數、total 是總張數',
      }),
    );
  };
  const takeBack = (card: ClassifyCard) => {
    const text = card.text;
    onPlace(card.id, null);
    pendingFocus.current = card.id;
    setAnnounce(t({ id: 'quiz.classify.takenBack', message: `已拿回：${text}`, comment: '分類題把已放入的卡片拿回時的播報；text 是卡片文字' }));
  };
  const onCardKey = (e: KeyboardEvent<HTMLButtonElement>, card: ClassifyCard) => {
    if (held !== card.id) return;
    const n = categories.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const next = target === null ? (forward ? 0 : n - 1) : (target + (forward ? 1 : -1) + n) % n;
      setTarget(next);
      const label = categories[next]?.label;
      if (label !== undefined)
        setAnnounce(t({ id: 'quiz.classify.target', message: `放置目標：${label}`, comment: '分類題用方向鍵選分類格時的播報；label 是分類格' }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const cat = target === null ? undefined : categories[target];
      if (cat) place(card, cat);
      else
        setAnnounce(
          t({ id: 'quiz.classify.chooseTarget', message: '先用方向鍵選一個分類格，再按 Enter 放入', comment: '分類題拿起卡片後直接按 Enter 的提示' }),
        );
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel(card);
    }
  };
  const ref = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(id, el);
    else buttons.current.delete(id);
  };
  const heldCard = held ? byId.get(held) : undefined;
  const poolTitleId = `${baseId}-pool`;
  const count = pool.length;
  const heldText = heldCard?.text ?? '';
  return (
    <div className="ll-classify" aria-labelledby={labelledBy} role="group">
      <section className="ll-classify__pool" aria-labelledby={poolTitleId}>
        <h3 id={poolTitleId} className="ll-classify__title">
          {t({ id: 'quiz.classify.pool', message: `待分類（${count}）`, comment: '分類題尚未放入的卡片區標題；count 是張數' })}
        </h3>
        {pool.length === 0 ? (
          <p className="ll-classify__empty">
            {t({ id: 'quiz.classify.allPlaced', message: '全部放好了，可以按「確認分類」。', comment: '分類題卡片全部放好後的提示' })}
          </p>
        ) : (
          <ul className="ll-classify__cards">
            {pool.map((card) => {
              const isHeld = held === card.id;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    ref={ref(card.id)}
                    className={`ll-classify__card${isHeld ? ' is-held' : ''}`}
                    aria-pressed={isHeld}
                    disabled={checked}
                    onClick={() => (isHeld ? cancel(card) : pickUp(card))}
                    onKeyDown={(e) => onCardKey(e, card)}
                  >
                    {isHeld && <HandIcon size={16} />}
                    <span>{card.label}</span>
                    {isHeld && (
                      <span className="ll-classify__held">{t({ id: 'quiz.classify.heldTag', message: '已拿起', comment: '分類題已拿起的卡片上的文字' })}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="ll-classify__zones">
        {categories.map((cat, i) => {
          const zoneTitleId = `${baseId}-zone-${cat.id}`;
          const inZone = cards.filter((c) => placement[c.id] === cat.id);
          const isTarget = held !== null && target === i;
          const label = cat.label;
          return (
            <section key={cat.id} className={`ll-classify__zone${held ? ' is-droppable' : ''}${isTarget ? ' is-target' : ''}`} aria-labelledby={zoneTitleId}>
              <h3 id={zoneTitleId} className="ll-classify__title">
                {cat.label}
              </h3>
              {!checked && (
                <button type="button" className="ll-classify__drop" disabled={!heldCard} onClick={() => heldCard && place(heldCard, cat)}>
                  {heldCard
                    ? t({
                        id: 'quiz.classify.putInto',
                        message: `把「${heldText}」放入${label}`,
                        comment: '分類格的放入按鈕；text 是已拿起的卡片文字、label 是分類格',
                      })
                    : t({ id: 'quiz.classify.dropHint', message: '先拿起一張卡片', comment: '還沒拿起卡片時分類格的提示' })}
                </button>
              )}
              <ul className="ll-classify__cards">
                {inZone.map((card) => {
                  const res = checked ? results?.[card.id] : undefined;
                  const expected = res?.expectedCategoryId ? catById.get(res.expectedCategoryId) : undefined;
                  const expectedLabel = expected?.label ?? '';
                  const fbId = `${baseId}-fb-${card.id}`;
                  return (
                    <li key={card.id}>
                      <button
                        type="button"
                        ref={ref(card.id)}
                        className={`ll-classify__card is-placed${res ? (res.correct ? ' is-correct' : ' is-wrong') : ''}`}
                        disabled={checked}
                        onClick={() => takeBack(card)}
                        aria-describedby={res ? fbId : undefined}
                      >
                        {res && <span className="ll-classify__mark">{res.correct ? <CheckCircleIcon filled size={16} /> : <XCircleIcon size={16} />}</span>}
                        <span>{card.label}</span>
                        {!checked && (
                          <span className="ll-sr-only">
                            {t({ id: 'quiz.classify.takeBackHint', message: '，再按一次拿回', comment: '已放入的卡片按鈕可讀名稱的尾句' })}
                          </span>
                        )}
                      </button>
                      {res && (
                        <span id={fbId} className={`ll-classify__fb ${res.correct ? 'is-correct' : 'is-wrong'}`}>
                          <span className="ll-option__status">
                            {res.correct
                              ? t({ id: 'quiz.classify.right', message: '放對了', comment: '分類題作答後每張卡片的結果' })
                              : t({ id: 'quiz.classify.wrong', message: '放錯了', comment: '分類題作答後每張卡片的結果' })}
                          </span>
                          {expected && (
                            <span className="ll-option__feedback">
                              {t({
                                id: 'quiz.classify.shouldBe',
                                message: `應該放在：${expectedLabel}`,
                                comment: '分類題放錯時標出正確分類格；label 是分類格',
                              })}
                            </span>
                          )}
                          {res.feedback && <span className="ll-option__feedback">{res.feedback}</span>}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="ll-sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
