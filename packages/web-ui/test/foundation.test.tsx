// 基礎元件（站規 1.2 到 1.6、1.12、1.17、4.3）：Button、IconButton、BackButton、TopBar、PageHeader、StatChip、TextLink、LinkProvider，
// 以及 Segmented 的焦點與窄螢幕換列、ToastRegion 的播報、NoteTag 按鈕形式（findings foundation-1 到 3）
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useState, type ReactNode } from 'react';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BackButton,
  Button,
  IconButton,
  LinkProvider,
  NoteTag,
  PageHeader,
  PlayIcon,
  Segmented,
  StarIcon,
  StatChip,
  TextLink,
  Toast,
  ToastRegion,
  TopBar,
  XIcon,
  loadWebUiMessages,
  type ButtonVariant,
  type LinkComponentProps,
} from '../src/index.ts';

beforeAll(async () => {
  i18n.loadAndActivate({ locale: 'zh-TW', messages: await loadWebUiMessages('zh-TW') });
});

/** 假的 provider：記錄導航；尊重 onClick 裡的 preventDefault()（react-router 的 Link 也是這樣），自己永遠不讓瀏覽器真的換頁 */
function makeProvider() {
  const navigate = vi.fn<(href: string) => void>();
  function FakeLink({ href, onClick, ref, children, ...rest }: LinkComponentProps) {
    return (
      <a
        ref={ref}
        href={href}
        data-router="fake"
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          const prevented = e.defaultPrevented;
          e.preventDefault();
          if (!prevented) navigate(href);
        }}
      >
        {children}
      </a>
    );
  }
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <LinkProvider component={FakeLink}>{children}</LinkProvider>
    </I18nProvider>
  );
  return { navigate, Wrap };
}

const deco = (el: Element) => getComputedStyle(el).textDecorationLine;
const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'back', 'quiet', 'danger'];

describe('Button', () => {
  it('沒有 href 是 <button type="button">；預設 secondary md', async () => {
    const screen = await render(<Button>再挑戰</Button>);
    const el = page.getByRole('button', { name: '再挑戰' }).element() as HTMLButtonElement;
    expect(el.tagName).toBe('BUTTON');
    expect(el.type).toBe('button');
    expect(el.className).toContain('ll-btn--secondary');
    expect(el.className).toContain('ll-btn--md');
    screen.unmount();
  });

  it('有 href 且有 provider 時渲染 provider 的連結', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <Button href="/play/">去闖關</Button>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '去闖關' }).element();
    expect(link.getAttribute('data-router')).toBe('fake');
    expect(link.getAttribute('href')).toBe('/play/');
    screen.unmount();
  });

  it('有 href、沒有 provider 時退回原生 <a>', async () => {
    const screen = await render(<Button href="/play/">去闖關</Button>);
    const link = page.getByRole('link', { name: '去闖關' }).element();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('data-router')).toBeNull();
    screen.unmount();
  });

  it('onClick 裡 preventDefault() 時 provider 不導航；沒有時導航到 href', async () => {
    const { navigate, Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <Button href="/a/" onClick={(e) => e.preventDefault()}>
          先關面板
        </Button>
        <Button href="/b/">直接去</Button>
      </Wrap>,
    );
    await page.getByRole('link', { name: '先關面板' }).click();
    expect(navigate).not.toHaveBeenCalled();
    await page.getByRole('link', { name: '直接去' }).click();
    expect(navigate).toHaveBeenCalledWith('/b/');
    screen.unmount();
  });

  it('五種變體在靜止、滑過、焦點、停用都沒有底線（連結與按鈕兩種形式）', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        {VARIANTS.map((v) => (
          <div key={v}>
            <Button variant={v} href={`/${v}/`}>
              {`連結 ${v}`}
            </Button>
            <Button variant={v}>{`按鈕 ${v}`}</Button>
            <Button variant={v} disabled>
              {`停用 ${v}`}
            </Button>
            <Button variant={v} href={`/${v}/x/`} disabled>
              {`停用連結 ${v}`}
            </Button>
          </div>
        ))}
      </Wrap>,
    );
    for (const v of VARIANTS) {
      for (const name of [`連結 ${v}`, `按鈕 ${v}`]) {
        const loc = page.getByText(name, { exact: true });
        const el = loc.element().closest('.ll-btn')!;
        expect(deco(el)).toBe('none');
        await userEvent.hover(el);
        expect(deco(el)).toBe('none');
        (el as HTMLElement).focus();
        expect(deco(el)).toBe('none');
      }
      expect(deco(page.getByText(`停用 ${v}`, { exact: true }).element().closest('.ll-btn')!)).toBe('none');
      expect(deco(page.getByText(`停用連結 ${v}`, { exact: true }).element().closest('.ll-btn')!)).toBe('none');
    }
    screen.unmount();
  });

  it('按下（:active）與所有狀態的樣式規則都不會把底線加回來', () => {
    const offenders: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSStyleRule && /\.ll-(btn|iconbtn|statchip|notetag--btn)\b/.test(r.selectorText)) {
          const line = r.style.getPropertyValue('text-decoration-line') || r.style.getPropertyValue('text-decoration');
          if (line && !/^none\b/.test(line.trim())) offenders.push(`${r.selectorText} → ${line}`);
        } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* 跨來源的樣式表讀不到，略過 */
      }
    }
    expect(offenders).toEqual([]);
  });

  it('三種尺寸的面高 44、48、56（底邊是陰影，不算在元素本身）；舊寫法 ll-btn--small 等於 sm', async () => {
    const screen = await render(
      <div>
        <Button size="sm">小</Button>
        <Button>中</Button>
        <Button size="lg">大</Button>
        <Button className="ll-btn--small extra-layout">舊小</Button>
      </div>,
    );
    const h = (name: string) => page.getByRole('button', { name, exact: true }).element().getBoundingClientRect().height;
    expect(h('小')).toBeCloseTo(44, 0);
    expect(h('中')).toBeCloseTo(48, 0);
    expect(h('大')).toBeCloseTo(56, 0);
    const legacy = page.getByRole('button', { name: '舊小' }).element();
    expect(legacy.className).toContain('ll-btn--sm');
    expect(legacy.className).not.toContain('ll-btn--small');
    expect(legacy.className).toContain('extra-layout');
    expect(legacy.getBoundingClientRect().height).toBeCloseTo(44, 0);
    // 立體的按鈕下方保留底邊的空間，平的不保留
    expect(getComputedStyle(page.getByRole('button', { name: '中' }).element()).marginBlockEnd).toBe('4px');
    screen.unmount();
  });

  it('pressed 輸出 aria-pressed；primary 有底邊、back 與 quiet 沒有', async () => {
    const screen = await render(
      <div>
        <Button pressed>收藏</Button>
        <Button pressed={false}>計時</Button>
        <Button variant="primary">下一題</Button>
        <Button variant="quiet">之後再說</Button>
        <Button variant="back">地圖</Button>
      </div>,
    );
    await expect.element(page.getByRole('button', { name: '收藏' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('button', { name: '計時' })).toHaveAttribute('aria-pressed', 'false');
    expect(getComputedStyle(page.getByRole('button', { name: '下一題' }).element()).boxShadow).not.toBe('none');
    expect(getComputedStyle(page.getByRole('button', { name: '之後再說' }).element()).marginBlockEnd).toBe('0px');
    const backShadow = getComputedStyle(page.getByRole('button', { name: '地圖' }).element()).boxShadow;
    expect(backShadow === 'none' || /0px 0px 0px 0px/.test(backShadow)).toBe(true);
    screen.unmount();
  });

  it('停用的連結形式是 aria-disabled 的 span，不可聚焦；停用用虛線外框、不用 opacity', async () => {
    const screen = await render(
      <div>
        <Button href="/x/" disabled>
          前往
        </Button>
        <Button disabled variant="primary" size="lg" block>
          確認答案
        </Button>
      </div>,
    );
    const span = page.getByText('前往').element().closest('.ll-btn') as HTMLElement;
    expect(span.tagName).toBe('SPAN');
    expect(span.getAttribute('aria-disabled')).toBe('true');
    expect(span.hasAttribute('href')).toBe(false);
    expect(span.tabIndex).toBe(-1);
    const btn = page.getByRole('button', { name: '確認答案' }).element();
    const cs = getComputedStyle(btn);
    expect(cs.borderTopStyle).toBe('dashed');
    expect(cs.opacity).toBe('1');
    screen.unmount();
  });

  it('external：附「（外部網站，另開分頁）」、rel="noopener"、target="_blank"；不經 provider', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <Button href="https://example.org/" external>
          原始碼
        </Button>
      </Wrap>,
    );
    const link = page.getByRole('link', { name: /^原始碼\s*（外部網站，另開分頁）$/ }).element();
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('data-router')).toBeNull();
    expect(link.querySelector('svg')).not.toBeNull();
    screen.unmount();
  });

  it('busy：aria-busy，寬度不變（有前置圖示與沒有前置圖示兩種）', async () => {
    function Demo({ busy }: { busy: boolean }) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Button variant="primary" icon={<PlayIcon />} busy={busy}>
            匯出備份檔
          </Button>
          <Button busy={busy}>檢查備份碼</Button>
        </div>
      );
    }
    const screen = await render(<Demo busy={false} />);
    const w = (name: string) => page.getByRole('button', { name }).element().getBoundingClientRect().width;
    const before = [w('匯出備份檔'), w('檢查備份碼')];
    await screen.rerender(<Demo busy />);
    await expect.element(page.getByRole('button', { name: '匯出備份檔' })).toHaveAttribute('aria-busy', 'true');
    expect(w('匯出備份檔')).toBeCloseTo(before[0]!, 0);
    expect(w('檢查備份碼')).toBeCloseTo(before[1]!, 0);
    screen.unmount();
  });

  // M3 驗收第 8 輪：有前置圖示的標籤換行時字靠圖示，標籤盒子撐滿剩下的寬度，空白全跑到右邊（「在地圖上看／這一章」左 24px、右 74px）
  it('有前置圖示的標籤換行時，圖示加文字整組置中：按鈕框到圖示、最長一行到按鈕框的距離相差 2px 以內；一行時不移', async () => {
    const gaps = (name: string) => {
      const btn = page.getByRole('button', { name }).element() as HTMLElement;
      const icon = btn.querySelector('.ll-btn__icon')!.getBoundingClientRect();
      const label = btn.querySelector('.ll-btn__label')!;
      const range = document.createRange();
      range.selectNodeContents(label);
      const rects = [...range.getClientRects()].filter((q) => q.width > 0);
      const b = btn.getBoundingClientRect();
      return {
        left: icon.left - b.left,
        right: b.right - Math.max(...rects.map((q) => q.right)),
        lines: new Set(rects.map((q) => Math.round(q.top))).size,
        label,
      };
    };
    const screen = await render(
      <div style={{ width: '200px', fontSize: '17px' }}>
        <Button block icon={<PlayIcon />}>
          在地圖上看這一章
        </Button>
        <Button size="sm" icon={<StarIcon />}>
          收藏
        </Button>
      </div>,
    );
    await vi.waitFor(() => {
      const g = gaps('在地圖上看這一章');
      expect(g.lines).toBe(2);
      expect(Math.abs(g.left - g.right)).toBeLessThanOrEqual(2);
    });
    // 一行的按鈕：標籤盒子本來就貼著字，不加 transform
    expect((gaps('收藏').label as HTMLElement).style.transform).toBe('');
    screen.unmount();
  });

  it('文字放大 200% 時左右內距少 4px（sm 12、md 16），一般字級不變（sm 16、md 20）', async () => {
    const pad = (name: string) => parseFloat(getComputedStyle(page.getByRole('button', { name }).element()).paddingLeft);
    const Demo = ({ scale }: { scale: number }) => (
      <div style={{ fontSize: `${scale * 16}px` }}>
        <Button size="sm" style={{ fontSize: `${scale * 15}px` }}>
          小
        </Button>
        <Button style={{ fontSize: `${scale * 17}px` }}>中</Button>
      </div>
    );
    const screen = await render(<Demo scale={1} />);
    expect(pad('小')).toBeCloseTo(16, 0);
    expect(pad('中')).toBeCloseTo(20, 0);
    await screen.rerender(<Demo scale={2} />);
    expect(pad('小')).toBeCloseTo(12, 0);
    expect(pad('中')).toBeCloseTo(16, 0);
    screen.unmount();
  });
});

describe('IconButton', () => {
  it('label 成為 aria-label，44×44；href 形式經 provider', async () => {
    const { Wrap, navigate } = makeProvider();
    const screen = await render(
      <Wrap>
        <IconButton icon={<XIcon />} label="關閉" onClick={() => {}} />
        <IconButton icon={<XIcon />} label="詳細" href="/me/backup/" variant="chrome" />
      </Wrap>,
    );
    const close = page.getByRole('button', { name: '關閉' }).element().getBoundingClientRect();
    expect(close.width).toBeCloseTo(44, 0);
    expect(close.height).toBeCloseTo(44, 0);
    await page.getByRole('link', { name: '詳細' }).click();
    expect(navigate).toHaveBeenCalledWith('/me/backup/');
    screen.unmount();
  });
  it('開發模式下 label 是空字串會丟錯誤', () => {
    expect(() => IconButton({ icon: <XIcon />, label: '  ' })).toThrow(/label/);
  });
});

describe('BackButton 與 TopBar', () => {
  it('label 不含 shortLabel 時丟錯誤（WCAG 2.5.3）；沒有 shortLabel 是 44×44 圓形', async () => {
    expect(() => BackButton({ href: '/play/', label: '回到闖關地圖', shortLabel: '首頁' })).toThrow(/2\.5\.3/);
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <BackButton onBack={() => {}} label="離開錯題複習" />
        <BackButton href="/play/" label="回到闖關地圖" shortLabel="地圖" />
      </Wrap>,
    );
    const icon = page.getByRole('button', { name: '離開錯題複習' }).element();
    const r = icon.getBoundingClientRect();
    expect(r.width).toBeCloseTo(44, 0);
    expect(r.height).toBeCloseTo(44, 0);
    expect(parseFloat(getComputedStyle(icon).borderTopLeftRadius)).toBeGreaterThanOrEqual(22);
    const link = page.getByRole('link', { name: '回到闖關地圖' }).element();
    expect(link.textContent).toContain('地圖');
    expect(link.getAttribute('data-router')).toBe('fake');
    expect(deco(link)).toBe('none');
    // 平的：沒有底邊
    expect(getComputedStyle(link).marginBlockEnd).toBe('0px');
    screen.unmount();
  });

  it('TopBar 兩列：返回在第一列、h1 在第二列；compact 一列', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <TopBar title="一家小店的帳" backHref="/play/" backLabel="回到闖關地圖" backShortLabel="地圖" />
        <TopBar title="第 2 題" compact onBack={() => {}} backLabel="離開這一關，回到闖關地圖" />
      </Wrap>,
    );
    const back = page.getByRole('link', { name: '回到闖關地圖' }).element().getBoundingClientRect();
    const h1 = page.getByRole('heading', { level: 1, name: '一家小店的帳' }).element();
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(h1.getBoundingClientRect().top).toBeGreaterThanOrEqual(back.bottom - 1);
    const compactBack = page.getByRole('button', { name: '離開這一關，回到闖關地圖' }).element().getBoundingClientRect();
    const compactTitle = page.getByRole('heading', { name: '第 2 題' }).element().getBoundingClientRect();
    expect(compactTitle.left).toBeGreaterThan(compactBack.right);
    expect(compactTitle.top).toBeLessThan(compactBack.bottom);
    screen.unmount();
  });
});

describe('PageHeader 與 StatChip', () => {
  it('StatChip：有 href 是連結（可讀名稱是 label）、沒有是不可聚焦的 span；44px 高', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <PageHeader
          title="闖關"
          start={
            <>
              <StatChip icon={<StarIcon filled />} value="12" label="星星 12 顆" tone="star" />
              <StatChip icon={<StarIcon filled />} value="2／14" label="徽章 2／14 枚" tone="badge" href="/me/badges/" />
            </>
          }
        />
      </Wrap>,
    );
    const link = page.getByRole('link', { name: '徽章 2／14 枚' }).element();
    expect(link.getBoundingClientRect().height).toBeCloseTo(44, 0);
    expect(deco(link)).toBe('none');
    const stat = page.getByText('星星 12 顆').element().closest('.ll-statchip') as HTMLElement;
    expect(stat.tagName).toBe('SPAN');
    expect(stat.tabIndex).toBe(-1);
    await expect.element(page.getByRole('heading', { level: 1, name: '闖關' })).toBeInTheDocument();
    screen.unmount();
  });
});

describe('TextLink', () => {
  it('有底線；中文底線 0.16em、英文 0.24em；外部連結有圖示與隱藏文字', async () => {
    const { Wrap } = makeProvider();
    const screen = await render(
      <Wrap>
        <p lang="zh-TW" style={{ fontSize: '20px' }}>
          請看 <TextLink href="/privacy/">隱私說明</TextLink>。
        </p>
        <p lang="en" style={{ fontSize: '20px' }}>
          See the{' '}
          <TextLink href="https://example.org/" external>
            licence
          </TextLink>
          .
        </p>
      </Wrap>,
    );
    const zh = page.getByRole('link', { name: '隱私說明' }).element();
    const en = page.getByRole('link', { name: /^licence.*（外部網站，另開分頁）$/ }).element();
    expect(deco(zh)).toBe('underline');
    expect(deco(en)).toBe('underline');
    expect(parseFloat(getComputedStyle(zh).textUnderlineOffset)).toBeCloseTo(3.2, 1);
    expect(parseFloat(getComputedStyle(en).textUnderlineOffset)).toBeCloseTo(4.8, 1);
    expect(en.querySelector('svg')).not.toBeNull();
    expect(en.getAttribute('rel')).toBe('noopener');
    screen.unmount();
  });
});

describe('Segmented（findings foundation-1、foundation-3）', () => {
  function Demo({ width }: { width?: number }) {
    const [v, setV] = useState('auto');
    return (
      <div style={{ width: width ? `${width}px` : undefined }} data-testid="box">
        <Segmented
          value={v}
          label="Glass effect"
          onChange={setV}
          options={[
            { value: 'auto', label: 'Automatic' },
            { value: 'reduced', label: 'Reduce transparency' },
            { value: 'frost', label: 'Frosted' },
            { value: 'refract', label: 'Refraction' },
          ]}
        />
      </div>
    );
  }
  it('方向鍵移動選取時焦點跟著新選項；繞回；Home 與 End', async () => {
    const screen = await render(<Demo />);
    const radio = (name: string) => page.getByRole('radio', { name });
    (radio('Automatic').element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(radio('Reduce transparency')).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radio('Reduce transparency').element());
    await userEvent.keyboard('{End}');
    await expect.element(radio('Refraction')).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radio('Refraction').element());
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(radio('Automatic')).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(radio('Automatic').element());
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(radio('Refraction').element());
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(radio('Automatic').element());
    screen.unmount();
  });
  it('放在 288px（320px 螢幕扣掉左右 16px）的欄位裡不會溢出：選項換到下一列，每個選項仍至少 44px 高', async () => {
    const screen = await render(<Demo width={288} />);
    const box = page.getByTestId('box').element() as HTMLElement;
    const group = page.getByRole('radiogroup', { name: 'Glass effect' }).element();
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
    expect(group.getBoundingClientRect().width).toBeLessThanOrEqual(288);
    for (const r of Array.from(group.querySelectorAll('[role="radio"]'))) {
      expect(r.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(r.getBoundingClientRect().right).toBeLessThanOrEqual(group.getBoundingClientRect().right + 0.5);
    }
    // 放不下一列：改成等寬格子（英文「Reduce transparency」兩欄也放不下，每列一個）。量是在 ResizeObserver 第一次回呼時做（不在掛載的同一個任務裡），用 poll 等
    await expect.poll(() => group.classList.contains('ll-seg--stack')).toBe(true);
    screen.unmount();
  });
  function Zh({ width }: { width: number }) {
    const [v, setV] = useState('auto');
    return (
      <div style={{ width: `${width}px` }}>
        <Segmented
          value={v}
          label="玻璃效果"
          onChange={setV}
          options={[
            { value: 'auto', label: '自動' },
            { value: 'reduced', label: '降低透明度' },
            { value: 'frost', label: '霧面' },
            { value: 'refract', label: '折射' },
          ]}
        />
      </div>
    );
  }
  it('寬度夠時維持一列的膠囊', async () => {
    const screen = await render(<Zh width={600} />);
    const group = page.getByRole('radiogroup', { name: '玻璃效果' }).element();
    expect(group.classList.contains('ll-seg--stack')).toBe(false);
    const tops = Array.from(group.querySelectorAll('[role="radio"]')).map((r) => Math.round(r.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    screen.unmount();
  });
  function Lang({ size }: { size: 'sm' | 'md' }) {
    const [v, setV] = useState('zh-TW');
    return (
      <div style={{ display: 'flex', width: '375px' }}>
        <span style={{ flex: '1 1 auto' }}>標題</span>
        <div style={{ display: 'flex', flex: 'none', marginInlineStart: 'auto' }}>
          <Segmented
            value={v}
            size={size}
            label="語言"
            onChange={setV}
            options={[
              { value: 'zh-TW', label: '中', lang: 'zh-Hant-TW' },
              { value: 'en', label: 'EN', lang: 'en' },
            ]}
          />
        </div>
      </div>
    );
  }
  it.each(['sm', 'md'] as const)('放在依內容決定寬度的容器裡（頁首的動作區）時維持一列：量測的四捨五入不會讓它自己變成直排（語言切換 %s）', async (size) => {
    const screen = await render(<Lang size={size} />);
    const group = page.getByRole('radiogroup', { name: '語言' }).element();
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(group.classList.contains('ll-seg--stack')).toBe(false);
    const tops = Array.from(group.querySelectorAll('[role="radio"]')).map((r) => Math.round(r.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    screen.unmount();
  });
  it('四個短選項放不下一列時排成 2×2', async () => {
    const screen = await render(<Zh width={240} />);
    const group = page.getByRole('radiogroup', { name: '玻璃效果' }).element();
    await expect.poll(() => group.classList.contains('ll-seg--stack')).toBe(true);
    expect(getComputedStyle(group).gridTemplateColumns.split(' ').length).toBe(2);
    expect(group.getBoundingClientRect().width).toBeLessThanOrEqual(240);
    screen.unmount();
  });
});

describe('Toast 與 ToastRegion（finding foundation-2）', () => {
  it('常駐的 ToastRegion 帶 role="status"，裡面的 Toast 不帶 role；單獨的 Toast 仍帶 role="status"', async () => {
    const hold = vi.fn<(held: boolean) => void>();
    function Demo() {
      const [items, setItems] = useState<string[]>([]);
      return (
        <I18nProvider i18n={i18n}>
          <button type="button" onClick={() => setItems(['取得徽章：開店了'])}>
            觸發
          </button>
          <ToastRegion data-testid="region" onHoldChange={hold}>
            {items.map((x) => (
              <Toast key={x} kind="success" onDismiss={() => setItems([])} action={{ label: '查看', onClick: () => {} }}>
                {x}
              </Toast>
            ))}
          </ToastRegion>
          <Toast>單獨的提示</Toast>
        </I18nProvider>
      );
    }
    const screen = await render(<Demo />);
    const region = page.getByTestId('region').element();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getBoundingClientRect().height).toBe(0);
    await page.getByRole('button', { name: '觸發' }).click();
    await expect.element(page.getByText('取得徽章：開店了')).toBeInTheDocument();
    const toast = region.querySelector('.ll-toast')!;
    expect(toast.hasAttribute('role')).toBe(false);
    expect(page.getByText('單獨的提示').element().closest('.ll-toast')!.getAttribute('role')).toBe('status');
    // 動作是 44px 的 quiet 按鈕、關閉是 IconButton；焦點進到提示裡時通知父層暫停計時
    const action = page.getByRole('button', { name: '查看' }).element();
    expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(deco(action)).toBe('none');
    (action as HTMLElement).focus();
    expect(hold).toHaveBeenLastCalledWith(true);
    (page.getByRole('button', { name: '觸發' }).element() as HTMLElement).focus();
    expect(hold).toHaveBeenLastCalledWith(false);
    screen.unmount();
  });
});

describe('NoteTag 按鈕形式（站規 1.20）', () => {
  it('沒有底線，按鈕本身至少 44px 高，膠囊畫在內層', async () => {
    const screen = await render(
      <I18nProvider i18n={i18n}>
        <NoteTag kind="not_ifrs_line" subject="經常利益" onClick={() => {}} />
      </I18nProvider>,
    );
    const btn = page.getByRole('button', { name: '非 IFRS 項目：經常利益。查看 IFRS 怎麼處理' }).element();
    expect(deco(btn)).toBe('none');
    expect(btn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    const pill = btn.querySelector('.ll-notetag__pill')!;
    expect(deco(pill)).toBe('none');
    expect(pill.classList.contains('ll-notetag--not-ifrs-line')).toBe(true);
    screen.unmount();
  });
});
