import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-regex-builder",
  name: "AI Regex Builder",
  description:
    "Build a regular expression from plain English. Pattern library (email, phone, URL, IP, date, time, credit card, hex color, ZIP, UUID), NL → regex matcher, live test against sample text with highlights, token-by-token AST explanation, multi-flavor conversion (JS/PCRE/Python/Java), ReDoS warnings, capture-group table, replace preview, code snippet export. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "regex builder", "regular expression generator", "natural language to regex",
    "ai regex", "regex from description", "explain regex",
    "regex tester", "regex 101 alternative", "private regex tool",
    "regex cheat sheet",
  ],
  icon: "braces",
  requiresNetwork: false,
  seo: {
    title: "AI Regex Builder — NL to Regex, Tested & Explained, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Regex Builder work?",
        a: "Type a plain-English description (e.g. 'match a US phone number') and the tool matches it against a built-in pattern library covering email, phone, URL, IPv4, date, time, credit card, hex color, ZIP code, UUID, and more. The chosen pattern is compiled into a JavaScript RegExp, tested live against any sample text you paste (with match highlights), and explained token-by-token — character classes, quantifiers, anchors, capture groups, and escape sequences are each translated to plain English.",
      },
      {
        q: "What regex flavors are supported?",
        a: "Four target flavors: JavaScript (the live test engine), PCRE (PHP / Perl-compatible, with named-group syntax), Python (re module, with raw-string literals), and Java (java.util.regex, with double-escaped backslashes). The converter rewrites the pattern string for each flavor's quoting and named-group conventions. Live matching always uses the JavaScript engine, so flavor-specific features like atomic groups or possessive quantifiers may not match in the preview — the tool will flag those.",
      },
      {
        q: "How are ReDoS (catastrophic backtracking) risks detected?",
        a: "The analyzer scans for known danger patterns: nested quantifiers like (a+)+, overlapping alternation like (a|a)*, and quantified groups with ambiguous boundaries. Each detection produces a warning explaining the risk and a safe alternative. ReDoS attacks can freeze regex engines on adversarial input — this linter catches the most common cases before you ship.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Pattern library with 10+ common patterns (email, phone, URL, IP, date, time, credit card, hex color, ZIP, UUID). (2) NL → regex matcher (keyword routing). (3) Live test against sample text with match highlights. (4) Token-by-token AST explanation. (5) Capture-group table (name + index + matched text). (6) Replace preview. (7) Multi-flavor conversion (JS/PCRE/Python/Java). (8) ReDoS / catastrophic-backtracking warnings. (9) Code snippet export (JS/Python/Java). (10) History (localStorage, last 20). (11) Shareable URL. (12) Sample descriptions. (13) CSV/JSON export. (14) Optional BYO-key LLM enhancement. (15) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my text sent anywhere?",
        a: "No. All pattern matching, testing, explaining, and ReDoS analysis run locally in your browser. Your description and sample text never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. AI-generated regex must be verified — the live tester makes that instant.",
      },
    ],
  },
  status: "done",
};
