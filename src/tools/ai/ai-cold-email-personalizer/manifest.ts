import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-cold-email-personalizer",
  name: "AI Cold Email Personalizer",
  description:
    "Generate research-grounded cold emails from prospect context you paste, not creepy scraping. Strong first line, tight body, clear CTA, tone control, spam-trigger check, readability meter, 5+ variations, follow-up sequence, merge-field template. 100% client-side — your inputs never leave the browser. Optional BYO-key LLM polish.",
  category: "ai",
  keywords: [
    "cold email", "cold email personalizer", "outreach email",
    "personalized email", "sales email", "email template",
    "follow-up sequence", "spam check", "non-creepy outreach",
    "cold email generator", "b2b outreach",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "AI Cold Email Personalizer — Research-Grounded, Private, No Login | UnQTools",
    faq: [
      {
        q: "How does the cold email personalizer work?",
        a: "You paste public context about your prospect (their bio, a recent post, their company, a pain point you can solve) and your offer. The tool assembles a cold email with a strong, grounded first line, a tight value proposition, an optional social proof line, and a single clear call to action. It generates five or more variations across three tone presets (concise, friendly, formal) so you can A/B test the opener and CTA. The templates reference only what you provide — they do not scrape or fabricate details.",
      },
      {
        q: "What spam and readability checks does it run?",
        a: "Every generated email is scanned against a built-in list of ~50 spam-trigger words and phrases (e.g., 'free', 'guarantee', 'act now', '!!!'). Each match is flagged and an overall spam-risk meter (low / medium / high) is computed. The linter also reports word count, sentence count, estimated reading time, and a plain-English readability note (short, on-target, too long) tuned for cold-email best practice of 50–125 words.",
      },
      {
        q: "Can I generate a follow-up sequence?",
        a: "Yes. The follow-up generator produces a 2–4 touch sequence from the same prospect and offer inputs. Touch 1 is the primary email; touches 2–4 are progressive: a gentle bump, a value-add with a different angle, and a break-up email. Each touch is short, references the previous email, and ends with a low-friction CTA. You can export the full sequence as Markdown or copy a single touch.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Research-grounded templates — first line, value prop, social proof, CTA — driven only by what you paste. (2) Five+ email variations per prospect across three tones. (3) A/B-ready first-line variants. (4) Spam-trigger linter with ~50-phrase detector and risk meter. (5) Readability meter (word count, sentence count, reading time). (6) Follow-up sequence generator (2–4 touches). (7) Merge-field template for your own sending tool. (8) CAN-SPAM / GDPR opt-out footer reminder. (9) Live preview as you type. (10) Validation warnings (thin context, generic offer). (11) Markdown sequence export. (12) JSON export. (13) Copy individual email button. (14) History (localStorage, last 20). (15) Shareable URL with all inputs encoded. (16) Optional BYO-key LLM polish (OpenAI/Anthropic).",
      },
      {
        q: "Is my data sent anywhere, and is this creepy outreach?",
        a: "No. All template assembly, spam checks, readability analysis, and Markdown/JSON export run locally in your browser. Your prospect context and offer never leave this device. The tool does not scrape prospect data — it only personalizes from what you provide. You must have a lawful basis to email (CAN-SPAM/GDPR), include an opt-out, and personalize from public info. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI or Anthropic.",
      },
    ],
  },
  status: "done",
};
