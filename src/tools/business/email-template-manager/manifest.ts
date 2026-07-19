import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "email-template-manager",
  name: "Email Template Manager",
  description:
    "Generate, customize, and store business email templates for 10 common scenarios — welcome, follow-up, meeting-request, proposal, thank-you, reminder, apology, newsletter, out-of-office, sales-outreach. Each template has 5 tone variants (formal, professional, casual, friendly, urgent). Variable substitution, subject auto-generator, read-time estimator, placeholder validator, multi-template batch generator. Render as text, HTML, or markdown. 18 extra features. 100% client-side.",
  category: "business",
  keywords: [
    "email template", "email generator", "business email",
    "cold email", "follow-up email", "welcome email",
    "meeting request", "sales outreach", "newsletter template",
    "out of office", "professional email",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "Email Template Manager — 10 Types × 5 Tones | UnQTools",
    faq: [
      {
        q: "How does the email template manager work?",
        a: "Pick a template type (welcome, follow-up, meeting request, proposal, thank-you, reminder, apology, newsletter, out-of-office, or sales outreach), choose a tone (formal, professional, casual, friendly, urgent), enter recipient and sender details, and optionally add custom fields like `meeting_date,2026-07-20`. The tool substitutes all `{{variables}}` and renders the email as text, HTML (email-client friendly, inline CSS), or markdown.",
      },
      {
        q: "Can I add my own variables?",
        a: "Yes. Use the custom fields textarea with one `key,value` pair per line. Each key becomes a `{{key}}` variable that you can reference in the subject or body. Standard variables like `{{recipientName}}`, `{{senderName}}`, and `{{senderCompany}}` are always available.",
      },
      {
        q: "What if I leave the subject blank?",
        a: "The tool auto-generates a subject line based on the template type and tone. For example, a welcome email becomes 'Welcome to {{senderCompany}}, {{recipientName}}!' and an urgent reminder becomes '[URGENT] Reminder: …'. You can override by typing your own subject.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 email template types. (2) 5 tone variants per type (formal, professional, casual, friendly, urgent). (3) Variable substitution system ({{key}} → value). (4) Custom-fields parser (`key,value` per line). (5) Subject-line auto-generator per type. (6) Tone modifier (greeting/closing adjuster). (7) Email length estimator (word count). (8) Read-time estimator (200 wpm). (9) Plain-text renderer. (10) HTML email renderer (inline CSS, email-client friendly). (11) Markdown renderer. (12) Copy + Download .txt + Download HTML + Download MD. (13) History (localStorage, last 20). (14) Shareable URL (encoded in hash). (15) Summary stats (type, tone, word count, read time). (16) Subject character counter (warns if > 60 chars). (17) Placeholder validator (warns if any {{}} remain unsubstituted). (18) Multi-template batch generator (same vars across multiple types).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All template generation, variable substitution, and rendering happen 100% locally in your browser. No data is uploaded. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
