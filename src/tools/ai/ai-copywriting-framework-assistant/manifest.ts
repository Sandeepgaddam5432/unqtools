import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-copywriting-framework-assistant",
  name: "AI Copywriting Framework Assistant",
  description:
    "Generate on-brand marketing copy structured by proven frameworks: AIDA, PAS, FAB, BAB, and 4Ps. Each stage is labeled and editable. Multiple variants, tone + length control, channel presets, swipe-file save (localStorage), explainer notes, shareable URL. 100% client-side, no login, no upload. Optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "aida", "pas", "fab", "bab", "4ps",
    "copywriting framework", "marketing copy generator",
    "aida generator", "pas framework", "before after bridge",
    "rytr alternative", "copywriting tool no login",
  ],
  icon: "pen-tool",
  requiresNetwork: false,
  seo: {
    title: "AI Copywriting Framework Assistant — AIDA / PAS / FAB / BAB, No Login | UnQTools",
    faq: [
      {
        q: "What copywriting frameworks does this tool support?",
        a: "Five proven frameworks with labeled stages: AIDA (Attention → Interest → Desire → Action), PAS (Problem → Agitate → Solve), FAB (Feature → Advantage → Benefit), BAB (Before → After → Bridge), and 4Ps (Picture → Promise → Prove → Push). Each framework maps your product, audience, pain, and tone to structured, on-brand copy — and every stage is labeled so you learn why the structure works.",
      },
      {
        q: "Can I generate multiple variants and control the tone?",
        a: "Yes. Pick a tone (professional, friendly, bold, playful, urgent) and a length (concise, standard, expanded). The tool generates 3+ variants per framework by rotating sentence templates for each labeled stage. Variants stay structurally faithful to the chosen framework while changing wording and emphasis — so you can A/B test without losing the framework's logic.",
      },
      {
        q: "Does it work offline without an LLM API key?",
        a: "Yes. The framework template library is pure TypeScript and runs entirely on-device — no API, no sign-up, no upload. The optional BYO-key LLM polish (OpenAI / Anthropic) is a one-click enhancement that sends your inputs directly from your browser to your chosen provider. Without a key, you still get full structured copy plus teaching notes.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five labeled frameworks (AIDA, PAS, FAB, BAB, 4Ps) with stage tags. (2) Tone control (5 tones) and length presets (3 lengths). (3) Multiple variants per framework (3+ each). (4) Per-stage and whole-copy copy buttons. (5) Channel presets (ad, email, landing, product page) that retune the CTA. (6) 'Explain this framework' teaching notes. (7) Swipe-file save to localStorage. (8) Honesty linter that flags unverifiable superlatives. (9) Markdown + JSON export. (10) CSV of all variants. (11) History (localStorage, last 20). (12) Shareable URL with all inputs encoded. (13) Optional BYO-key LLM polish.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All framework assembly, variant generation, the honesty linter, and Markdown/JSON/CSV export run locally in your browser. Your product, audience, and pain inputs never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI or Anthropic, with the key stored only in this browser's localStorage.",
      },
    ],
  },
  status: "done",
};
