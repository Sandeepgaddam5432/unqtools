import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-code-debugger",
  name: "AI Code Debugger & Bug Finder",
  description:
    "Static analysis + bug finder for Python, JavaScript, TypeScript, Java, C++, and Go. Detects undefined variables, missing returns, off-by-one loops, = vs == bugs, == vs === in JS, mutable default arguments, var usage, console.log leftovers, TODO/FIXME markers, empty catch blocks, magic numbers, infinite loops, unreachable code, missing break in switch, hardcoded credentials, division-by-zero literals, mismatched brackets, and more. Per-language rule sets, severity classification (info/warning/error/critical), line numbers, suggested fixes, auto-fix button for safe corrections, side-by-side diff view, runtime-error root-cause guesser, cyclomatic complexity hint, code-smell detection, sample buggy snippets, stats per severity, local history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement for explanations — your code never leaves the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "code debugger", "bug finder", "static analysis",
    "code review", "find bugs", "ai debugger",
    "javascript linter", "python linter", "java linter",
    "private code review", "explain this error", "online code debugger",
    "no login linter", "free code checker",
  ],
  icon: "bug",
  requiresNetwork: false,
  seo: {
    title: "AI Code Debugger & Bug Finder — Static + AI, Private | UnQTools",
    faq: [
      {
        q: "How does the AI code debugger work?",
        a: "Pick a language (or let the tool auto-detect) and paste your code. The tool runs deterministic, pattern-based static analysis using per-language rule sets — finding undefined variables, missing returns, off-by-one loops, = vs == bugs, == vs === in JavaScript, mutable default arguments in Python, var usage, leftover console.log, TODO/FIXME markers, empty catch blocks, magic numbers, infinite loops, unreachable code after return, missing break in switch, hardcoded credentials, division-by-zero literals, and mismatched brackets. Each issue has a line number, severity, explanation, and suggested fix. The optional LLM enhancement uses your own key to explain tricky issues — never touching UnQTools servers.",
      },
      {
        q: "What languages are supported?",
        a: "Python, JavaScript, TypeScript, Java, C++, and Go. Each language has its own rule set tuned to its common pitfalls. JavaScript/TypeScript rules flag var usage, == vs ===, and missing semicolons. Python rules flag mutable default arguments (def f(x=[])) and bare except. Java/C++ rules flag missing semicolons and missing break in switch. Go rules flag unused-likely patterns. Mismatched-bracket detection runs for all languages.",
      },
      {
        q: "Are the findings always correct?",
        a: "No — and the tool is honest about it. Pattern-based static analysis catches common issues reliably (bracket mismatches, var declarations, console.log leftovers, TODO markers, = vs ==, missing break in switch). Other findings (undefined variables, missing returns, unreachable code) are heuristic and may produce false positives or miss real bugs — always review each finding before changing your code. The tool clearly labels findings as 'deterministic' (rule-based, reliable) vs 'heuristic' (best-effort, review needed). Optional BYO-key LLM enhancement can refine explanations.",
      },
      {
        q: "Can the tool auto-fix issues?",
        a: "Yes — for safe, deterministic fixes. The 'Auto-fix' button applies only safe corrections: converting `var` to `let`, inserting missing semicolons, replacing `==` with `===` (and `!=` with `!==`) in JavaScript/TypeScript, and adding `break` statements to switch cases that are missing them. Each applied fix is listed so you can review what changed. Heuristic findings (undefined variables, missing returns, etc.) are NOT auto-fixed — they need your judgment.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 6 languages with per-language rule sets. (2) Auto-detect source language. (3) 15+ bug-detection rules (undefined vars, missing returns, off-by-one, == vs ===, var usage, console.log, TODO/FIXME, empty catch, magic numbers, infinite loops, unreachable code, missing break, hardcoded credentials, division by zero, mismatched brackets). (4) Severity classification (info / warning / error / critical). (5) Line numbers + suggested fixes per issue. (6) Auto-fix button for safe corrections. (7) Side-by-side diff view (before vs after). (8) Runtime-error root-cause guesser (paste an error message). (9) Cyclomatic complexity hint. (10) Code-smell detection (long functions, deep nesting). (11) Sample buggy snippets per language. (12) Stats per severity. (13) Local history (localStorage, last 20). (14) Shareable URL with code + language encoded. (15) Optional BYO-key LLM explanation (OpenAI/Anthropic). (16) Honesty disclaimer about heuristic findings.",
      },
      {
        q: "Is my code sent anywhere?",
        a: "No. All static analysis, auto-fixes, complexity calculation, and history run locally in your browser — your code never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Explain with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
