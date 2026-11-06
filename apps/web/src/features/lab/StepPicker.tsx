// 勾稽練習的「選一步」（03 第 3.8 節）：取代瀏覽器原生的下拉選單。按鈕上是目前這一步的號碼牌與名稱，按下去打開面板（和地圖的關卡面板同一套 Sheet：
// 原生 dialog，焦點鎖定、Esc 與點遮罩關閉、關閉後焦點回到按鈕），裡面每一步是一列：左邊是像關卡節點的圓形號碼牌，練過的是亮起來的星色、
// 還沒練的是淡色；右邊用文字標出「完成」「看過答案」與「目前」（不只靠顏色）。列是設計系統的 NavRow（按鈕），鍵盤用 Tab 與 Enter。
// 面板開頭站著鈴（裝飾），副標是練過幾步；平板以上分兩欄，先上到下、再左到右。
// 2026-11-06（維護者回饋）：原生選單和站上其他地方的樣子差太多，不像遊戲裡選關卡。
import { useLingui } from '@lingui/react/macro';
import { useId, useRef, useState, type CSSProperties } from 'react';
import { Badge, Button, CaretDownIcon, NavList, NavRow, Sheet, StarIcon } from '@ledgerland/web-ui';
import { MapMarker } from '@ledgerland/web-ui/map';

/** todo：還沒練；done：全部相符；peeked：全部相符，但有格子用到第三層提示（看過答案） */
export type StepPickState = 'todo' | 'done' | 'peeked';

export interface StepPickItem {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly state: StepPickState;
}

export interface StepPickerProps {
  steps: readonly StepPickItem[];
  /** 目前選的步驟 id */
  value: string;
  onPick: (id: string) => void;
}

/** 號碼牌：像地圖的關卡節點（圓盤加立體底邊），裝飾用，名稱另外有文字 */
function StepDisc({ order, state }: { order: number; state: StepPickState }) {
  return (
    <span className="ll-lab-stepdisc ll-num" data-state={state} aria-hidden="true">
      {order}
    </span>
  );
}

export function StepPicker({ steps, value, onPick }: StepPickerProps) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const captionId = useId();
  // Button 不轉發 ref：關閉面板後要把焦點還給它，用外層找（Safari 點按鈕不給焦點，不能靠 document.activeElement）
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const current = steps.find((s) => s.id === value) ?? steps[0];
  if (!current) return null;
  // 和故事頁共用 lab.story.stepN：參數要寫成成員存取（s.order），抽出來的佔位符才和那邊一樣是 {0}
  const stepNo = (s: StepPickItem) => t({ id: 'lab.story.stepN', message: `第 ${s.order} 步` });
  const done = steps.filter((s) => s.state !== 'todo').length;
  const show = () => {
    trigger.current = wrap.current?.querySelector('button') ?? null;
    setOpen(true);
  };
  const choose = (id: string) => {
    setOpen(false);
    if (id !== value) onPick(id);
  };
  return (
    <div ref={wrap} className="ll-lab-steppick">
      <span id={captionId} className="ll-lab-steppick__caption">
        {t({ id: 'lab.reconcile.pick', message: '故事的哪一步之後', comment: '選步驟的按鈕上方的說明' })}
      </span>
      <Button
        variant="secondary"
        iconEnd={<CaretDownIcon />}
        className="ll-lab-steppick__trigger"
        aria-haspopup="dialog"
        aria-describedby={captionId}
        onClick={show}
        data-testid="lab-reconcile-step"
      >
        {/* 號碼牌放在文字裡（按鈕的圖示欄只有 20px 寬，放不下）；和面板的列一樣，「第 n 步」用看不到的字補進可讀名稱 */}
        <span className="ll-lab-steppick__now">
          <StepDisc order={current.order} state={current.state} />
          <span>
            <span className="ll-sr-only">{stepNo(current)} </span>
            {current.title}
          </span>
        </span>
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t({ id: 'lab.reconcile.sheet.title', message: '選一步來練習', comment: '勾稽練習選步驟的面板標題' })}
        subtitle={t({
          id: 'lab.reconcile.sheet.progress',
          message: `已經練過 ${done}／${steps.length} 步`,
          comment: '勾稽練習選步驟的面板副標；兩個數字已代入',
        })}
        lead={<MapMarker pose="wave" size={64} />}
        returnFocusTo={trigger}
        className="ll-sheet--steps"
        data-testid="lab-step-sheet"
      >
        {/* 兩欄時每欄幾列（先上到下、再左到右）由步驟數決定：自訂屬性寫在外層，裡面清單的格線用它 */}
        <div className="ll-lab-steps__wrap" style={{ '--_rows': Math.ceil(steps.length / 2) } as CSSProperties}>
          <NavList
            aria-label={t({ id: 'lab.reconcile.sheet.list', message: '故事的步驟', comment: '勾稽練習選步驟面板裡清單的可讀名稱' })}
            inset={false}
            className="ll-lab-steps"
          >
            {steps.map((s) => (
              <NavRow
                key={s.id}
                onClick={() => choose(s.id)}
                icon={<StepDisc order={s.order} state={s.state} />}
                // 號碼牌是裝飾（aria-hidden），可讀名稱裡的「第 n 步」用看不到的字補上
                title={
                  <>
                    <span className="ll-sr-only">{stepNo(s)} </span>
                    {s.title}
                  </>
                }
                size="compact"
                trailing={
                  s.id === value ? (
                    <Badge kind="accent">{t({ id: 'lab.reconcile.sheet.current', message: '目前', comment: '選步驟面板：現在正在練的這一步' })}</Badge>
                  ) : s.state === 'done' ? (
                    <Badge kind="star">
                      <StarIcon />
                      {t({ id: 'lab.reconcile.sheet.done', message: '完成', comment: '選步驟面板：這一步的勾稽練習全部相符' })}
                    </Badge>
                  ) : s.state === 'peeked' ? (
                    <Badge kind="neutral">
                      {t({ id: 'lab.reconcile.sheet.peeked', message: '看過答案', comment: '選步驟面板：這一步完成了，但有格子用過第三層提示' })}
                    </Badge>
                  ) : undefined
                }
                current={s.id === value ? 'location' : undefined}
                chevron="none"
                data-testid={`lab-step-option-${s.order}`}
              />
            ))}
          </NavList>
        </div>
      </Sheet>
    </div>
  );
}
