import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "nap-citation-consistency-checker",
  name: "NAP Citation Consistency Checker",
  description:
    "Check NAP (Name, Address, Phone) consistency across local SEO citations. Compare each citation against your master NAP, normalize formatting, compute consistency %, and flag field-level mismatches. 100% client-side.",
  category: "seo",
  keywords: [
    "nap", "citation", "local seo", "google business profile",
    "name address phone", "local listings", "citation consistency",
  ],
  icon: "map-pin",
  requiresNetwork: false,
  seo: {
    title: "NAP Citation Consistency Checker — Local SEO Audit | UnQTools",
    faq: [
      {
        q: "What is NAP consistency?",
        a: "NAP (Name, Address, Phone) consistency means your business information is identical across every directory, citation site, and listing — Google Business Profile, Yelp, Apple Maps, Bing Places, Facebook, industry directories, etc. Inconsistencies confuse Google's local algorithm and hurt your local pack rankings.",
      },
      {
        q: "How does the tool normalize formatting?",
        a: "We lowercase and strip punctuation from names. For addresses, we expand common abbreviations ('Street' → 'st', 'Avenue' → 'ave', 'North' → 'n'). For phones, we strip all non-digits and keep the last 10 digits (handling +1 country codes). This means '(217) 555-1234' and '217-555-1234' will match.",
      },
      {
        q: "What consistency percentage should I aim for?",
        a: "100% is the goal — even small inconsistencies (Suite vs Ste, dashes vs dots in phone) can hurt. Practically, aim for 90%+ on your top 20-30 citations (the ones Google trusts most). For long-tail citations (smaller directories), 80%+ is acceptable.",
      },
      {
        q: "Which citations matter most?",
        a: "Priority: (1) Google Business Profile (critical), (2) Apple Maps, Bing Places, Yelp, Facebook (high), (3) Yellow Pages, Foursquare, TripAdvisor (medium), (4) Industry-specific directories (varies). Focus on the citations that actually rank in your local pack — check which ones show up for your keywords.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Master NAP input with normalization. (2) Add/remove citation entries. (3) Field-by-field comparison (name / address / phone separately). (4) Mismatch highlighting per field. (5) Stats — consistency %, fully/partially consistent, issues by field. (6) Markdown report export. (7) Google Business Profile reference link. (8) History (localStorage, last 20). (9) Shareable URL — encode master + up to 5 citations in fragment. (10) NAP formatting normalization (abbreviations, phone digits).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All comparison and analysis runs locally. History is stored in localStorage on this device only. We don't fetch your citations — you enter them.",
      },
    ],
  },
  status: "done",
};
