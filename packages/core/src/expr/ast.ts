// 受控運算式的 AST（04 第 8.4 節）。節點是純 JSON 物件：數字字面值以字串保存精確值，有理數不進 AST。
// parseExpr 產生未標型別的 Ast；typecheck 產生每個值節點都帶 valueType 的 TypedAst。account 節點只是函式引數，沒有 valueType。

export type ValueType = 'int' | 'rat' | 'bool';
export type NumericType = 'int' | 'rat';
export type Namespace = 'param' | 'derived' | 'line' | 'input' | 'ratio';
export type FunctionName = 'balance' | 'cost' | 'round' | 'min' | 'max' | 'avg';
export type ArithmeticOp = '+' | '-' | '*' | '/';
export type ComparisonOp = '==' | '!=' | '<' | '<=' | '>' | '>=';
export type LogicalOp = '&&' | '||';
export type BinaryOp = ArithmeticOp | ComparisonOp | LogicalOp;
export type UnaryOp = '-' | '!';

export const NAMESPACES: readonly Namespace[] = ['param', 'derived', 'line', 'input', 'ratio'];
export const FUNCTION_NAMES: readonly FunctionName[] = ['balance', 'cost', 'round', 'min', 'max', 'avg'];

/** ident 規則（04 第 8.4 節）：先驗證再查 Map，所以碰不到 __proto__ 之類的原型屬性 */
export const IDENT_RE = /^[a-z][A-Za-z0-9_]{0,63}$/;
/** 科目 ID：snake_case */
export const ACCOUNT_ID_RE = /^[a-z][a-z0-9_]*$/;

export const isNamespace = (s: string): s is Namespace => (NAMESPACES as readonly string[]).includes(s);
export const isFunctionName = (s: string): s is FunctionName => (FUNCTION_NAMES as readonly string[]).includes(s);

export interface NumberNode {
  readonly type: 'number';
  /** 十進位字面值的原文，例如 '0.2'；求值時以 ratFromDecimalString 還原精確值 */
  readonly value: string;
}
export interface RefNode {
  readonly type: 'ref';
  readonly ns: Namespace;
  readonly name: string;
  /** 只有 ratio 參照有版本：ratio.<id>.<version> */
  readonly version?: string;
}
/** balance、cost 的科目引數；不是值，所以沒有 valueType */
export interface AccountNode {
  readonly type: 'account';
  readonly id: string;
}
export interface CallNode<A> {
  readonly type: 'call';
  readonly fn: FunctionName;
  readonly args: readonly (A | AccountNode)[];
}
export interface BinaryNode<A> {
  readonly type: 'binary';
  readonly op: BinaryOp;
  readonly left: A;
  readonly right: A;
}
export interface UnaryNode<A> {
  readonly type: 'unary';
  readonly op: UnaryOp;
  readonly operand: A;
}

/** parser 的輸出：未標型別 */
export type Ast = NumberNode | RefNode | CallNode<Ast> | BinaryNode<Ast> | UnaryNode<Ast>;

interface Typed {
  readonly valueType: ValueType;
}
/** 型別檢查後的輸出：每個值節點都帶 valueType，存進內容快照，學習端不載入 parser */
export type TypedAst = (NumberNode & Typed) | (RefNode & Typed) | (CallNode<TypedAst> & Typed) | (BinaryNode<TypedAst> & Typed) | (UnaryNode<TypedAst> & Typed);

export type AnyAst = Ast | TypedAst;

/** 節點數（含 account 引數節點），用來檢查 256 的上限 */
export function astNodeCount(node: AnyAst | AccountNode): number {
  switch (node.type) {
    case 'number':
    case 'ref':
    case 'account':
      return 1;
    case 'unary':
      return 1 + astNodeCount(node.operand);
    case 'binary':
      return 1 + astNodeCount(node.left) + astNodeCount(node.right);
    case 'call': {
      let n = 1;
      for (const a of node.args) n += astNodeCount(a);
      return n;
    }
  }
}

/** 樹深（根為 1），用來檢查 32 的上限 */
export function astDepth(node: AnyAst | AccountNode): number {
  switch (node.type) {
    case 'number':
    case 'ref':
    case 'account':
      return 1;
    case 'unary':
      return 1 + astDepth(node.operand);
    case 'binary':
      return 1 + Math.max(astDepth(node.left), astDepth(node.right));
    case 'call': {
      let d = 0;
      for (const a of node.args) d = Math.max(d, astDepth(a));
      return 1 + d;
    }
  }
}

/** 參照的完整寫法：param.x、ratio.roa.excel */
export function refToString(node: RefNode): string {
  return node.version === undefined ? `${node.ns}.${node.name}` : `${node.ns}.${node.name}.${node.version}`;
}

/** ratio 參照對應的 ratioRef（04 第 12.1 節：<id>@<version>），求值環境以它查值 */
export function ratioRefOf(node: RefNode): string {
  return `${node.name}@${node.version ?? ''}`;
}
