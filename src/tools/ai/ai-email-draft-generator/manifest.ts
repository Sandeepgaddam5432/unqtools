import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-email-draft-generator",
  name: "AI Email Draft Generator",
  description:
    "Draft professional emails from a short brief or pasted thread — purpose + tone + length control. Nine purpose presets (request, follow-up, thank you, apology, announcement, newsletter, intro, decline, cold outreach), five tones (formal, friendly, casual, urgent, persuasive), three lengths. Compose mode + reply mode (addresses each point in the thread). Subject-line variants, bullet-to-prose, shorten/lengthen, signature insert, copy, mailto: link, .eml export, history (localStorage, last 20), shareable URL, optional BYO-key LLM polish. 100% client-side — drafts never leave the browser.",
  category: "ai",
  keywords: [
    "email draft generator", "ai email writer free", "reply email generator",
    "professional email maker", "compose email", "email template",
    "cold email writer", "follow-up email", "apology email",
    "thank you email", "newsletter draft", "mailto generator",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "AI Email Draft Generator — Compose & Reply, Private | UnQTools",
    faq: [
      {
        q: "How does the email draft generator work?",
        a: "Pick a mode (Compose or Reply), choose a purpose preset (request, follow-up, thank you, apology, announcement, newsletter, intro, decline, cold outreach), select a tone (formal, friendly, casual, urgent, persuasive), and a length (short, medium, long). In Compose mode you type a short brief; in Reply mode you paste an incoming thread and the tool extracts each point and drafts a response that addresses them. The tool assembles a subject line + body using built-in templates tuned by your tone + length, then lets you shorten, lengthen, copy, open in your mail client via mailto:, or export as a .eml file.",
      },
      {
        q: "Is this a real AI? Do I need an API key?",
        a: "By default the tool uses deterministic templates and tone presets running 100% in your browser — no API key, no network call, no account. If you want LLM-quality refinement, you can paste your own OpenAI or Anthropic API key and click 'Polish with LLM'. The key is stored only in this browser's localStorage and is sent directly to the provider you choose — never to UnQTools. The default experience works fully offline.",
      },
      {
        q: "What is the difference between Compose and Reply modes?",
        a: "Compose mode starts from a short brief (one or two sentences describing what you want to say) and produces a full email with subject + body. Reply mode starts from a pasted incoming thread: the tool extracts each numbered/bulleted point or paragraph, drafts a response that addresses each one in turn, and adds a subject like 'Re: <original subject>'. Reply mode is best for handling long threads or multi-point requests without dropping anything.",
      },
      {
        q: "What extra features does this tool have compared to other email drafters?",
        a: "(1) Nine purpose presets (request, follow-up, thank you, apology, announcement, newsletter, intro, decline, cold outreach) each with their own subject + body templates. (2) Five tone presets (formal, friendly, casual, urgent, persuasive) that adjust opener, closer, and sentence phrasing. (3) Three length presets (short, medium, long) that adjust paragraph count. (4) Compose + Reply modes — reply extracts each point in the thread and addresses it. (5) Subject-line variants (3 options per draft). (6) Bullet-to-prose: paste bullet points and get prose paragraphs. (7) Shorten / lengthen rewrites. (8) Signature insert with name + title + phone + email. (9) mailto: deep link — opens your default mail client pre-filled. (10) .eml export — full RFC 5322 message you can drag into Outlook/Apple Mail. (11) Markdown + JSON export. (12) History (localStorage, last 20). (13) Shareable URL with all inputs encoded. (14) Optional BYO-key LLM polish (OpenAI/Anthropic). (15) Honesty disclaimer: it's a draft — review before sending; nothing is uploaded.",
      },
      {
        q: "Is my email content sent anywhere?",
        a: "No. All draft generation, tone/length adjustment, bullet-to-prose, shorten/lengthen, mailto:/.eml/Markdown/JSON export, history, and favorites run locally in your browser. Your brief, thread, and draft never leave this device. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly to the LLM provider you choose. Even then, the request is between your browser and the provider; UnQTools never sees your email content or your API key.",
      },
    ],
  },
  status: "done",
};
