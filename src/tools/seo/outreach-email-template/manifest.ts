import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "outreach-email-template",
  name: "Outreach Email Template Generator",
  description:
    "Generate personalized outreach emails for link building — guest post pitches, backlink requests, broken link alerts, collaboration, and influencer outreach. Variables, tone presets, subject lines, and stats. 100% client-side.",
  category: "seo",
  keywords: [
    "outreach", "email template", "link building", "guest post",
    "backlink request", "broken link building", "influencer outreach",
    "cold email", "outreach pitch",
  ],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "Outreach Email Template Generator — Link Building | UnQTools",
    faq: [
      {
        q: "What outreach templates are included?",
        a: "Five: (1) Guest post pitch — propose a guest article. (2) Backlink request — ask a site to link to your resource. (3) Broken link building — notify a site about a broken link and offer your replacement. (4) Collaboration pitch — propose a joint piece or partnership. (5) Influencer outreach — reach out about your product/content.",
      },
      {
        q: "What personalization variables can I use?",
        a: "We auto-fill {name} (recipient), {site} (their site), {yourName}, {yourSite}, {topic}, {yourArticleTitle}, {theirArticleUrl}, {brokenLinkUrl}, {replacementUrl}, and {customMessage}. Just type the variables into any field and they'll be substituted.",
      },
      {
        q: "What tones can I choose?",
        a: "Three: Formal ('Dear X,' / 'Sincerely'), Casual ('Hey X!' / 'Cheers'), and Friendly ('Hi X,' / 'Best'). Pick the one that matches your relationship with the recipient.",
      },
      {
        q: "How long should outreach emails be?",
        a: "Short. Aim for 75-150 words (15-45 seconds to read). The tool shows word count, character count, and estimated read time so you can keep it tight. Editors get dozens of pitches per day — respect their time and lead with value.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five template presets. (2) Three tone selectors. (3) Variable substitution ({name}, {site}, {topic}, etc.). (4) Auto-generated subject lines per template. (5) Live preview as you type. (6) Copy to clipboard. (7) Word / char count + estimated read time. (8) Field validation. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Email generation is pure string manipulation in your browser. History is stored in localStorage on this device only. We don't send emails — paste the output into your mail client.",
      },
    ],
  },
  status: "done",
};
