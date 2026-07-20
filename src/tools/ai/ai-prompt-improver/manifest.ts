import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-prompt-improver",
  name: "AI Prompt Improver",
  description:
    "Rewrite weak one-line prompts into structured, model-ready prompts. Analyzes clarity, specificity, context, constraints, format, and examples. Adds role framing, explicit task, context slots, constraints, and output format. Scores 0-100 with tips. Target-model presets (GPT-4, Claude, Gemini, local). Variable extraction + reusable template. Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "prompt improver", "prompt generator", "rewrite my prompt",
    "prompt optimizer", "prompt engineering", "structured prompt",
    "llm prompt", "free prompt optimizer no login", "prompt scoring",
    "prompt template",
  ],
  icon: "wand-2",
  requiresNetwork: false,
  seo: {
    title: "AI Prompt Improver — Score + Rewrite Prompts, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Prompt Improver work?",
        a: "Paste your rough prompt and the analyzer scores it across six dimensions — clarity, specificity, context, constraints, format, and examples — yielding a 0-100 score with per-dimension breakdowns. The rewriter then adds missing components: a role framing line, an explicit task statement, context slots, constraints (length, tone, things to avoid), a desired output format, and a few-shot scaffolding block. You get an improved prompt, a diff of what changed, and a per-change explanation. By default everything runs on-device with deterministic rules.",
      },
      {
        q: "What target models are supported and what changes between them?",
        a: "Four target presets: GPT-4-class, Claude, Gemini, and Small Local. Each preset tweaks phrasing conventions — for example, Claude favors explicit XML-style section tags (<context>, <task>) and a thinking-friendly structure, GPT-4-class favors clear numbered steps and JSON output schemas, Gemini favors concise role + bullet constraints, and Small Local favors shorter prompts with explicit format examples to compensate for limited context handling. The rewriter applies the preset's conventions automatically.",
      },
      {
        q: "What is the variable extraction / template mode?",
        a: "Variable mode scans the improved prompt for concrete values (names, numbers, technologies, file paths) and turns them into {{double_brace}} placeholders, producing a reusable template. You can fill the placeholders in any future run by typing values into the template form, without rewriting the prompt. Templates persist in localStorage and export as JSON.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six-dimension prompt analyzer (clarity, specificity, context, constraints, format, examples). (2) 0-100 score with per-dimension breakdown and tips. (3) Rule-based rewriter adding role, task, context, constraints, format, and few-shot scaffolding. (4) Four target-model presets. (5) Diff view (added/removed lines) with explanations. (6) Variable extraction and reusable template mode. (7) Token-budget estimator (rough). (8) Negative-constraint builder ('avoid X'). (9) Preset use-cases (coding, writing, image-gen, analysis, agent-system-prompt). (10) Copy improved prompt, copy template, export JSON. (11) History (localStorage, last 20). (12) Shareable URL. (13) Optional BYO-key LLM enhancement. (14) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my prompt sent anywhere?",
        a: "No. All analysis, scoring, rewriting, and variable extraction run locally in your browser. Prompts never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
