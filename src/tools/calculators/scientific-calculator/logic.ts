/** Scientific Calculator — pure logic. */

export interface CalcOptions {
  angleMode?: "deg" | "rad";
  precision?: number;
}

export interface CalcResult {
  result: number;
  steps: string[];
  warnings: string[];
}

const FUNCS: Record<string, (x: number, angleMode: "deg" | "rad") => number> = {
  sin: (x, m) => Math.sin(m === "deg" ? (x * Math.PI) / 180 : x),
  cos: (x, m) => Math.cos(m === "deg" ? (x * Math.PI) / 180 : x),
  tan: (x, m) => Math.tan(m === "deg" ? (x * Math.PI) / 180 : x),
  asin: (x, m) => m === "deg" ? (Math.asin(x) * 180) / Math.PI : Math.asin(x),
  acos: (x, m) => m === "deg" ? (Math.acos(x) * 180) / Math.PI : Math.acos(x),
  atan: (x, m) => m === "deg" ? (Math.atan(x) * 180) / Math.PI : Math.atan(x),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  exp: (x) => Math.exp(x),
  ln: (x) => Math.log(x),
  log10: (x) => Math.log10(x),
  log2: (x) => Math.log2(x),
};

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const TOKEN_RE = /\s*(=>|<=|==|!=|&&|\|\||[+\-*/^%(),!<>]|\d+\.?\d*(?:e[-+]?\d+)?|\w+)/gi;

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(expr)) !== null) {
    tokens.push(m[1]!);
  }
  return tokens;
}

// Shunting-yard → RPN → evaluate
function toRPN(tokens: string[]): string[] {
  const prec: Record<string, number> = { "+": 2, "-": 2, "*": 3, "/": 3, "%": 3, "^": 4, "!": 5, "u-": 5 };
  const rightAssoc = new Set(["^", "u-"]);
  const output: string[] = [];
  const ops: string[] = [];
  let prev: string | null = null;
  for (const t of tokens) {
    if (/^\d/.test(t)) {
      output.push(t);
    } else if (t in CONSTS) {
      output.push(t);
    } else if (t in FUNCS) {
      ops.push(t);
    } else if (/^[a-z]+\d*$/i.test(t)) {
      output.push(t); // unknown identifier → treat as constant, will be 0/NaN in eval
    } else if (t === "(") {
      ops.push(t);
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      if (!ops.length) throw new Error("Mismatched )");
      ops.pop();
      // If a function sits on top of ops, pop it onto output
      if (ops.length && ops[ops.length - 1]! in FUNCS) output.push(ops.pop()!);
    } else if (t === ",") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
    } else {
      let op = t;
      if (op === "-" && (prev === null || prev === "(" || prev in prec)) op = "u-";
      while (ops.length) {
        const top = ops[ops.length - 1]!;
        if (top === "(") break;
        if (rightAssoc.has(op) ? prec[top]! > prec[op]! : prec[top]! >= prec[op]!) {
          output.push(ops.pop()!);
        } else break;
      }
      ops.push(op);
    }
    prev = t;
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === "(") throw new Error("Mismatched (");
    output.push(op);
  }
  return output;
}

function evalRPN(rpn: string[], angleMode: "deg" | "rad"): number {
  const stack: number[] = [];
  for (const tok of rpn) {
    if (/^\d/.test(tok)) {
      stack.push(parseFloat(tok));
    } else if (tok in CONSTS) {
      stack.push(CONSTS[tok]!);
    } else if (tok in FUNCS) {
      const a = stack.pop();
      if (a === undefined) throw new Error("Missing operand for " + tok);
      stack.push(FUNCS[tok]!(a, angleMode));
    } else if (tok === "!") {
      const a = stack.pop();
      if (a === undefined) throw new Error("Missing operand for !");
      stack.push(factorial(a));
    } else if (tok === "u-") {
      const a = stack.pop();
      if (a === undefined) throw new Error("Missing operand for unary -");
      stack.push(-a);
    } else if (tok === "pow") {
      const b = stack.pop(); const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Missing operands for pow");
      stack.push(Math.pow(a, b));
    } else {
      const b = stack.pop(); const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Missing operands for " + tok);
      switch (tok) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(a / b); break;
        case "%": stack.push(a % b); break;
        case "^": stack.push(Math.pow(a, b)); break;
        default: throw new Error("Unknown operator: " + tok);
      }
    }
  }
  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0]!;
}

export function process(input: string, options: CalcOptions = {}): CalcResult | { error: string } {
  const warnings: string[] = [];
  const angleMode = options.angleMode ?? "rad";
  const precision = options.precision ?? 10;
  if (!input.trim()) return { error: "Empty expression" };
  try {
    const tokens = tokenize(input);
    const rpn = toRPN(tokens);
    const result = evalRPN(rpn, angleMode);
    if (!Number.isFinite(result)) warnings.push("Result is not finite (Infinity or NaN).");
    const rounded = Math.round(result * Math.pow(10, precision)) / Math.pow(10, precision);
    return { result: rounded, steps: [`RPN: ${rpn.join(" ")}`, `Raw: ${result}`], warnings };
  } catch (e) {
    return { error: `Evaluation error: ${(e as Error).message}` };
  }
}
