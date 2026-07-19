import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-code-converter",
  name: "AI Code Converter",
  description:
    "Translate code between Python, JavaScript, TypeScript, Java, C++, Go, and Ruby using on-device pattern-based transpilation for common constructs (loops, conditionals, functions, classes, variables, prints, lists, dicts, comments). Idiomatic output, change explanations, side-by-side diff, library/dependency mapping notes, comment-preservation toggle, snippet-vs-file mode, language auto-detect, unsupported-feature flags, copy/download, local history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement for complex translations — your code never leaves the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "code converter", "code translator", "python to javascript",
    "javascript to python", "java to kotlin", "python to java",
    "translate code", "transpiler", "source code converter",
    "ai code translator", "free code converter", "no login code converter",
    "python to go", "ruby to python", "cpp to python",
    "typescript to java", "go to python",
  ],
  icon: "arrow-left-right",
  requiresNetwork: false,
  seo: {
    title: "AI Code Converter — Translate Code Between Languages, Private | UnQTools",
    faq: [
      {
        q: "How does the AI code converter work?",
        a: "Pick a source language (or let the tool auto-detect it) and a target language — Python, JavaScript, TypeScript, Java, C++, Go, or Ruby. The tool parses your snippet into an intermediate representation of common constructs (functions, classes, loops, conditionals, variable assignments, print statements, lists, dicts, comments) and re-emits idiomatic code in the target language. Anything it can't confidently translate is passed through as raw text with a comment, so you always get a complete, runnable starting point.",
      },
      {
        q: "What language pairs are supported?",
        a: "All 7×6 = 42 ordered pairs between Python, JavaScript, TypeScript, Java, C++, Go, and Ruby. Common patterns — print, function/method declarations, for/for-each/while loops, if/elif/else, class definitions, variable assignments, list/array literals, dict/map literals, return statements, comments, imports — are translated idiomatically. Untranslated lines are kept verbatim with a '// untranslated' marker so you can fix them by hand.",
      },
      {
        q: "Are translations always correct?",
        a: "No — and the tool is honest about it. Pattern-based translation cannot perfectly translate every construct (decorators, generics, async/await semantics, operator overloading, language-specific stdlib calls all need manual review). Each conversion produces a list of 'key changes' explaining what was done and a list of 'unsupported features' the parser couldn't map. Always compile and test the translated code. Optional BYO-key LLM enhancement can refine harder cases — your code goes directly to your provider, never to UnQTools.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 7 source languages × 7 target languages (42 pairs). (2) Auto-detect source language from filename/keywords. (3) Idiomatic output per target. (4) Side-by-side diff view. (5) Key-change explanations panel. (6) Unsupported-feature flags. (7) Library/dependency mapping notes (e.g., Python `requests` → JS `fetch`). (8) Comment-preservation toggle. (9) Snippet vs file mode (wraps in proper boilerplate). (10) Copy + download .txt. (11) Local history (localStorage, last 20). (12) Shareable URL with source, target, and code encoded. (13) Sample snippets per language. (14) Stats (lines parsed, lines translated, lines untranslated). (15) Optional BYO-key LLM polish (OpenAI/Anthropic). (16) Honesty disclaimer.",
      },
      {
        q: "Is my code sent anywhere?",
        a: "No. All parsing, translation, and rendering run locally in your browser — your source code never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Enhance with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
