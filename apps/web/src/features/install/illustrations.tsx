// 安裝圖解的原創示意圖（06 第 2.6 節、07 第 12 節）：不放 iOS 實機截圖，用簡化的手機畫面與線條圖示；顏色全部來自 tokens 的 CSS 變數，
// 四個主題都能看；高亮只是加粗的強調色外框，減少動態時不動畫。文字標籤由呼叫端用介面語言傳進來。
export type GuideStep = 'compact-more' | 'compact-share' | 'bar-share' | 'add-row' | 'confirm' | 'chromium-menu' | 'chromium-confirm';

export interface GuideLabels {
  share: string;
  addToHome: string;
  openAsApp: string;
  add: string;
  install: string;
  appName: string;
}

interface Props {
  step: GuideStep;
  labels: GuideLabels;
  className?: string;
}

/** 分享圖示：方框加向上的箭頭（原創線條，不描摹系統圖示） */
function ShareGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="ll-guide__glyph">
      <path d="M-5 0 v9 h10 v-9" />
      <path d="M0 -7 v10" />
      <path d="M-3.5 -3.5 L0 -7 L3.5 -3.5" />
    </g>
  );
}

function PlusGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="ll-guide__glyph">
      <rect x="-6" y="-6" width="12" height="12" rx="3" />
      <path d="M0 -3 v6 M-3 0 h6" />
    </g>
  );
}

function MoreGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="ll-guide__glyph ll-guide__glyph--fill">
      <circle cx="-5" cy="0" r="1.6" />
      <circle cx="0" cy="0" r="1.6" />
      <circle cx="5" cy="0" r="1.6" />
    </g>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect x="3" y="3" width="154" height="194" rx="18" className="ll-guide__phone" />
      {/* 頁面內容的灰條 */}
      <rect x="20" y="28" width="90" height="8" rx="4" className="ll-guide__line" />
      <rect x="20" y="44" width="120" height="6" rx="3" className="ll-guide__line" />
      <rect x="20" y="56" width="104" height="6" rx="3" className="ll-guide__line" />
      <rect x="20" y="68" width="112" height="6" rx="3" className="ll-guide__line" />
      {children}
    </>
  );
}

/** 從底部升起的選單面板：rows 是列文字，highlight 是要加框的那一列 */
function Sheet({ rows, highlight, glyph }: { rows: readonly string[]; highlight: number; glyph: 'share' | 'plus' }) {
  const top = 86;
  return (
    <>
      <rect x="10" y={top} width="140" height="104" rx="14" className="ll-guide__sheet" />
      {rows.map((text, i) => {
        const y = top + 16 + i * 26;
        const hl = i === highlight;
        return (
          <g key={text + String(i)}>
            {hl && <rect x="16" y={y - 10} width="128" height="22" rx="8" className="ll-guide__highlight" />}
            <text x="26" y={y + 4} className={`ll-guide__text${hl ? ' ll-guide__text--strong' : ''}`}>
              {text}
            </text>
            {hl && (glyph === 'share' ? <ShareGlyph x={132} y={y + 1} /> : <PlusGlyph x={132} y={y + 1} />)}
          </g>
        );
      })}
    </>
  );
}

export function GuideIllustration({ step, labels, className }: Props) {
  return (
    <svg viewBox="0 0 160 200" className={`ll-guide__svg${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false" data-step={step}>
      <Phone>
        {step === 'compact-more' && (
          <>
            {/* Compact 分頁列：底部一顆縮小的網址膠囊，右側是「⋯」 */}
            <rect x="18" y="160" width="124" height="24" rx="12" className="ll-guide__bar" />
            <rect x="40" y="168" width="52" height="8" rx="4" className="ll-guide__line" />
            <circle cx="128" cy="172" r="10" className="ll-guide__highlight" />
            <MoreGlyph x={128} y={172} />
          </>
        )}
        {step === 'compact-share' && <Sheet rows={['Aa', '', labels.share]} highlight={2} glyph="share" />}
        {step === 'bar-share' && (
          <>
            {/* Top／Bottom 分頁列：底部完整工具列，中間是「分享」 */}
            <rect x="3" y="156" width="154" height="41" className="ll-guide__bar ll-guide__bar--full" />
            <path d="M28 176 l6 -6 M28 176 l6 6" className="ll-guide__glyph" />
            <path d="M58 176 l-6 -6 M58 176 l-6 6" className="ll-guide__glyph" />
            <circle cx="80" cy="176" r="12" className="ll-guide__highlight" />
            <ShareGlyph x={80} y={176} />
            <path d="M104 170 h10 v12 h-10z M104 176 h10" className="ll-guide__glyph" />
            <rect x="126" y="170" width="11" height="11" rx="2" className="ll-guide__glyph" />
            <rect x="130" y="166" width="11" height="11" rx="2" className="ll-guide__glyph" />
          </>
        )}
        {step === 'add-row' && <Sheet rows={['', '', labels.addToHome]} highlight={2} glyph="plus" />}
        {step === 'confirm' && (
          <>
            <rect x="10" y="86" width="140" height="104" rx="14" className="ll-guide__sheet" />
            <rect x="22" y="100" width="26" height="26" rx="7" className="ll-guide__appicon" />
            <text x="56" y="112" className="ll-guide__text ll-guide__text--strong">
              {labels.appName}
            </text>
            <rect x="56" y="118" width="60" height="5" rx="2.5" className="ll-guide__line" />
            {/* 「以 Web App 打開」開關（iOS 26 以上才有） */}
            <text x="22" y="150" className="ll-guide__text">
              {labels.openAsApp}
            </text>
            <rect x="112" y="141" width="28" height="14" rx="7" className="ll-guide__toggle" />
            <circle cx="133" cy="148" r="5.5" className="ll-guide__knob" />
            <rect x="22" y="164" width="116" height="20" rx="8" className="ll-guide__highlight ll-guide__highlight--button" />
            <text x="80" y="178" textAnchor="middle" className="ll-guide__text ll-guide__text--onaccent">
              {labels.add}
            </text>
          </>
        )}
        {step === 'chromium-menu' && (
          <>
            <rect x="18" y="12" width="124" height="22" rx="11" className="ll-guide__bar" />
            <circle cx="130" cy="23" r="9" className="ll-guide__highlight" />
            <g transform="rotate(90 130 23)">
              <MoreGlyph x={130} y={23} />
            </g>
            <rect x="60" y="40" width="90" height="70" rx="10" className="ll-guide__sheet" />
            <rect x="70" y="52" width="60" height="5" rx="2.5" className="ll-guide__line" />
            <rect x="70" y="66" width="48" height="5" rx="2.5" className="ll-guide__line" />
            <rect x="66" y="80" width="78" height="20" rx="8" className="ll-guide__highlight" />
            <text x="76" y="94" className="ll-guide__text ll-guide__text--strong">
              {labels.install}
            </text>
          </>
        )}
        {step === 'chromium-confirm' && (
          <>
            {/* 瀏覽器的安裝確認視窗（第 4 輪驗收新增）：App 圖示與名稱、取消（只畫外框）與加框的「安裝」 */}
            <rect x="18" y="12" width="124" height="22" rx="11" className="ll-guide__bar" />
            <rect x="14" y="74" width="132" height="92" rx="14" className="ll-guide__sheet" />
            <rect x="26" y="88" width="26" height="26" rx="7" className="ll-guide__appicon" />
            <text x="60" y="100" className="ll-guide__text ll-guide__text--strong">
              {labels.appName}
            </text>
            <rect x="60" y="106" width="64" height="5" rx="2.5" className="ll-guide__line" />
            <rect x="26" y="130" width="52" height="22" rx="8" className="ll-guide__bar" />
            <rect x="84" y="130" width="52" height="22" rx="8" className="ll-guide__highlight ll-guide__highlight--button" />
            <text x="110" y="145" textAnchor="middle" className="ll-guide__text ll-guide__text--onaccent">
              {labels.install}
            </text>
          </>
        )}
      </Phone>
    </svg>
  );
}
