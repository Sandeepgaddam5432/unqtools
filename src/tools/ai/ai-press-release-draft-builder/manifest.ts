import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-press-release-draft-builder",
  name: "AI Press Release Draft Builder",
  description:
    "Build AP-style press release drafts from your announcement details. Six release types (product launch, partnership, hiring, funding, event, award). Full structure: FOR IMMEDIATE RELEASE, headline, subhead, dateline, inverted-pyramid body, quote, boilerplate, ### end mark. Five headline angles, newsworthiness check, editable quote placeholders. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "press release", "press release generator", "press release template",
    "ap style press release", "media release", "news release",
    "press release builder", "press release writer",
    "pr draft", "boilerplate",
  ],
  icon: "newspaper",
  requiresNetwork: false,
  seo: {
    title: "AI Press Release Draft Builder — AP-Style, Private | UnQTools",
    faq: [
      {
        q: "How does the press release builder work?",
        a: "Fill in the 5 Ws (who, what, when, where, why) plus your spokesperson, contact, and company boilerplate. Pick a release type (product launch, partnership, hiring, funding, event, award) and a tone. The tool generates a properly structured, AP-style press release: FOR IMMEDIATE RELEASE, headline (5 angle variants), subhead, dateline, inverted-pyramid lede, 2-4 body paragraphs, an editable quote with attribution placeholders, your boilerplate, contact info, and the ### end mark. Export to Markdown or plain text and paste into your CMS.",
      },
      {
        q: "What is AP style and why does the structure matter?",
        a: "AP (Associated Press) style is the standard journalists expect for press releases. The structure follows the inverted pyramid: the most important information goes in the lede (first paragraph), supporting context in the middle, and background (boilerplate + contact) at the end. The dateline (CITY, State — Month Day, Year —) tells editors when and where the news originates. The ### end mark tells editors the release is complete. Following these conventions increases the chance your release is read rather than discarded.",
      },
      {
        q: "What are the five headline angles?",
        a: "Each release generates five headline variants from five angles: (1) benefit-led — leads with what the audience gains, (2) fact-led — leads with the news itself, (3) customer-led — leads with who it's for, (4) trend-led — connects the news to a larger industry shift, (5) controversy-led — leads with the tension or contrarian take. Pick the angle that matches your newsroom and audience. An SEO-tight variant (under 65 characters) is also generated for search-friendly distribution.",
      },
      {
        q: "Are the quotes real?",
        a: "No. Quotes are clearly marked as editable placeholders with attribution cues like [SPOKESPERSON NAME], [TITLE]. The quote scaffolding tells you what to say (the angle, the supporting point, the forward-looking statement) but you must fill in a real quote from a real person who has approved the wording. The tool warns against publishing unverified quotes — fabricating quotes is a PR ethics violation and damages credibility with journalists.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six release-type templates (product launch, partnership, hiring, funding, event, award). (2) Five headline angles + an SEO-tight variant under 65 chars. (3) AP-style structure (FOR IMMEDIATE RELEASE, dateline, inverted pyramid, ### end mark). (4) Newsworthiness critique — does this actually pass the 'is this news?' test? (5) Editable quote scaffolds with attribution placeholders. (6) Three tone presets (formal, conversational, energetic). (7) Three length presets (short 300w, standard 500w, long 800w). (8) Copy + Download (text/Markdown). (9) History (localStorage, last 20). (10) Shareable URL. (11) Boilerplate + contact info library. (12) Live word count + SEO headline length check. (13) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All release generation, headline drafting, and newsworthiness checks run locally in your browser. Embargoed and unannounced news stays on your device — nothing is uploaded. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose (OpenAI or Anthropic). Distribution to wire services is entirely up to you.",
      },
    ],
  },
  status: "done",
};
