import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-resume-bullet-point-optimizer",
  name: "AI Resume Bullet Point Optimizer",
  description:
    "Rewrite weak resume bullets into quantified, action-verb-led, ATS-friendly achievement statements. Bullet formula (Action verb + Task + Result + Metric), weak-phrase detector ('responsible for', 'worked on'), passive-voice flag, strong verb alternatives, JD keyword match + gap highlight, per-bullet strength score, STAR framing, tense check, bulk optimize, copy/export. Pure-JS engine — optional BYO-key LLM. 100% client-side, PII never leaves the browser.",
  category: "ai",
  keywords: [
    "resume bullet", "resume bullet point", "optimize resume",
    "ats resume", "achievement bullet", "action verb resume",
    "quantified resume", "resume rewriter", "bullet point generator",
    "private resume tool",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "AI Resume Bullet Optimizer — Quantified, ATS-Friendly, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Resume Bullet Point Optimizer work?",
        a: "Paste one or more resume bullets and the tool applies the Action verb + Task + Result + Metric formula. It detects weak phrases ('responsible for', 'worked on', 'helped with'), passive constructions, missing metrics, and tense inconsistencies, then generates 2–3 stronger rewrites per bullet using a built-in action-verb library. Each rewrite gets a strength score (0–100) so you can pick the strongest version.",
      },
      {
        q: "Will the tool invent metrics or achievements I didn't earn?",
        a: "No. The optimizer never fabricates numbers or outcomes. If a bullet lacks a metric, it flags the gap and prompts you to supply the real number (%, $, count, time saved). The rewrites are structural — they reorganize your existing facts into the strongest verb-first format. Anything in [brackets] is a placeholder for you to fill in with your real data.",
      },
      {
        q: "What is the strength score based on?",
        a: "The 0–100 score combines five signals: (1) starts with a strong action verb (not a weak phrase), (2) contains a quantified metric (%, $, x, count, time), (3) active voice rather than passive, (4) consistent past tense for prior roles, and (5) length within 80–180 characters. Each signal contributes points; missing signals are flagged in the diagnostics so you know exactly what to fix.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Action-verb library (200+ verbs across leadership, technical, communication, analytical, creative, operational). (2) Weak-phrase detector (15+ patterns). (3) Passive-voice flag. (4) Strong verb alternatives per bullet. (5) Bullet formula (Action + Task + Result + Metric). (6) Missing-metric prompts. (7) JD keyword match + gap highlight (no keyword stuffing). (8) Per-bullet strength score (0–100). (9) STAR framing analysis. (10) Tense consistency check. (11) 2–3 rewrites per bullet. (12) Bulk optimize whole resume. (13) Sample bullets. (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement. (17) Deterministic — same input always produces the same output.",
      },
      {
        q: "Is my resume data sent anywhere?",
        a: "No. All bullet analysis, scoring, rewriting, and keyword matching run locally in your browser. Your resume text and any job description you paste never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Nothing is uploaded to UnQTools.",
      },
    ],
  },
  status: "done",
};
