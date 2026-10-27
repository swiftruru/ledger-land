// 按鈕狀態板（站規 5.1 的 E2E 專用 fixture，?ll-fixture=buttons）：五變體 × 三尺寸 × 靜止、滑過、按下、切換已按下、焦點、停用、載入中，
// 加 IconButton、StatChip、NavRow、Disclosure、GlossaryItem 的狀態，以及 BackButton、NoteTag、TextLink、Segmented、Menu、Sheet、
// SearchField、ProgressBar、Switch、多行欄位、HintBar、Banner、空狀態與錯誤狀態、Toast（一般與收集類）、TopBar、PageHeader。
// 滑過、按下、焦點的格子帶 data-force="hover|active|focus-visible"：截圖腳本用 Chrome DevTools Protocol 的 CSS.forcePseudoState
// 一次把整張板的狀態都打開（一張圖看完全部狀態）；E2E 也可以照 data-board 標記用滑鼠、鍵盤觸發。
// 只在開發伺服器與帶 VITE_LL_FIXTURES=1 的建置可用（Root.tsx 的 BUTTON_BOARD）；正式建置不含這個檔。
// 文字是固定的示範字，不走 Lingui（這一頁不對使用者開放，不翻譯）。
import { useState, type ReactNode } from 'react';
import {
  ArrowRightIcon,
  BackButton,
  Badge,
  Banner,
  BookIcon,
  BookmarkIcon,
  Button,
  CardsIcon,
  CodeIcon,
  CompassIcon,
  ConfirmSheet,
  DeviceIcon,
  Disclosure,
  EmptyState,
  ErrorState,
  ExportIcon,
  FlaskIcon,
  GearIcon,
  GlossaryGrid,
  GlossaryItem,
  HeartIcon,
  HintBar,
  IconButton,
  InfoIcon,
  MenuButton,
  MenuItem,
  MoreIcon,
  NavCard,
  NavList,
  NavRow,
  NoteTag,
  PageHeader,
  PlayIcon,
  ProgressBar,
  RetryIcon,
  SearchField,
  Segmented,
  Sheet,
  ShieldIcon,
  StarIcon,
  StatChip,
  Switch,
  TermPill,
  TermPillList,
  TextLink,
  Toast,
  ToastRegion,
  TopBar,
  TrashIcon,
  XIcon,
  type ButtonSize,
  type ButtonVariant,
} from '@ledgerland/web-ui';
import { ChapterBadge, KeyboardIcon, ListIcon, LocateIcon, MapIcon, MedalIcon, QrIcon } from '@ledgerland/web-ui/map';
import './ButtonBoard.css';

type State = 'rest' | 'hover' | 'active' | 'pressed' | 'focus' | 'disabled' | 'busy';
const STATES: { s: State; label: string; force?: string }[] = [
  { s: 'rest', label: '靜止' },
  { s: 'hover', label: '滑過', force: 'hover' },
  { s: 'active', label: '按下', force: 'active' },
  { s: 'pressed', label: '已按下' },
  { s: 'focus', label: '焦點', force: 'focus-visible' },
  { s: 'disabled', label: '停用' },
  { s: 'busy', label: '載入中' },
];
const VARIANTS: { v: ButtonVariant; label: string; icon?: 'play' | 'retry' | 'trash' | 'map' | 'star' }[] = [
  { v: 'primary', label: '開始 1-2', icon: 'play' },
  { v: 'secondary', label: '再挑戰', icon: 'retry' },
  { v: 'danger', label: '覆蓋進度', icon: 'trash' },
  { v: 'quiet', label: '之後再說' },
  { v: 'back', label: '地圖' },
];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const ICONS = { play: <PlayIcon />, retry: <RetryIcon />, trash: <TrashIcon />, map: <MapIcon />, star: <StarIcon /> };
/** 切換按鈕只有 secondary 與 quiet（收藏、我是猜的、計時暫停、正負號） */
const TOGGLES: ReadonlySet<ButtonVariant> = new Set(['secondary', 'quiet']);

function Cell({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`ll-board__cell${wide ? ' ll-board__cell--wide' : ''}`}>
      <span className="ll-board__cap">{label}</span>
      {children}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="ll-board__group" aria-labelledby={`board-${id}`} data-board-section={id}>
      <h2 id={`board-${id}`} className="ll-board__h">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * NavCard 的 media 示範（M3 驗收第 4 輪：原本是空的色塊，看起來像圖片壞掉）：用場景 tokens 畫的靜態地景，
 * 海、島、路、走過的路線與還沒走的圓點、一個已完成與一個下一關的節點（底邊和地圖同一組 token）。只在按鈕狀態板用
 */
function BoardLandscape() {
  // viewBox 1040×120（寬版卡片的實際比例）；手機的卡片較窄，slice 只留中間約 340 寬，所以路線與兩個節點都放在中間
  return (
    <svg className="ll-board__scene" viewBox="0 0 1040 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="ll-board__sea" width="1040" height="120" />
      <path className="ll-board__sand" d="M-10 130 L -10 70 C 120 52 220 30 360 34 C 500 38 560 14 700 12 C 840 10 930 34 1050 26 L 1050 130 Z" />
      <path className="ll-board__land" d="M-10 130 L -10 80 C 120 62 222 42 360 46 C 500 50 562 26 700 24 C 840 22 932 46 1050 38 L 1050 130 Z" />
      <ellipse className="ll-board__meadow" cx="200" cy="96" rx="120" ry="20" />
      <ellipse className="ll-board__meadow" cx="860" cy="74" rx="110" ry="18" />
      <circle className="ll-board__leaf" cx="120" cy="84" r="12" />
      <circle className="ll-board__leaf" cx="146" cy="90" r="9" />
      <circle className="ll-board__leaf" cx="900" cy="58" r="11" />
      <path className="ll-board__road-edge" d="M 360 130 C 380 96 410 84 450 82 C 520 78 560 58 620 58 C 700 58 760 44 860 44" />
      <path className="ll-board__road" d="M 360 130 C 380 96 410 84 450 82 C 520 78 560 58 620 58 C 700 58 760 44 860 44" />
      <path className="ll-board__walked" d="M 360 130 C 380 96 410 84 450 82" />
      <path className="ll-board__ahead" d="M 450 82 C 520 78 560 58 620 58 C 700 58 760 44 860 44" />
      <circle className="ll-board__ledge--done" cx="450" cy="86" r="20" />
      <circle className="ll-board__disc--done" cx="450" cy="82" r="20" />
      <circle className="ll-board__ledge--next" cx="620" cy="62" r="20" />
      <circle className="ll-board__disc--next" cx="620" cy="58" r="19" />
    </svg>
  );
}

export default function ButtonBoard() {
  const [seg, setSeg] = useState('auto');
  const [segSm, setSegSm] = useState('name');
  const [fav, setFav] = useState(true);
  const [q, setQ] = useState('應收');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [discOpen, setDiscOpen] = useState(true);
  const [swOn, setSwOn] = useState(true);
  const [swOff, setSwOff] = useState(false);
  return (
    <div className="ll-board" data-testid="button-board">
      <TopBar
        title="按鈕狀態板"
        backHref="/me/"
        backLabel="回到我的"
        backShortLabel="我的"
        actions={<IconButton icon={<MoreIcon />} label="更多" variant="chrome" />}
      />
      {/* 和闖關頁一樣：339px 以下標題只給螢幕閱讀器（320 寬時兩個統計膠囊加兩顆圖示按鈕才放得下，不水平捲動） */}
      <PageHeader
        title="闖關"
        titleHiddenNarrow
        start={
          <>
            <StatChip icon={<StarIcon filled />} value="12" label="星星 12 顆" tone="star" data-board="stat-static" />
            <StatChip icon={<MedalIcon />} value="2／14" label="徽章 2／14 枚" tone="badge" href="/me/badges/" data-board="stat-link" />
          </>
        }
        end={
          <>
            <IconButton icon={<LocateIcon />} label="跳到目前關卡" variant="chrome" data-board="icon-chrome" />
            <MenuButton data-testid="board-menu">
              <MenuItem icon={<KeyboardIcon />}>輸入關卡代號</MenuItem>
              <MenuItem icon={<QrIcon />}>掃描課堂 QR</MenuItem>
              <MenuItem icon={<ListIcon />}>清單檢視</MenuItem>
            </MenuButton>
          </>
        }
      />

      <HintBar detailsHref="/me/backup/" detailsLabel="詳細：備份" onClose={() => {}} data-board="hintbar">
        記得備份進度
      </HintBar>

      {VARIANTS.map(({ v, label, icon }) => (
        <Section key={v} id={v} title={`Button ${v}`}>
          {SIZES.map((s) => (
            <div key={s} className="ll-board__states" data-board-row={`${v}-${s}`}>
              <span className="ll-board__size">{s}</span>
              {STATES.map(({ s: st, label: cap, force }) => {
                const key = `${v}-${s}-${st}`;
                if (st === 'pressed' && !TOGGLES.has(v))
                  return (
                    <Cell key={st} label={cap}>
                      <span className="ll-board__na">不適用</span>
                    </Cell>
                  );
                const lead = st === 'pressed' && v === 'secondary' ? <HeartIcon filled /> : icon ? ICONS[icon] : undefined;
                return (
                  <Cell key={st} label={cap}>
                    <Button
                      variant={v}
                      size={s}
                      icon={lead}
                      disabled={st === 'disabled'}
                      busy={st === 'busy'}
                      pressed={st === 'pressed' ? true : undefined}
                      data-board={key}
                      data-force={force}
                    >
                      {st === 'pressed' && v === 'secondary' ? '收藏' : label}
                    </Button>
                  </Cell>
                );
              })}
            </div>
          ))}
        </Section>
      ))}

      <Section id="forms" title="連結形式、切換、撐滿、外部、後置圖示、動作鈕">
        <div className="ll-board__row">
          <Button variant="primary" href="/play/" icon={<PlayIcon />} data-board="primary-md-link">
            連結
          </Button>
          <Button href="/play/" icon={<MapIcon />} data-board="secondary-md-link">
            在地圖上看這一章
          </Button>
          <Button href="/play/" disabled data-board="secondary-md-link-disabled">
            停用的連結
          </Button>
          <Button size="sm" pressed={fav} icon={<HeartIcon filled={fav} />} onClick={() => setFav((f) => !f)} data-board="toggle-secondary">
            收藏
          </Button>
          <Button variant="quiet" size="sm" pressed icon={<BookmarkIcon filled />} data-board="toggle-quiet">
            我是猜的
          </Button>
          <Button size="sm" iconEnd={<ArrowRightIcon />} href="/chapter/x/">
            前往所屬章節
          </Button>
          <Button size="sm" href="https://example.org/" external icon={<CodeIcon />}>
            原始碼
          </Button>
        </div>
        <div className="ll-board__stack">
          <Button variant="primary" size="lg" block icon={<PlayIcon />} data-board="primary-block">
            繼續 1-2 永遠平衡的一條式子
          </Button>
          <Button variant="secondary" size="md" block icon={<RetryIcon />}>
            再挑戰
          </Button>
          <Button variant="primary" size="lg" block disabled>
            確認答案
          </Button>
        </div>
        {/* 窄容器裡有前置圖示、會換行的標籤（M3 驗收第 8 輪）：圖示加文字整組置中、字靠圖示那一側，最長一行兩側的空白相同 */}
        <div className="ll-board__narrow" data-board="wrap-icon">
          <Button href="/play/" block icon={<MapIcon />}>
            在地圖上看這一章
          </Button>
          <Button size="sm" variant="quiet" pressed icon={<BookmarkIcon filled />}>
            我是猜的，加入錯題本
          </Button>
          <Button size="sm" icon={<RetryIcon />}>
            再挑戰這一關的題目
          </Button>
        </div>
        <div className="ll-board__row">
          <Button size="sm" minWidth="action" variant="primary" icon={<PlayIcon />}>
            開始
          </Button>
          <Button size="sm" minWidth="action" icon={<RetryIcon />}>
            再挑戰
          </Button>
        </div>
      </Section>

      <Section id="icon" title="IconButton（quiet、chrome）">
        {(['quiet', 'chrome'] as const).map((variant) => (
          <div key={variant} className="ll-board__states">
            <span className="ll-board__size">{variant}</span>
            {STATES.filter((x) => x.s !== 'busy').map(({ s: st, label: cap, force }) => (
              <Cell key={st} label={cap}>
                <IconButton
                  icon={variant === 'quiet' ? <XIcon /> : <ListIcon />}
                  label={variant === 'quiet' ? '關閉' : '清單檢視'}
                  variant={variant}
                  pressed={st === 'pressed' ? true : undefined}
                  disabled={st === 'disabled'}
                  data-board={`icon-${variant}-${st}`}
                  data-force={force}
                />
              </Cell>
            ))}
          </div>
        ))}
        <div className="ll-board__row">
          <IconButton icon={<InfoIcon />} label="介紹：1-1 誰的東西、誰的錢" />
          <IconButton icon={<CardsIcon />} label="詳細" href="/terms/" />
          <BackButton href="/play/" label="回到闖關地圖" shortLabel="地圖" />
          <BackButton onBack={() => {}} label="離開錯題複習" />
          <NoteTag kind="not_ifrs_line" subject="經常利益" onClick={() => {}} />
          <NoteTag kind="midterm" />
        </div>
      </Section>

      <Section id="stat" title="StatChip">
        <div className="ll-board__states">
          <Cell label="靜態">
            <StatChip icon={<StarIcon filled />} value="12" label="星星 12 顆" tone="star" />
          </Cell>
          {STATES.filter((x) => x.s === 'rest' || x.force).map(({ s: st, label: cap, force }) => (
            <Cell key={st} label={`連結 ${cap}`}>
              <StatChip
                icon={<BookmarkIcon filled />}
                value="3"
                label="錯題本 3 題"
                tone="review"
                href="/review/"
                dot
                data-board={`stat-${st}`}
                data-force={force}
              />
            </Cell>
          ))}
          <Cell label="圖鑑">
            <StatChip icon={<CardsIcon />} value="12／99" label="圖鑑 12／99" tone="terms" />
          </Cell>
        </div>
      </Section>

      <Section id="nav" title="NavList、NavRow、NavCard">
        <div className="ll-board__cols">
          <NavList title="這台裝置（accent，狀態）">
            <NavRow icon={<GearIcon />} title="設定（靜止）" description="語言、外觀、計時" href="/me/settings/" data-testid="nav-rest" />
            <NavRow
              icon={<ExportIcon />}
              title="備份（滑過）"
              description="匯出或匯入學習進度"
              trailing={<Badge kind="warning">還沒備份</Badge>}
              href="/me/backup/"
              data-testid="nav-hover"
            />
            <NavRow icon={<MedalIcon />} title="徽章（按下）" description="已取得 2／14 枚" href="/me/badges/" data-testid="nav-active" />
            <NavRow icon={<DeviceIcon />} title="安裝教學（焦點）" description="把會計樂園加到主畫面" href="/install/" data-testid="nav-focus" />
            <NavRow icon={<HeartIcon />} title="收藏的題目（目前頁）" trailing="3" href="/me/" current />
          </NavList>
          <NavList title="關於（neutral；最後一列 compact）" tone="neutral">
            <NavRow icon={<ShieldIcon />} title="隱私說明" description="進度存在哪裡、誰看得到" href="/privacy/" />
            <NavRow icon={<CompassIcon />} title="關於系統設計" description="這個網站怎麼設計出來的" href="/design/" />
            <NavRow icon={<CodeIcon />} title="回報問題" description="GitHub repo 的 issue 頁面" href="https://example.org/" external />
            <NavRow icon={<InfoIcon />} title="章節資訊" trailing="學習目標與徽章" size="compact" href="/chapter/x/" />
          </NavList>
        </div>
        <NavList aria-label="收藏" inset={false}>
          <NavCard
            icon={<HeartIcon />}
            chevron="wide"
            title="1-2 永遠平衡的一條式子"
            description="老闆拿出自己的錢開店，資產和業主權益同時增加多少？"
            trailing={<Badge>1-2</Badge>}
            href="/level/x/"
            aside={<IconButton icon={<TrashIcon />} label="移除收藏：老闆拿出自己的錢開店" />}
          />
          <NavCard
            icon={<HeartIcon />}
            title="這一關已下架"
            description="不可點的卡片：沒有箭頭，移除鈕照樣在右側"
            trailing={<Badge>1-9</Badge>}
            aside={<IconButton icon={<TrashIcon />} label="移除收藏：已下架的題目" />}
          />
        </NavList>
        <NavCard
          as="div"
          icon={<MapIcon />}
          title="第 1 章 一家小店的帳"
          description="下一關 1-2 永遠平衡的一條式子"
          href="/play/"
          media={<BoardLandscape />}
        />
      </Section>

      <Section id="disclosure" title="Disclosure">
        <div className="ll-board__cols">
          <div>
            <Disclosure summary="參考名詞（收合）" icon={<BookIcon />} trailing={<Badge>64</Badge>} data-testid="disc-rest">
              <p>內容</p>
            </Disclosure>
            <Disclosure summary="滑過" icon={<BookIcon />} trailing={<Badge>64</Badge>} data-testid="disc-hover">
              <p>內容</p>
            </Disclosure>
            <Disclosure summary="按下" icon={<BookIcon />} trailing={<Badge>64</Badge>} data-testid="disc-active">
              <p>內容</p>
            </Disclosure>
            <Disclosure summary="焦點" icon={<BookIcon />} data-testid="disc-focus">
              <p>內容</p>
            </Disclosure>
          </div>
          <div>
            <Disclosure summary="在 iPhone 上怎麼做（展開，受控）" open={discOpen} onToggle={setDiscOpen}>
              <p>展開後的內容。受控時以父層的 open 為準。</p>
            </Disclosure>
            <Disclosure summary="其他選項為什麼不對（plain）" variant="plain" defaultOpen>
              <p>plain 版只有上下兩條髮絲線，放在卡片或回饋面板裡。</p>
            </Disclosure>
            <Disclosure summary="給老師：關卡代號（plain，收合）" variant="plain">
              <p>內容</p>
            </Disclosure>
          </div>
        </div>
      </Section>

      <Section id="glossary" title="GlossaryItem、TermPill">
        <GlossaryGrid aria-label="名詞卡">
          <GlossaryItem
            href="/terms/a/"
            name="現金及約當現金"
            english="Cash and cash equivalents"
            category="account"
            categoryLabel="科目"
            element="asset"
            state="unlocked"
            stateLabel="已收進"
            data-testid="gi-unlocked"
          />
          <GlossaryItem
            href="/terms/b/"
            name="應付帳款"
            english="Accounts payable"
            category="account"
            categoryLabel="科目"
            element="liability"
            state="unlocked"
            stateLabel="已收進"
            justCollected
            data-testid="gi-just"
          />
          <GlossaryItem
            href="/terms/c/"
            name="權責發生基礎"
            english="Accrual basis"
            category="concept"
            categoryLabel="觀念"
            state="locked"
            stateLabel="未收進"
            meet="在 1-1 誰的東西、誰的錢遇到"
            data-testid="gi-locked"
          />
          <GlossaryItem
            href="/terms/d/"
            name="損益表"
            english="Statement of profit or loss"
            category="statement"
            categoryLabel="報表"
            state="pending"
            data-testid="gi-pending"
          />
          <GlossaryItem
            href="/terms/e/"
            name="流動比率"
            english="Current ratio"
            category="ratio"
            categoryLabel="參考"
            state="reference"
            data-testid="gi-reference"
          />
          <GlossaryItem
            href="/terms/f/"
            name="銷貨收入（滑過）"
            english="Sales revenue"
            category="account"
            categoryLabel="科目"
            element="revenue"
            state="unlocked"
            stateLabel="已收進"
            data-testid="gi-hover"
          />
          <GlossaryItem
            href="/terms/g/"
            name="薪資費用（按下）"
            english="Salaries expense"
            category="account"
            categoryLabel="科目"
            element="expense"
            state="locked"
            stateLabel="未收進"
            meet="在 3-2 一個月的薪水遇到"
            data-testid="gi-active"
          />
          <GlossaryItem
            href="/terms/h/"
            name="業主權益（焦點）"
            english="Owner's equity"
            category="account"
            categoryLabel="科目"
            element="equity"
            state="unlocked"
            stateLabel="已收進"
            data-testid="gi-focus"
          />
          <GlossaryItem
            href="/terms/i/"
            name="結帳流程"
            english="Closing process"
            category="process"
            categoryLabel="流程"
            state="locked"
            stateLabel="未收進"
            meet="在 9-1 關帳的那一天遇到"
          />
        </GlossaryGrid>
        <TermPillList aria-label="參考名詞">
          <TermPill href="/terms/p/">預付費用</TermPill>
          <TermPill href="/terms/q/">累計折舊 (−)</TermPill>
          <TermPill href="/terms/r/">業主往來 (+)</TermPill>
          <TermPill href="/terms/s/" data-testid="pill-hover">
            滑過的膠囊
          </TermPill>
        </TermPillList>
      </Section>

      <Section id="fields" title="SearchField、ProgressBar">
        <div className="ll-board__cols">
          <SearchField label="搜尋名詞（中文或英文）" value={q} onChange={setQ} placeholder="例如：應收帳款、asset" />
          <SearchField label="空的搜尋框" defaultValue="" onChange={() => {}} placeholder="例如：折舊" />
        </div>
        <div className="ll-board__progress">
          <span className="ll-board__cap">md 0／99</span>
          <ProgressBar value={0} max={99} />
          <span className="ll-board__cap">md 12／99</span>
          <ProgressBar value={12} max={99} />
          <span className="ll-board__cap">md 60%</span>
          <ProgressBar value={0.6} />
          <span className="ll-board__cap">sm 100%</span>
          <ProgressBar value={1} size="sm" />
          <span className="ll-board__cap">sm 0／14</span>
          <ProgressBar value={0} max={14} size="sm" />
        </div>
        <div className="ll-board__cols" data-board="switches">
          <Switch checked={swOn} onChange={setSwOn} label="附上錯誤紀錄（開）" description="只用於回報問題" />
          <Switch checked={swOff} onChange={setSwOff} label="附上錯誤紀錄（關）" />
          <Switch checked={false} onChange={() => {}} label="停用的開關" disabled />
        </div>
        <div className="ll-board__cols">
          <div>
            <label className="ll-board__cap" htmlFor="board-code">
              多行欄位（五行，不能拖曳改大小）
            </label>
            <textarea
              id="board-code"
              className="ll-input"
              readOnly
              rows={4}
              value={
                'LL1:TZDBToNAEIbfZa5d6AJSmr0ZjUlPUtvqwZhm2R2BALu4u9DShnc3GNTe5s98ky_zX4G3LbArCK0cKveKxpZaAQsI9L8zUJ_6dFFrwWsYCYgCRWW7BhjYgofxyttXsdk8bNPm9SW4G4Y-G55SFbYyjvdt9_iWyufD-fjlxVF3AAKSOz45uXPYtM4Ce_8gUPNsx5XM9Pk_0-5wTthjnRqdG7TzgcG-xNO2w25mLDpXqtwCu44EOlVrUf2wIwGZ7USBDb99UGJfCtxIYCCPNB9kdLnEQACN0WaW4LnVxqG8d8AgpOHKC6gXxnuasChhUejTIFnQNaMUCHxq0_AJrFHmaGqupJdxUXXt3_LW32iJwCAz-mTRAAFtyrycCi-ca9lyGYTJ1LwfsPV6TWH8Bg'
              }
            />
          </div>
          <div>
            <label className="ll-board__cap" htmlFor="board-code-error">
              多行欄位（錯誤）
            </label>
            <textarea id="board-code-error" className="ll-input" rows={4} aria-invalid="true" defaultValue="LL1:這不是備份碼" />
          </div>
        </div>
      </Section>

      <Section id="banner" title="HintBar、Banner">
        {/* 換行用全站規則（07 第 3.5 節：中文逐字換行、齊行） */}
        <HintBar kind="warning" detailsHref="/me/backup/" detailsLabel="詳細：Safari 分頁" onClose={() => {}}>
          Safari 分頁的進度可能會消失，文字放大時會換行，不會被截斷
        </HintBar>
        {/* 站規 2.17：只有儲存層五種的主動作是 primary sm，其他橫幅的主動作是 secondary sm 加圖示、次動作 quiet sm */}
        <Banner
          kind="info"
          title="把會計樂園加到主畫面"
          onDismiss={() => {}}
          actions={
            <>
              <Button size="sm" icon={<DeviceIcon />}>
                加到主畫面
              </Button>
              <Button variant="quiet" size="sm">
                之後再說
              </Button>
            </>
          }
        >
          加到主畫面後，進度不會因為清除瀏覽紀錄而消失。
        </Banner>
        <Banner kind="warning" role="status">
          <p>舊寫法：只有 children 的橫幅，圖示自動加上。</p>
        </Banner>
        <Banner
          kind="danger"
          title="無法儲存進度"
          actions={
            <Button variant="primary" size="sm" icon={<ExportIcon />}>
              立即匯出
            </Button>
          }
        >
          這台裝置的儲存空間被瀏覽器擋住了，先匯出備份檔。
        </Banner>
        <Banner kind="success" title="備份碼已複製" role="status">
          貼到另一台裝置或 App 的「貼上備份碼」就能匯入。
        </Banner>
      </Section>

      <Section id="states" title="EmptyState、ErrorState、Sheet、Menu">
        <div className="ll-board__cols">
          {/* 和錯題本的空狀態同一組字（第 7 輪 handoff） */}
          <EmptyState
            title="今天沒有要複習的題目"
            description="答錯或標成猜的題目，會在之後幾天回來找你。"
            action={
              <Button variant="primary" icon={<MapIcon />} href="/play/">
                去闖關地圖
              </Button>
            }
          />
          <ErrorState
            title="地圖載入失敗"
            description="這一頁還沒下載到這台裝置。連上網路後再試一次。"
            onRetry={() => {}}
            action={
              <Button icon={<CardsIcon />} href="/terms/">
                先看名詞圖鑑
              </Button>
            }
          />
        </div>
        <div className="ll-board__row">
          <Button onClick={() => setSheet(true)} icon={<FlaskIcon />} data-board="open-sheet">
            打開面板
          </Button>
          <Button variant="danger" icon={<TrashIcon />} onClick={() => setConfirm(true)} data-board="open-confirm">
            覆蓋現有進度
          </Button>
        </div>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="1-2 永遠平衡的一條式子"
          subtitle="第 1 章 一家小店的帳"
          lead={<Badge kind="accent">目前關卡</Badge>}
          data-testid="board-sheet"
          footer={
            <>
              <Button variant="quiet" icon={<InfoIcon />} href="/chapter/x/">
                章節資訊
              </Button>
              <Button variant="primary" size="lg" block icon={<PlayIcon />} href="/level/x/">
                開始
              </Button>
            </>
          }
        >
          <p>學習目標：看懂資產等於負債加權益。</p>
        </Sheet>
        <ConfirmSheet
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={() => setConfirm(false)}
          title="要覆蓋現有進度嗎？"
          description="這台裝置上的星星、錯題本與設定會換成備份檔裡的內容，覆蓋之後不能復原。"
          confirmLabel="覆蓋現有進度"
          confirmIcon={<TrashIcon />}
          data-testid="board-confirm"
        />
      </Section>

      <Section id="text" title="TextLink 與分段控制">
        <p>
          進度存在哪裡，請看 <TextLink href="/privacy/">隱私說明</TextLink>；授權寫在{' '}
          <TextLink href="https://example.org/" external>
            原始碼與第三方授權聲明
          </TextLink>
          。
        </p>
        <p lang="en">
          Read the <TextLink href="/privacy/">privacy notice</TextLink> before you start.
        </p>
        <Segmented
          value={seg}
          label="玻璃效果"
          onChange={setSeg}
          options={[
            { value: 'auto', label: '自動' },
            { value: 'reduced', label: '降低透明度' },
            { value: 'frost', label: '霧面' },
            { value: 'refract', label: '折射' },
          ]}
        />
        <div className="ll-board__row">
          <Segmented
            value={segSm}
            label="排序"
            size="sm"
            onChange={setSegSm}
            options={[
              { value: 'chapter', label: '依章節' },
              { value: 'name', label: '依名稱' },
            ]}
          />
          <Segmented
            value="zh-TW"
            label="語言"
            size="sm"
            onChange={() => {}}
            options={[
              { value: 'zh-TW', label: '中', lang: 'zh-TW' },
              { value: 'en', label: 'EN', lang: 'en' },
            ]}
          />
          <StatChip icon={<StarIcon filled />} value="12" label="星星 12 顆" tone="star" />
        </div>
      </Section>
      <ToastRegion className="ll-board__toasts">
        <Toast kind="collect" media={<ChapterBadge state="mastery" size={34} />} title="取得精通徽章" onDismiss={() => {}}>
          開店了
        </Toast>
        <Toast kind="success" action={{ label: '查看', onClick: () => {} }} onDismiss={() => {}}>
          取得徽章：開店了
        </Toast>
      </ToastRegion>
    </div>
  );
}
