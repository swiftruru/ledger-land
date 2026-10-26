// check:links（站規 4.1）：全站的可點元素只准用設計系統元件，不得出現瀏覽器預設樣式的連結、帶底線的按鈕或沒設計過的可點元素。
// 純解析原始碼、不需要建置：TS、TSX、JS 用 TypeScript 的 AST，CSS 用 lightningcss 的選擇器 AST，index.html 與字串產生的 HTML 用標籤掃描。
// 規則 R1 到 R12 的設定在 tools/link-rules.json；例外在 tools/link-exceptions.json（檔案加規則為鍵，count 必須和實際數量相同，用不到的例外也算失敗）。
// 用法：node tools/check-links.mjs [--report] [--json]
//   --report：只輸出違規清單，不讓檢查失敗（本機盤點用；CI 一律用失敗模式）
//   --json：改輸出 JSON（盤點腳本用）
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ROOT, walk } from './lib/fs.mjs';
import { LINK_EXCEPTIONS_FILE, readLinkExceptions, validateLinkExceptions } from './lib/link-exceptions.mjs';

export const RULES_FILE = 'tools/link-rules.json';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** class 是否屬於某個 base（本身、修飾 --x 或子元素 __x） */
const inFamily = (cls, base) => cls === base || cls.startsWith(`${base}--`) || cls.startsWith(`${base}__`);

/**
 * 把 link-rules.json 轉成掃描函式用的形狀
 * @param {any} raw
 */
export function normaliseRules(raw) {
  const names = raw.reservedClasses.map(escapeRe).join('|');
  return {
    raw,
    dsFiles: new Set(raw.dsFiles),
    routerLinkFiles: new Set(raw.routerLinkFiles),
    routerModuleRe: new RegExp(`^(${raw.routerModules.map(escapeRe).join('|')})(/.*)?$`),
    routerLinkExports: new Set(raw.routerLinkExports),
    buttonDirs: raw.buttonDirs,
    // 逐片段完整比對（ll-btnx、ll-link-foo、my-ll-btn 都不算）
    reservedRe: new RegExp(`^ll-(${names})(--[\\w-]+|__[\\w-]+)?$`),
    // 樣板字串裡緊接 ${…} 的片段（例如 `ll-btn--${variant}`）用寬鬆的版本
    reservedPrefixRe: new RegExp(`^ll-(${names})(--[\\w-]*|__[\\w-]*)?$`),
    reservedBases: raw.reservedClasses.map((n) => `ll-${n}`),
    suggest: raw.suggest,
    allowedAncestors: raw.allowedAncestors,
    globalAnchorFiles: new Set(raw.globalAnchorFiles),
    linkClasses: raw.linkClasses,
    visitedClasses: raw.visitedClasses,
    textDecorationNoneClasses: raw.textDecorationNoneClasses,
    htmlAnchorClasses: raw.htmlAnchorClasses,
    nonInteractiveElements: new Set(raw.nonInteractiveElements),
    nonInteractiveHandlers: raw.nonInteractiveHandlers,
    forbiddenRoles: new Set(raw.forbiddenRoles),
    polymorphicProps: raw.polymorphicProps,
    listClassRe: new RegExp(raw.listClassPattern),
    listForbidden: raw.listForbidden,
    dsComponents: new Set(raw.dsComponents),
    styleDecorationProps: new Set(raw.styleDecorationProps),
    styleColorProps: new Set(raw.styleColorProps),
  };
}

/** @param {string} [root] */
export function loadRules(root = ROOT) {
  return normaliseRules(JSON.parse(readFileSync(join(root, RULES_FILE), 'utf8')));
}

/** 保留 class 對應的建議元件 */
function suggestFor(rules, cls) {
  const m = rules.reservedRe.exec(cls) ?? rules.reservedPrefixRe.exec(cls);
  return (m && rules.suggest[m[1]]) || '設計系統元件';
}

const R1_FIX = '改用 NavRow、Button、TextLink 或 GlossaryItem（站內連結經 LinkProvider）；只有 RouterLink.tsx 可以匯入';
const DOM_DOC_RE = /(^|\.)(document|ownerDocument|doc)$/i;
const APPEND_METHODS = new Set([
  'appendChild',
  'append',
  'prepend',
  'insertBefore',
  'replaceWith',
  'replaceChildren',
  'after',
  'before',
  'insertAdjacentElement',
]);
const HTML_SINK_CALLS = new Set(['insertAdjacentHTML', 'createContextualFragment', 'setHTMLUnsafe', 'parseHTMLUnsafe']);
const JSX_FACTORIES = new Set(['createElement', 'jsx', 'jsxs', 'jsxDEV', '_jsx', '_jsxs']);

function scriptKindOf(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function unwrap(expr) {
  let e = expr;
  while (
    e &&
    (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e))
  )
    e = e.expression;
  return e;
}

const isStr = (n) => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

/**
 * 掃描一個 TS、TSX 或 JS 檔（R1 到 R10、R12）
 * @param {string} text 原始碼
 * @param {string} file repo 內的相對路徑（以 / 分隔），用來判斷設計系統檔案
 * @param {ReturnType<typeof normaliseRules>} rules
 * @returns {{ file: string; line: number; rule: string; message: string; exceptable?: boolean }[]}
 */
export function scanTsx(text, file, rules) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindOf(file));
  const out = [];
  const isDs = rules.dsFiles.has(file);
  const isRouterLinkFile = rules.routerLinkFiles.has(file);
  const inButtonDir = rules.buttonDirs.some((d) => file.startsWith(d));
  const lineOf = (node, extraLines = 0) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 + extraLines;
  const add = (node, rule, message, extra = {}) => out.push({ file, line: lineOf(node), rule, message, ...extra });

  // 先收集：從 react-router 匯入的名稱與命名空間，以及檔案裡所有 const 的初始值（className、style 的靜態判定用）
  const router = { locals: new Set(), linkLocals: new Set(), namespaces: new Set() };
  /** 匯入 Link 的違規，掃完後補上用到的行號，方便逐處替換 */
  const importViolations = new Map();
  const linkUsages = new Map();
  /** @type {Map<string, ts.Expression[]>} */
  const consts = new Map();
  /** @type {Map<string, ts.Node>} */
  const functions = new Map();
  const dsImports = new Set();
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const) {
      const list = consts.get(node.name.text) ?? [];
      list.push(node.initializer);
      consts.set(node.name.text, list);
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.set(node.name.text, node.body);
    ts.forEachChild(node, collect);
  };
  collect(sf);
  // 從設計系統檔案匯入的名稱（例如 Menu.tsx 匯出的 menuItemClass）：className 用它們視為靜態可判定（站規 1.9）
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.moduleSpecifier.text.startsWith('.')) continue;
    const base = posix.normalize(posix.join(posix.dirname(file), st.moduleSpecifier.text)).replace(/\.(js|jsx|ts|tsx)$/, '');
    if (![`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].some((f) => rules.dsFiles.has(f))) continue;
    const nb = st.importClause?.namedBindings;
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) dsImports.add(el.name.text);
  }
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !rules.routerModuleRe.test(st.moduleSpecifier.text)) continue;
    const clause = st.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name) router.namespaces.add(clause.name.text);
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) router.namespaces.add(nb.name.text);
    if (nb && ts.isNamedImports(nb))
      for (const el of nb.elements) {
        if (el.isTypeOnly) continue;
        const imported = (el.propertyName ?? el.name).text;
        router.locals.add(el.name.text);
        if (!rules.routerLinkExports.has(imported)) continue;
        router.linkLocals.add(el.name.text);
        if (!isRouterLinkFile) {
          add(el, 'R1', `匯入 ${st.moduleSpecifier.text} 的 ${imported}${el.propertyName ? `（改名為 ${el.name.text}）` : ''}；${R1_FIX}`);
          importViolations.set(el.name.text, out[out.length - 1]);
        }
      }
  }

  const isRouterLinkExpr = (expr) => {
    const e = unwrap(expr);
    if (!e) return false;
    if (ts.isIdentifier(e)) return router.linkLocals.has(e.text) || router.namespaces.has(e.text);
    if (ts.isPropertyAccessExpression(e))
      return ts.isIdentifier(e.expression) && router.namespaces.has(e.expression.text) && rules.routerLinkExports.has(e.name.text);
    return false;
  };

  /** polymorphic 屬性的值是不是 <a> 或 react-router 的連結 */
  const isAnchorValue = (expr) => {
    const e = unwrap(expr);
    if (!e) return false;
    if (isStr(e)) return e.text.trim().toLowerCase() === 'a';
    if (ts.isIdentifier(e)) return router.locals.has(e.text) || rules.routerLinkExports.has(e.text);
    if (ts.isPropertyAccessExpression(e))
      return (ts.isIdentifier(e.expression) && router.namespaces.has(e.expression.text)) || rules.routerLinkExports.has(e.name.text);
    return false;
  };

  /** className 是否靜態可判定且含 ll- 片段（每條分支都要有） */
  const classHasLl = (expr, depth = 0) => {
    const e = unwrap(expr);
    if (!e || depth > 6) return false;
    const hasTok = (s) => s.split(/\s+/).some((t) => t.startsWith('ll-'));
    if (isStr(e)) return hasTok(e.text);
    if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].some(hasTok);
    if (ts.isConditionalExpression(e)) return classHasLl(e.whenTrue, depth + 1) && classHasLl(e.whenFalse, depth + 1);
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      if (k === ts.SyntaxKind.PlusToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken)
        return classHasLl(e.left, depth + 1) || classHasLl(e.right, depth + 1);
      return false;
    }
    if (ts.isCallExpression(e)) {
      // 同一個檔案裡組 class 的函式（例如 Button.tsx 的 buttonClass），或從設計系統檔案匯入的函式
      if (ts.isIdentifier(e.expression)) {
        const name = e.expression.text;
        if (dsImports.has(name)) return true;
        const bodies = [functions.get(name), ...(consts.get(name) ?? []).map((i) => (ts.isArrowFunction(i) || ts.isFunctionExpression(i) ? i.body : null))];
        // 深度給 6：函式本體裡的字串直接看，不再展開其他 const，避免大型元件來回展開
        if (bodies.some((b) => b && staticTokens(b, 6).some((t) => t.startsWith('ll-')))) return true;
      }
      return (
        e.arguments.some((a) => classHasLl(a, depth + 1)) || (ts.isPropertyAccessExpression(e.expression) && classHasLl(e.expression.expression, depth + 1))
      );
    }
    if (ts.isArrayLiteralExpression(e)) return e.elements.some((x) => classHasLl(x, depth + 1));
    if (ts.isObjectLiteralExpression(e))
      return e.properties.some((p) => p.name && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) && hasTok(p.name.text));
    if (ts.isIdentifier(e)) return dsImports.has(e.text) || (consts.get(e.text) ?? []).some((init) => classHasLl(init, depth + 1));
    return false;
  };

  /** 運算式裡所有靜態字串的片段（ll-list 判定用） */
  const staticTokens = (expr, depth = 0, acc = []) => {
    const e = unwrap(expr);
    if (!e || depth > 6) return acc;
    const visitTok = (n) => {
      if (isStr(n)) acc.push(...n.text.split(/\s+/).filter(Boolean));
      else if (ts.isTemplateExpression(n))
        for (const p of [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]) acc.push(...p.split(/\s+/).filter(Boolean));
      else if (ts.isIdentifier(n)) for (const init of consts.get(n.text) ?? []) staticTokens(init, depth + 1, acc);
      ts.forEachChild(n, visitTok);
    };
    visitTok(e);
    return acc;
  };

  const attrNameOf = (a) => (ts.isIdentifier(a.name) ? a.name.text : a.name.getText(sf));
  const attrValue = (a) => {
    const init = a.initializer;
    if (!init) return undefined;
    if (ts.isJsxExpression(init)) return init.expression;
    return init;
  };
  const findAttr = (el, name) => el.attributes.properties.find((a) => ts.isJsxAttribute(a) && attrNameOf(a) === name);
  const tagOf = (el) => el.tagName.getText(sf);
  const lastSeg = (tag) => tag.split('.').pop();
  const isIntrinsic = (tag) => /^[a-z][\w-]*$/.test(tag);

  const resolveObject = (expr, depth = 0) => {
    const e = unwrap(expr);
    if (!e || depth > 4) return null;
    if (ts.isObjectLiteralExpression(e)) return e;
    if (ts.isIdentifier(e)) {
      for (const init of consts.get(e.text) ?? []) {
        const o = resolveObject(init, depth + 1);
        if (o) return o;
      }
    }
    return null;
  };
  const propNameOf = (p) => {
    if (!p.name) return null;
    if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name)) return p.name.text;
    if (ts.isComputedPropertyName(p.name) && isStr(p.name.expression)) return p.name.expression.text;
    return null;
  };

  const checkJsx = (el) => {
    const tag = tagOf(el);
    const intrinsic = isIntrinsic(tag);
    const props = el.attributes.properties;
    // R2：原生 <a> 與多型屬性
    if (intrinsic && tag === 'a' && !isDs) add(el, 'R2', '的 <a> 不在設計系統檔案；改用 Button href、NavRow、TextLink 或 GlossaryItem');
    if (!isDs)
      for (const p of rules.polymorphicProps) {
        const a = findAttr(el, p);
        if (a && isAnchorValue(attrValue(a))) add(a, 'R2', `<${tag} ${p}=…> 把元件換成 <a> 或 react-router 的連結；改用設計系統元件`);
      }
    // R4：原生 <button>
    if (intrinsic && tag === 'button') {
      if (!inButtonDir) add(el, 'R4', '的 <button> 請改用 <Button> 或 <IconButton>');
      else {
        const cn = findAttr(el, 'className');
        if (!cn || !classHasLl(attrValue(cn))) add(el, 'R4', '的 <button> 要有靜態可判定、含 ll- 片段的 className');
      }
    }
    // R5：非連結的導航
    if (intrinsic && rules.nonInteractiveElements.has(tag))
      for (const h of rules.nonInteractiveHandlers) {
        const a = findAttr(el, h);
        if (a) add(a, 'R5', `的 <${tag} ${h}> 請改用 Button 或 NavRow`);
      }
    const role = findAttr(el, 'role');
    if (role) {
      const v = unwrap(attrValue(role));
      if (isStr(v) && rules.forbiddenRoles.has(v.text.trim()))
        add(role, 'R5', `的 <${tag} role="${v.text.trim()}"> 請改用原生元素（Button、NavRow 或 TextLink）`);
    }
    // R6：展開屬性
    if (intrinsic && (tag === 'a' || tag === 'button') && !isDs && props.some((a) => ts.isJsxSpreadAttribute(a)))
      add(el, 'R6', `的 <${tag} {...props}> 可能帶進任何 className；改用設計系統元件`);
    // R8
    const danger = findAttr(el, 'dangerouslySetInnerHTML');
    if (danger) add(danger, 'R8', '的 dangerouslySetInnerHTML 會產生未經元件的 HTML；改用元件');
    // R12：style 物件
    const style = findAttr(el, 'style');
    if (style) {
      const obj = resolveObject(attrValue(style));
      const strictColor = tag === 'a' || rules.dsComponents.has(lastSeg(tag));
      if (obj)
        for (const p of obj.properties) {
          const name = propNameOf(p);
          if (!name) continue;
          if (rules.styleDecorationProps.has(name) || /^(-webkit-)?text-(decoration|underline)/.test(name))
            add(p, 'R12', `的 style 設定了 ${name}；底線只由 TextLink（.ll-link）決定`);
          else if (strictColor && rules.styleColorProps.has(name)) add(p, 'R12', `的 <${tag}> 用 style 設定 ${name}；顏色由元件的變體與 token 決定`);
        }
    }
  };

  const reportedInList = new Set();
  const checkList = (node) => {
    const cn = findAttr(node.openingElement, 'className');
    if (!cn || !staticTokens(attrValue(cn)).some((t) => rules.listClassRe.test(t))) return;
    const listLine = lineOf(node);
    const inner = (n) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = lastSeg(tagOf(n));
        const rule = Object.hasOwn(rules.listForbidden, tag) ? rules.listForbidden[tag] : undefined;
        const hit = rule === true || (typeof rule === 'string' && !!findAttr(n, rule));
        if (hit && !reportedInList.has(n.pos)) {
          reportedInList.add(n.pos);
          add(n, 'R7', `的 .ll-list（第 ${listLine} 行）裡有 <${tag}>；請改用 NavList，.ll-list 只放文字與 TextLink`);
        }
      }
      ts.forEachChild(n, inner);
    };
    for (const c of node.children) inner(c);
  };

  const isModuleSpecifier = (node) => {
    const p = node.parent;
    if (!p) return false;
    if ((ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === node) return true;
    if (ts.isExternalModuleReference(p)) return true;
    if (ts.isCallExpression(p) && (p.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(p.expression) && p.expression.text === 'require')))
      return true;
    if (ts.isLiteralTypeNode(p) && p.parent && ts.isImportTypeNode(p.parent)) return true;
    return false;
  };

  /** R3：字串常值或樣板字串的靜態片段，以空白切開後逐片段比對保留 class */
  const checkReserved = (parts, node) => {
    const seen = new Set();
    let lines = 0;
    parts.forEach((part, i) => {
      const toks = part.split(/\s+/);
      toks.forEach((tok, j) => {
        if (!tok) return;
        if (i > 0 && j === 0) return; // 緊接在 ${…} 後面，實際 class 名稱不確定
        const trailingAdj = i < parts.length - 1 && j === toks.length - 1;
        const re = trailingAdj ? rules.reservedPrefixRe : rules.reservedRe;
        if (re.test(tok) && !seen.has(tok)) {
          seen.add(tok);
          out.push({
            file,
            line: lineOf(node, lines),
            rule: 'R3',
            message: `出現保留 class「${tok}${trailingAdj ? '${…}' : ''}」；改用 ${suggestFor(rules, tok)}`,
          });
        }
      });
      lines += (part.match(/\n/g) ?? []).length;
    });
  };

  const PLACEHOLDER = '';
  const visit = (node) => {
    // R1：轉匯出、命名空間的 Link、解構、動態匯入
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const fromRouter = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && rules.routerModuleRe.test(node.moduleSpecifier.text);
      const clause = node.exportClause;
      if (fromRouter && (!clause || ts.isNamespaceExport(clause)))
        add(node, 'R1', `轉匯出 ${node.moduleSpecifier.getText(sf)} 的全部名稱（含 Link、NavLink）；任何檔案都不得轉匯出`);
      if (clause && ts.isNamedExports(clause))
        for (const el of clause.elements) {
          if (el.isTypeOnly) continue;
          const local = (el.propertyName ?? el.name).text;
          if (fromRouter ? rules.routerLinkExports.has(local) : router.linkLocals.has(local) || router.namespaces.has(local))
            add(el, 'R1', `轉匯出 react-router 的 ${local}${el.propertyName ? `（改名為 ${el.name.text}）` : ''}；任何檔案都不得轉匯出`);
        }
    }
    if (ts.isExportAssignment(node) && isRouterLinkExpr(node.expression)) add(node, 'R1', '以 export default 轉匯出 react-router 的連結；任何檔案都不得轉匯出');
    if (ts.isVariableStatement(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      for (const d of node.declarationList.declarations)
        if (d.initializer && isRouterLinkExpr(d.initializer)) add(d, 'R1', '把 react-router 的連結指定給匯出的變數；任何檔案都不得轉匯出');
    if (!isRouterLinkFile) {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        router.namespaces.has(node.expression.text) &&
        rules.routerLinkExports.has(node.name.text)
      )
        add(node, 'R1', `使用 ${node.expression.text}.${node.name.text}（react-router）；${R1_FIX}`);
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        router.namespaces.has(node.expression.text) &&
        isStr(node.argumentExpression) &&
        rules.routerLinkExports.has(node.argumentExpression.text)
      )
        add(node, 'R1', `使用 ${node.expression.text}['${node.argumentExpression.text}']（react-router）；${R1_FIX}`);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(unwrap(node.initializer)) &&
        router.namespaces.has(unwrap(node.initializer).text)
      )
        for (const b of node.name.elements) {
          const key = b.propertyName ? b.propertyName.getText(sf) : b.name.getText(sf);
          if (rules.routerLinkExports.has(key)) add(b, 'R1', `從 react-router 解構出 ${key}；${R1_FIX}`);
        }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        isStr(node.arguments[0]) &&
        rules.routerModuleRe.test(node.arguments[0].text)
      )
        add(node, 'R1', `動態匯入 ${node.arguments[0].text}；${R1_FIX}`);
    }

    // JSX
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      checkJsx(node);
      const tag = tagOf(node);
      if (importViolations.has(tag)) linkUsages.set(tag, [...(linkUsages.get(tag) ?? []), lineOf(node)]);
    }
    if (ts.isJsxElement(node)) checkList(node);

    // 呼叫：createElement('a')、jsx('a')、innerHTML 類的 API
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let name = null;
      let objText = null;
      if (ts.isIdentifier(callee)) name = callee.text;
      else if (ts.isPropertyAccessExpression(callee)) {
        name = callee.name.text;
        objText = callee.expression.getText(sf);
      }
      const argA = (i) => isStr(node.arguments[i]) && node.arguments[i].text.trim().toLowerCase() === 'a';
      const domDoc = objText !== null && DOM_DOC_RE.test(objText);
      if ((name === 'createElement' && domDoc && argA(0)) || (name === 'createElementNS' && argA(1))) checkDomAnchor(node);
      else if (name && JSX_FACTORIES.has(name) && argA(0) && !isDs)
        add(node, 'R2', `的 ${name}('a', …) 不在設計系統檔案；改用 Button href、NavRow、TextLink 或 GlossaryItem`);
      if (name && HTML_SINK_CALLS.has(name)) add(node, 'R8', `的 ${name}(…) 會產生未經元件的 HTML；改用元件`);
      if ((name === 'write' || name === 'writeln') && domDoc) add(node, 'R8', `的 document.${name}(…) 會產生未經元件的 HTML`);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'DOMParser')
      add(node, 'R8', '的 new DOMParser 會產生未經元件的 HTML');
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsToken || node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      const l = node.left;
      const name = ts.isPropertyAccessExpression(l)
        ? l.name.text
        : ts.isElementAccessExpression(l) && isStr(l.argumentExpression)
          ? l.argumentExpression.text
          : null;
      if (name === 'innerHTML' || name === 'outerHTML') add(node, 'R8', `的 .${name} = 會產生未經元件的 HTML；改用元件`);
    }
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && propNameOf(node) === 'dangerouslySetInnerHTML')
      add(node, 'R8', '的 dangerouslySetInnerHTML 會產生未經元件的 HTML；改用元件');

    // 字串：R3 保留 class、R10 字串產生的 HTML
    if (isStr(node) && !isModuleSpecifier(node)) {
      if (!isDs) checkReserved([node.text], node);
      out.push(...scanHtmlString(node.text, file, rules, { line: lineOf(node) }));
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (!isDs) checkReserved(parts, node);
      out.push(...scanHtmlString(parts.join(PLACEHOLDER), file, rules, { line: lineOf(node) }));
    }
    ts.forEachChild(node, visit);
  };

  /** R9：document.createElement('a') 只准在例外清單的檔案，而且同一函式內不得插進畫面 */
  function checkDomAnchor(call) {
    add(call, 'R9', "的 document.createElement('a') 只准在例外清單的檔案（程式產生的下載連結，不插進畫面）");
    let wrapped = call;
    while (
      wrapped.parent &&
      (ts.isParenthesizedExpression(wrapped.parent) ||
        ts.isAsExpression(wrapped.parent) ||
        ts.isSatisfiesExpression(wrapped.parent) ||
        ts.isNonNullExpression(wrapped.parent))
    )
      wrapped = wrapped.parent;
    const p = wrapped.parent;
    let varName = null;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) varName = p.name.text;
    else if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(p.left)) varName = p.left.text;
    else if (
      ts.isCallExpression(p) &&
      p.arguments.includes(wrapped) &&
      ts.isPropertyAccessExpression(p.expression) &&
      APPEND_METHODS.has(p.expression.name.text)
    ) {
      add(p, 'R9', `的程式產生連結直接被 ${p.expression.name.text}() 插進畫面；改成不插進 DOM、直接 click()`, { exceptable: false });
      return;
    }
    if (!varName) return;
    let fn = call.parent;
    while (fn && !ts.isFunctionLike(fn) && !ts.isSourceFile(fn)) fn = fn.parent;
    const scan = (n) => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        APPEND_METHODS.has(n.expression.name.text) &&
        n.arguments.some((a) => ts.isIdentifier(unwrap(a)) && unwrap(a).text === varName)
      )
        add(n, 'R9', `的程式產生連結 ${varName} 被 ${n.expression.name.text}() 插進畫面；改成不插進 DOM、直接 click()`, { exceptable: false });
      ts.forEachChild(n, scan);
    };
    if (fn) scan(fn);
  }

  visit(sf);
  for (const [local, v] of importViolations) {
    const lines = linkUsages.get(local);
    if (lines?.length) v.message = v.message.replace('；', `（用在第 ${lines.join('、')} 行）；`);
  }
  return out;
}

/** 型別選擇器 a、:visited 等的判斷都要能看進 :is()、:where()、:not()、:has() 與 :nth-child(… of …) 的參數 */
const nestedSelectors = (c) => [...(Array.isArray(c.selectors) ? c.selectors : []), ...(Array.isArray(c.of) ? c.of : [])];

/** 把選擇器切成複合選擇器（compound），去掉組合子 */
function compoundsOf(sel) {
  /** @type {any[][]} */
  const out = [[]];
  for (const c of sel) {
    if (c.type === 'combinator') {
      if (c.value === 'pseudo-element') continue;
      out.push([]);
    } else out[out.length - 1].push(c);
  }
  return out.filter((x) => x.length);
}

/** 所有層級的 compound（含偽類參數裡的），回呼帶 compound 本身 */
function forEachCompoundDeep(sel, cb) {
  for (const comp of compoundsOf(sel)) {
    cb(comp);
    for (const c of comp) if (c.type === 'pseudo-class') for (const s of nestedSelectors(c)) forEachCompoundDeep(s, cb);
  }
}

const classesOf = (comp) => comp.filter((c) => c.type === 'class').map((c) => c.name);

function serSel(sel) {
  return sel
    .map((c) => serComp(c))
    .join('')
    .trim();
}
function serComp(c) {
  switch (c.type) {
    case 'combinator':
      return { descendant: ' ', child: ' > ', 'next-sibling': ' + ', 'later-sibling': ' ~ ', 'pseudo-element': '' }[c.value] ?? ' ';
    case 'class':
      return `.${c.name}`;
    case 'id':
      return `#${c.name}`;
    case 'type':
      return c.name;
    case 'universal':
      return '*';
    case 'nesting':
      return '&';
    case 'attribute': {
      const op = c.operation;
      if (!op) return `[${c.name}]`;
      const sym = { equal: '=', includes: '~=', 'dash-match': '|=', prefix: '^=', substring: '*=', suffix: '$=' }[op.operator] ?? '=';
      return `[${c.name}${sym}"${op.value}"]`;
    }
    case 'pseudo-class': {
      const name = c.kind === 'custom' || c.kind === 'custom-function' ? c.name : c.kind;
      if (c.kind === 'lang') return `:lang(${(c.languages ?? []).join(', ')})`;
      if (Array.isArray(c.selectors)) return `:${name}(${c.selectors.map(serSel).join(', ')})`;
      if (typeof c.a === 'number') return `:${name}(${c.a}n+${c.b}${c.of ? ` of ${c.of.map(serSel).join(', ')}` : ''})`;
      return `:${name}`;
    }
    case 'pseudo-element':
      return `::${c.kind === 'custom' || c.kind === 'custom-function' ? c.name : c.kind}`;
    default:
      return '';
  }
}

/** 解開巢狀選擇器的 &（lightningcss 已經替沒寫 & 的巢狀規則補上） */
function resolveNesting(selectors, parents) {
  if (!parents) return selectors;
  const out = [];
  for (const sel of selectors) {
    if (!sel.some((c) => c.type === 'nesting')) {
      for (const p of parents) out.push([...p, { type: 'combinator', value: 'descendant' }, ...sel]);
      continue;
    }
    for (const p of parents) out.push(sel.flatMap((c) => (c.type === 'nesting' ? p : [c])));
  }
  return out;
}

const FALLBACK_IS = new Set([':is(:not([class]), [class=""])', ':is([class=""], :not([class]))']);
const FALLBACK_STATES = new Set(['lang', 'visited', 'hover', 'active', 'focus', 'focus-visible', 'link', 'any-link']);
/** 保底選擇器 a:is(:not([class]), [class='']) 加上可選的狀態偽類 */
function isFallbackCompound(comp) {
  if (comp.length < 2 || comp[0].type !== 'type' || comp[0].name.toLowerCase() !== 'a') return false;
  if (comp[1].type !== 'pseudo-class' || !FALLBACK_IS.has(serComp(comp[1]))) return false;
  return comp.slice(2).every((c) => c.type === 'pseudo-class' && FALLBACK_STATES.has(c.kind));
}
/** html、body、:root 加屬性與狀態（主題、減少動態、開發模式標示） */
function isRootStateCompound(comp) {
  const hasRoot = comp.some((c) => (c.type === 'type' && /^(html|body)$/i.test(c.name)) || (c.type === 'pseudo-class' && c.kind === 'root'));
  if (!hasRoot) return false;
  return comp.every(
    (c) =>
      (c.type === 'type' && /^(html|body)$/i.test(c.name)) ||
      c.type === 'attribute' ||
      (c.type === 'pseudo-class' && (c.kind === 'root' || c.kind === 'lang' || c.kind === 'dir')) ||
      (c.type === 'pseudo-class' &&
        (c.kind === 'not' || c.kind === 'is' || c.kind === 'where') &&
        c.selectors.every((s) => s.every((x) => x.type === 'attribute'))),
  );
}
const isWhereReset = (sel) => sel.length === 1 && sel[0].type === 'pseudo-class' && sel[0].kind === 'where' && serComp(sel[0]) === ':where(a)';

function containsTypeA(sel) {
  let hit = false;
  forEachCompoundDeep(sel, (comp) => {
    if (comp.some((c) => c.type === 'type' && c.name.toLowerCase() === 'a')) hit = true;
  });
  return hit;
}

/** CSS 宣告的屬性名稱與值（給 R11（a）判斷底線） */
function decorationOf(decl) {
  let prop;
  let valueJson;
  if (decl.property === 'custom') {
    prop = decl.value.name;
    valueJson = JSON.stringify(decl.value.value);
  } else if (decl.property === 'unparsed') {
    prop = decl.value.propertyId.property;
    valueJson = JSON.stringify(decl.value.value);
  } else {
    prop = decl.property;
    valueJson = JSON.stringify(decl.value);
  }
  const vendor = (decl.vendorPrefix ?? decl.value?.propertyId?.vendor_prefix ?? []).map((v) => `-${v}-`).join('');
  const fullProp = `${vendor}${prop}`;
  const isDecoProp = /^(-webkit-|-moz-)?text-decoration(-line)?$/.test(fullProp);
  const underline = valueJson.includes('underline');
  if (!isDecoProp && !underline) return null;
  const none =
    !underline && ((decl.property === 'text-decoration' && decl.value?.line === 'none') || (decl.property === 'text-decoration-line' && decl.value === 'none'));
  return { prop: fullProp, none };
}

let lightningcss = null;
/** lightningcss 是 tools 自己的 devDependency（版本和 apps/web 相同）；只在掃到 CSS 時才載入 */
function loadLightningcss() {
  lightningcss ??= createRequire(import.meta.url)('lightningcss');
  return lightningcss;
}

/**
 * 掃描一份 CSS（R11）
 * @param {string} text
 * @param {string} file repo 內的相對路徑
 * @param {ReturnType<typeof normaliseRules>} rules
 * @param {{ lineOffset?: number }} [options] index.html 的 <style> 用：CSS 第一行在檔案裡的行號減一
 */
export function scanCss(text, file, rules, { lineOffset = 0 } = {}) {
  const { transform } = loadLightningcss();
  const out = [];
  /** @type {any} */
  let sheet = null;
  try {
    transform({
      filename: file,
      code: Buffer.from(text),
      errorRecovery: true,
      visitor: {
        StyleSheet(ss) {
          sheet = ss;
        },
      },
    });
  } catch (e) {
    out.push({ file, line: (e.loc?.line ?? 0) + lineOffset || 1, rule: 'R11', message: `CSS 無法解析：${e.message}`, exceptable: false });
    return out;
  }
  if (!sheet) return out;
  const isGlobal = rules.globalAnchorFiles.has(file);
  const hasClassIn = (comp, bases) => classesOf(comp).some((cls) => bases.some((b) => inFamily(cls, b)));
  const reservedBaseOf = (cls) => {
    const m = rules.reservedRe.exec(cls);
    return m ? `ll-${m[1]}` : null;
  };
  const isAnchorAllowed = (sel) => {
    if (!isGlobal) return false;
    if (isWhereReset(sel)) return true;
    const comps = compoundsOf(sel);
    return isFallbackCompound(comps[comps.length - 1]) && comps.slice(0, -1).every(isRootStateCompound);
  };

  const checkRule = (selectors, declarations, line) => {
    const decls = [...(declarations?.declarations ?? []), ...(declarations?.importantDeclarations ?? [])];
    const decos = /** @type {{ prop: string; none: boolean }[]} */ (decls.map(decorationOf).filter(Boolean));
    for (const sel of selectors) {
      const text = serSel(sel);
      const comps = compoundsOf(sel);
      const subject = comps[comps.length - 1] ?? [];
      // （b）型別選擇器 a；這條已經失敗時不再重複報（a）
      const typeAViolation = containsTypeA(sel) && !isAnchorAllowed(sel);
      if (typeAViolation)
        out.push({
          file,
          line,
          rule: 'R11',
          message: `的「${text}」用型別選擇器 a 改連結外觀；只有 base.css 的 :where(a) 重設與 07-core-components.css 的保底（tools/link-rules.json 的 globalAnchorFiles）可以，元件請改自己的 class`,
        });
      // （a）底線
      for (const d of typeAViolation ? [] : decos) {
        const ok =
          hasClassIn(subject, rules.linkClasses) ||
          isAnchorAllowed(sel) ||
          (d.none && (classesOf(subject).some((c) => reservedBaseOf(c)) || hasClassIn(subject, rules.textDecorationNoneClasses)));
        if (!ok)
          out.push({
            file,
            line,
            rule: 'R11',
            message: `的「${text}」設定 ${d.prop}${d.none ? ': none' : ''}；底線只准出現在 .ll-link 與保底選擇器`,
          });
      }
      // （c）:visited
      forEachCompoundDeep(sel, (comp) => {
        if (!comp.some((c) => c.type === 'pseudo-class' && c.kind === 'visited')) return;
        if (hasClassIn(comp, rules.visitedClasses) || (isGlobal && isFallbackCompound(comp))) return;
        out.push({ file, line, rule: 'R11', message: `的「${text}」用 :visited；只准在 .ll-link、保底選擇器與 .ll-btn 的重設` });
      });
      // （d）設計系統 class 出現在複合選擇器的非第一段
      const checkSegments = (s, outerAncestors) => {
        const cs = compoundsOf(s);
        cs.forEach((comp, i) => {
          const ancestors = [...outerAncestors, ...cs.slice(0, i)];
          // :is()、:where() 的參數視為同一個位置；:not() 與 :has() 不是在改那個元素本身，不算
          for (const c of comp)
            if (c.type === 'pseudo-class' && ['is', 'where', 'matches', 'any'].includes(c.kind) && Array.isArray(c.selectors))
              for (const inner of c.selectors) checkSegments(inner, ancestors);
          if (!ancestors.length) return;
          for (const cls of classesOf(comp)) {
            const base = reservedBaseOf(cls);
            if (!base) continue;
            const ok = ancestors.every((a) => isRootStateCompound(a) || hasClassIn(a, rules.allowedAncestors) || hasClassIn(a, [base]));
            if (!ok)
              out.push({
                file,
                line,
                rule: 'R11',
                message: `的「${text}」在元件外改 .${cls}；請改元件本身（允許的祖先：${rules.allowedAncestors.map((a) => `.${a}`).join('、')}）`,
              });
          }
        });
      };
      checkSegments(sel, []);
    }
  };

  const walkRules = (list, parents) => {
    for (const rule of list ?? []) {
      const v = rule.value ?? {};
      const line = (v.loc?.line ?? 0) + 1 + lineOffset;
      if (rule.type === 'style') {
        const sels = resolveNesting(v.selectors, parents);
        checkRule(sels, v.declarations, line);
        walkRules(v.rules, sels);
      } else if (rule.type === 'nested-declarations') {
        if (parents) checkRule(parents, v.declarations, line);
      } else if (Array.isArray(v.rules)) walkRules(v.rules, parents);
    }
  };
  walkRules(sheet.rules, null);
  return out;
}

/**
 * 掃描字串產生的 HTML（R10，另外檢查 style 屬性的底線，算 R12）
 * @param {string} text HTML 片段；樣板字串的 ${…} 以 U+E000 代替
 * @param {string} file repo 內的相對路徑（決定允許的 class）
 * @param {ReturnType<typeof normaliseRules>} rules
 * @param {{ line?: number }} [options] 片段第一行在檔案裡的行號
 */
export function scanHtmlString(text, file, rules, { line = 1 } = {}) {
  const out = [];
  if (!/<(a|button)[\s>/]/i.test(text)) return out;
  const allowed = rules.htmlAnchorClasses[file] ?? [];
  const re = /<(a|button)(?=[\s>/])([^>]*)/gi;
  for (const m of text.matchAll(re)) {
    const at = line + (text.slice(0, m.index).match(/\n/g) ?? []).length;
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    if (tag === 'button') {
      out.push({ file, line: at, rule: 'R10', message: '的字串產生 <button>；改用元件，殼層真的需要時列進例外清單' });
      continue;
    }
    const cm = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    const classes = cm ? (cm[1] ?? cm[2] ?? cm[3] ?? '').split(/[\s]+/).filter(Boolean) : [];
    if (!classes.some((c) => allowed.includes(c)))
      out.push({
        file,
        line: at,
        rule: 'R10',
        message: `的字串產生的 <a> 沒有允許的 class（${allowed.length ? `這個檔案只允許 ${allowed.join('、')}` : '這個檔案不允許字串產生連結'}）`,
      });
    const sm = /(?:^|\s)style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    if (sm && /text-(decoration|underline)/i.test(sm[1] ?? sm[2] ?? ''))
      out.push({ file, line: at, rule: 'R12', message: '的字串產生的 <a> 用 style 設定底線；底線只由 .ll-link 決定' });
  }
  return out;
}

/** index.html：去掉註解後掃標籤，<style> 交給 scanCss */
export function scanHtmlDocument(text, file, rules) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const clean = text.replace(/<!--[\s\S]*?-->/g, blank);
  const out = scanHtmlString(clean, file, rules, { line: 1 });
  for (const m of clean.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style>/gi)) {
    const startLine = (clean.slice(0, m.index + m[1].length).match(/\n/g) ?? []).length;
    out.push(...scanCss(m[2], file, rules, { lineOffset: startLine }));
  }
  return out;
}

/**
 * 套用例外清單：同一個檔案加規則的違規數量必須等於 count（多了少了都失敗），用不到的例外也失敗
 * @template {{ file: string; rule: string; exceptable?: boolean }} T
 * @param {T[]} violations
 * @param {{ file: string; rule: string; count: number }[]} exceptions
 */
export function applyExceptions(violations, exceptions) {
  const problems = [];
  const keyOf = (f, r) => `${f}\u0000${r}`;
  const byKey = new Map(exceptions.map((e) => [keyOf(e.file, e.rule), e]));
  const counted = new Map();
  const remaining = [];
  for (const v of violations) {
    const k = keyOf(v.file, v.rule);
    if (v.exceptable !== false && byKey.has(k)) counted.set(k, (counted.get(k) ?? 0) + 1);
    else remaining.push(v);
  }
  for (const [k, e] of byKey) {
    const n = counted.get(k) ?? 0;
    if (n === 0) problems.push(`${LINK_EXCEPTIONS_FILE} 的 ${e.file} ${e.rule} 已經用不到，請移除`);
    else if (n !== e.count) problems.push(`${LINK_EXCEPTIONS_FILE} 的 ${e.file} ${e.rule} 寫 count ${e.count}，實際有 ${n} 處；請確認後更新`);
  }
  return { remaining, problems, used: counted };
}

const SKIP_FILE = /(^|\/)(e2e|locales|generated)\/|\.test\.[cm]?[jt]sx?$/;
const SCAN_EXT = /\.(tsx?|jsx?|mjs|cjs|css)$/;

/** 掃描範圍：apps/web/src、packages/<名稱>/src 與 apps/web/index.html */
export function listFiles(root = ROOT) {
  const out = [];
  const add = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of walk(dir)) {
      const rel = relative(root, f).split(sep).join('/');
      if (SCAN_EXT.test(rel) && !SKIP_FILE.test(rel)) out.push(rel);
    }
  };
  add(join(root, 'apps/web/src'));
  const pkgs = join(root, 'packages');
  if (existsSync(pkgs)) for (const e of readdirSync(pkgs, { withFileTypes: true })) if (e.isDirectory()) add(join(pkgs, e.name, 'src'));
  if (existsSync(join(root, 'apps/web/index.html'))) out.push('apps/web/index.html');
  return [...new Set(out)].sort();
}

/** 掃描單一檔案，依副檔名分派 */
export function scanFile(text, file, rules) {
  if (file.endsWith('.css')) return scanCss(text, file, rules);
  if (file.endsWith('.html')) return scanHtmlDocument(text, file, rules);
  return scanTsx(text, file, rules);
}

/** 一行違規訊息：「check:links：檔案:行 訊息（規則）」 */
export const formatViolation = (v) => `check:links：${v.file}:${v.line} ${v.message}（${v.rule}）`;

/**
 * 跑完整檢查
 * @param {{ root?: string; report?: boolean; json?: boolean; log?: (s: string) => void; error?: (s: string) => void }} [options]
 * @returns {number} 結束代碼
 */
export function run({ root = ROOT, report = false, json = false, log = console.log, error = console.error } = {}) {
  const rules = loadRules(root);
  const problems = [];
  let exceptions = [];
  try {
    exceptions = readLinkExceptions(root);
    problems.push(...validateLinkExceptions(exceptions));
  } catch (e) {
    problems.push(`${LINK_EXCEPTIONS_FILE} 無法讀取：${e.message}`);
  }
  const missingDs = [...rules.dsFiles].filter((f) => !existsSync(join(root, f)));
  for (const f of missingDs) problems.push(`${RULES_FILE} 的設計系統檔案 ${f} 不存在（新增或改名後要同步更新）`);
  const files = listFiles(root);
  const violations = [];
  for (const f of files) {
    try {
      violations.push(...scanFile(readFileSync(join(root, f), 'utf8'), f, rules));
    } catch (e) {
      problems.push(`${f} 無法解析：${e.message}`);
    }
  }
  const { remaining, problems: exProblems } = applyExceptions(violations, Array.isArray(exceptions) ? exceptions : []);
  problems.push(...exProblems);
  remaining.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule, 'en', { numeric: true }));
  const failed = remaining.length > 0 || problems.length > 0;
  if (json) {
    log(JSON.stringify({ files: files.length, violations: remaining, problems, missingDs }, null, 2));
    return report || !failed ? 0 : 1;
  }
  const print = report ? log : error;
  for (const v of remaining) print(formatViolation(v));
  for (const p of problems) print(`check:links：${p}`);
  const byRule = {};
  for (const v of remaining) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  const ruleSummary = Object.keys(byRule)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((r) => `${r} ${byRule[r]}`)
    .join('、');
  const fileCount = new Set(remaining.map((v) => v.file)).size;
  if (!failed) log(`check:links：${files.length} 個檔案沒有未經設計系統的連結、按鈕或底線；例外 ${exceptions.length} 條都相符`);
  else
    print(
      `check:links：${files.length} 個檔案，違規 ${remaining.length} 項${ruleSummary ? `（${ruleSummary}）` : ''}，分布在 ${fileCount} 個檔案；其他問題 ${problems.length} 項${report ? '（--report：只輸出，不讓檢查失敗）' : ''}`,
    );
  return report || !failed ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  process.exitCode = run({ report: args.includes('--report'), json: args.includes('--json') });
}
