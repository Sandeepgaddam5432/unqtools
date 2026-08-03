/**
 * AST Explorer (JS/TS) — Tokenizer and simple parser for JavaScript/TypeScript.
 * Provides a visual representation of the code structure.
 * 100% client-side.
 */

export interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}

export interface AstNode {
  type: string;
  value?: string;
  children: AstNode[];
  start: number;
  end: number;
  depth: number;
}

export interface ParseResult {
  ok: true;
  tokens: Token[];
  ast: AstNode;
  stats: {
    tokenCount: number;
    lineCount: number;
    nodeCount: number;
    maxDepth: number;
  };
}

export interface ParseError {
  ok: false;
  error: string;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "class", "extends", "import",
  "export", "from", "default", "async", "await", "try", "catch", "finally",
  "throw", "new", "this", "typeof", "instanceof", "in", "of", "true", "false",
  "null", "undefined", "interface", "type", "enum", "implements", "abstract",
  "public", "private", "protected", "static", "readonly", "as", "is",
]);

const TOKEN_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: "whitespace", pattern: /^\s+/ },
  { type: "comment", pattern: /^\/\/[^\n]*/ },
  { type: "multiline-comment", pattern: /^\/\*[\s\S]*?\*\// },
  { type: "string", pattern: /^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.)*`/ },
  { type: "number", pattern: /^0[xX][0-9a-fA-F]+|^0[bB][01]+|^0[oO][0-7]+|^\d+\.?\d*(?:[eE][+-]?\d+)?/ },
  { type: "regex", pattern: /^\/(?:[^/\\]|\\.)+\/[gimsuy]*/ },
  { type: "arrow", pattern: /^=>/ },
  { type: "spread", pattern: /^\.\.\./ },
  { type: "operator", pattern: /^(?:===|!==|==|!=|<=|>=|&&|\|\||>>|<<|\?\?|\+=|-=|\*=|\/=)/ },
  { type: "identifier", pattern: /^[a-zA-Z_$][a-zA-Z0-9_$]*/ },
  { type: "punctuation", pattern: /^[{}()\[\];,.:?<>=!&|+\-*/%^~@#]/ },
];

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  while (pos < code.length) {
    let matched = false;

    for (const { type, pattern } of TOKEN_PATTERNS) {
      const remaining = code.slice(pos);
      const match = remaining.match(pattern);
      if (match && match.index === 0) {
        const value = match[0];
        if (type !== "whitespace") {
          tokens.push({ type, value, line, column });
        }
        // Update position
        for (const ch of value) {
          if (ch === "\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
        }
        pos += value.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Unknown character - skip
      const ch = code[pos];
      if (ch === "\n") { line++; column = 1; } else { column++; }
      pos++;
    }
  }

  return tokens;
}

export function buildAst(tokens: Token[]): AstNode {
  const root: AstNode = { type: "Program", children: [], start: 0, end: tokens.length, depth: 0 };
  const stack: AstNode[] = [root];
  let current = root;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Detect structure
    if (token.type === "identifier" && KEYWORDS.has(token.value)) {
      const node: AstNode = {
        type: `Keyword:${token.value}`,
        value: token.value,
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      };
      current.children.push(node);
    } else if (token.value === "{") {
      const block: AstNode = {
        type: "Block",
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      };
      current.children.push(block);
      stack.push(current);
      current = block;
    } else if (token.value === "}") {
      current.end = i;
      if (stack.length > 1) {
        current = stack.pop()!;
      }
    } else if (token.value === "(") {
      const paren: AstNode = {
        type: "ParenExpression",
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      };
      current.children.push(paren);
      stack.push(current);
      current = paren;
    } else if (token.value === ")") {
      current.end = i;
      if (stack.length > 1) {
        current = stack.pop()!;
      }
    } else if (token.type === "string" || token.type === "number") {
      current.children.push({
        type: `Literal:${token.type}`,
        value: token.value,
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      });
    } else if (token.type === "identifier" && !KEYWORDS.has(token.value)) {
      current.children.push({
        type: "Identifier",
        value: token.value,
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      });
    } else if (token.type === "comment" || token.type === "multiline-comment") {
      current.children.push({
        type: "Comment",
        value: token.value,
        children: [],
        start: i,
        end: i,
        depth: current.depth + 1,
      });
    }
  }

  return root;
}

export function parseCode(code: string): ParseResult | ParseError {
  if (!code.trim()) return { ok: false, error: "Code is empty" };

  try {
    const tokens = tokenize(code);
    const ast = buildAst(tokens);

    const lineCount = code.split("\n").length;
    let nodeCount = 0;
    let maxDepth = 0;

    function countNodes(node: AstNode) {
      nodeCount++;
      if (node.depth > maxDepth) maxDepth = node.depth;
      for (const child of node.children) countNodes(child);
    }
    countNodes(ast);

    return {
      ok: true,
      tokens,
      ast,
      stats: {
        tokenCount: tokens.length,
        lineCount,
        nodeCount,
        maxDepth,
      },
    };
  } catch (e) {
    return { ok: false, error: `Parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function formatTokenTable(tokens: Token[]): string {
  const lines = ["Line\tCol\tType\tValue", "----\t---\t----\t-----"];
  for (const t of tokens) {
    const val = t.value.length > 30 ? t.value.slice(0, 30) + "…" : t.value;
    lines.push(`${t.line}\t${t.column}\t${t.type}\t${val}`);
  }
  return lines.join("\n");
}

export function formatAstJson(ast: AstNode, indent: number = 2): string {
  return JSON.stringify(ast, null, indent);
}
