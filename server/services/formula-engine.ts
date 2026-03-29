/**
 * 安全公式引擎 — 不使用 eval()
 * 
 * 支持的公式语法:
 *   "base * 0.105"          → 变量 × 系数
 *   "base + perf"           → 变量加法
 *   "1500"                  → 固定常数
 *   "base * 0.12 + 200"     → 混合运算
 *   "auto_tax"              → 内置特殊函数
 *   ""                      → 返回 0 (使用 default_amount)
 * 
 * 可用变量:
 *   base   — 基本工资
 *   perf   — 绩效奖金
 *   gross  — 应发合计（所有 income 项之和）
 *   以及任何模板 key 名（如 attendance、transport 等）
 */

import { calculateTax } from './payroll';

// ─── Token Types ────────────────────────────────────────────────────
type TokenType = 'number' | 'variable' | 'operator' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string;
}

// ─── Tokenizer ──────────────────────────────────────────────────────
function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = formula.trim();

  while (i < src.length) {
    const ch = src[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) { num += src[i]; i++; }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Bracketed Variable / identifier (e.g. [基本工资], [Base Salary])
    if (ch === '[') {
      let name = '';
      i++; // skip '['
      while (i < src.length && src[i] !== ']') { name += src[i]; i++; }
      if (src[i] === ']') i++; // skip ']'
      tokens.push({ type: 'variable', value: name });
      continue;
    }

    // Variable / identifier (a-z, A-Z, _, 0-9, \u4e00-\u9fa5)
    if (/[a-zA-Z_\u4e00-\u9fa5]/.test(ch)) {
      let name = '';
      while (i < src.length && /[a-zA-Z0-9_\u4e00-\u9fa5]/.test(src[i])) { name += src[i]; i++; }
      tokens.push({ type: 'variable', value: name });
      continue;
    }

    // Operators
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

// ─── Recursive-Descent Parser ───────────────────────────────────────
// Grammar:
//   expression = term (('+' | '-') term)*
//   term       = factor (('*' | '/') factor)*
//   factor     = NUMBER | VARIABLE | '(' expression ')'

class Parser {
  private tokens: Token[];
  private pos = 0;
  private variables: Record<string, number>;

  constructor(tokens: Token[], variables: Record<string, number>) {
    this.tokens = tokens;
    this.variables = variables;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parseExpression(): number {
    let left = this.parseTerm();
    while (this.peek()?.type === 'operator' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.peek()?.type === 'operator' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.consume().value;
      const right = this.parseFactor();
      if (op === '/') {
        left = right === 0 ? 0 : left / right; // Divide-by-zero protection
      } else {
        left = left * right;
      }
    }
    return left;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (!token) return 0;

    if (token.type === 'number') {
      this.consume();
      return parseFloat(token.value) || 0;
    }

    if (token.type === 'variable') {
      this.consume();
      const val = this.variables[token.value];
      if (val === undefined) {
        console.warn(`[FormulaEngine] 未知变量: ${token.value}`);
        return 0;
      }
      return val;
    }

    if (token.type === 'lparen') {
      this.consume(); // consume '('
      const result = this.parseExpression();
      if (this.peek()?.type === 'rparen') {
        this.consume(); // consume ')'
      }
      return result;
    }

    // Fallback
    this.consume();
    return 0;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * 计算公式，返回结果（四舍五入到分）
 * 
 * @param formula  公式字符串，如 "base * 0.105"
 * @param variables 变量映射，如 { base: 15000, perf: 3000, gross: 18000 }
 * @returns 计算结果，保留两位小数
 */
export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || formula.trim() === '') return 0;

  // Special built-in keywords
  const trimmed = formula.trim().toLowerCase();

  if (trimmed === 'auto_tax') {
    // Calculate tax based on taxable income
    // taxableIncome = gross - social_insurance - housing_fund
    const gross = variables.gross || 0;
    const socialIns = variables.social_insurance || variables.social_ins || 0;
    const housingFund = variables.housing_fund || variables.housing || 0;
    const taxableIncome = gross - socialIns - housingFund;
    return Math.round(calculateTax(taxableIncome) * 100) / 100;
  }

  if (trimmed === 'auto_perf') {
    // Returns current perf value (already set in variables)
    return variables.perf || variables.perf_bonus || 0;
  }

  // Parse and evaluate
  try {
    const tokens = tokenize(formula);
    if (tokens.length === 0) return 0;
    const parser = new Parser(tokens, variables);
    const result = parser.parseExpression();
    return Math.round(result * 100) / 100;
  } catch (err) {
    console.error(`[FormulaEngine] 公式计算错误: "${formula}"`, err);
    return 0;
  }
}

/**
 * 验证公式语法是否合法
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') return { valid: true };

  const trimmed = formula.trim().toLowerCase();
  if (['auto_tax', 'auto_perf'].includes(trimmed)) return { valid: true };

  try {
    const tokens = tokenize(formula);
    // Check for balanced parentheses
    let depth = 0;
    for (const t of tokens) {
      if (t.type === 'lparen') depth++;
      if (t.type === 'rparen') depth--;
      if (depth < 0) return { valid: false, error: '括号不匹配' };
    }
    if (depth !== 0) return { valid: false, error: '括号不匹配' };

    // Check for consecutive operators
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].type === 'operator' && tokens[i + 1].type === 'operator') {
        return { valid: false, error: '连续的运算符' };
      }
    }

    // Try to evaluate with dummy variables
    const dummyVars: Record<string, number> = {};
    for (const t of tokens) {
      if (t.type === 'variable') dummyVars[t.value] = 1;
    }
    const parser = new Parser(tokens, dummyVars);
    parser.parseExpression();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || '语法错误' };
  }
}
