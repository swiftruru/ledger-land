// 小型註記標籤（07 第 9 節、05 第 12.1 節）：一律有文字；給 onClick 時是按鈕（有完整的可讀名稱），否則是純文字標籤。
// 按鈕形式（站規 1.20）：<button> 本身 44px 高、透明，視覺膠囊畫在內層 span（量得到 44px，不用偽元素補範圍），結尾加 InfoIcon，沒有底線。
import { useLingui } from '@lingui/react/macro';
import { InfoIcon } from './icons.tsx';

export type NoteTagKind = 'old_name' | 'simplified' | 'single_period' | 'not_ifrs_line' | 'ifrs_not_scored' | 'design_note' | 'extension' | 'midterm';

export interface NoteTagProps {
  kind: NoteTagKind;
  /** 標記所附的列名或名詞（可讀名稱用，例如「非 IFRS 項目：經常利益。查看 IFRS 怎麼處理」） */
  subject?: string;
  onClick?: () => void;
  className?: string;
}

export function useNoteTagLabels(): Record<NoteTagKind, string> {
  const { t } = useLingui();
  return {
    old_name: t({ id: 'note.oldName', message: '舊稱', comment: '名詞或報表列的註記標籤（W07）' }),
    simplified: t({ id: 'note.simplified', message: '簡化', comment: '名詞或報表列的註記標籤（W14）' }),
    single_period: t({ id: 'note.singlePeriod', message: '單期近似', comment: '指標的註記標籤（W12）' }),
    not_ifrs_line: t({ id: 'report.notIfrsLine', message: '非 IFRS 項目', comment: '教材版面中帶 not_ifrs_line 旗標的列，列名旁的標記（D11）' }),
    ifrs_not_scored: t({ id: 'lab.policy.ifrsNotScored', message: 'IFRS 對照，不計分', comment: '切到 IFRS 對照時的標記（D10(f)）' }),
    design_note: t({ id: 'note.designNote', message: '設計說明', comment: '引用 14 的設計決定的名詞或列的標記' }),
    extension: t({ id: 'map.chapter.extensionTag', message: '延伸，不列入期中考', comment: '延伸章的標籤' }),
    midterm: t({
      id: 'map.chapter.midtermTag',
      message: '期中考範圍',
      comment: '主線章節（examScope 為 midterm）的標籤；範圍以老師公告為準的說明另外放在章節頁、清單檢視與延伸區分隔（T32）',
    }),
  };
}

export function NoteTag({ kind, subject, onClick, className }: NoteTagProps) {
  const { t } = useLingui();
  const labels = useNoteTagLabels();
  const text = labels[kind];
  const cls = `ll-notetag ll-notetag--${kind.replace(/_/g, '-')}${className ? ` ${className}` : ''}`;
  if (!onClick) return <span className={cls}>{text}</span>;
  const line = subject ?? '';
  const a11y =
    kind === 'not_ifrs_line' && subject
      ? t({ id: 'report.notIfrsLine.a11y', message: `非 IFRS 項目：${line}。查看 IFRS 怎麼處理`, comment: '非 IFRS 項目標記按鈕的可讀名稱；line 是列名' })
      : subject
        ? t({ id: 'note.a11y', message: `${text}：${line}。查看說明`, comment: '註記標籤按鈕的可讀名稱；text 是標籤文字、line 是列名或名詞' })
        : undefined;
  return (
    <button type="button" className={`ll-notetag--btn${className ? ` ${className}` : ''}`} onClick={onClick} aria-label={a11y}>
      <span className={`ll-notetag ll-notetag--${kind.replace(/_/g, '-')} ll-notetag__pill`}>
        {text}
        <InfoIcon size={14} className="ll-notetag__icon" />
      </span>
    </button>
  );
}
