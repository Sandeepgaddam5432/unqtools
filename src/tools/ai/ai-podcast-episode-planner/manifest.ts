import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-podcast-episode-planner",
  name: "AI Podcast Episode Planner",
  description:
    "Plan podcast episodes with segment outlines, timestamps, talking points, guest interview questions, ad-break placements, and publish-ready show notes. Pure-JS template engine for solo, interview, co-host, panel, and story formats — interview questions, ad spots, chapter markers, multiple title/description options, optional BYO-key LLM enhancement. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "podcast episode planner", "podcast outline generator", "podcast script",
    "show notes generator", "podcast interview questions", "podcast timestamps",
    "podcast segment planner", "free podcast planner", "no login podcast",
  ],
  icon: "mic",
  requiresNetwork: false,
  seo: {
    title: "AI Podcast Episode Planner — Outlines, Timestamps, Show Notes | UnQTools",
    faq: [
      {
        q: "How does the podcast episode planner work?",
        a: "Enter your topic, pick a format (solo, interview, co-host, panel, story), set the duration, and add optional guest names. The tool generates a complete episode plan: cold-open hook, segmented outline with rough timestamps, per-segment talking points, guest interview questions, ad-break placements, chapter markers, and ready-to-publish show notes with title/description options — all from built-in templates, no audio generated.",
      },
      {
        q: "What formats are supported?",
        a: "Five formats: solo monologue, interview (one guest), co-host banter, panel (multiple guests), and narrative story. Each format has its own segment template tuned to the typical rhythm of that style. Durations from 5 to 120 minutes are supported, with timestamps auto-pro-rated to the total runtime.",
      },
      {
        q: "How are timestamps calculated?",
        a: "Each format defines segment weights (e.g., intro 5%, main content 60%, ads 5%, outro 5%). The tool multiplies each weight by your target duration to produce MM:SS timestamps. Ad breaks are slotted at the 25% and 75% marks for episodes over 20 minutes. Chapter markers mirror segment boundaries so you can export them directly.",
      },
      {
        q: "Can I use my own LLM API key for richer plans?",
        a: "Yes. The tool builds an optimal prompt (topic + format + duration + guests) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. If no key is provided, the on-device template engine produces solid baseline plans fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 episode format templates (solo, interview, co-host, panel, story). (2) Per-segment talking points. (3) Auto-timestamped outline with MM:SS labels. (4) Guest interview question bank (10+ per episode). (5) Ad-break placement slots. (6) Chapter markers export. (7) Multiple title options (3-5). (8) Show notes with description options. (9) Topic keyword extractor. (10) Social-clip repurposing outline. (11) Copy + Download (Markdown/text/JSON). (12) Optional BYO-key LLM enhancement. (13) History (localStorage, last 20). (14) Shareable URL. (15) Topic presets for quick starts.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All planning runs locally in your browser. Topics and guests never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
