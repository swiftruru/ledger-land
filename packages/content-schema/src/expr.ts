// 受控運算式（04 第 8 節）：schema 只管字串的形狀與 AST 的 JSON 形狀；解析、型別推導與引用檢查由核心負責
import { z } from 'zod';
import { SEMANTIC_ID_RE, SemanticId } from './common.ts';

/** 運算式字串：非空、最長 300 字元，只允許文法用得到的字元（不支援字串、屬性存取、科學記號） */
export const EXPR_RE = /^[A-Za-z0-9_.()+\-*/<>=!&| ,]+$/;
export const Expr = z.string().min(1).max(300).regex(EXPR_RE, '運算式只能用英數、底線、小數點、括號、四則、比較與邏輯運算子').meta({ id: 'Expr' });
export type Expr = z.infer<typeof Expr>;

export const ValueType = z.enum(['int', 'rat', 'bool']);
export type ValueType = z.infer<typeof ValueType>;
export const ExprNamespace = z.enum(['param', 'derived', 'line', 'input', 'ratio']);
export const ExprFunction = z.enum(['balance', 'cost', 'round', 'min', 'max', 'avg']);
export const BinaryOp = z.enum(['||', '&&', '==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/']);
export const UnaryOp = z.enum(['-', '!']);

/** AST 節點（04 第 8.4 節的 JSON 形狀）；account 節點只出現在函式引數 */
export interface ExprAstNode {
  type: 'number' | 'ref' | 'account' | 'call' | 'binary' | 'unary';
  valueType?: ValueType;
  value?: string;
  ns?: z.infer<typeof ExprNamespace>;
  name?: string;
  version?: string;
  id?: string;
  fn?: z.infer<typeof ExprFunction>;
  args?: ExprAstNode[];
  op?: string;
  left?: ExprAstNode;
  right?: ExprAstNode;
  operand?: ExprAstNode;
}

const NumberNode = z.object({ type: z.literal('number'), value: z.string().regex(/^\d+(\.\d+)?$/), valueType: ValueType }).strict();
const RefNode = z
  .object({
    type: z.literal('ref'),
    ns: ExprNamespace,
    name: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
    /** 只有 ratio.<id>.<version> 這種連鎖參照才有 */
    version: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .optional(),
    valueType: ValueType,
  })
  .strict();
const AccountNode = z.object({ type: z.literal('account'), id: SemanticId }).strict();

export const ExprAst: z.ZodType<ExprAstNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    NumberNode,
    RefNode,
    AccountNode,
    z.object({ type: z.literal('call'), fn: ExprFunction, valueType: ValueType, args: z.array(ExprAst) }).strict(),
    z.object({ type: z.literal('binary'), op: BinaryOp, valueType: ValueType, left: ExprAst, right: ExprAst }).strict(),
    z.object({ type: z.literal('unary'), op: UnaryOp, valueType: ValueType, operand: ExprAst }).strict(),
  ]),
);

/** 科目 ID 在運算式裡的寫法與語意 ID 相同 */
export const isAccountIdToken = (s: string): boolean => SEMANTIC_ID_RE.test(s);
