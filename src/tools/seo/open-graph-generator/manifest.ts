import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "open-graph-generator",
  name: "Open Graph Generator",
  description:
    "Generate Open Graph and Twitter Card meta tags for social sharing. Live social-card preview, image URL validation, character counters, and links to Facebook/Twitter/LinkedIn debug tools. 100% client-side.",
  category: "seo",
  keywords: [
    "open graph", "og", "twitter card", "social", "facebook", "linkedin",
    "whatsapp", "share", "preview", "rich card", "meta",
  ],
  icon: "share-2",
  requiresNetwork: false,
  seo: {
    title: "Open Graph Generator — Social Share Tags | UnQTools",
    faq: [
      {
        q: "What is Open Graph?",
        a: "Open Graph is a protocol (originally from Facebook) that lets you control how your page appears when shared on social media. It uses og:title, og:description, og:image, og:url, og:type and other meta properties in the HTML <head>.",
      },
      {
        q: "What's the difference between Open Graph and Twitter Cards?",
        a: "They overlap but Twitter uses its own twitter:card / twitter:title / twitter:image tags. Best practice is to emit both sets — our generator does that in a single output block.",
      },
      {
        q: "What size should og:image be?",
        a: "Recommended 1200×630 px, at least 600×315 px. Keep file size under 8 MB (Facebook) and use JPG or PNG. For Twitter summary_large_image use 1200×600 px.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Live social-card preview mockup. (2) Image URL validator. (3) Card type selector (summary / summary_large_image / player / app). (4) Character counters. (5) Facebook Sharing Debugger link. (6) Twitter Card Validator link. (7) LinkedIn Post Inspector link. (8) WhatsApp-style preview. (9) History (localStorage, last 20). (10) Shareable URL — encode the form in the fragment.",
      },
      {
        q: "Is my data sent to Facebook or Twitter?",
        a: "No. Tag generation runs entirely in your browser. The Facebook/Twitter/LinkedIn links open their respective debug tools in a new tab; you'd need to paste your URL there yourself — we never transmit your inputs.",
      },
    ],
  },
  status: "done",
};
