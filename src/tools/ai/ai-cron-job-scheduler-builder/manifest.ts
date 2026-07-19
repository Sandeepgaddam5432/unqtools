import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-cron-job-scheduler-builder",
  name: "AI Cron Job Scheduler Builder",
  description:
    "Convert plain English to cron expressions and back. 'every 5 minutes', 'daily at 9am', 'every Monday' → cron. Validate, explain, preview next N run times (timezone-aware), Quartz 6/7-field support, @yearly/@daily macros, DOM/DOW union warning, crontab line + systemd timer output. History (localStorage), shareable URL, optional BYO-key LLM polish. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "cron", "cron expression", "crontab", "cron generator",
    "plain english to cron", "cron builder", "cron explainer",
    "quartz cron", "systemd timer", "cron next run", "schedule",
    "crontab.guru alternative", "cron validator",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "AI Cron Job Scheduler Builder — Plain English to Cron + Next Runs | UnQTools",
    faq: [
      {
        q: "How does the cron scheduler builder work?",
        a: "Type a schedule in plain English (e.g., 'every 5 minutes', 'daily at 9am', 'every Monday at 6pm') and the tool parses it into a cron expression using a deterministic rule-based engine. You also get a plain-English explanation of any expression, the next 1–20 run times in your timezone, and a DOM/DOW union warning when both day-of-month and day-of-week are restricted (standard cron treats this as an OR, which trips people up).",
      },
      {
        q: "What cron flavors are supported?",
        a: "Standard 5-field (minute hour day-of-month month day-of-week) and Quartz 6-field (with seconds) / 7-field (with year). Named months (jan–dec) and named days (sun–sat) are supported, plus step values (*/5), ranges (1-5), lists (1,15,30), and Quartz modifiers (L for last, ? for no-specific-value, # for nth weekday, W for nearest weekday). The 8 macros (@yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly, @reboot) are also recognized.",
      },
      {
        q: "How are next-run times calculated?",
        a: "The parser expands each cron field into its integer set, then iterates minute-by-minute (or second-by-second for Quartz seconds) from the start time, applying the standard cron matching rules including the DOM/DOW union (OR) semantics. Wall-clock fields are extracted via Intl.DateTimeFormat in your selected timezone so the next-run table reflects local time, not server time.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Plain-English → cron parser with 20+ NL presets. (2) Cron → plain-English explainer. (3) Standard 5-field + Quartz 6/7-field support. (4) 8 macro shortcuts. (5) Cron validator with field-level errors. (6) DOM/DOW union warning. (7) Next-N run calculator (timezone-aware via Intl). (8) Curated timezone list with browser-local default. (9) Crontab line output with custom command. (10) systemd timer + service snippet generator. (11) Local history (last 20). (12) Shareable URL with expression + flavor + tz + count encoded. (13) Copy expression / copy next-runs / download .txt. (14) Optional BYO-key LLM polish (OpenAI/Anthropic) for tricky phrasings. (15) Honesty disclaimers (rule-based parser is weaker than BYO-key LLM).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, validation, explanation, next-run calculation, and format conversion run locally in your browser. Your schedule input never leaves this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic).",
      },
    ],
  },
  status: "done",
};
