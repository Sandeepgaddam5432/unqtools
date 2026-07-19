import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-cta-generator",
  name: "AI CTA Generator",
  description:
    "Generate high-converting calls-to-action tuned to your goal, product, audience, and tone. Built-in persuasion-angle library (urgency, curiosity, benefit, social-proof, scarcity, FOMO, value, action, question, contrast) with placement-specific outputs (button microcopy, banner, email CTA, inline link, popup), strength scoring per variant, automatic A/B pair generation with hypothesis, platform character-limit presets (Google Ads, Facebook, email subject, push, SMS), swipe file favorites, power-word library, current-CTA analyzer, and copywriting framework (AIDA/PAS) tags. 100% client-side — optional BYO-key LLM enhancement.",
  category: "ai",
  keywords: [
    "cta generator", "call to action generator", "high converting cta",
    "button copy generator", "marketing cta", "ai cta",
    "ab test cta", "cta copywriter", "no login cta generator",
    "cta examples", "persuasion copy",
  ],
  icon: "target",
  requiresNetwork: false,
  seo: {
    title: "AI CTA Generator — High-Converting Calls-to-Action, Private | UnQTools",
    faq: [
      {
        q: "How does the AI CTA Generator work?",
        a: "Enter your goal (signup, purchase, trial, download, demo, subscribe, register, contact), product, audience, and tone. The tool draws from a built-in library of 10 persuasion angles (urgency, curiosity, benefit, social-proof, scarcity, FOMO, value, action, question, contrast) and produces 10+ placement-specific CTA variations (button microcopy, banner, email CTA, inline link, popup). Each variant carries an angle label and a 0-100 strength score.",
      },
      {
        q: "Can I generate A/B test pairs?",
        a: "Yes. Each pair contains a control CTA and a challenger CTA, drawn from different persuasion angles, plus a hypothesis explaining what the challenger tests (e.g., 'urgency vs benefit framing'). Use pairs as the starting point for real A/B tests — the tool encourages you to actually run them, since real performance depends on your audience and offer.",
      },
      {
        q: "Which platforms and character limits are supported?",
        a: "Built-in presets for Google Ads (headline 30, description 90), Facebook ad (125 chars), email subject (50), push notification (40), SMS (140), Twitter/X (280), and button microcopy (24). Each variant is flagged if it exceeds its platform limit so you can adapt before publishing.",
      },
      {
        q: "Can I use my own LLM API key for richer copy?",
        a: "Yes. The tool builds an optimal prompt (goal + product + audience + tone + angle + platform) using AIDA/PAS copywriting frameworks and calls OpenAI or Anthropic with a key you paste — stored only in localStorage on this device. Without a key, the on-device template engine produces solid baseline CTAs fully offline.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 10 persuasion angles (urgency, curiosity, benefit, social-proof, scarcity, FOMO, value, action, question, contrast). (2) 5 placement types (button, banner, email, inline, popup). (3) Strength scorer 0-100 per variant. (4) Auto A/B pair generator with hypothesis. (5) Platform character-limit presets (Google Ads, Facebook, email, push, SMS, Twitter, button). (6) Swipe file / favorites (localStorage). (7) Power-word library with active highlighting. (8) Current-CTA analyzer (detects which angle your existing CTA uses). (9) Tone library (urgent, friendly, professional, playful, bold, premium). (10) Goal library (signup, purchase, trial, download, demo, subscribe, register, contact). (11) Copy framework tags (AIDA, PAS). (12) Copy + Download (text/JSON/CSV/Markdown). (13) Optional BYO-key LLM enhancement. (14) History (localStorage, last 20). (15) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All CTA generation, scoring, A/B pairing, and analysis runs locally in your browser. Your product and audience details never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
