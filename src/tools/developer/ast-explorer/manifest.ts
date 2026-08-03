/**
 * AST Explorer (JS/TS) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ast-explorer",
  name: "AST Explorer (JS/TS)",
  description: "Visualize JavaScript/TypeScript code structure. Tokenizer, AST tree, and token table — all client-side, no dependencies.",
  category: "developer",
  keywords: ["ast", "abstract syntax tree", "javascript parser", "typescript", "tokenizer", "lexer", "code analysis", "code structure"],
  icon: "GitBranch",
  requiresNetwork: false,
  seo: {
    title: "AST Explorer (JS/TS) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Analyzes JavaScript/TypeScript code and shows its structure — tokens, AST nodes, keywords, literals, and comments." },
      { q: "Is this a full parser?", a: "This is a lightweight tokenizer and structural analyzer. It identifies keywords, identifiers, literals, and block structures without requiring a full ECMAScript parser." },
      { q: "Is my code sent to a server?", a: "No. All analysis runs 100% in your browser." },
      { q: "What languages are supported?", a: "JavaScript and TypeScript syntax highlighting and tokenization." },
    ],
  },
  status: "done",
};
