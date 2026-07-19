import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-coding-pattern-refactorer",
  name: "AI Coding Pattern Refactorer — Smells, Diffs & GoF Patterns",
  description:
    "Detects code smells (long methods/functions, deep nesting, magic numbers, duplicated code, switch statements, god classes, long parameter lists, comments-as-deodorizer) and proposes named refactorings (Extract Function, Replace Conditional with Strategy, Replace Nested Conditional with Guard Clauses, Introduce Parameter Object, Replace Magic Number with Symbolic Constant, Extract Class, etc.) and GoF design patterns (Singleton, Factory, Builder, Adapter, Decorator, Facade, Observer, Strategy, State, Command, Template Method, Visitor, and 10 more) with reviewable before/after diffs, rationale, tradeoffs, accept/reject per suggestion, apply-all-safe-refactorings button, complexity metrics (cyclomatic, lines, functions, max nesting, duplicates), 22-pattern browseable catalog with intent/when-to-use/when-not-to-use/templates, multi-language support (Python, JavaScript, TypeScript, Java, C++, Go), sample snippets per language, local history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement — your code never leaves the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "code refactoring", "design patterns", "code smells",
    "refactor code", "ai refactor", "goF patterns",
    "strategy pattern", "factory pattern", "observer pattern",
    "private code review", "fix code smells", "fowler refactorings",
  ],
  icon: "wand-2",
  requiresNetwork: false,
  seo: {
    title: "AI Coding Pattern Refactorer — Smells, Diffs & GoF Patterns | UnQTools",
    faq: [
      {
        q: "How does the AI coding pattern refactorer work?",
        a: "Pick a language (or let the tool auto-detect) and paste your code. The tool runs a deterministic, pattern-based smell detector that finds long methods/functions, deep nesting (>4 levels), magic numbers, duplicated lines, switch statements with 3+ cases, long if/else-if chains, long parameter lists (>4 params), god classes (>15 methods), large classes (>200 lines), and comments-as-deodorizer blocks. For each smell, it proposes a named refactoring (Extract Function, Replace Conditional with Strategy, Replace Nested Conditional with Guard Clauses, Introduce Parameter Object, Replace Magic Number with Symbolic Constant, Extract Class) with a reviewable before/after diff, rationale, and tradeoffs. Accept/reject each suggestion individually or use 'Apply safe refactorings' to auto-apply deterministic transformations (e.g., magic-number extraction).",
      },
      {
        q: "Which design patterns does the catalog include?",
        a: "All 22 GoF (Gang of Four) patterns organized by category: Creational (Singleton, Factory Method, Abstract Factory, Builder, Prototype), Structural (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy), and Behavioral (Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor). Each entry shows the intent, when to use, when NOT to use, and a TypeScript-flavored code template you can copy and adapt. The tool also suggests specific patterns based on the smells it detects (e.g., switch-statement → Strategy, long-parameter-list → Builder).",
      },
      {
        q: "Will the refactorings preserve behavior?",
        a: "Not guaranteed — and the tool is honest about it. Refactoring suggestions are template-based and pattern detection is heuristic. The tool CANNOT prove behavior preservation; that requires running your test suite. The 'Apply safe refactorings' button only applies deterministic transformations (magic-number extraction to a named constant) that are very unlikely to change behavior. Everything else is shown as a diff for your manual review — accept/reject per suggestion, then apply the change to your codebase and run your tests. The optional BYO-key LLM enhancement can refine the suggestions using your own OpenAI or Anthropic key.",
      },
      {
        q: "Can the tool auto-apply refactorings?",
        a: "Only safe, deterministic ones. The 'Apply safe refactorings' button applies magic-number extraction (replacing bare numeric literals with a named constant declared at the top of the file) — these changes are very unlikely to change behavior. Unsafe refactorings (Extract Function, Replace Conditional with Strategy, Replace Nested Conditional with Guard Clauses, Extract Class, Introduce Parameter Object) are NOT auto-applied — they require your judgment because the tool cannot determine the correct split points or strategy boundaries automatically. Each unsafe suggestion shows a before/after diff and rationale for manual review.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 11+ code-smell detectors (long method/function, deep nesting, magic number, duplicated code, switch statement, if/else-if chain, long parameter list, comments-as-deodorizer, god class, large class). (2) 18 named refactorings (Extract Function, Replace Conditional with Strategy/Polymorphism, Replace Nested Conditional with Guard Clauses, Introduce Parameter Object, Replace Magic Number with Symbolic Constant, Extract Class, Decompose Conditional, Consolidate Conditional Expression, Replace Temp with Query, Introduce Null Object, and more). (3) 22 GoF pattern catalog with intent / when-to-use / when-not-to-use / code templates. (4) Before/after diff per suggestion. (5) Rationale + tradeoffs per suggestion. (6) Accept/reject per suggestion. (7) Apply-safe-refactorings button. (8) Complexity metrics (cyclomatic, lines, functions, max nesting, duplicates). (9) Pattern suggestions based on detected smells. (10) 6 languages with per-language rules. (11) Auto-detect language. (12) Sample snippets per language. (13) Local history (localStorage, last 20). (14) Shareable URL with code + language + accepted suggestions encoded. (15) Optional BYO-key LLM enhancement (OpenAI/Anthropic). (16) Honesty disclaimer about behavior preservation.",
      },
      {
        q: "Is my code sent anywhere?",
        a: "No. All smell detection, refactoring suggestions, pattern matching, complexity analysis, and history run locally in your browser — your code never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Refine with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
