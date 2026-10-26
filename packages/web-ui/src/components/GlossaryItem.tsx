// 名詞卡（站規 1.11）：名詞圖鑑的收集卡 GlossaryItem、參考名詞膠囊 TermPill、卡片格 GlossaryGrid。
// 整張卡是一個連結（經 LinkProvider）；可讀名稱由畫面上的內容依序組成（名稱、英文、類別、狀態、遇到的關卡），不另設 aria-label。
// 收集的回饋：已收進的卡徽記上色、右上角蓋 32px 的金色雙圈印章（斜 8 度）、2px 金邊與淡金底；未收進是虛線空位（內容照樣能讀，不變灰也不上鎖，03 第 2.10 節）。
// 狀態同時用形狀（印章、虛線空位）與文字（視覺隱藏的「已收進」「未收進」）表達，不只靠顏色。
// 類別名稱、狀態文字與「在 1-1 … 遇到」是 apps/web 的字串（站規 7.4 的 terms.*），由呼叫端格式化後傳進來。
// 蓋章動畫：justCollected 時播一次（印章從 1.4 倍縮到 1、從 -20 度轉到印章本身的 -8 度）；減少動態時不加動畫 class。比對 ll:terms-seen 是頁面的事。
// 名詞圖鑑不再傳 pending（維護者 2026-10-26）：頁面在進度讀到之後才畫卡片，印章和卡片同一次繪製出現，不是先沒有再蓋上；
// pending 只剩設計系統的狀態板（features/design-system/ButtonBoard.tsx）在示範，那裡拿掉後這個值與 .ll-termemblem--pending 就能刪。
import type { MouseEventHandler, ReactNode } from 'react';
import { Fragment, useState } from 'react';
import {
  AccountIcon,
  BookIcon,
  CaretRightIcon,
  CheckIcon,
  CoinsIcon,
  ConceptIcon,
  HandshakeIcon,
  IouIcon,
  OtherIcon,
  ProcessIcon,
  RatioIcon,
  ReceiptIcon,
  StatementIcon,
  WalletIcon,
} from './icons.tsx';
import { UiLink } from './link-context.tsx';
import { CLOSE_QUOTES, OPEN_QUOTES, phraseParts } from './phrase.ts';
import { uiPrefersReducedMotion } from './motion.ts';

export type TermCategory = 'statement' | 'account' | 'ratio' | 'concept' | 'process' | 'other';
export type ElementKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type GlossaryItemState = 'unlocked' | 'locked' | 'pending' | 'reference';

type IconSize = { size?: number };

/** 名詞類別的圖示（名詞卡徽記、名詞頁與名詞小卡的類別 Badge 共用） */
export function TermCategoryIcon({ category, size }: { category: TermCategory } & IconSize) {
  switch (category) {
    case 'statement':
      return <StatementIcon size={size} />;
    case 'account':
      return <AccountIcon size={size} />;
    case 'ratio':
      return <RatioIcon size={size} />;
    case 'concept':
      return <ConceptIcon size={size} />;
    case 'process':
      return <ProcessIcon size={size} />;
    default:
      return <OtherIcon size={size} />;
  }
}

/** 會計要素的圖示：資產錢包、負債借據、權益握手、收入錢幣、費用收據 */
export function ElementKindIcon({ element, size }: { element: ElementKind } & IconSize) {
  switch (element) {
    case 'asset':
      return <WalletIcon size={size} />;
    case 'liability':
      return <IouIcon size={size} />;
    case 'equity':
      return <HandshakeIcon size={size} />;
    case 'revenue':
      return <CoinsIcon size={size} />;
    default:
      return <ReceiptIcon size={size} />;
  }
}

/** 徽記：科目類且有要素時用要素的 tint 與 ink；其他類別是中性底（避免報表撞資產色、觀念撞費用色） */
export function TermEmblem({
  category,
  element,
  state = 'unlocked',
  size = 44,
  className,
}: {
  category: TermCategory;
  element?: ElementKind;
  state?: GlossaryItemState;
  size?: 44 | 32;
  className?: string;
}) {
  const tone = state === 'reference' ? 'neutral' : category === 'account' && element ? element : 'neutral';
  const glyph =
    state === 'reference' ? (
      <BookIcon size={size === 44 ? 22 : 18} />
    ) : category === 'account' && element ? (
      <ElementKindIcon element={element} size={size === 44 ? 22 : 18} />
    ) : (
      <TermCategoryIcon category={category} size={size === 44 ? 22 : 18} />
    );
  return (
    <span
      className={`ll-termemblem ll-termemblem--${tone} ll-termemblem--${state} ll-termemblem--s${size}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}

/** 金色印章（已收進）：--ll-star 圓、--ll-star-ink 勾號；名詞頁的「已收進圖鑑」也用它 */
export function CollectedStamp({ size = 24, animate, className }: { size?: 24 | 32; animate?: boolean; className?: string }) {
  return (
    <span className={`ll-stamp ll-stamp--s${size}${animate ? ' is-stamping' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <CheckIcon size={size === 24 ? 14 : 18} strokeWidth={3} />
    </span>
  );
}

export interface GlossaryItemProps {
  href: string;
  name: string;
  /** 中文介面才傳（lang="en"）；英文介面不顯示 */
  english?: string | null;
  category: TermCategory;
  /** 類別的顯示名稱（apps/web 的 terms.category.*）；參考名詞傳「參考」 */
  categoryLabel: string;
  /** 科目類的會計要素（名詞索引的 element；沒有時退回中性的類別徽記） */
  element?: ElementKind;
  state: GlossaryItemState;
  /** 視覺隱藏的狀態文字：已收進、未收進（apps/web 的 terms.state.*）；pending 與 reference 不用給 */
  stateLabel?: string;
  /** 未收進時的「在 1-1 遇到」或「在 1-1「誰的東西、誰的錢」遇到」（apps/web 的 terms.meet.*，呼叫端格式化）；類別的下一行 */
  meet?: string;
  /** meet 裡的關卡名：連同前後的引號與緊接的字（「誰的東西、誰的錢」遇到）排成一塊，不從引號中間斷行 */
  meetTitle?: string;
  /** 畫面上的 meet 是短的寫法時，螢幕閱讀器唸的完整寫法（例如依章節分組時畫面是「在 1-1 遇到」、可讀名稱帶關卡名） */
  meetLabel?: string;
  /** 關卡代號（「1-1」；延伸章是「E1-2」，和章節頁、地圖一致，由呼叫端格式化），排成小膠囊（2026-10-25 看圖驗收第 2 輪）。
   *  和 meetTitle 一起給：畫面是「[1-1] 關卡名」兩部分、最多兩行，「在…遇到」的整句（meetLabel，沒給時用 meet）只給螢幕閱讀器；
   *  只給代號：meet 裡的代號換成小膠囊（「在 [1-1] 遇到」）。沒給時照舊（MeetLine） */
  meetCode?: string;
  /** NoteTag 文字標籤（不是按鈕） */
  flags?: ReactNode;
  /** 播一次蓋章動畫（只在名詞圖鑑頁、新收進的卡第一次出現時） */
  justCollected?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /** 名稱的語言（英文介面的名稱是英文） */
  lang?: string;
  id?: string;
  'data-testid'?: string;
  /** 放在外層 <li> 的 data 屬性（例如名詞圖鑑的 data-term-id，E2E 用），不影響外觀 */
  cellProps?: CellDataProps;
}

/** 外層 <li> 只收 data-* 屬性 */
export type CellDataProps = { readonly [key: `data-${string}`]: string | undefined };

/** 把 meet 切成「前段、關卡名那一塊、後段」：關卡名連同緊鄰的引號，以及後面到下一個空白為止的字（中文的「遇到」）排成一塊；
 *  找不到關卡名時回 undefined（整句照一般斷行） */
export function splitMeet(meet: string, title: string | undefined): readonly [string, string, string] | undefined {
  if (!title) return undefined;
  const at = meet.indexOf(title);
  if (at < 0) return undefined;
  let start = at;
  let end = at + title.length;
  if (start > 0 && OPEN_QUOTES.includes(meet[start - 1]!)) start -= 1;
  if (end < meet.length && CLOSE_QUOTES.includes(meet[end]!)) end += 1;
  while (end < meet.length && !/\s/.test(meet[end]!)) end += 1;
  return [meet.slice(0, start), meet.slice(start, end), meet.slice(end)];
}

/** 字寬的粗估（全形字算 1、半形字算 0.55 個字寬） */
function textUnits(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.55;
  return n;
}

/** 關卡名那一塊最多幾個字寬才排成一塊：名詞卡的文字欄在 375 單欄與寬版三欄都約 214px，15px 的字放得下 14 個字，留一點餘裕 */
const KEEP_MAX_UNITS = 13;

/** 遇到的關卡那一行：關卡名那一塊放得進一行時排成 inline-block（放不下前段就整塊換到下一行，不從引號中間斷）；
 *  比一行還長時不排成一塊，整句切詞後在詞與詞之間斷（排成一塊反而會變成「在 4-2」「「流動、」「非流動…」三行） */
function MeetLine({ meet, title }: { meet: string; title?: string }) {
  const parts = splitMeet(meet, title);
  if (!parts || textUnits(parts[1]) > KEEP_MAX_UNITS) return <Phrased text={meet} />;
  const [before, keep, after] = parts;
  return (
    <>
      <Phrased text={before} />
      <span className="ll-termitem__keep">{keep}</span>
      <Phrased text={after} />
    </>
  );
}

/** 中文的字串切成詞、詞之間放 <wbr>（外層加 .ll-phrased：keep-all 只在詞與詞之間斷，全站規則在 03-core-utils.css）；不是中文時照原字 */
function Phrased({ text }: { text: string }) {
  const parts = phraseParts(text);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/** 「在 1-1 遇到」：句子裡的代號換成小膠囊；找不到代號時整句照原字 */
function CodeLine({ meet, code }: { meet: string; code: string }) {
  const at = meet.indexOf(code);
  if (at < 0) return <>{meet}</>;
  return (
    <>
      <Phrased text={meet.slice(0, at)} />
      <span className="ll-termitem__code">{code}</span>
      <Phrased text={meet.slice(at + code.length)} />
    </>
  );
}

export function GlossaryItem({
  href,
  name,
  english,
  category,
  categoryLabel,
  element,
  state,
  stateLabel,
  meet,
  meetTitle,
  meetLabel,
  meetCode,
  flags,
  justCollected,
  onClick,
  lang,
  id,
  'data-testid': testId,
  cellProps,
}: GlossaryItemProps) {
  // justCollected 第一次變成 true 時決定要不要播（頁面在布幕拉開的那一次繪製才傳 true）；只播一次，減少動態時不加 class
  const [stamp, setStamp] = useState<'idle' | 'play' | 'still'>('idle');
  if (justCollected && stamp === 'idle') setStamp(uiPrefersReducedMotion() ? 'still' : 'play');
  const stamping = stamp === 'play' && state === 'unlocked';
  const meetText = (state === 'locked' || state === 'pending') && meet ? meet : undefined;
  const srState = stateLabel && (state === 'unlocked' || state === 'locked') ? stateLabel : undefined;
  const phrases = phraseParts(name);
  return (
    <li className="ll-termgrid__cell" {...cellProps}>
      <UiLink
        href={href}
        onClick={onClick}
        className={`ll-termitem ll-termitem--${state}${stamping ? ' is-just-collected' : ''}`}
        id={id}
        data-testid={testId}
        data-state={state}
      >
        <TermEmblem category={category} element={element} state={state} />
        <span className="ll-termitem__text">
          <span className={`ll-termitem__name${phrases ? ' ll-phrased' : ''}`} lang={lang}>
            {phrases
              ? phrases.map((p, i) => (
                  <Fragment key={i}>
                    {i > 0 && <wbr />}
                    {p}
                  </Fragment>
                ))
              : name}
          </span>
          {english && (
            <span className="ll-termitem__en" lang="en">
              {english}
            </span>
          )}
          {/* 讀的順序：類別、狀態、遇到的關卡。畫面上類別一行、遇到的關卡另起一行（不和類別擠在同一行被引號切開），狀態只給螢幕閱讀器；
              每一段前面留一個空白，可讀名稱的字不黏在一起（行首的空白不會畫出來） */}
          <span className="ll-termitem__desc">
            <span className="ll-termitem__cat">
              {categoryLabel}
              {srState && <span className="ll-sr-only">{` ${srState}`}</span>}
            </span>
            {meetText &&
              (meetCode && meetTitle ? (
                // 代號膠囊加關卡名：不會留下「在 6-1」單獨一行，最多兩行（每張卡的節奏一致）；整句只給螢幕閱讀器
                <>
                  <span className="ll-termitem__meet ll-termitem__meet--level" aria-hidden="true">
                    <span className="ll-termitem__code">{meetCode}</span>{' '}
                    <span className="ll-termitem__ltitle ll-phrased">
                      <Phrased text={meetTitle} />
                    </span>
                  </span>
                  <span className="ll-sr-only">{` ${meetLabel ?? meetText}`}</span>
                </>
              ) : meetLabel && meetLabel !== meetText ? (
                <>
                  <span className="ll-termitem__meet ll-phrased" aria-hidden="true">
                    {' '}
                    {meetCode ? <CodeLine meet={meetText} code={meetCode} /> : <Phrased text={meetText} />}
                  </span>
                  <span className="ll-sr-only">{` ${meetLabel}`}</span>
                </>
              ) : (
                <span className="ll-termitem__meet ll-phrased">
                  {' '}
                  {meetCode ? <CodeLine meet={meetText} code={meetCode} /> : <MeetLine meet={meetText} title={meetTitle} />}
                </span>
              ))}
          </span>
          {flags && <span className="ll-termitem__flags">{flags}</span>}
        </span>
        <span className="ll-termitem__chev" aria-hidden="true">
          <CaretRightIcon />
        </span>
        {(state === 'unlocked' || state === 'pending') && (
          <span className="ll-termitem__stampslot" aria-hidden="true">
            {state === 'unlocked' && <CollectedStamp size={32} animate={stamping} />}
          </span>
        )}
      </UiLink>
    </li>
  );
}

export interface GlossaryGridProps {
  children: ReactNode;
  /** 群組的可讀名稱（例如章名），或 aria-labelledby 指向 h2 */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  'data-testid'?: string;
}

/** 名詞卡格：小於 600px 一欄、600 到 1023 兩欄、1024 以上三欄 */
export function GlossaryGrid({ children, className, ...rest }: GlossaryGridProps) {
  return (
    <ul className={`ll-termgrid${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </ul>
  );
}

export interface TermPillProps {
  href: string;
  children: ReactNode;
  lang?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  'data-testid'?: string;
  /** 放在外層 <li> 的 data 屬性（例如 data-term-id），不影響外觀 */
  cellProps?: CellDataProps;
}

/** 參考名詞膠囊：44px、前置 16px BookIcon；名稱裡的「(+)」「(−)」照原字，沒有底線所以不會被看成「(_)」。放在 TermPillList 裡排成雲 */
export function TermPill({ href, children, lang, onClick, 'data-testid': testId, cellProps }: TermPillProps) {
  return (
    <li className="ll-termpills__item" {...cellProps}>
      <UiLink href={href} className="ll-termpill" lang={lang} onClick={onClick} data-testid={testId}>
        <BookIcon size={16} />
        <span className="ll-termpill__label">{children}</span>
      </UiLink>
    </li>
  );
}

/** TermPill 的雲（flex-wrap、gap 8） */
export function TermPillList({ children, className, ...rest }: GlossaryGridProps) {
  return (
    <ul className={`ll-termpills${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </ul>
  );
}
