import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "citation-finder",
  name: "Local Citation Finder",
  description:
    "Find local citation opportunities — directories and listings to submit your NAP (Name/Address/Phone) to. Built-in database of 50+ citation sources (general, niche-specific, country-specific), priority classification, time-to-submit estimator, required-fields list, total time estimate, filter by priority/category, summary stats, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "citations", "local citations", "nap", "business listings",
    "directory submission", "local seo", "yelp", "google business",
    "bing places", "apple maps", "citation sources",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "Local Citation Finder — NAP Directory Submission Opportunities | UnQTools",
    faq: [
      {
        q: "How does the citation finder work?",
        a: "Enter your business name, niche, city, and country. The tool matches you against a built-in database of 50+ citation sources: 10 general directories (Yelp, Bing Places, Apple Maps, Facebook, Foursquare, etc.), 30+ niche-specific directories (HealthGrades for medical, Avvo for legal, Houzz for home services, OpenTable for restaurants, Cars.com for auto, etc.), and 10+ country-specific directories (Yell.com for UK, YellowPages.ca for CA, TrueLocal for AU, JustDial for IN).",
      },
      {
        q: "What info is provided for each citation source?",
        a: "For each directory you get: the direct submission URL (or a Google search fallback), citation priority (high/medium/low based on domain authority), estimated time to submit (5/10/15 minutes), and the required fields (NAP, website, hours, photos, etc.). A total time estimate is computed across all matched directories.",
      },
      {
        q: "Can I filter and export the citation list?",
        a: "Yes. Filter by priority (high/medium/low) or category (general/niche/country). Export as a text report or CSV with columns: directory, url, priority, time, fields. Copy to clipboard or download as .txt or .csv.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Built-in 50+ directory database. (2) Niche-based directory matching. (3) Country-specific directory filter. (4) Direct submission URL generator with Google search fallback. (5) Priority classification (high/medium/low). (6) Time-to-submit estimator per directory. (7) Required-fields list per directory. (8) Total time estimate. (9) Text report renderer. (10) CSV export. (11) Copy + Download .txt + Download CSV. (12) History (localStorage, last 20). (13) Shareable URL. (14) Filter by priority/category. (15) Summary stats (total citations, by priority, total time). (16) Niche presets (18 common business niches).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All citation matching and report generation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
