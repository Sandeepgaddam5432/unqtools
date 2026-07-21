/**
 * jq Playground & Filter Builder — pure logic.
 *
 * A small pure-JavaScript jq interpreter (no WASM, no network) plus a
 * visual filter builder. Supports the most common jq filters:
 *
 *   .                      identity
 *   .foo, .foo.bar         field access
 *   .[0], .[-1]            array index
 *   .[1:3], .[:3], .[3:]   array slice
 *   .[]                    iterate
 *   a | b                  pipe
 *   a, b                   sequence (comma)
 *   select(cond)           keep matching
 *   map(f), map_values(f)  apply to each
 *   sort, sort_by(f)       sort
 *   group_by(f)            group
 *   keys, keys_unsorted    object keys
 *   values                 object values
 *   length, utf8bytelength size
 *   to_entries, from_entries
 *   add                    sum/concat
 *   first, last            head/tail
 *   first(f), last(f)      first/last result of f
 *   limit(n; f)            first n results of f
 *   unique, unique_by(f)   dedupe
 *   has(key), in(arr)      membership
 *   contains(other)        superset test
 *   del(path)              delete (basic)
 *   [f]                    array constructor
 *   {k: f}, {foo}          object constructor
 *   "...\(expr)..."        string interpolation
 *   + - * / %              arithmetic
 *   == != < > <= >=        comparison
 *   and, or, not, //       logic
 *   if/then/elif/else/end  conditional
 *   -x                     negation
 *   ..                     recursive descent
 *   try c catch e          error handling
 *   $x                     variable (from `as $x`)
 *   exp as $x | body       binding
 *
 * Errors are surfaced distinctly: invalid JSON vs invalid filter.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export interface RunResult {
  /** Transformed values (jq yields zero or more). */
  results: Json[];
  /** Error message, if the filter failed. */
  error: string | null;
  /** Per-step explanation (only for builder output, empty otherwise). */
  steps: ExplainedStep[];
  /** Whether the input JSON was valid. */
  inputValid: boolean;
  /** Parse error for the input, if any. */
  inputError: string | null;
  /** Number of input values (1 for plain JSON, N for slurped NDJSON). */
  inputCount: number;
}

export interface Flags {
  /** -c  compact output. */
  compact: boolean;
  /** -r  raw string output. */
  raw: boolean;
  /** -s  slurp multiple inputs into an array. */
  slurp: boolean;
  /** -S  sort object keys in output. */
  sortKeys: boolean;
}

export const DEFAULT_FLAGS: Flags = {
  compact: false,
  raw: false,
  slurp: false,
  sortKeys: false,
};

// ---------------------------------------------------------------------------
// Builder types — visual filter builder
// ---------------------------------------------------------------------------

export type BuilderStepType =
  | "identity"
  | "field"
  | "index"
  | "iterate"
  | "select"
  | "map"
  | "map_values"
  | "sort"
  | "sort_by"
  | "group_by"
  | "keys"
  | "values"
  | "length"
  | "to_entries"
  | "from_entries"
  | "add"
  | "first"
  | "last"
  | "limit"
  | "unique"
  | "unique_by"
  | "has"
  | "contains"
  | "del"
  | "array_constructor"
  | "reverse";

export interface BuilderStep {
  type: BuilderStepType;
  /** Field path for field/select/sort_by/group_by/unique_by/del/has. */
  field?: string;
  /** Index for `index`. */
  index?: number;
  /** End index for slice. */
  indexEnd?: number;
  /** Condition expression for `select`. */
  condition?: string;
  /** Inner expression for `map`, `map_values`, `first(f)`, `last(f)`. */
  expr?: string;
  /** Count for `limit(n; f)`. */
  count?: number;
  /** Inner expression for `limit(n; f)`. */
  limitExpr?: string;
  /** Contains value (JSON literal) for `contains`. */
  value?: string;
  /** Array constructor inner expression. */
  arrayExpr?: string;
}

export interface ExplainedStep {
  /** The 1-based step number. */
  n: number;
  /** The jq filter fragment for this step. */
  fragment: string;
  /** Plain-English explanation. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Sample JSON + recipe library
// ---------------------------------------------------------------------------

export const SAMPLE_JSON: { label: string; json: string }[] = [
  {
    label: "Users array",
    json: JSON.stringify([
      { name: "Alice", age: 30, role: "admin" },
      { name: "Bob", age: 17, role: "user" },
      { name: "Carol", age: 25, role: "user" },
      { name: "Dave", age: 40, role: "admin" },
    ], null, 2),
  },
  {
    label: "API response",
    json: JSON.stringify({
      page: 1,
      per_page: 3,
      total: 12,
      data: [
        { id: 1, title: "First", tags: ["a", "b"] },
        { id: 2, title: "Second", tags: ["b", "c"] },
        { id: 3, title: "Third", tags: ["a"] },
      ],
    }, null, 2),
  },
  {
    label: "Nested object",
    json: JSON.stringify({
      store: {
        book: [
          { title: "X", price: 9.99, inStock: true },
          { title: "Y", price: 14.99, inStock: false },
          { title: "Z", price: 4.99, inStock: true },
        ],
        bike: { color: "red", price: 199.99 },
      },
    }, null, 2),
  },
  {
    label: "NDJSON lines",
    json: [
      '{"ts":"2024-01-01","level":"info","msg":"start"}',
      '{"ts":"2024-01-02","level":"error","msg":"crash"}',
      '{"ts":"2024-01-03","level":"info","msg":"restart"}',
    ].join("\n"),
  },
];

export interface Recipe {
  id: string;
  label: string;
  filter: string;
  description: string;
}

export const RECIPES: Recipe[] = [
  { id: "identity", label: "Identity (.)", filter: ".", description: "Return the input unchanged." },
  { id: "iterate", label: "Iterate array (.[])", filter: ".[]", description: "Yield each element of the input array." },
  { id: "field", label: "Field (.foo)", filter: ".foo", description: "Project the field foo from an object." },
  { id: "field-chain", label: "Field chain (.a.b.c)", filter: ".a.b.c", description: "Walk into nested fields." },
  { id: "select", label: "select(.age > 18)", filter: ".[] | select(.age > 18)", description: "Keep elements where the condition is true." },
  { id: "map", label: "map(.name)", filter: ".[] | map(.name)", description: "Apply the inner filter to each element of an array." },
  { id: "keys", label: "keys", filter: "keys", description: "Return the keys of an object as a sorted array." },
  { id: "values", label: "values", filter: "values", description: "Return the values of an object as an array." },
  { id: "length", label: "length", filter: "length", description: "Return the size/length of the input." },
  { id: "sort_by", label: "sort_by(.age)", filter: "sort_by(.age)", description: "Sort an array by the given field." },
  { id: "group_by", label: "group_by(.role)", filter: "group_by(.role)", description: "Group elements by the given field." },
  { id: "to_entries", label: "to_entries", filter: "to_entries", description: "Convert {k:v} into [{key:k, value:v}]." },
  { id: "from_entries", label: "from_entries", filter: "from_entries", description: "Convert [{key:k, value:v}] back into {k:v}." },
  { id: "unique", label: "unique", filter: "unique", description: "Remove duplicates from an array." },
  { id: "unique_by", label: "unique_by(.id)", filter: "unique_by(.id)", description: "Remove duplicates by a key." },
  { id: "add", label: "add", filter: "add", description: "Sum numbers, concat strings, or merge objects." },
  { id: "first", label: "first", filter: "first", description: "Return the first element of an array." },
  { id: "last", label: "last", filter: "last", description: "Return the last element of an array." },
  { id: "limit", label: "limit(2; .[])", filter: "limit(2; .[])", description: "Take the first N results of the inner filter." },
  { id: "has", label: "has(\"name\")", filter: "has(\"name\")", description: "True if the object has the given key." },
  { id: "contains", label: "contains({role:\"admin\"})", filter: ".[] | select(. | contains({role:\"admin\"}))", description: "True if the input contains the given sub-object." },
  { id: "del", label: "del(.password)", filter: "del(.password)", description: "Delete a key from each object." },
  { id: "interpolation", label: "\"Hello \\(.name)\"", filter: "\"Hello \\(.name)!\"", description: "String interpolation: embed filter results into a string." },
  { id: "recursive", label: "Recursive (..)", filter: ".. | numbers", description: "Recursive descent over all values." },
  { id: "array-ctor", label: "[.[] | .name]", filter: "[.[] | .name]", description: "Collect filter results into an array." },
  { id: "object-ctor", label: "{name, age}", filter: "{name, age}", description: "Build an object from selected fields." },
];

// ---------------------------------------------------------------------------
// Input parsing — JSON or NDJSON
// ---------------------------------------------------------------------------

export interface ParsedInput {
  values: Json[];
  error: string | null;
}

/** Parse the input text. With slurp=false, expects a single JSON value
 *  (with optional trailing whitespace). With slurp=true, parses each
 *  non-empty line as a separate JSON value. */
export function parseInput(text: string, slurp: boolean): ParsedInput {
  if (text == null || text === "") return { values: [], error: null };
  if (slurp) {
    const lines = text.split(/\r?\n/);
    const out: Json[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        out.push(JSON.parse(line) as Json);
      } catch (e) {
        return { values: [], error: `Line ${i + 1}: ${(e as Error).message}` };
      }
    }
    return { values: out, error: null };
  }
  // Non-slurp: try JSON.parse on the whole text.
  try {
    const v = JSON.parse(text) as Json;
    return { values: [v], error: null };
  } catch (e) {
    return { values: [], error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokKind =
  | "dot" | "dotdot" | "pipe" | "comma" | "lbracket" | "rbracket"
  | "lbrace" | "rbrace" | "lparen" | "rparen" | "colon" | "semicolon"
  | "question" | "alt" | "plus" | "minus" | "star" | "slash" | "percent"
  | "eq" | "neq" | "lt" | "gt" | "lte" | "gte" | "assign"
  | "update" | "number" | "string" | "ident" | "var" | "format"
  | "eof";

interface Token {
  kind: TokKind;
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  "and", "or", "not", "if", "then", "elif", "else", "end",
  "as", "def", "reduce", "foreach", "try", "catch",
  "import", "include", "label", "null", "true", "false",
  "module", "__loc__",
]);

const TWO_CHAR_OPS = new Map<string, TokKind>([
  ["//", "alt"], ["==", "eq"], ["!=", "neq"], ["<=", "lte"], [">=", "gte"],
  ["|=", "update"], ["?=", "question"],
]);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  const isIdentStart = (c: string) => /[a-zA-Z_]/.test(c);
  const isIdent = (c: string) => /[a-zA-Z0-9_]/.test(c);
  const isDigit = (c: string) => c >= "0" && c <= "9";

  while (i < n) {
    const c = src[i];

    // Whitespace
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    // Comments
    if (c === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    const pos = i;

    // Two-char operators
    const two = src.substring(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      out.push({ kind: TWO_CHAR_OPS.get(two)!, value: two, pos });
      i += 2; continue;
    }

    // Single-char operators
    switch (c) {
      case ".": {
        if (src[i + 1] === ".") {
          out.push({ kind: "dotdot", value: "..", pos });
          i += 2; continue;
        }
        out.push({ kind: "dot", value: ".", pos });
        i++; continue;
      }
      case "|": out.push({ kind: "pipe", value: "|", pos }); i++; continue;
      case ",": out.push({ kind: "comma", value: ",", pos }); i++; continue;
      case "[": out.push({ kind: "lbracket", value: "[", pos }); i++; continue;
      case "]": out.push({ kind: "rbracket", value: "]", pos }); i++; continue;
      case "{": out.push({ kind: "lbrace", value: "{", pos }); i++; continue;
      case "}": out.push({ kind: "rbrace", value: "}", pos }); i++; continue;
      case "(": out.push({ kind: "lparen", value: "(", pos }); i++; continue;
      case ")": out.push({ kind: "rparen", value: ")", pos }); i++; continue;
      case ":": out.push({ kind: "colon", value: ":", pos }); i++; continue;
      case ";": out.push({ kind: "semicolon", value: ";", pos }); i++; continue;
      case "?": out.push({ kind: "question", value: "?", pos }); i++; continue;
      case "+": out.push({ kind: "plus", value: "+", pos }); i++; continue;
      case "-": out.push({ kind: "minus", value: "-", pos }); i++; continue;
      case "*": out.push({ kind: "star", value: "*", pos }); i++; continue;
      case "/": out.push({ kind: "slash", value: "/", pos }); i++; continue;
      case "%": out.push({ kind: "percent", value: "%", pos }); i++; continue;
      case "<": out.push({ kind: "lt", value: "<", pos }); i++; continue;
      case ">": out.push({ kind: "gt", value: ">", pos }); i++; continue;
      case "=": out.push({ kind: "assign", value: "=", pos }); i++; continue;
    }

    // Numbers
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (j < n && isDigit(src[j])) j++;
      if (src[j] === ".") {
        j++;
        while (j < n && isDigit(src[j])) j++;
      }
      if (src[j] === "e" || src[j] === "E") {
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < n && isDigit(src[j])) j++;
      }
      out.push({ kind: "number", value: src.substring(i, j), pos });
      i = j; continue;
    }

    // Strings (double-quoted, with escapes + interpolation)
    if (c === '"') {
      const start = i;
      i++; // skip opening quote
      let str = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\") {
          const next = src[i + 1];
          if (next === undefined) throw new JqError("Unterminated string escape", pos);
          if (next === "(") {
            // Interpolation: collect until matching ')'.
            let depth = 1;
            i += 2; // skip \(
            let inner = "";
            while (i < n && depth > 0) {
              if (src[i] === "(") depth++;
              else if (src[i] === ")") {
                depth--;
                if (depth === 0) break;
              }
              inner += src[i];
              i++;
            }
            if (depth !== 0) throw new JqError("Unterminated interpolation", pos);
            i++; // skip ')'
            str += `\u0000${inner}\u0000`; // marker for interpolation
          } else if (next === "n") { str += "\n"; i += 2; }
          else if (next === "t") { str += "\t"; i += 2; }
          else if (next === "r") { str += "\r"; i += 2; }
          else if (next === "b") { str += "\b"; i += 2; }
          else if (next === "f") { str += "\f"; i += 2; }
          else if (next === "/") { str += "/"; i += 2; }
          else if (next === "\\") { str += "\\"; i += 2; }
          else if (next === '"') { str += '"'; i += 2; }
          else if (next === "u") {
            const hex = src.substring(i + 2, i + 6);
            str += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            str += next; i += 2;
          }
        } else {
          str += src[i];
          i++;
        }
      }
      if (i >= n) throw new JqError("Unterminated string", pos);
      i++; // skip closing quote
      out.push({ kind: "string", value: str, pos: start });
      continue;
    }

    // Variables: $name
    if (c === "$") {
      let j = i + 1;
      if (j < n && src[j] === "_") {
        // $_ — also valid
        j++;
      } else {
        while (j < n && isIdent(src[j])) j++;
      }
      if (j === i + 1) throw new JqError("Expected variable name after $", pos);
      out.push({ kind: "var", value: src.substring(i, j), pos });
      i = j; continue;
    }

    // Formats: @base64, @text, @json, etc.
    if (c === "@") {
      let j = i + 1;
      while (j < n && isIdent(src[j])) j++;
      out.push({ kind: "format", value: src.substring(i, j), pos });
      i = j; continue;
    }

    // Identifiers / keywords
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdent(src[j])) j++;
      const word = src.substring(i, j);
      if (KEYWORDS.has(word)) {
        out.push({ kind: "ident", value: word, pos });
      } else {
        out.push({ kind: "ident", value: word, pos });
      }
      i = j; continue;
    }

    throw new JqError(`Unexpected character "${c}"`, pos);
  }
  out.push({ kind: "eof", value: "", pos: n });
  return out;
}

class JqError extends Error {
  pos: number;
  constructor(message: string, pos: number = -1) {
    super(message);
    this.name = "JqError";
    this.pos = pos;
  }
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type Ast =
  | { t: "identity" }
  | { t: "recursive" }
  | { t: "literal"; value: Json }
  | { t: "field"; name: string; obj: Ast | null }
  | { t: "index"; index: Ast | null; obj: Ast | null }
  | { t: "slice"; from: Ast | null; to: Ast | null; obj: Ast | null }
  | { t: "iterate"; obj: Ast | null }
  | { t: "optional"; inner: Ast }
  | { t: "pipe"; left: Ast; right: Ast }
  | { t: "comma"; left: Ast; right: Ast }
  | { t: "alt"; left: Ast; right: Ast }
  | { t: "binop"; op: string; left: Ast; right: Ast }
  | { t: "and"; left: Ast; right: Ast }
  | { t: "or"; left: Ast; right: Ast }
  | { t: "compare"; op: string; left: Ast; right: Ast }
  | { t: "array"; inner: Ast | null }
  | { t: "object"; entries: { key: Ast; value: Ast }[] }
  | { t: "interpolation"; parts: (string | Ast)[] }
  | { t: "var"; name: string }
  | { t: "call"; name: string; args: Ast[] }
  | { t: "if"; cond: Ast; then: Ast; elifs: { cond: Ast; then: Ast }[]; else: Ast | null }
  | { t: "try"; body: Ast; catch: Ast | string | null }
  | { t: "reduce"; source: Ast; varName: string; init: Ast; update: Ast }
  | { t: "foreach"; source: Ast; varName: string; init: Ast; update: Ast; extract: Ast }
  | { t: "as"; source: Ast; varName: string; body: Ast }
  | { t: "neg"; operand: Ast }
  | { t: "format"; name: string }
  | { t: "label"; name: string; body: Ast };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private toks: Token[];
  private i = 0;
  constructor(src: string) {
    this.toks = tokenize(src);
  }
  private peek(): Token { return this.toks[this.i]; }
  private next(): Token { return this.toks[this.i++]; }
  private expect(kind: TokKind, what?: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new JqError(`Expected ${what ?? kind}, got "${t.value || t.kind}"`, t.pos);
    }
    return this.next();
  }
  private eat(kind: TokKind): boolean {
    if (this.peek().kind === kind) { this.i++; return true; }
    return false;
  }

  parseProgram(): Ast {
    const node = this.parsePipe();
    if (this.peek().kind !== "eof") {
      throw new JqError(`Unexpected token "${this.peek().value}"`, this.peek().pos);
    }
    return node;
  }

  // Pipe: Comma ('|' Comma)*  — but `as $x | body` is special.
  private parsePipe(): Ast {
    let left = this.parseComma();
    // Check for `as $x | body` binding.
    if (this.peek().kind === "ident" && this.peek().value === "as") {
      const binding = this.parseAsBinding(left);
      if (binding) return binding;
    }
    while (this.peek().kind === "pipe") {
      this.next();
      let right = this.parseComma();
      if (this.peek().kind === "ident" && this.peek().value === "as") {
        const binding = this.parseAsBinding(right);
        if (binding) right = binding;
      }
      left = { t: "pipe", left, right };
    }
    return left;
  }

  private parseComma(): Ast {
    let left = this.parseAlt();
    while (this.peek().kind === "comma") {
      this.next();
      const right = this.parseAlt();
      left = { t: "comma", left, right };
    }
    return left;
  }

  private parseAlt(): Ast {
    let left = this.parseLogical();
    while (this.peek().kind === "alt") {
      this.next();
      const right = this.parseLogical();
      left = { t: "alt", left, right };
    }
    return left;
  }

  private parseLogical(): Ast {
    let left = this.parseComparison();
    while (this.peek().kind === "ident" && (this.peek().value === "and" || this.peek().value === "or")) {
      const op = this.next().value;
      const right = this.parseComparison();
      left = op === "and"
        ? { t: "and", left, right }
        : { t: "or", left, right };
    }
    return left;
  }

  private parseComparison(): Ast {
    const left = this.parseArith();
    const t = this.peek();
    const ops: Record<string, string> = {
      eq: "==", neq: "!=", lt: "<", gt: ">", lte: "<=", gte: ">=",
    };
    if (t.kind in ops) {
      this.next();
      const right = this.parseArith();
      return { t: "compare", op: ops[t.kind], left, right };
    }
    if (t.kind === "ident" && t.value === "not") {
      // `not` is a postfix-style function call in jq — handled as call. Skip here.
    }
    return left;
  }

  private parseArith(): Ast {
    let left = this.parseUnary();
    const ops: Record<string, string> = {
      plus: "+", minus: "-", star: "*", slash: "/", percent: "%",
    };
    while (this.peek().kind in ops) {
      const op = ops[this.next().kind];
      const right = this.parseUnary();
      left = { t: "binop", op, left, right };
    }
    return left;
  }

  private parseUnary(): Ast {
    const t = this.peek();
    if (t.kind === "minus") {
      this.next();
      return { t: "neg", operand: this.parseUnary() };
    }
    if (t.kind === "plus") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Ast {
    let node = this.parsePrimary();
    // Postfix: ?  (optional), .field, [expr], [expr:expr], []
    while (true) {
      const t = this.peek();
      if (t.kind === "question") {
        this.next();
        node = { t: "optional", inner: node };
      } else if (t.kind === "dot") {
        // .field after a primary (e.g. .foo.bar, .[0].x)
        // lookahead: .ident  OR  .[ ... ]
        const next = this.toks[this.i + 1];
        if (next && next.kind === "ident") {
          this.next(); // dot
          const name = this.next().value;
          node = { t: "field", name, obj: node };
        } else if (next && next.kind === "string") {
          this.next(); // dot
          const name = this.next().value;
          node = { t: "field", name, obj: node };
        } else {
          break;
        }
      } else if (t.kind === "lbracket") {
        // [expr], [expr:expr], [:expr], [expr:], []
        this.next();
        if (this.peek().kind === "rbracket") {
          this.next();
          node = { t: "iterate", obj: node };
        } else if (this.peek().kind === "colon") {
          // [:expr] — slice from start.
          this.next();
          let to: Ast | null = null;
          if (this.peek().kind !== "rbracket") to = this.parsePipe();
          this.expect("rbracket", "]");
          node = { t: "slice", from: null, to, obj: node };
        } else {
          const first = this.parsePipe();
          if (this.peek().kind === "colon") {
            this.next();
            let to: Ast | null = null;
            if (this.peek().kind !== "rbracket") to = this.parsePipe();
            this.expect("rbracket", "]");
            node = { t: "slice", from: first, to, obj: node };
          } else {
            this.expect("rbracket", "]");
            node = { t: "index", index: first, obj: node };
          }
        }
      } else {
        break;
      }
    }
    return node;
  }

  private parsePrimary(): Ast {
    const t = this.peek();

    // `.`  identity or `.field` or `.[...]`
    if (t.kind === "dot") {
      this.next();
      const next = this.peek();
      if (next.kind === "ident") {
        const name = this.next().value;
        return { t: "field", name, obj: null };
      }
      if (next.kind === "string") {
        const name = this.next().value;
        return { t: "field", name, obj: null };
      }
      if (next.kind === "lbracket") {
        // handled by postfix loop above — re-enter by returning identity
        return { t: "identity" };
      }
      return { t: "identity" };
    }
    if (t.kind === "dotdot") {
      this.next();
      return { t: "recursive" };
    }
    if (t.kind === "number") {
      this.next();
      const num = Number(t.value);
      return { t: "literal", value: num };
    }
    if (t.kind === "string") {
      this.next();
      return this.buildString(t.value);
    }
    if (t.kind === "var") {
      this.next();
      return { t: "var", name: t.value };
    }
    if (t.kind === "format") {
      this.next();
      return { t: "format", name: t.value };
    }
    if (t.kind === "lparen") {
      this.next();
      const inner = this.parsePipe();
      this.expect("rparen", ")");
      return inner;
    }
    if (t.kind === "lbracket") {
      this.next();
      if (this.peek().kind === "rbracket") {
        this.next();
        return { t: "array", inner: null };
      }
      const inner = this.parsePipe();
      this.expect("rbracket", "]");
      return { t: "array", inner };
    }
    if (t.kind === "lbrace") {
      return this.parseObject();
    }
    if (t.kind === "ident") {
      return this.parseIdent();
    }
    throw new JqError(`Unexpected token "${t.value || t.kind}"`, t.pos);
  }

  private parseIdent(): Ast {
    const t = this.next();
    const name = t.value;
    if (name === "true") return { t: "literal", value: true };
    if (name === "false") return { t: "literal", value: false };
    if (name === "null") return { t: "literal", value: null };
    if (name === "if") return this.parseIf();
    if (name === "try") return this.parseTry();
    if (name === "reduce") return this.parseReduce();
    if (name === "foreach") return this.parseForeach();
    if (name === "def") throw new JqError("def is not supported in this subset", t.pos);
    if (name === "import" || name === "include" || name === "module") {
      throw new JqError(`${name} is not supported in this subset`, t.pos);
    }
    if (name === "label") {
      this.expect("lparen", "(");
      const varTok = this.expect("var", "$label");
      this.expect("rparen", ")");
      const body = this.parsePipe();
      return { t: "label", name: varTok.value, body };
    }
    if (name === "and" || name === "or" || name === "not" || name === "as") {
      throw new JqError(`"${name}" used in unexpected position`, t.pos);
    }
    // Function call: name, name(args), name(arg; arg; ...)
    if (this.peek().kind === "lparen") {
      this.next();
      const args: Ast[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.parsePipe());
        while (this.peek().kind === "semicolon") {
          this.next();
          args.push(this.parsePipe());
        }
      }
      this.expect("rparen", ")");
      return { t: "call", name, args };
    }
    return { t: "call", name, args: [] };
  }

  private parseIf(): Ast {
    const cond = this.parsePipe();
    this.expect("ident", "then"); // 'then'
    const then = this.parsePipe();
    const elifs: { cond: Ast; then: Ast }[] = [];
    let elseBranch: Ast | null = null;
    while (this.peek().kind === "ident" && this.peek().value === "elif") {
      this.next();
      const eCond = this.parsePipe();
      this.expect("ident", "then");
      const eThen = this.parsePipe();
      elifs.push({ cond: eCond, then: eThen });
    }
    if (this.peek().kind === "ident" && this.peek().value === "else") {
      this.next();
      elseBranch = this.parsePipe();
    }
    this.expect("ident", "end");
    return { t: "if", cond, then, elifs, else: elseBranch };
  }

  private parseTry(): Ast {
    const body = this.parsePostfix();
    let catcher: Ast | string | null = null;
    if (this.peek().kind === "ident" && this.peek().value === "catch") {
      this.next();
      const next = this.peek();
      if (next.kind === "string") {
        catcher = this.next().value;
      } else {
        catcher = this.parsePostfix();
      }
    }
    return { t: "try", body, catch: catcher };
  }

  private parseReduce(): Ast {
    const source = this.parsePostfix();
    this.expect("ident", "as");
    const varTok = this.expect("var", "$var");
    this.expect("lparen", "(");
    const init = this.parsePipe();
    this.expect("semicolon", ";");
    const update = this.parsePipe();
    this.expect("rparen", ")");
    return { t: "reduce", source, varName: varTok.value, init, update };
  }

  private parseForeach(): Ast {
    const source = this.parsePostfix();
    this.expect("ident", "as");
    const varTok = this.expect("var", "$var");
    this.expect("lparen", "(");
    const init = this.parsePipe();
    this.expect("semicolon", ";");
    const update = this.parsePipe();
    let extract: Ast = { t: "identity" };
    if (this.peek().kind === "semicolon") {
      this.next();
      extract = this.parsePipe();
    }
    this.expect("rparen", ")");
    return { t: "foreach", source, varName: varTok.value, init, update, extract };
  }

  private parseObject(): Ast {
    this.expect("lbrace", "{");
    const entries: { key: Ast; value: Ast }[] = [];
    while (this.peek().kind !== "rbrace") {
      let key: Ast;
      let value: Ast | null = null;
      const t = this.peek();
      if (t.kind === "ident" && !KEYWORDS.has(t.value)) {
        this.next();
        key = { t: "literal", value: t.value };
        // Identifier shorthand: {foo} means {foo: .foo}
        if (this.peek().kind === "colon") {
          this.next();
          value = this.parseObjValue();
        } else {
          value = { t: "field", name: t.value, obj: null };
        }
      } else if (t.kind === "string") {
        this.next();
        const parts = this.buildString(t.value);
        key = parts;
        this.expect("colon", ":");
        value = this.parseObjValue();
      } else if (t.kind === "var") {
        this.next();
        // {($x): value} — keyword key
        key = { t: "var", name: t.value };
        this.expect("colon", ":");
        value = this.parseObjValue();
      } else if (t.kind === "lparen") {
        this.next();
        key = this.parsePipe();
        this.expect("rparen", ")");
        this.expect("colon", ":");
        value = this.parseObjValue();
      } else {
        throw new JqError(`Expected object key, got "${t.value || t.kind}"`, t.pos);
      }
      entries.push({ key, value: value! });
      if (this.peek().kind === "comma") this.next();
      else break;
    }
    this.expect("rbrace", "}");
    return { t: "object", entries };
  }

  private parseObjValue(): Ast {
    return this.parseAlt();
  }

  /** Convert a string token value (with `\u0000...\u0000` interpolation
   *  markers) into an interpolation AST. */
  private buildString(raw: string): Ast {
    if (raw.indexOf("\u0000") === -1) {
      return { t: "literal", value: raw };
    }
    const parts: (string | Ast)[] = [];
    let i = 0;
    let cur = "";
    while (i < raw.length) {
      if (raw[i] === "\u0000") {
        if (cur) { parts.push(cur); cur = ""; }
        i++;
        let inner = "";
        while (i < raw.length && raw[i] !== "\u0000") {
          inner += raw[i];
          i++;
        }
        i++; // skip closing \u0000
        const sub = new Parser(inner);
        parts.push(sub.parsePipe());
      } else {
        cur += raw[i];
        i++;
      }
    }
    if (cur) parts.push(cur);
    return { t: "interpolation", parts };
  }

  /** Special: `exp as $x | body` — handled at the pipe level. We expose
   *  this method so parsePipe can detect the `as` keyword. */
  parseAsBinding(source: Ast): Ast | null {
    if (this.peek().kind !== "ident" || this.peek().value !== "as") return null;
    this.next();
    const varTok = this.expect("var", "$var");
    this.expect("pipe", "|");
    const body = this.parsePipe();
    return { t: "as", source, varName: varTok.value, body };
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export interface EvalEnv {
  vars: Map<string, Json>;
}

export function evalAst(ast: Ast, input: Json, env: EvalEnv): Json[] {
  switch (ast.t) {
    case "identity":
      return [input];
    case "recursive": {
      const out: Json[] = [];
      const walk = (v: Json) => {
        out.push(v);
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          for (const k of Object.keys(v as object)) walk((v as Record<string, Json>)[k]);
        }
      };
      walk(input);
      return out;
    }
    case "literal":
      return [ast.value];
    case "field": {
      const obj = ast.obj ? evalAst(ast.obj, input, env) : [input];
      const out: Json[] = [];
      for (const o of obj) {
        if (o === null) out.push(null);
        else if (typeof o === "object" && !Array.isArray(o)) {
          out.push((o as Record<string, Json>)[ast.name] ?? null);
        } else {
          throw new JqError(`Cannot index ${typeName(o)} with "${ast.name}"`);
        }
      }
      return out;
    }
    case "index": {
      const obj = ast.obj ? evalAst(ast.obj, input, env) : [input];
      const out: Json[] = [];
      for (const o of obj) {
        const idxVals = ast.index ? evalAst(ast.index, input, env) : [null];
        for (const idx of idxVals) {
          if (Array.isArray(o)) {
            if (typeof idx !== "number" || !Number.isInteger(idx)) {
              throw new JqError(`Array index must be an integer, got ${typeName(idx)}`);
            }
            const i = idx < 0 ? o.length + idx : idx;
            out.push(i >= 0 && i < o.length ? o[i] : null);
          } else if (typeof o === "object" && o !== null) {
            if (typeof idx !== "string") {
              throw new JqError(`Object index must be a string, got ${typeName(idx)}`);
            }
            out.push((o as Record<string, Json>)[idx] ?? null);
          } else if (o === null) {
            out.push(null);
          } else {
            throw new JqError(`Cannot index ${typeName(o)}`);
          }
        }
      }
      return out;
    }
    case "slice": {
      const obj = ast.obj ? evalAst(ast.obj, input, env) : [input];
      const fromVals = ast.from ? evalAst(ast.from, input, env) : [0];
      const toVals = ast.to ? evalAst(ast.to, input, env) : [null];
      const out: Json[] = [];
      for (const o of obj) {
        const from = fromVals[0] as number;
        const to = toVals[0] as number | null;
        if (Array.isArray(o)) {
          const end = to === null ? o.length : to;
          out.push(o.slice(from < 0 ? o.length + from : from, end < 0 ? o.length + end : end));
        } else if (typeof o === "string") {
          const end = to === null ? o.length : to;
          out.push(o.substring(from < 0 ? o.length + from : from, end < 0 ? o.length + end : end));
        } else {
          throw new JqError(`Cannot slice ${typeName(o)}`);
        }
      }
      return out;
    }
    case "iterate": {
      const obj = ast.obj ? evalAst(ast.obj, input, env) : [input];
      const out: Json[] = [];
      for (const o of obj) {
        if (Array.isArray(o)) out.push(...o);
        else if (o !== null && typeof o === "object") {
          out.push(...Object.values(o as Record<string, Json>));
        } else if (o === null) {
          throw new JqError("Cannot iterate over null (null)");
        } else {
          throw new JqError(`Cannot iterate over ${typeName(o)}`);
        }
      }
      return out;
    }
    case "optional": {
      try {
        return evalAst(ast.inner, input, env);
      } catch {
        return [];
      }
    }
    case "pipe": {
      const left = evalAst(ast.left, input, env);
      const out: Json[] = [];
      for (const v of left) {
        out.push(...evalAst(ast.right, v, env));
      }
      return out;
    }
    case "comma": {
      return [...evalAst(ast.left, input, env), ...evalAst(ast.right, input, env)];
    }
    case "alt": {
      const left = evalAst(ast.left, input, env);
      const filtered = left.filter((v) => v !== null && v !== false);
      if (filtered.length > 0) return filtered;
      return evalAst(ast.right, input, env);
    }
    case "neg": {
      const vals = evalAst(ast.operand, input, env);
      return vals.map((v) => {
        if (typeof v !== "number") throw new JqError(`${typeName(v)} cannot be negated`);
        return -v;
      });
    }
    case "binop": {
      const left = evalAst(ast.left, input, env);
      const right = evalAst(ast.right, input, env);
      const out: Json[] = [];
      for (const l of left) {
        for (const r of right) {
          out.push(applyBinop(ast.op, l, r));
        }
      }
      return out;
    }
    case "compare": {
      const left = evalAst(ast.left, input, env);
      const right = evalAst(ast.right, input, env);
      const out: Json[] = [];
      for (const l of left) {
        for (const r of right) {
          out.push(compareValues(ast.op, l, r));
        }
      }
      return out;
    }
    case "and": {
      const left = evalAst(ast.left, input, env);
      const out: Json[] = [];
      for (const l of left) {
        if (!truthy(l)) { out.push(false); continue; }
        const right = evalAst(ast.right, input, env);
        for (const r of right) out.push(truthy(r));
      }
      return out;
    }
    case "or": {
      const left = evalAst(ast.left, input, env);
      const out: Json[] = [];
      for (const l of left) {
        if (truthy(l)) { out.push(true); continue; }
        const right = evalAst(ast.right, input, env);
        for (const r of right) out.push(truthy(r));
      }
      return out;
    }
    case "array": {
      if (ast.inner === null) return [[]];
      const vals = evalAst(ast.inner, input, env);
      return [vals];
    }
    case "object": {
      // Recursively collect all combinations of key/value pairs.
      let combos: { key: string; value: Json }[][] = [[]];
      for (const entry of ast.entries) {
        const keys = evalAst(entry.key, input, env);
        const values = evalAst(entry.value, input, env);
        const next: { key: string; value: Json }[][] = [];
        for (const combo of combos) {
          for (const k of keys) {
            if (typeof k !== "string") {
              throw new JqError(`Object key must be a string, got ${typeName(k)}`);
            }
            for (const v of values) {
              next.push([...combo, { key: k, value: v }]);
            }
          }
        }
        combos = next;
      }
      return combos.map((combo) => {
        const obj: Record<string, Json> = {};
        for (const { key, value } of combo) obj[key] = value;
        return obj;
      });
    }
    case "interpolation": {
      let parts: string[] = [""];
      for (const part of ast.parts) {
        if (typeof part === "string") {
          parts = parts.map((p) => p + part);
        } else {
          const newParts: string[] = [];
          const vals = evalAst(part, input, env);
          for (const p of parts) {
            for (const v of vals) {
              newParts.push(p + stringify(v));
            }
          }
          parts = newParts;
        }
      }
      return parts;
    }
    case "var": {
      if (!env.vars.has(ast.name)) {
        throw new JqError(`Undefined variable ${ast.name}`);
      }
      return [env.vars.get(ast.name)!];
    }
    case "as": {
      const srcVals = evalAst(ast.source, input, env);
      const out: Json[] = [];
      for (const v of srcVals) {
        const subEnv: EvalEnv = { vars: new Map(env.vars) };
        subEnv.vars.set(ast.varName, v);
        out.push(...evalAst(ast.body, input, subEnv));
      }
      return out;
    }
    case "if": {
      const condVals = evalAst(ast.cond, input, env);
      const out: Json[] = [];
      for (const c of condVals) {
        if (truthy(c)) {
          out.push(...evalAst(ast.then, input, env));
        } else {
          let matched = false;
          for (const elif of ast.elifs) {
            const elifConds = evalAst(elif.cond, input, env);
            if (elifConds.some(truthy)) {
              out.push(...evalAst(elif.then, input, env));
              matched = true;
              break;
            }
          }
          if (!matched) {
            if (ast.else) out.push(...evalAst(ast.else, input, env));
          }
        }
      }
      return out;
    }
    case "try": {
      try {
        return evalAst(ast.body, input, env);
      } catch (e) {
        if (ast.catch === null) return [];
        if (typeof ast.catch === "string") return [ast.catch];
        return evalAst(ast.catch, (e as Error).message, env);
      }
    }
    case "reduce": {
      const srcVals = evalAst(ast.source, input, env);
      const initVals = evalAst(ast.init, input, env);
      if (initVals.length !== 1) {
        throw new JqError("reduce: init must produce exactly one value");
      }
      let acc = initVals[0];
      for (const v of srcVals) {
        const subEnv: EvalEnv = { vars: new Map(env.vars) };
        subEnv.vars.set(ast.varName, v);
        const upd = evalAst(ast.update, acc, subEnv);
        if (upd.length !== 1) {
          throw new JqError("reduce: update must produce exactly one value");
        }
        acc = upd[0];
      }
      return [acc];
    }
    case "foreach": {
      const srcVals = evalAst(ast.source, input, env);
      const initVals = evalAst(ast.init, input, env);
      if (initVals.length !== 1) {
        throw new JqError("foreach: init must produce exactly one value");
      }
      let acc = initVals[0];
      const out: Json[] = [];
      for (const v of srcVals) {
        const subEnv: EvalEnv = { vars: new Map(env.vars) };
        subEnv.vars.set(ast.varName, v);
        const upd = evalAst(ast.update, acc, subEnv);
        if (upd.length !== 1) {
          throw new JqError("foreach: update must produce exactly one value");
        }
        acc = upd[0];
        const ext = evalAst(ast.extract, acc, subEnv);
        out.push(...ext);
      }
      return out;
    }
    case "label": {
      try {
        return evalAst(ast.body, input, env);
      } catch (e) {
        if (e instanceof LabeledBreak && e.label === ast.name) return e.value;
        throw e;
      }
    }
    case "format": {
      return applyFormat(ast.name, input);
    }
    case "call": {
      return evalCall(ast.name, ast.args, input, env);
    }
    default: {
      // Exhaustiveness check — if Ast gets a new variant without a case
      // here, this line fails to compile.
      const _exhaustive: never = ast as never;
      return _exhaustive;
    }
  }
}

class LabeledBreak extends Error {
  label: string;
  value: Json[];
  constructor(label: string, value: Json[]) {
    super("break");
    this.label = label;
    this.value = value;
  }
}

function applyFormat(name: string, input: Json): Json[] {
  switch (name) {
    case "@text": return [stringify(input)];
    case "@json": return [JSON.stringify(input)];
    case "@base64": return [btoaSafe(stringify(input))];
    case "@base64d": return [atobSafe(typeof input === "string" ? input : stringify(input))];
    default:
      throw new JqError(`Unsupported format ${name}`);
  }
}

function btoaSafe(s: string): string {
  if (typeof btoa === "function") return btoa(s);
  // Node fallback
  return Buffer.from(s, "binary").toString("base64");
}
function atobSafe(s: string): string {
  if (typeof atob === "function") return atob(s);
  return Buffer.from(s, "base64").toString("binary");
}

function evalCall(name: string, args: Ast[], input: Json, env: EvalEnv): Json[] {
  // --- zero-arg builtins ---
  if (args.length === 0) {
    switch (name) {
      case "empty": return [];
      case "error":
        throw new JqError(typeof input === "string" ? input : stringify(input));
      case "not": return [!truthy(input)];
      case "length": return [lengthOf(input)];
      case "utf8bytelength": return [Buffer.byteLength(stringify(input), "utf8")];
      case "keys": return [keysOf(input, true)];
      case "keys_unsorted": return [keysOf(input, false)];
      case "values": return [valuesOf(input)];
      case "to_entries": return [toEntries(input)];
      case "from_entries": return [fromEntries(input)];
      case "add": return [addOf(input)];
      case "sort": return [sortOf(input, (a, b) => compareJson(a, b))];
      case "reverse":
        if (Array.isArray(input)) return [input.slice().reverse()];
        if (typeof input === "string") return [input.split("").reverse().join("")];
        throw new JqError(`${name} cannot be applied to ${typeName(input)}`);
      case "first":
        if (Array.isArray(input)) return input.length > 0 ? [input[0]] : [];
        throw new JqError("first requires an array");
      case "last":
        if (Array.isArray(input)) return input.length > 0 ? [input[input.length - 1]] : [];
        throw new JqError("last requires an array");
      case "unique": return [uniqueOf(input, (a) => a)];
      case "ascii": return [asciiOf(input)];
      case "tostring": return [stringify(input)];
      case "tonumber": return [toNumber(input)];
      case "ascii_downcase":
        return [typeof input === "string" ? input.toLowerCase() : input];
      case "ascii_upcase":
        return [typeof input === "string" ? input.toUpperCase() : input];
      case "type": return [typeName(input)];
      case "notnull": return [input !== null];
      case "isnan": return [typeof input === "number" && Number.isNaN(input)];
      case "isinfinite": return [typeof input === "number" && !Number.isFinite(input)];
      case "paths":
        return pathsOf(input, false);
      case "leaf_paths":
        return pathsOf(input, true);
      case "splits":
      case "ltrimstr":
      case "rtrimstr":
      case "getpath":
      case "path":
        // Some require args; fall through to error if zero.
        break;
      case "abs":
        if (typeof input === "number") return [Math.abs(input)];
        throw new JqError("abs requires a number");
      case "floor":
        if (typeof input === "number") return [Math.floor(input)];
        throw new JqError("floor requires a number");
      case "ceil":
        if (typeof input === "number") return [Math.ceil(input)];
        throw new JqError("ceil requires a number");
      case "round":
        if (typeof input === "number") return [Math.round(input)];
        throw new JqError("round requires a number");
      case "sqrt":
        if (typeof input === "number") return [Math.sqrt(input)];
        throw new JqError("sqrt requires a number");
      case "tojson": return [JSON.stringify(input)];
      case "fromjson":
        if (typeof input === "string") {
          try { return [JSON.parse(input) as Json]; }
          catch (e) { throw new JqError(`Invalid JSON: ${(e as Error).message}`); }
        }
        throw new JqError("fromjson requires a string");
      case "implode":
        if (typeof input === "number") return [String.fromCharCode(input)];
        if (Array.isArray(input)) return [input.map((n) => String.fromCharCode(n as number)).join("")];
        throw new JqError("implode requires a number or array of numbers");
      case "explode":
        if (typeof input === "string") return [input.split("").map((c) => c.charCodeAt(0))];
        throw new JqError("explode requires a string");
      default:
        // fall through
        break;
    }
  }

  // --- one-arg builtins ---
  if (args.length === 1) {
    const arg = args[0];
    switch (name) {
      case "select": {
        const condVals = evalAst(arg, input, env);
        if (condVals.some(truthy)) return [input];
        return [];
      }
      case "map": {
        if (!Array.isArray(input)) throw new JqError("map requires an array");
        const out: Json[] = [];
        for (const v of input) out.push(...evalAst(arg, v, env));
        return [out];
      }
      case "map_values": {
        if (Array.isArray(input)) {
          const out: Json[] = [];
          for (const v of input) out.push(...evalAst(arg, v, env));
          return [out];
        }
        if (input !== null && typeof input === "object") {
          const obj: Record<string, Json> = {};
          for (const [k, v] of Object.entries(input as Record<string, Json>)) {
            const vs = evalAst(arg, v, env);
            if (vs.length > 0) obj[k] = vs[0];
          }
          return [obj];
        }
        throw new JqError("map_values requires an array or object");
      }
      case "sort_by": {
        if (!Array.isArray(input)) throw new JqError("sort_by requires an array");
        const keyed = input.map((v) => {
          const ks = evalAst(arg, v, env);
          return { v, k: ks[0] };
        });
        keyed.sort((a, b) => compareJson(a.k, b.k));
        return [keyed.map((x) => x.v)];
      }
      case "group_by": {
        if (!Array.isArray(input)) throw new JqError("group_by requires an array");
        const keyed = input.map((v) => {
          const ks = evalAst(arg, v, env);
          return { v, k: ks[0] };
        });
        keyed.sort((a, b) => compareJson(a.k, b.k));
        const groups: Json[][] = [];
        let curKey: Json | "__none__" = "__none__";
        for (const x of keyed) {
          if (curKey === "__none__" || compareJson(x.k, curKey) !== 0) {
            groups.push([x.v]);
            curKey = x.k;
          } else {
            groups[groups.length - 1].push(x.v);
          }
        }
        return [groups];
      }
      case "unique_by": {
        if (!Array.isArray(input)) throw new JqError("unique_by requires an array");
        const seen: string[] = [];
        const out: Json[] = [];
        for (const v of input) {
          const ks = evalAst(arg, v, env);
          const key = JSON.stringify(ks[0]);
          if (!seen.includes(key)) {
            seen.push(key);
            out.push(v);
          }
        }
        return [out];
      }
      case "has": {
        const argVals = evalAst(arg, input, env);
        const k = argVals[0];
        if (Array.isArray(input) && typeof k === "number") {
          return [k >= 0 && k < input.length];
        }
        if (input !== null && typeof input === "object" && typeof k === "string") {
          return [Object.prototype.hasOwnProperty.call(input, k)];
        }
        throw new JqError("has: type mismatch");
      }
      case "in": {
        const argVals = evalAst(arg, input, env);
        const arr = argVals[0];
        if (!Array.isArray(arr)) throw new JqError("in requires an array");
        return [arr.some((v) => compareJson(v, input) === 0)];
      }
      case "contains": {
        const argVals = evalAst(arg, input, env);
        return [containsOf(input, argVals[0])];
      }
      case "inside": {
        const argVals = evalAst(arg, input, env);
        return [containsOf(argVals[0], input)];
      }
      case "del": {
        return [delPath(input, arg)];
      }
      case "getpath": {
        const argVals = evalAst(arg, input, env);
        const path = argVals[0];
        if (!Array.isArray(path)) throw new JqError("getpath requires an array path");
        return [getPath(input, path as (string | number)[])];
      }
      case "path": {
        // Best-effort: only supports simple field/index paths.
        return [pathOf(arg, input)];
      }
      case "paths": {
        const argVals = evalAst(arg, input, env);
        // Filter paths by predicate (best-effort).
        const all = pathsOf(input, false);
        const out: Json[] = [];
        for (const p of all) {
          if (evalAst(arg, p, env).some(truthy)) out.push(p);
        }
        return out;
      }
      case "limit": {
        // limit(n; f) is two args — handle below. If only one, error.
        throw new JqError("limit requires 2 arguments");
      }
      case "first": {
        const vals = evalAst(arg, input, env);
        return vals.length > 0 ? [vals[0]] : [];
      }
      case "last": {
        const vals = evalAst(arg, input, env);
        return vals.length > 0 ? [vals[vals.length - 1]] : [];
      }
      case "any":
      case "all": {
        if (!Array.isArray(input)) throw new JqError(`${name} requires an array`);
        const results = input.map((v) => evalAst(arg, v, env).some(truthy));
        return [name === "any" ? results.some(Boolean) : results.every(Boolean)];
      }
      case "range": {
        const argVals = evalAst(arg, input, env);
        const n = argVals[0];
        if (typeof n !== "number") throw new JqError("range requires a number");
        const out: number[] = [];
        for (let i = 0; i < n; i++) out.push(i);
        return [out];
      }
      default:
        // fall through
        break;
    }
  }

  // --- two-arg builtins ---
  if (args.length === 2 && name === "limit") {
    const nVals = evalAst(args[0], input, env);
    if (nVals.length !== 1 || typeof nVals[0] !== "number") {
      throw new JqError("limit: first arg must be a single number");
    }
    const n = nVals[0];
    const vals = evalAst(args[1], input, env);
    return vals.slice(0, Math.max(0, n));
  }
  if (args.length === 2 && (name === "split" || name === "join" || name === "test" || name === "ltrimstr" || name === "rtrimstr" || name === "startswith" || name === "endswith")) {
    const a = evalAst(args[0], input, env)[0];
    const b = evalAst(args[1], input, env)[0];
    if (name === "split") {
      if (typeof input !== "string") throw new JqError("split requires a string input");
      // Two-arg split is the regex form; we don't support regex.
      throw new JqError("split(pattern; flags) regex form is not supported");
    }
    if (name === "join") {
      if (!Array.isArray(input)) throw new JqError("join requires an array input");
      return [(input as Json[]).map((x) => stringify(x)).join(typeof b === "string" ? b : "")];
    }
  }

  // One-arg string/number helpers handled inline above; anything else is unknown.
  throw new JqError(`Unknown function or arity: ${name}/${args.length}`);
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function truthy(v: Json): boolean {
  return v !== false && v !== null;
}

function typeName(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return "array";
  return "object";
}

function lengthOf(v: Json): number {
  if (v === null) return 0;
  if (typeof v === "string") return v.length;
  if (Array.isArray(v)) return v.length;
  if (typeof v === "object") return Object.keys(v as object).length;
  if (typeof v === "number") return Math.abs(v);
  throw new JqError(`${typeName(v)} has no length`);
}

function keysOf(v: Json, sort: boolean): string[] {
  if (v === null) return [];
  if (typeof v !== "object" || Array.isArray(v)) {
    if (Array.isArray(v)) {
      const out = v.map((_, i) => String(i));
      return out;
    }
    throw new JqError(`${typeName(v)} has no keys`);
  }
  const keys = Object.keys(v as object);
  return sort ? keys.sort() : keys;
}

function valuesOf(v: Json): Json[] {
  if (v === null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return Object.values(v as Record<string, Json>);
  throw new JqError(`${typeName(v)} has no values`);
}

function toEntries(v: Json): Json[] {
  if (v === null) return [];
  if (Array.isArray(v)) {
    return v.map((x, i) => ({ key: i, value: x }));
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, Json>).map(([k, val]) => ({ key: k, value: val }));
  }
  throw new JqError(`to_entries requires an object or array, got ${typeName(v)}`);
}

function fromEntries(v: Json): Json {
  if (!Array.isArray(v)) throw new JqError("from_entries requires an array");
  const obj: Record<string, Json> = {};
  for (const e of v as Json[]) {
    if (e === null || typeof e !== "object") {
      throw new JqError("from_entries: each entry must be an object");
    }
    const eo = e as Record<string, Json>;
    let key: string | undefined;
    if ("key" in eo) key = String(eo.key);
    else if ("k" in eo) key = String(eo.k);
    else if ("name" in eo) key = String(eo.name);
    if (key === undefined) throw new JqError("from_entries: entry missing key/k/name");
    const value = "value" in eo ? eo.value : ("v" in eo ? eo.v : null);
    obj[key] = value;
  }
  return obj;
}

function addOf(v: Json): Json {
  if (v === null) return null;
  if (!Array.isArray(v)) throw new JqError("add requires an array");
  if (v.length === 0) return null;
  let acc: Json = v[0];
  for (let i = 1; i < v.length; i++) {
    acc = applyBinop("+", acc, v[i]);
  }
  return acc;
}

function sortOf(v: Json, cmp: (a: Json, b: Json) => number): Json[] {
  if (!Array.isArray(v)) throw new JqError("sort requires an array");
  return (v as Json[]).slice().sort(cmp);
}

function uniqueOf(v: Json, keyFn: (a: Json) => Json): Json[] {
  if (!Array.isArray(v)) throw new JqError("unique requires an array");
  const seen = new Set<string>();
  const out: Json[] = [];
  for (const x of v as Json[]) {
    const k = JSON.stringify(keyFn(x));
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function containsOf(a: Json, b: Json): boolean {
  if (a === null && b === null) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "string") return (a as string).includes(b as string);
  if (typeof a === "number") return a === b;
  if (typeof a === "boolean") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.every((x) => (a as Json[]).some((y) => containsOf(y, x)));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, Json>;
    const bo = b as Record<string, Json>;
    return Object.keys(bo).every((k) => k in ao && containsOf(ao[k], bo[k]));
  }
  return false;
}

function applyBinop(op: string, l: Json, r: Json): Json {
  switch (op) {
    case "+":
      if (l === null) return r;
      if (r === null) return l;
      if (typeof l === "number" && typeof r === "number") return l + r;
      if (typeof l === "string" && typeof r === "string") return l + r;
      if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
      if (l !== null && r !== null && typeof l === "object" && typeof r === "object"
          && !Array.isArray(l) && !Array.isArray(r)) {
        return { ...(l as object), ...(r as object) } as Json;
      }
      throw new JqError(`${typeName(l)} and ${typeName(r)} cannot be added`);
    case "-":
      if (typeof l === "number" && typeof r === "number") return l - r;
      if (Array.isArray(l) && Array.isArray(r)) {
        return l.filter((x) => !r.some((y) => compareJson(x, y) === 0));
      }
      throw new JqError(`${typeName(l)} and ${typeName(r)} cannot be subtracted`);
    case "*":
      if (typeof l === "number" && typeof r === "number") return l * r;
      if (typeof l === "string" && typeof r === "number") return l.repeat(r);
      throw new JqError(`${typeName(l)} and ${typeName(r)} cannot be multiplied`);
    case "/":
      if (typeof l === "number" && typeof r === "number") {
        if (r === 0) throw new JqError("Division by zero");
        return l / r;
      }
      if (typeof l === "string" && typeof r === "string") return l.split(r);
      throw new JqError(`${typeName(l)} and ${typeName(r)} cannot be divided`);
    case "%":
      if (typeof l === "number" && typeof r === "number") {
        if (r === 0) throw new JqError("Modulo by zero");
        return l % r;
      }
      throw new JqError(`${typeName(l)} and ${typeName(r)} cannot be modulo'd`);
    default:
      throw new JqError(`Unknown operator ${op}`);
  }
}

function compareValues(op: string, l: Json, r: Json): boolean {
  const c = compareJson(l, r);
  switch (op) {
    case "==": return c === 0;
    case "!=": return c !== 0;
    case "<": return c < 0;
    case ">": return c > 0;
    case "<=": return c <= 0;
    case ">=": return c >= 0;
    default: throw new JqError(`Unknown comparison ${op}`);
  }
}

/** jq ordering: null < false < true < numbers < strings < arrays < objects. */
export function compareJson(a: Json, b: Json): number {
  const order = (v: Json): number => {
    if (v === null) return 0;
    if (typeof v === "boolean") return v ? 2 : 1;
    if (typeof v === "number") return 3;
    if (typeof v === "string") return 4;
    if (Array.isArray(v)) return 5;
    return 6;
  };
  const oa = order(a), ob = order(b);
  if (oa !== ob) return oa - ob;
  if (oa === 0) return 0;
  if (oa === 1 || oa === 2) return 0;
  if (oa === 3) return (a as number) - (b as number);
  if (oa === 4) {
    const sa = a as string, sb = b as string;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  if (oa === 5) {
    const aa = a as Json[], ab = b as Json[];
    const len = Math.min(aa.length, ab.length);
    for (let i = 0; i < len; i++) {
      const c = compareJson(aa[i], ab[i]);
      if (c !== 0) return c;
    }
    return aa.length - ab.length;
  }
  // objects: compare by sorted keys, then values.
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
    const c = compareJson((a as Record<string, Json>)[ka[i]], (b as Record<string, Json>)[kb[i]]);
    if (c !== 0) return c;
  }
  return ka.length - kb.length;
}

function asciiOf(v: Json): number {
  if (typeof v === "string" && v.length === 1) return v.charCodeAt(0);
  throw new JqError("ascii requires a single-character string");
}

function toNumber(v: Json): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isNaN(n)) throw new JqError(`Cannot parse "${v}" as a number`);
    return n;
  }
  throw new JqError(`${typeName(v)} cannot be converted to a number`);
}

function pathsOf(v: Json, leafOnly: boolean): Json[] {
  const out: Json[] = [];
  const walk = (val: Json, path: (string | number)[]) => {
    if (Array.isArray(val)) {
      if (!leafOnly && path.length > 0) out.push(path);
      val.forEach((x, i) => walk(x, [...path, i]));
    } else if (val !== null && typeof val === "object") {
      if (!leafOnly && path.length > 0) out.push(path);
      for (const [k, x] of Object.entries(val as Record<string, Json>)) walk(x, [...path, k]);
    } else {
      if (path.length > 0) out.push(path);
    }
  };
  walk(v, []);
  return out;
}

function getPath(v: Json, path: (string | number)[]): Json {
  let cur: Json = v;
  for (const p of path) {
    if (cur === null) return null;
    if (Array.isArray(cur) && typeof p === "number") {
      cur = cur[p];
    } else if (cur !== null && typeof cur === "object" && typeof p === "string") {
      cur = (cur as Record<string, Json>)[p] ?? null;
    } else {
      return null;
    }
  }
  return cur;
}

function delPath(v: Json, pathAst: Ast): Json {
  // Best-effort: only handles single field/index paths.
  if (pathAst.t === "field" && v !== null && typeof v === "object" && !Array.isArray(v)) {
    const obj = { ...(v as Record<string, Json>) };
    delete obj[pathAst.name];
    return obj;
  }
  if (pathAst.t === "index" && Array.isArray(v) && pathAst.index && pathAst.index.t === "literal") {
    const idx = (pathAst.index as { value: Json }).value;
    if (typeof idx === "number") {
      const out = (v as Json[]).slice();
      out.splice(idx, 1);
      return out;
    }
  }
  // For more complex paths, return unchanged.
  return v;
}

function pathOf(ast: Ast, input: Json): Json {
  // Only support identity, field, index for path-of.
  if (ast.t === "identity") return [];
  if (ast.t === "field" && ast.obj === null) return [ast.name];
  if (ast.t === "index" && ast.index && ast.index.t === "literal" && ast.obj === null) {
    return [(ast.index as { value: Json }).value as string | number];
  }
  throw new JqError("path: only simple paths are supported");
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/** Stringify a JSON value (used for string interpolation contexts). */
export function stringify(v: Json): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** Format the output values according to flags. */
export function formatOutput(values: Json[], flags: Flags): string {
  return values.map((v) => formatOne(v, flags)).join("\n");
}

function formatOne(v: Json, flags: Flags): string {
  if (flags.raw && typeof v === "string") return v;
  if (flags.sortKeys && v !== null && typeof v === "object" && !Array.isArray(v)) {
    v = sortKeysDeep(v);
  }
  if (flags.compact) return JSON.stringify(v);
  return JSON.stringify(v, null, 2);
}

function sortKeysDeep(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === "object") {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = sortKeysDeep((v as Record<string, Json>)[k]);
    }
    return out;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Top-level run
// ---------------------------------------------------------------------------

export function run(input: string, filter: string, flags: Flags): RunResult {
  const parsed = parseInput(input, flags.slurp);
  if (parsed.error) {
    return {
      results: [],
      error: null,
      steps: [],
      inputValid: false,
      inputError: parsed.error,
      inputCount: 0,
    };
  }
  if (parsed.values.length === 0) {
    return {
      results: [],
      error: null,
      steps: [],
      inputValid: true,
      inputError: null,
      inputCount: 0,
    };
  }
  // If slurp, the input to the filter is the array of values.
  const inputs = flags.slurp ? [parsed.values as Json] : parsed.values;
  let ast: Ast;
  try {
    ast = new Parser(filter || ".").parseProgram();
  } catch (e) {
    return {
      results: [],
      error: (e as Error).message,
      steps: [],
      inputValid: true,
      inputError: null,
      inputCount: parsed.values.length,
    };
  }
  const env: EvalEnv = { vars: new Map() };
  const allResults: Json[] = [];
  try {
    for (const inp of inputs) {
      allResults.push(...evalAst(ast, inp, env));
    }
  } catch (e) {
    return {
      results: allResults,
      error: (e as Error).message,
      steps: [],
      inputValid: true,
      inputError: null,
      inputCount: parsed.values.length,
    };
  }
  return {
    results: allResults,
    error: null,
    steps: [],
    inputValid: true,
    inputError: null,
    inputCount: parsed.values.length,
  };
}

// ---------------------------------------------------------------------------
// Filter builder
// ---------------------------------------------------------------------------

/** Render a single builder step to its jq filter fragment. */
export function renderStep(step: BuilderStep): string {
  switch (step.type) {
    case "identity": return ".";
    case "field": return step.field ? `.${step.field}` : ".";
    case "index": {
      if (step.indexEnd !== undefined) {
        return `.[${step.index ?? 0}:${step.indexEnd}]`;
      }
      return `.[${step.index ?? 0}]`;
    }
    case "iterate": return ".[]";
    case "select":
      return step.condition ? `select(${step.condition})` : "select(.)";
    case "map": return step.expr ? `map(${step.expr})` : "map(.)";
    case "map_values": return step.expr ? `map_values(${step.expr})` : "map_values(.)";
    case "sort": return "sort";
    case "sort_by": return step.field ? `sort_by(.${step.field})` : "sort";
    case "group_by": return step.field ? `group_by(.${step.field})` : "group_by(.)";
    case "keys": return "keys";
    case "values": return "values";
    case "length": return "length";
    case "to_entries": return "to_entries";
    case "from_entries": return "from_entries";
    case "add": return "add";
    case "first": return step.expr ? `first(${step.expr})` : "first";
    case "last": return step.expr ? `last(${step.expr})` : "last";
    case "limit": {
      const n = step.count ?? 1;
      const e = step.limitExpr ?? ".";
      return `limit(${n}; ${e})`;
    }
    case "unique": return "unique";
    case "unique_by": return step.field ? `unique_by(.${step.field})` : "unique";
    case "has": return step.field ? `has("${step.field}")` : 'has("")';
    case "contains": return step.value ? `contains(${step.value})` : "contains({})";
    case "del": return step.field ? `del(.${step.field})` : "del(.)";
    case "array_constructor": return `[${step.arrayExpr ?? "."}]`;
    case "reverse": return "reverse";
    default:
      return ".";
  }
}

/** Explain a single builder step in plain English. */
export function explainStep(step: BuilderStep): string {
  switch (step.type) {
    case "identity": return "Pass the input through unchanged.";
    case "field": return step.field ? `Project the ".${step.field}" field from the current object.` : "Pass the input through unchanged.";
    case "index":
      if (step.indexEnd !== undefined) {
        return `Slice elements from index ${step.index ?? 0} to ${step.indexEnd}.`;
      }
      return `Get the element at index ${step.index ?? 0} of the current array.`;
    case "iterate": return "Yield each element of the current array (or each value of the current object).";
    case "select": return step.condition
      ? `Keep only elements where "${step.condition}" is truthy.`
      : "Keep all elements (identity filter).";
    case "map": return step.expr
      ? `Apply "${step.expr}" to each element of the array, collect results.`
      : "Apply identity to each element of the array (no-op).";
    case "map_values": return step.expr
      ? `Apply "${step.expr}" to each value of the object/array.`
      : "Apply identity to each value.";
    case "sort": return "Sort the array using jq's default ordering.";
    case "sort_by": return step.field ? `Sort the array by the ".${step.field}" field.` : "Sort the array.";
    case "group_by": return step.field
      ? `Group array elements by the ".${step.field}" field, producing an array of groups.`
      : "Group array elements by identity.";
    case "keys": return "Return the keys of the current object as a sorted array.";
    case "values": return "Return the values of the current object/array as an array.";
    case "length": return "Return the length/size of the current value.";
    case "to_entries": return "Convert {k:v} into [{key:k, value:v}].";
    case "from_entries": return "Convert [{key:k, value:v}] back into {k:v}.";
    case "add": return "Sum numbers, concatenate strings, or merge objects in the array.";
    case "first": return step.expr ? `Return the first result of "${step.expr}".` : "Return the first element of the array.";
    case "last": return step.expr ? `Return the last result of "${step.expr}".` : "Return the last element of the array.";
    case "limit": return `Take the first ${step.count ?? 1} result(s) of "${step.limitExpr ?? "."}".`;
    case "unique": return "Remove duplicate values from the array.";
    case "unique_by": return step.field ? `Remove duplicates by the ".${step.field}" field.` : "Remove duplicates.";
    case "has": return step.field ? `True if the current object has a key named "${step.field}".` : 'True if the input has the empty-string key.';
    case "contains": return step.value ? `True if the current value contains ${step.value}.` : "True if the current value contains an empty object.";
    case "del": return step.field ? `Delete the ".${step.field}" field from each object.` : "Delete identity (no-op).";
    case "array_constructor": return `Collect the results of "${step.arrayExpr ?? "."}" into a single array.`;
    case "reverse": return "Reverse the current array (or string).";
    default:
      return "Apply this step.";
  }
}

/** Build the full filter string + explanations from a list of steps. */
export function buildFilter(steps: BuilderStep[]): { filter: string; explained: ExplainedStep[] } {
  if (steps.length === 0) return { filter: ".", explained: [] };
  const fragments: string[] = [];
  const explained: ExplainedStep[] = [];
  steps.forEach((step, i) => {
    const frag = renderStep(step);
    fragments.push(frag);
    explained.push({
      n: i + 1,
      fragment: frag,
      explanation: explainStep(step),
    });
  });
  return { filter: fragments.join(" | "), explained };
}

/** Step type labels for the UI. */
export const STEP_TYPE_LABELS: Record<BuilderStepType, string> = {
  identity: "Identity (.)",
  field: "Field (.foo)",
  index: "Index (.[n])",
  iterate: "Iterate (.[])",
  select: "select(cond)",
  map: "map(f)",
  map_values: "map_values(f)",
  sort: "sort",
  sort_by: "sort_by(.field)",
  group_by: "group_by(.field)",
  keys: "keys",
  values: "values",
  length: "length",
  to_entries: "to_entries",
  from_entries: "from_entries",
  add: "add",
  first: "first / first(f)",
  last: "last / last(f)",
  limit: "limit(n; f)",
  unique: "unique",
  unique_by: "unique_by(.field)",
  has: "has(\"key\")",
  contains: "contains(value)",
  del: "del(.field)",
  array_constructor: "[f]",
  reverse: "reverse",
};

// ---------------------------------------------------------------------------
// History (localStorage) — max 20
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:jq-playground-filter-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  filter: string;
  resultCount: number;
  inputBytes: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL — encode filter + input + flags in the hash
// ---------------------------------------------------------------------------

export function buildShareUrl(filter: string, input: string, flags: Flags): string {
  const params = new URLSearchParams();
  if (filter) params.set("f", filter);
  if (input) params.set("i", input);
  const flagBits = [
    flags.compact ? "c" : "",
    flags.raw ? "r" : "",
    flags.slurp ? "s" : "",
    flags.sortKeys ? "S" : "",
  ].filter(Boolean).join("");
  if (flagBits) params.set("x", flagBits);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { filter: string; input: string; flags: Flags } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { filter: "", input: "", flags: { ...DEFAULT_FLAGS } };
  const params = new URLSearchParams(clean);
  const filter = params.get("f") ?? "";
  const input = params.get("i") ?? "";
  const bits = params.get("x") ?? "";
  const flags: Flags = { ...DEFAULT_FLAGS };
  if (bits.includes("c")) flags.compact = true;
  if (bits.includes("r")) flags.raw = true;
  if (bits.includes("s")) flags.slurp = true;
  if (bits.includes("S")) flags.sortKeys = true;
  return { filter, input, flags };
}

// ---------------------------------------------------------------------------
// Error decoder — turn a jq error into plain-English hints
// ---------------------------------------------------------------------------

export function decodeError(message: string): { plain: string; hint: string } {
  if (/Cannot index (.+) with "/.test(message)) {
    return {
      plain: "Tried to access a field on a value that isn't an object.",
      hint: "Check that the upstream filter is producing an object, not an array or scalar. Use .[] first to iterate, or wrap with select(. != null).",
    };
  }
  if (/Cannot iterate over (null|null \(null\))/.test(message)) {
    return {
      plain: "Tried to iterate (.[]) over null.",
      hint: "Add a null guard: `select(. != null) | .[]` or use `.[]?` to silently skip nulls.",
    };
  }
  if (/Cannot iterate over/.test(message)) {
    return {
      plain: "Tried to iterate (.[]) over a non-iterable value.",
      hint: "Make sure the upstream value is an array or object. Use `length` to inspect, or wrap with `select(type == \"array\")`.",
    };
  }
  if (/has no length/.test(message)) {
    return {
      plain: "Called length on a value that has no length.",
      hint: "length works on strings, arrays, objects, and numbers (absolute value). Check the upstream type.",
    };
  }
  if (/requires an array/.test(message)) {
    return {
      plain: "A function expected an array input.",
      hint: "Use `[...]` to wrap results into an array, or check that the upstream isn't a single object.",
    };
  }
  if (/Undefined variable/.test(message)) {
    return {
      plain: "Used a $variable that wasn't bound.",
      hint: "Use `... as $x | ...` to bind a variable before referencing it.",
    };
  }
  if (/Unterminated string/.test(message)) {
    return {
      plain: "A string literal is missing its closing quote.",
      hint: "Make sure every \" has a matching closing \" — escape inner quotes as \\\".",
    };
  }
  if (/Unexpected token/.test(message)) {
    return {
      plain: "A token appeared where the parser didn't expect it.",
      hint: "Check for a missing `|`, unmatched `(` or `[`, or an unfinished expression.",
    };
  }
  if (/Unknown function/.test(message)) {
    return {
      plain: "The filter calls a function not supported by this pure-JS interpreter.",
      hint: "Use the full jq (play.jqlang.org) for def/import/@format/regex. Or rewrite using supported builtins.",
    };
  }
  return { plain: message, hint: "" };
}
