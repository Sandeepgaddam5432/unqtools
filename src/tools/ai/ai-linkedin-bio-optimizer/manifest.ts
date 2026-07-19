import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-linkedin-bio-optimizer",
  name: "AI LinkedIn Bio Optimizer — Keyword-Rich Headlines & About",
  description:
    "Paste your current profile or resume and get an optimized LinkedIn headline (within the 220-character limit) and About section (within 2,600 characters) — keyword-rich, recruiter-friendly, with a CTA. Score your profile section by section on keyword density, clarity, and impact. Generate 10+ headline and About variations across leadership / IC / creative / minimal / technical tones. Before/after diff, keyword gap list, character meters, history (last 20), and shareable URL. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "linkedin bio optimizer", "linkedin headline generator", "linkedin about section",
    "linkedin profile optimizer", "no login linkedin tool", "private linkedin optimizer",
    "keyword-rich headline", "jobscan alternative", "resume worded alternative",
    "recruiter friendly headline", "linkedin summary generator",
  ],
  icon: "linkedin",
  requiresNetwork: false,
  seo: {
    title: "AI LinkedIn Bio Optimizer — Keyword-Rich Headlines & About, Private | UnQTools",
    faq: [
      {
        q: "How does the LinkedIn Bio Optimizer work?",
        a: "Paste your existing LinkedIn profile text or resume, enter your target role (e.g. 'Senior Product Manager') and industry (e.g. 'SaaS'), pick a tone (leadership, IC, creative, minimal, technical), and choose a CTA (e.g. 'Open to work', 'Let's connect'). The tool composes 10+ headline variants within the 220-character limit and several About variants within the 2,600-character limit, then scores each on keyword density, clarity, and impact so you can pick the best one.",
      },
      {
        q: "How are the 220-character headline and 2,600-character About limits handled?",
        a: "Every generated headline is scored against LinkedIn's 220-character limit and every About against the 2,600-character limit. Variants that exceed the limit are auto-trimmed on word boundaries and flagged with a warning. The character meter shows current/limit so you can edit before publishing. Line breaks are counted as one character each, matching LinkedIn's UI.",
      },
      {
        q: "How is the profile scored?",
        a: "Each section (headline and About) is scored on three dimensions: keyword density (does it include role + industry keywords recruiters search?), clarity (active voice, concrete numbers, no jargon pile-up), and impact (action verbs, quantified achievements, differentiation). The headline is out of 100 (40 keyword / 30 clarity / 30 impact); the About is out of 100 with the same weighting. The overall profile score is the average of headline + About.",
      },
      {
        q: "Can I use my own LLM API key for more nuanced optimization?",
        a: "Yes. The tool builds an optimal prompt (current profile + target role + industry + tone + CTA + character limits) and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. Without a key, the on-device template engine produces solid baseline headlines and About sections fully offline. Nothing is uploaded unless you opt in.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 5 tone presets (leadership, IC, creative, minimal, technical). (2) 5 CTA options (open to work, let's connect, hire me, speaking, blog). (3) Live 220-char headline meter + 2,600-char About meter with auto-trim. (4) 10+ headline variations per run. (5) Multiple About section variations. (6) Section-by-section scoring (keyword density / clarity / impact). (7) Keyword extraction from pasted resume. (8) Keyword gap list (target role keywords missing from your profile). (9) Before/after diff. (10) Role and industry presets (10+ each). (11) Copy + Download (text/JSON/CSV/Markdown). (12) Optional BYO-key LLM enhancement. (13) History (localStorage, last 20). (14) Shareable URL. (15) Honesty disclaimers (don't inflate titles/metrics; keyword optimization aids discovery, not guarantees).",
      },
    ],
  },
  status: "done",
};
