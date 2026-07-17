import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "conversion-tracking-tag-generator",
  name: "Conversion Tracking Tag Generator",
  description:
    "Generate conversion tracking tags for Google Ads, Facebook Pixel (Meta), LinkedIn Insight, and Twitter (X). Base + event snippets, custom parameters, HTML output ready to paste. 100% client-side.",
  category: "seo",
  keywords: [
    "conversion tracking", "google ads", "facebook pixel", "meta pixel",
    "linkedin insight", "twitter pixel", "retargeting", "ad tracking",
  ],
  icon: "target",
  requiresNetwork: false,
  seo: {
    title: "Conversion Tracking Tag Generator — Google Ads, FB, LinkedIn, X | UnQTools",
    faq: [
      {
        q: "Which platforms does this tool support?",
        a: "Four: (1) Google Ads conversion tracking (gtag.js event). (2) Facebook/Meta Pixel (base + event). (3) LinkedIn Insight Tag (base + event). (4) Twitter/X Pixel (base + event). Each platform generates the official snippet format ready to paste into your site's <head> or via Google Tag Manager.",
      },
      {
        q: "Where do I find my conversion IDs?",
        a: "Google Ads: Tools & Settings → Conversions → click a conversion → 'Tag setup' → ID like 'AW-123456789'. Facebook Pixel: Meta Events Manager → Data Sources → Pixel → ID is a 15-16 digit number. LinkedIn: Campaign Manager → Account Assets → Insight Tag → Partner ID. Twitter: Tools → Conversion Tracking → Pixel ID.",
      },
      {
        q: "Where do I paste the tags?",
        a: "Base tags go in the <head> of every page (or via Google Tag Manager, or your CMS's tracking settings). Event tags fire on specific actions — paste them on conversion pages (thank-you pages) or trigger them via JavaScript when a conversion happens (button click, form submit).",
      },
      {
        q: "Can I use these tags with Google Tag Manager?",
        a: "Yes. For GTM, you typically don't paste these directly — instead create tags in GTM's UI (Tags → New → choose tag type → enter ID). But you can also paste these snippets into a 'Custom HTML' tag in GTM. The snippets here are for direct site implementation.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Platform selector with 4 platforms. (2) Google Ads base + event snippet generation. (3) Facebook Pixel base + event code. (4) LinkedIn Insight Tag with noscript fallback. (5) Twitter/X Pixel code. (6) Custom event parameters (value, currency, transaction_id). (7) Full HTML snippet generation. (8) Copy each snippet. (9) Validation with warnings for unusual ID formats. (10) History (localStorage, last 20) + shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All tag generation is pure string manipulation. We don't send your conversion IDs anywhere. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
