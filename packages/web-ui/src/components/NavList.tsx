// 選單列（站規 1.7）：兩個以上的去處用 NavList 包 NavRow；單一大去處用 NavCard。
// 每列只有一個可聚焦元素（整列是連結或按鈕）：左邊 36px 圖示方塊、標題與一行說明、右側狀態（Badge、計數）、箭頭。
// 一個 NavList 最多兩種 tone（美感審查：同一頁不要出現四種底色）；需要注意的狀態（還沒備份、今天要複習）只改右側的 Badge，不改圖示方塊的顏色。
// 站內連結經 LinkProvider（react-router，不整頁重新載入）；external 換外連箭頭並加「（外部網站）」。NavCard 的 aside（例如移除鈕）一定在連結外面。
import type { MouseEventHandler, ReactNode } from 'react';
import { isValidElement, useId } from 'react';
import { ArrowUpRightIcon, CaretRightIcon } from './icons.tsx';
import { UiLink } from './link-context.tsx';
import { useUiLabels } from './ui-labels.ts';

export type NavTone = 'accent' | 'neutral';

export interface NavListProps {
  /** 群組標題（預設 h2，footnote 13/600）；省略時要給 aria-label */
  title?: ReactNode;
  'aria-label'?: string;
  /** 整個清單的圖示色系，預設 accent；整組都是說明性頁面時用 neutral */
  tone?: NavTone;
  /** 預設 true：清單本身是一張卡片；false：放在既有卡片或 Disclosure 裡（只有分隔線） */
  inset?: boolean;
  /** 標題的層級（預設 h2） */
  titleAs?: 'h2' | 'h3';
  /** 標題的 id（例如收藏區的捲動定位） */
  titleId?: string;
  className?: string;
  /** 只放 NavRow 或 NavCard */
  children: ReactNode;
  'data-testid'?: string;
}

export function NavList({ title, tone = 'accent', inset = true, titleAs: Heading = 'h2', titleId, className, children, ...rest }: NavListProps) {
  const autoId = useId();
  const headId = titleId ?? autoId;
  const list = (
    <ul
      className={`ll-navlist ll-navlist--${tone}${inset ? ' ll-navlist--inset' : ''}${!title && className ? ` ${className}` : ''}`}
      aria-labelledby={title ? headId : undefined}
      aria-label={title ? undefined : rest['aria-label']}
      data-testid={title ? undefined : rest['data-testid']}
    >
      {children}
    </ul>
  );
  if (!title) return list;
  return (
    <div className={`ll-navlist__group${className ? ` ${className}` : ''}`} data-testid={rest['data-testid']}>
      <Heading id={headId} className="ll-navlist__title">
        {title}
      </Heading>
      {list}
    </div>
  );
}

export interface NavRowProps {
  /** 有 href 是連結；沒有就給 onClick，渲染成 <button>；兩者都沒有是不可點的資訊列（沒有箭頭） */
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  external?: boolean;
  /** 必填：36px 方塊裡的 20px 圖示 */
  icon: ReactNode;
  title: ReactNode;
  /** 一行說明，可換行，不截斷（compact 不顯示） */
  description?: ReactNode;
  /** 右側狀態：Badge、計數、短文字 */
  trailing?: ReactNode;
  /** compact：44px、沒有說明 */
  size?: 'md' | 'compact';
  /** 目前所在的位置：圖示方塊加 accent 框。true 或 'page' 輸出 aria-current="page"；頁內目錄的目前段落用 'location' */
  current?: boolean | 'page' | 'location';
  /** 內容的語言（例如英文名稱） */
  lang?: string;
  /** 右側箭頭：next（預設，前往另一頁）；none 是頁內錨點（例如關於系統設計的目錄），不畫箭頭、少一欄 20px */
  chevron?: 'next' | 'none';
  className?: string;
  id?: string;
  'data-testid'?: string;
}

/**
 * 節點裡文字的估計寬度（em；字串、數字、陣列與元素的 children）：中日韓字與全形符號算 1em、其他算 0.55em。
 * 用來判斷右側狀態有多長（M3 驗收第 5 輪：以前數字數，「還沒備份」約 4em 和 Not backed up yet 約 9em 被當成一樣長）
 */
function textWidth(node: ReactNode): number {
  if (typeof node === 'string' || typeof node === 'number') {
    let em = 0;
    for (const ch of String(node)) em += /[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 1 : 0.55;
    return em;
  }
  if (Array.isArray(node)) return node.reduce<number>((n, child: ReactNode) => n + textWidth(child), 0);
  if (isValidElement<{ children?: ReactNode }>(node)) return textWidth(node.props.children);
  return 0;
}

/**
 * 右側狀態的長度分級（14-core-nav.css 的容器查詢，只對 Badge）：長（5em 以上，例如 Not backed up yet）在列寬 25em 以下移到說明下方；
 * 中（3em 以上，例如「還沒備份」）只在 19em 以下（320 寬或字級放大）移下去；計數這類短的一律在右側
 */
function trailClass(trailing: ReactNode): string | false {
  if (trailing === undefined || trailing === null) return false;
  const em = textWidth(trailing);
  return em > 5 ? 'll-navrow--long-trail' : em > 3 && 'll-navrow--mid-trail';
}

/** 列的本體（a、button 或不可點的 div）；NavRow 包一層 li，NavCard 包卡片 */
function RowBody({
  href,
  onClick,
  external,
  icon,
  title,
  description,
  trailing,
  size = 'md',
  current,
  lang,
  chevron = 'next',
  className,
  id,
  card,
  media,
  'data-testid': testId,
}: NavRowProps & { card?: boolean; media?: ReactNode }) {
  const labels = useUiLabels();
  const interactive = href !== undefined || onClick !== undefined;
  const ariaCurrent = current === true ? 'page' : current || undefined;
  const cls = [
    'll-navrow',
    size === 'compact' && 'll-navrow--compact',
    card && 'll-navrow--card',
    !interactive && 'll-navrow--static',
    trailClass(trailing),
    chevron === 'none' && 'll-navrow--no-chev',
    current && 'is-current',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      {media && (
        <span className="ll-navrow__media" aria-hidden="true">
          {media}
        </span>
      )}
      <span className="ll-navrow__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ll-navrow__text">
        <span className="ll-navrow__title">{title}</span>
        {description !== undefined && description !== null && size !== 'compact' && <span className="ll-navrow__desc">{description}</span>}
        {external && <span className="ll-sr-only">{labels.externalSite}</span>}
      </span>
      {trailing !== undefined && trailing !== null && <span className="ll-navrow__trail">{trailing}</span>}
      {interactive && chevron !== 'none' && <span className="ll-navrow__chev">{external ? <ArrowUpRightIcon /> : <CaretRightIcon />}</span>}
    </>
  );
  if (href !== undefined) {
    return (
      <UiLink
        href={href}
        external={external}
        className={cls}
        onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}
        aria-current={ariaCurrent}
        lang={lang}
        id={id}
        data-testid={testId}
      >
        {body}
      </UiLink>
    );
  }
  if (onClick !== undefined) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick as MouseEventHandler<HTMLButtonElement>}
        aria-current={ariaCurrent}
        lang={lang}
        id={id}
        data-testid={testId}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={cls} lang={lang} id={id} data-testid={testId}>
      {body}
    </div>
  );
}

export function NavRow(props: NavRowProps) {
  return (
    <li className="ll-navlist__item">
      <RowBody {...props} />
    </li>
  );
}

export interface NavCardProps extends Omit<NavRowProps, 'size' | 'chevron'> {
  /** 卡片上方的插圖（例如首頁的章節小地圖），滿寬、aria-hidden，點了也是這張卡的連結 */
  media?: ReactNode;
  /** 連結外側的兄弟元素（例如移除收藏的 IconButton），垂直置中在右側，不在連結裡 */
  aside?: ReactNode;
  /** 預設 li（放在 NavList inset={false} 裡）；單獨一張卡時用 div */
  as?: 'li' | 'div';
  /** 外層卡片的 class（只給版面用） */
  cardClassName?: string;
  /** 箭頭：預設 always；wide 是 600 以下不畫箭頭（有 aside 時箭頭和移除鈕擠在一起，文字欄用到整列寬；整張卡仍有滑過與按下的狀態） */
  chevron?: 'always' | 'wide';
}

export function NavCard({ media, aside, as: Tag = 'li', cardClassName, chevron = 'always', ...row }: NavCardProps) {
  const cls = ['ll-navcard', aside && 'll-navcard--aside', media && 'll-navcard--media', chevron === 'wide' && !media && 'll-navcard--chev-wide', cardClassName]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={cls}>
      <RowBody {...row} card media={media} />
      {aside && <div className="ll-navcard__aside">{aside}</div>}
    </Tag>
  );
}
