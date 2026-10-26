// check:links 的自我測試（站規 4.1）：R1 到 R12 的代表寫法各自會失敗或通過，例外清單的數量比對與過期都會被抓到。
// 規則設定用 repo 裡的 tools/link-rules.json（測試同時確認設定檔本身能用）。
import { describe, expect, it } from 'vitest';
import { applyExceptions, listFiles, loadRules, scanCss, scanHtmlDocument, scanHtmlString, scanTsx } from '../check-links.mjs';
import { validateLinkExceptions } from '../lib/link-exceptions.mjs';

const rules = loadRules();
const APP = 'apps/web/src/pages/Example.tsx';
const UI = 'packages/web-ui/src/components/Example.tsx';
const DS = 'packages/web-ui/src/components/Button.tsx';
const ROUTER_LINK = 'apps/web/src/components/RouterLink.tsx';

type V = { rule: string; line: number; message: string; exceptable?: boolean };
const rulesOf = (vs: V[]) => vs.map((v) => v.rule);
const tsx = (code: string, file = APP): V[] => scanTsx(code, file, rules);
const css = (code: string, file = 'packages/web-ui/src/styles/99-example.css'): V[] => scanCss(code, file, rules);

describe('R1：react-router 的 Link 只准在 RouterLink.tsx', () => {
  it('裸 <Link> 失敗，訊息帶行號與用到的地方', () => {
    const vs = tsx(`import { Link } from 'react-router';\nexport const A = () => <Link to="/x/">x</Link>;`);
    expect(rulesOf(vs)).toEqual(['R1']);
    expect(vs[0].line).toBe(1);
    expect(vs[0].message).toContain('用在第 2 行');
  });
  it('改名匯入失敗', () => {
    expect(rulesOf(tsx(`import { Link as RL } from 'react-router-dom';\nexport const A = () => <RL to="/x/">x</RL>;`))).toEqual(['R1']);
  });
  it('NavLink 也算', () => {
    expect(rulesOf(tsx(`import { NavLink } from 'react-router';`))).toEqual(['R1']);
  });
  it('import * as RR 之後的 <RR.Link> 失敗', () => {
    expect(rulesOf(tsx(`import * as RR from 'react-router';\nexport const A = () => <RR.Link to="/x/">x</RR.Link>;`))).toContain('R1');
  });
  it('從命名空間解構出 Link 失敗', () => {
    expect(rulesOf(tsx(`import * as RR from 'react-router';\nconst { Link } = RR;`))).toEqual(['R1']);
  });
  it('轉匯出失敗，連 RouterLink.tsx 也不行', () => {
    expect(rulesOf(tsx(`export { Link } from 'react-router';`))).toEqual(['R1']);
    expect(rulesOf(tsx(`export { Link as X } from 'react-router';`, ROUTER_LINK))).toEqual(['R1']);
    expect(rulesOf(tsx(`export * from 'react-router-dom';`, ROUTER_LINK))).toEqual(['R1']);
    expect(rulesOf(tsx(`import { Link } from 'react-router';\nexport { Link };`, ROUTER_LINK))).toEqual(['R1']);
  });
  it('動態匯入 react-router 失敗', () => {
    expect(rulesOf(tsx(`export const m = () => import('react-router');`))).toEqual(['R1']);
  });
  it('其他名稱與型別匯入通過', () => {
    expect(tsx(`import { useNavigate, type LinkProps } from 'react-router';\nimport type { Link } from 'react-router';`)).toEqual([]);
  });
});

describe('R1、R2：RouterLink.tsx 與設計系統檔案', () => {
  it('RouterLink.tsx 裡的 Link 通過', () => {
    const code = `import { Link } from 'react-router';\nexport function RouterLink(p: { href: string }) { return <Link to={p.href} />; }`;
    expect(tsx(code, ROUTER_LINK)).toEqual([]);
  });
  it('<a> 在設計系統檔案通過、在 apps/web 與其他 web-ui 檔案失敗', () => {
    const code = `export const A = () => <a className="x" href="/x/">x</a>;`;
    expect(tsx(code, DS)).toEqual([]);
    expect(rulesOf(tsx(code))).toEqual(['R2']);
    expect(rulesOf(tsx(code, UI))).toEqual(['R2']);
  });
  it("createElement('a')、React.createElement('a')、jsx('a')、jsxs('a') 失敗", () => {
    expect(rulesOf(tsx(`import { createElement } from 'react';\nexport const A = () => createElement('a', { href: '/x/' });`))).toEqual(['R2']);
    expect(rulesOf(tsx(`import React from 'react';\nexport const A = () => React.createElement('a');`))).toEqual(['R2']);
    expect(rulesOf(tsx(`import { jsx, jsxs } from 'react/jsx-runtime';\nexport const A = () => [jsx('a', {}), jsxs('a', {})];`))).toEqual(['R2', 'R2']);
  });
  it('多型屬性 as、component、asChild 指向 a 或 react-router 失敗', () => {
    expect(rulesOf(tsx(`export const A = () => <Card as="a" href="/x/" />;`))).toEqual(['R2']);
    expect(rulesOf(tsx(`export const A = () => <X component={Link} />;`))).toEqual(['R2']);
    expect(rulesOf(tsx(`import { NavLink as N } from 'react-router';\nexport const A = () => <X component={N} />;`))).toEqual(['R1', 'R2']);
    expect(rulesOf(tsx(`export const A = () => <X asChild={'a'} />;`))).toEqual(['R2']);
  });
  it('LinkProvider 注入 RouterLink 通過（Root.tsx 的寫法）', () => {
    expect(tsx(`import { RouterLink } from '../components/RouterLink';\nexport const R = () => <LinkProvider component={RouterLink} />;`)).toEqual([]);
  });
});

describe('R3：設計系統 class 保留給元件檔', () => {
  it('className="ll-btn ll-btn--primary" 在 apps/web 失敗', () => {
    const vs = tsx(`export const A = () => <span className="ll-btn ll-btn--primary" />;`);
    expect(rulesOf(vs)).toEqual(['R3', 'R3']);
    expect(vs[0].message).toContain('<Button>');
  });
  it("cx('ll-btn') 失敗；任何字串都算，不只 className", () => {
    expect(rulesOf(tsx(`const cls = cx('ll-btn', on && 'is-on');`))).toEqual(['R3']);
    expect(rulesOf(tsx(`const map = { a: 'll-navrow__icon' };`))).toEqual(['R3']);
  });
  it('樣板字串的靜態片段也算，緊接 ${…} 的修飾片段也抓得到', () => {
    expect(rulesOf(tsx('const c = `ll-iconbtn ${x}`;'))).toEqual(['R3']);
    expect(rulesOf(tsx('const c = `ll-btn--${variant}`;'))).toEqual(['R3']);
  });
  it("'ll-btnx'、'll-link-foo'、'my-ll-btn'、'll-btnrow' 通過", () => {
    expect(tsx(`const a = ['ll-btnx', 'll-link-foo', 'my-ll-btn', 'll-btnrow', 'll-list'];`)).toEqual([]);
    expect(tsx('const c = `${p}ll-btn`;')).toEqual([]);
  });
  it('設計系統檔案可以用', () => {
    expect(tsx(`export const B = () => <button className="ll-btn ll-btn--primary" />;`, DS)).toEqual([]);
  });
  it('註解與匯入路徑不算', () => {
    expect(tsx(`// className="ll-btn"\nimport './ll-btn';\n/* ll-link */ const x = 1;`)).toEqual([]);
  });
});

describe('R4：原生 <button>', () => {
  it('apps/web 的 <button className="x"> 失敗', () => {
    expect(rulesOf(tsx(`export const A = () => <button type="button" className="x">x</button>;`))).toEqual(['R4']);
  });
  it('web-ui 的 <button> 沒有 class 失敗、class 不含 ll- 也失敗', () => {
    expect(rulesOf(tsx(`export const A = () => <button type="button">x</button>;`, UI))).toEqual(['R4']);
    expect(rulesOf(tsx(`export const A = () => <button className="foo">x</button>;`, UI))).toEqual(['R4']);
    expect(rulesOf(tsx(`export const A = (p: { c: string }) => <button className={p.c}>x</button>;`, UI))).toEqual(['R4']);
  });
  it('web-ui 的 <button> 有靜態可判定的 ll- class 通過', () => {
    expect(tsx(`export const A = () => <button className="ll-seg__opt">x</button>;`, UI)).toEqual([]);
    expect(tsx("export const A = (p: { on: boolean }) => <button className={`ll-chip${p.on ? ' is-on' : ''}`}>x</button>;", UI)).toEqual([]);
    expect(tsx(`const cls = 'll-node';\nexport const A = () => <button className={cls}>x</button>;`, UI)).toEqual([]);
    expect(tsx(`export const A = (p: { a: boolean }) => <button className={p.a ? 'll-x is-a' : 'll-x'}>x</button>;`, UI)).toEqual([]);
  });
  it('同檔案組 class 的函式、從設計系統檔案匯入的 class（menuItemClass）視為靜態可判定', () => {
    const helper = `function buttonClass(v: string) { return ['ll-btn', \`ll-btn--\${v}\`].join(' '); }
      export const B = () => { const cls = buttonClass('primary'); return <button className={cls}>x</button>; };`;
    expect(tsx(helper, DS)).toEqual([]);
    const journal = `import { menuItemClass } from './Menu';\nexport const J = () => <button className={menuItemClass}>x</button>;`;
    expect(tsx(journal, 'packages/web-ui/src/components/JournalEntryEditor.tsx')).toEqual([]);
    const other = `import { fooClass } from './LevelCard';\nexport const J = () => <button className={fooClass}>x</button>;`;
    expect(rulesOf(tsx(other, UI))).toEqual(['R4']);
  });
});

describe('R5：非連結的導航', () => {
  it('<div onClick>、<li onKeyDown> 失敗', () => {
    expect(rulesOf(tsx(`export const A = () => <div onClick={() => go()}>x</div>;`))).toEqual(['R5']);
    expect(rulesOf(tsx(`export const A = () => <li onKeyDown={k}>x</li>;`))).toEqual(['R5']);
  });
  it('<span role="link">、role="button" 失敗（設計系統檔案也一樣）', () => {
    expect(rulesOf(tsx(`export const A = () => <span role="link" tabIndex={0}>x</span>;`))).toEqual(['R5']);
    expect(rulesOf(tsx(`export const A = () => <summary role={'button'}>x</summary>;`, DS))).toEqual(['R5']);
  });
  it('其他 role 與 <ul onKeyDown> 通過', () => {
    expect(tsx(`export const A = () => <ul role="menu" onKeyDown={k}><li role="none" /></ul>;`)).toEqual([]);
  });
});

describe('R6：展開屬性', () => {
  it('<a {...p}> 在 apps/web 失敗', () => {
    expect(rulesOf(tsx(`export const A = (p: object) => <a {...p}>x</a>;`))).toEqual(['R2', 'R6']);
  });
  it('web-ui 一般元件的 <button {...rest}> 失敗、設計系統檔案通過', () => {
    expect(rulesOf(tsx(`export const A = (p: object) => <button className="ll-chip" {...p} />;`, UI))).toEqual(['R6']);
    expect(tsx(`export const A = (p: object) => <button className="ll-btn" {...p} />;`, DS)).toEqual([]);
  });
});

describe('R7：.ll-list 裡不放連結', () => {
  it('.ll-list 裡的 NavRow、Button href、<a> 失敗', () => {
    const code = `export const A = () => (
      <ul className="ll-list">
        <li><NavRow href="/me/" icon={null} title="x" /></li>
        <li><Button href="/play/">x</Button></li>
        {items.map((i) => <li key={i}><a href={i}>x</a></li>)}
      </ul>
    );`;
    expect(rulesOf(tsx(code, DS))).toEqual(['R7', 'R7', 'R7']);
  });
  it('.ll-list 裡的 TextLink 與沒有 href 的 Button 通過', () => {
    const code = `export const A = () => (
      <ul className={cx('ll-list', dense && 'is-dense')}>
        <li>說明文字，詳見 <TextLink href="/privacy/">隱私說明</TextLink></li>
        <li><Button onClick={go}>x</Button></li>
      </ul>
    );`;
    expect(tsx(code)).toEqual([]);
  });
});

describe('R8：未經元件的 HTML', () => {
  it('innerHTML =、insertAdjacentHTML、dangerouslySetInnerHTML、DOMParser、document.write 失敗', () => {
    expect(rulesOf(tsx(`el.innerHTML = s;`))).toEqual(['R8']);
    expect(rulesOf(tsx(`el.outerHTML += s;`))).toEqual(['R8']);
    expect(rulesOf(tsx(`el.insertAdjacentHTML('beforeend', s);`))).toEqual(['R8']);
    expect(rulesOf(tsx(`export const A = () => <div dangerouslySetInnerHTML={{ __html: s }} />;`))).toEqual(['R8']);
    expect(rulesOf(tsx(`const d = new DOMParser();`))).toEqual(['R8']);
    expect(rulesOf(tsx(`document.write(s);`))).toEqual(['R8']);
    expect(rulesOf(tsx(`range.createContextualFragment(s);`))).toEqual(['R8']);
  });
  it('textContent 通過', () => {
    expect(tsx(`el.textContent = s;`)).toEqual([]);
  });
});

describe("R9：document.createElement('a')", () => {
  it('不插進畫面的下載連結回報 R9（交給例外清單）', () => {
    const vs = tsx(`export function dl(url: string) { const a = document.createElement('a'); a.href = url; a.click(); }`);
    expect(rulesOf(vs)).toEqual(['R9']);
    expect(vs[0].exceptable).not.toBe(false);
  });
  it('同一函式內被 appendChild 插進畫面另外失敗，而且不能列例外', () => {
    const vs = tsx(`export function dl(url: string) {\n  const a = document.createElement('a');\n  document.body.appendChild(a);\n  a.click();\n}`);
    expect(rulesOf(vs)).toEqual(['R9', 'R9']);
    expect(vs[1].exceptable).toBe(false);
    expect(vs[1].line).toBe(3);
  });
  it('直接 append 失敗', () => {
    expect(tsx(`document.body.append(document.createElement('a') as HTMLAnchorElement);`).map((v) => v.exceptable)).toEqual([undefined, false]);
  });
  it('其他元素（canvas、link）通過', () => {
    expect(tsx(`const c = document.createElement('canvas'); document.head.append(document.createElement('link'));`)).toEqual([]);
  });
});

describe('R10：字串產生的 HTML', () => {
  it('shellHtml.ts 的 ll-tabbar__link 通過、其他 class 或沒有 class 失敗', () => {
    const file = 'apps/web/src/shell/shellHtml.ts';
    expect(scanHtmlString('<li><a class="ll-tabbar__link" href="/play/">x</a></li>', file, rules)).toEqual([]);
    expect(rulesOf(scanHtmlString('<a href="/play/">x</a>', file, rules))).toEqual(['R10']);
    expect(rulesOf(scanHtmlString("<a class='other' href='/'>x</a>", file, rules))).toEqual(['R10']);
  });
  it('樣板字串裡的 <a> 與 <button>', () => {
    const file = 'apps/web/src/shell/shellHtml.ts';
    expect(tsx('export const n = (p: string) => `<a class="ll-tabbar__link" href="/${p}">x</a>`;', file)).toEqual([]);
    expect(rulesOf(tsx('export const n = (p: string) => `<a href="/${p}">x</a>`;', file))).toEqual(['R10']);
    expect(rulesOf(tsx('export const b = \'<button type="button">x</button>\';', file))).toEqual(['R10']);
  });
  it('index.html 的 ll-skiplink 通過、裸連結失敗，註解不算', () => {
    const file = 'apps/web/index.html';
    expect(scanHtmlDocument('<body>\n<a class="ll-skiplink" href="#main">跳到主要內容</a>\n<!-- <a href="/x/">x</a> -->\n</body>', file, rules)).toEqual([]);
    const vs = scanHtmlDocument('<body>\n\n<a href="/x/">x</a>\n</body>', file, rules);
    expect(rulesOf(vs)).toEqual(['R10']);
    expect(vs[0].line).toBe(3);
  });
  it('index.html 的 <style> 交給 CSS 規則，行號對應到檔案', () => {
    const vs = scanHtmlDocument('<head>\n<style>\n.x a { color: red }\n</style>\n</head>', 'apps/web/index.html', rules);
    expect(rulesOf(vs)).toEqual(['R11']);
    expect(vs[0].line).toBe(3);
  });
  it('abbr、article、aside 不是連結', () => {
    expect(scanHtmlString('<abbr title="x">x</abbr><article></article><aside></aside>', 'apps/web/src/x.ts', rules)).toEqual([]);
  });
});

describe('R11：CSS', () => {
  it('.x a:hover { color } 失敗', () => {
    const vs = css(`.x a:hover { color: red; }`);
    expect(rulesOf(vs)).toEqual(['R11']);
    expect(vs[0].message).toContain('.x a:hover');
  });
  it('a[href] { text-decoration: none } 在 base.css 以外失敗；:is() 裡的 a 也算', () => {
    expect(rulesOf(css(`a[href] { text-decoration: none; }`, 'apps/web/src/styles/me.css'))).toEqual(['R11']);
    expect(rulesOf(css(`.x :is(a, .y) { color: red; }`))).toEqual(['R11']);
  });
  it('base.css 的 :where(a) 重設與 a:is(:not([class]), [class=""]) 保底通過', () => {
    const code = `
      :where(a) { color: inherit; text-decoration: none; }
      .ll-link, a:is(:not([class]), [class='']) { color: var(--ll-link); text-decoration-line: underline; }
      .ll-link:lang(zh), a:is(:not([class]), [class='']):lang(zh) { text-underline-offset: 0.16em; }
      .ll-link:visited, a:is(:not([class]), [class='']):visited { color: var(--ll-link); }
      a:is(:not([class]), [class='']):hover { text-decoration-thickness: max(2px, 0.1em); }`;
    expect(css(code, 'apps/web/src/styles/base.css')).toEqual([]);
    // 第 8 輪：保底和 .ll-link 併成同一組規則，放在 web-ui 的 07-core-components.css（globalAnchorFiles）
    expect(css(code, 'packages/web-ui/src/styles/07-core-components.css')).toEqual([]);
    expect(css(`html[data-dev] a:is(:not([class]), [class='']) { outline: 2px dashed var(--ll-danger-ink); }`, 'apps/web/src/styles/dev.css')).toEqual([]);
  });
  it('保底選擇器與 :where(a) 寫在別的檔案失敗', () => {
    expect(rulesOf(css(`:where(a) { color: inherit; }`))).toEqual(['R11']);
  });
  it('.ll-sheet--level .ll-btn 失敗；巢狀寫法與 :is() 也抓得到', () => {
    expect(rulesOf(css(`.ll-sheet--level .ll-btn { text-decoration: none; }`))).toEqual(['R11']);
    expect(rulesOf(css(`.ll-sheet { & .ll-btn { color: red; } }`))).toEqual(['R11']);
    expect(rulesOf(css(`.ll-sheet :is(.ll-iconbtn) { color: red; }`))).toEqual(['R11']);
  });
  it('.ll-navlist .ll-navrow 通過；元件自己的子元素、主題與減少動態的祖先也通過', () => {
    expect(css(`.ll-navlist .ll-navrow { min-height: 44px; }`)).toEqual([]);
    expect(css(`.ll-navcard > .ll-navrow--card { border-radius: 0; }`)).toEqual([]);
    expect(css(`.ll-btn--primary .ll-btn__icon { color: inherit; }`)).toEqual([]);
    expect(css(`html[data-motion='reduced'] .ll-btn:active { transform: none; }`)).toEqual([]);
    expect(css(`:root[data-theme='dark'] .ll-chbanner .ll-chbanner__link { color: var(--ll-text); }`)).toEqual([]);
    expect(css(`.ll-chbanner:has(.ll-chbanner__link:active) { background: var(--ll-surface-2); }`)).toEqual([]);
  });
  it('text-decoration: underline wavy 在 .ll-foo 失敗；none 只准用在設計系統元件', () => {
    expect(rulesOf(css(`.ll-foo { text-decoration: underline wavy; }`))).toEqual(['R11']);
    expect(rulesOf(css(`.ll-foo { text-decoration-line: none; }`))).toEqual(['R11']);
    expect(rulesOf(css(`.ll-foo { -webkit-text-decoration: underline; }`))).toEqual(['R11']);
    expect(css(`.ll-btn, .ll-btn:hover, .ll-btn:visited { text-decoration: none; }`)).toEqual([]);
    expect(css(`.ll-tabbar__link { text-decoration: none; }`)).toEqual([]);
    expect(css(`.ll-link { text-decoration: underline; text-decoration-thickness: max(1.5px, 0.08em); }`)).toEqual([]);
  });
  it(':visited 只准在 .ll-link、保底選擇器與 .ll-btn', () => {
    expect(rulesOf(css(`.ll-foo:visited { color: red; }`))).toEqual(['R11']);
    expect(css(`.ll-link:visited, .ll-btn--primary:visited { color: inherit; }`)).toEqual([]);
  });
});

describe('R12：style 物件', () => {
  it("style={{ textDecoration: 'none' }} 失敗", () => {
    expect(rulesOf(tsx(`export const A = () => <span style={{ textDecoration: 'none' }} />;`))).toEqual(['R12']);
    expect(rulesOf(tsx(`const s = { textUnderlineOffset: 2 };\nexport const A = () => <span style={s} />;`))).toEqual(['R12']);
  });
  it('<a> 與設計系統元件的 style 不得有 color，一般元素可以', () => {
    expect(rulesOf(tsx(`export const A = () => <Button style={{ color: 'red' }}>x</Button>;`))).toEqual(['R12']);
    expect(tsx(`export const A = () => <span style={{ color: 'var(--ll-text)' }} />;`)).toEqual([]);
  });
});

describe('例外清單', () => {
  const v = (file: string, rule: string, extra: object = {}) => ({ file, line: 1, rule, message: 'x', ...extra });
  const ex = (file: string, rule: string, count: number) => ({ file, rule, count, reason: '程式產生的下載連結', added: '2026-10-24' });

  it('數量相符時生效', () => {
    const r = applyExceptions([v('a.tsx', 'R9'), v('b.tsx', 'R2')], [ex('a.tsx', 'R9', 1)]);
    expect(r.remaining.map((x) => x.file)).toEqual(['b.tsx']);
    expect(r.problems).toEqual([]);
  });
  it('count 不符失敗（多了少了都算）', () => {
    expect(applyExceptions([v('a.tsx', 'R9'), v('a.tsx', 'R9')], [ex('a.tsx', 'R9', 1)]).problems).toHaveLength(1);
    expect(applyExceptions([v('a.tsx', 'R9')], [ex('a.tsx', 'R9', 2)]).problems).toHaveLength(1);
  });
  it('用不到的例外失敗', () => {
    expect(applyExceptions([], [ex('a.tsx', 'R9', 1)]).problems[0]).toContain('用不到');
  });
  it('不能列例外的違規不被吃掉', () => {
    const r = applyExceptions([v('a.tsx', 'R9'), v('a.tsx', 'R9', { exceptable: false })], [ex('a.tsx', 'R9', 1)]);
    expect(r.remaining).toHaveLength(1);
    expect(r.problems).toEqual([]);
  });
  it('格式與日期：缺欄位、規則名稱、未來日期、到期、重複都失敗', () => {
    const today = '2026-10-25';
    expect(validateLinkExceptions([ex('a.tsx', 'R9', 1)], today)).toEqual([]);
    expect(validateLinkExceptions({}, today)).toHaveLength(1);
    expect(validateLinkExceptions([{ file: 'a.tsx', rule: 'R13', count: 0, reason: '', added: '24/10' }], today)).toHaveLength(4);
    expect(validateLinkExceptions([{ ...ex('a.tsx', 'R9', 1), added: '2026-12-01' }], today)[0]).toContain('之後');
    expect(validateLinkExceptions([{ ...ex('a.tsx', 'R9', 1), expires: '2026-10-01' }], today)[0]).toContain('到期');
    expect(validateLinkExceptions([ex('a.tsx', 'R9', 1), ex('a.tsx', 'R9', 2)], today)[0]).toContain('重複');
  });
  it('repo 的例外清單格式正確', async () => {
    const { readLinkExceptions } = await import('../lib/link-exceptions.mjs');
    const { ROOT } = await import('../lib/fs.mjs');
    expect(validateLinkExceptions(readLinkExceptions(ROOT))).toEqual([]);
  });
});

describe('掃描範圍', () => {
  it('含 apps/web/src、各 package 的 src、index.html 與 features 底下的 CSS；略過測試、e2e、locales、generated', () => {
    const files = listFiles();
    expect(files).toContain('apps/web/index.html');
    expect(files).toContain('apps/web/src/features/quest-map/QrScanner.css');
    expect(files.some((f) => f.startsWith('packages/web-ui/src/'))).toBe(true);
    expect(files.some((f) => f.startsWith('packages/core/src/'))).toBe(true);
    expect(files.filter((f) => /\.test\.|\/e2e\/|\/locales\/|\/generated\//.test(f))).toEqual([]);
  });
});
