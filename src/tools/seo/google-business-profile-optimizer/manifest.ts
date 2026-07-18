import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "google-business-profile-optimizer",
  name: "Google Business Profile Optimizer",
  description:
    "Optimize your Google Business Profile (GBP). Score your description (length, category keyword, city mention, service keyword, call-to-action), generate GBP post templates (What's New / Offer / Event), suggest additional categories, plan required photos, suggest Q&A. Includes keyword density analyzer, 8 business-type presets (plumber, electrician, restaurant, dentist, lawyer, realtor, salon, gym), copy + download .txt + download CSV, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "google business profile", "gbp", "google my business",
    "local seo", "business listing", "google maps",
    "gbp post", "business profile optimization",
  ],
  icon: "store",
  requiresNetwork: false,
  seo: {
    title: "Google Business Profile Optimizer — Posts, Categories & Photos | UnQTools",
    faq: [
      {
        q: "How does the Google Business Profile optimizer work?",
        a: "Enter your business name, primary category, services, city, description, hours, and website. The tool scores your description (0-100) on five components: length (200-750 chars = 30 pts), includes primary category keyword (20), includes city name (20), includes a service keyword (15), and includes a call-to-action (15). It also generates GBP post templates, suggests additional categories, plans required photos, and lists common Q&A.",
      },
      {
        q: "What GBP post templates are generated?",
        a: "Three types: (1) What's New — 100-300 chars highlighting a recent service or project. (2) Offer — 100-300 chars with a discount, expiry, and CTA. (3) Event — 100-300 chars with event name, date, location, and RSVP. Each uses your business name, category, and city.",
      },
      {
        q: "How are category suggestions chosen?",
        a: "A lookup table maps your primary category (e.g. Plumber) to additional relevant GBP categories (e.g. Plumbing contractor, Emergency plumber, Drainage service). 8 business-type presets cover plumber, electrician, restaurant, dentist, lawyer, realtor, salon, and gym.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Description word + char count. (2) Description score (5 components). (3) Keyword density analyzer (top 5). (4) City/category mention detection. (5) GBP post template generator (3 types). (6) Category suggestion engine (lookup table). (7) Photo plan generator (6+ photo types). (8) Q&A suggestions (5+ common questions). (9) Text report. (10) CSV export. (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL. (14) Business type presets (8). (15) Summary stats (score, missing components).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All analysis, scoring, and template generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
