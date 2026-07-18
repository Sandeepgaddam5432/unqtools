import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "guest-post-finder",
  name: "Guest Post Niche Site Finder",
  description:
    "Find guest posting opportunities with Google search footprints. Generate search queries for write-for-us, guest post, contribute, submit-article. Niche input, query generator, Google search link, bulk queries, copy queries, stats, history (localStorage), shareable URL, niche presets. 100% client-side.",
  category: "seo",
  keywords: [
    "guest post", "guest posting", "write for us",
    "guest article", "submit article", "contribute",
    "guest post finder", "outreach",
  ],
  icon: "pen-tool",
  requiresNetwork: false,
  seo: {
    title: "Guest Post Niche Site Finder — Search Footprints + Queries | UnQTools",
    faq: [
      {
        q: "How does the guest post finder work?",
        a: "Enter your niche keyword and we generate Google search queries using proven guest-post footprints: 'write for us', 'guest post', 'guest article', 'contribute to', 'submit article', 'become a contributor'. Each query has a direct Google search link so you can scan the SERPs for opportunities.",
      },
      {
        q: "What footprints are included?",
        a: "Six categories of footprints: write-for-us (5 variations), guest post (8), contribute (6), submit article (5), become a contributor (4), and guest column (4). Combined with your niche, that's up to 32 queries per niche.",
      },
      {
        q: "Can I bulk-generate queries?",
        a: "Yes. Enter multiple niches (one per line or comma-separated) and the tool generates queries for each niche × each footprint. Copy all queries to clipboard or download as a text file.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Search footprint templates (6 categories, 32 footprints). (2) Niche input. (3) Query generator. (4) Direct Google search link per query. (5) Bulk queries (multi-niche). (6) Copy all queries. (7) Stats (query count per niche). (8) History (localStorage, last 20). (9) Shareable URL. (10) Niche presets. (11) Download queries as .txt. (12) Footprint category filter.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All query generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
