import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-code-explainer",
  name: "AI Code Explainer — Line-by-Line, Multi-Language",
  description:
    "Line-by-line plain-English code explainer for Python, JavaScript, TypeScript, Java, C++, and Go. Detects constructs (functions, classes, loops, conditionals, try/catch, switch, imports, async/await, decorators), generates an overall summary plus a per-line explanation, supports a depth slider (beginner / intermediate / expert / ELI5), Big-O complexity hint, library & API identification, security-smell callouts, data-flow notes, inline-comment injection (writes comments next to each line), block-grouped explanations, basic translation of explanations to Spanish/French/German/Chinese/Japanese, sample snippets per language, local history (localStorage, last 20), and shareable URL. 100% client-side. Optional BYO-key LLM enhancement for prose — your code never leaves the browser unless you choose to call your own provider.",
  category: "ai",
  keywords: [
    "code explainer", "explain code", "what does this code do",
    "line by line code explanation", "plain english code", "code walkthrough",
    "ai code explainer", "code reader", "understand code",
    "private code explanation", "eli5 code", "code translator",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "AI Code Explainer — Line-by-Line, Multi-Language, Private | UnQTools",
    faq: [
      {
        q: "How does the AI code explainer work?",
        a: "Pick a language (or let the tool auto-detect) and paste your code. The tool runs a deterministic, line-by-line construct detector that classifies each line (function declaration, if, for, while, try/catch, switch, return, import, variable assignment, function call, comment, decorator, async/await, and more), then generates a plain-English explanation from a per-construct template at your chosen depth (ELI5, beginner, intermediate, expert). You also get an overall summary, a Big-O complexity hint, a list of libraries/APIs referenced, security-smell callouts, data-flow notes, and an option to inject the explanations back into the code as inline comments.",
      },
      {
        q: "What languages are supported?",
        a: "Python, JavaScript, TypeScript, Java, C++, and Go. Each language has its own construct-detection rules tuned to its syntax (e.g., 'def' for Python functions, 'function' for JavaScript, 'func' for Go, '#include' for C++). Auto-detect picks the most likely language from keyword scoring if you don't pick one.",
      },
      {
        q: "Are the explanations always correct?",
        a: "No — and the tool is honest about it. Construct detection and template-based explanations are deterministic and reliable for what the line syntactically IS (e.g., 'this is a for-loop'). They are heuristic for what the line MEANS — for subtle intent, business logic, or idiomatic patterns, the deterministic explanation is a starting point, not ground truth. The optional BYO-key LLM enhancement can refine the prose using your own OpenAI or Anthropic key. Always review generated explanations against the actual code.",
      },
      {
        q: "What is the depth slider for?",
        a: "The depth slider controls the explanation style. ELI5 uses simple analogies and avoids jargon. Beginner explains the line's role plainly. Intermediate adds terminology (control flow, scope, return values). Expert assumes you know the language and focuses on intent, side effects, and idioms. Switch depth anytime — the explanations regenerate from the templates.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) 6 languages with per-language construct rules. (2) Auto-detect language. (3) Depth slider (ELI5 / beginner / intermediate / expert). (4) Overall summary. (5) Line-by-line explanation. (6) Block grouping (function/if/loop bodies). (7) Big-O complexity hint (nested loops, recursion, sort calls). (8) Library & API identification (imports, requires, includes). (9) Security-smell callouts (eval, exec, innerHTML, SQL string concat, hardcoded credentials). (10) Data-flow notes (variable assignments and uses). (11) Inline-comment injection (writes explanations into the code). (12) Basic translation of explanations to Spanish/French/German/Chinese/Japanese. (13) Sample snippets per language. (14) Local history (localStorage, last 20). (15) Shareable URL with code + language + depth encoded. (16) Optional BYO-key LLM explanation (OpenAI/Anthropic). (17) Honesty disclaimer about deterministic vs heuristic explanations.",
      },
      {
        q: "Is my code sent anywhere?",
        a: "No. All construct detection, explanation generation, complexity analysis, library detection, security smell detection, data-flow tracking, inline-comment injection, translation, and history run locally in your browser — your code never leaves this device. The only network path is if you explicitly paste your own LLM API key and click 'Explain with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
