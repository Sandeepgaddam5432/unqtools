import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "link-prospecting-builder",
  name: "Link Prospecting List Builder",
  description:
    "Build link prospecting lists from search footprints. Generate guest post / resource / broken-link queries, prospect template, status tracker (pending / contacted / yes / no), stats, export CSV, dedup, history (localStorage), shareable URL, niche presets, priority scoring. 100% client-side.",
  category: "seo",
  keywords: [
    "link prospecting", "outreach list", "guest post queries",
    "search footprints", "link building", "outreach tracker",
    "seo outreach", "prospecting",
  ],
  icon: "list-search",
  requiresNetwork: false,
  seo: {
    title: "Link Prospecting List Builder — Outreach Queries + Tracker | UnQTools",
    faq: [
      {
        q: "How does the prospecting list builder work?",
        a: "Enter a niche/topic and pick one or more search-footprint categories (guest post, resource, broken link, infographic, podcast, interview). The tool generates Google search queries using proven footprints, builds a prospect template table, and lets you track outreach status per prospect.",
      },
      {
        q: "What search footprints are used?",
        a: "Guest post: 'write for us', 'guest post', 'contribute', 'submit article'. Resource: 'resources', 'useful links', 'recommended sites'. Broken link: 'resources page' + niche. Infographic: 'submit infographic'. Podcast: 'submit podcast'. Interview: 'expert interview'. Each combines with the niche keyword.",
      },
      {
        q: "How does the status tracker work?",
        a: "Each prospect has a status field (pending / contacted / replied / yes / no). Status changes are stored in localStorage so you can resume across sessions. Stats summarize the pipeline (counts per status).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Search footprint generator (6 categories). (2) Prospect template. (3) Status tracker. (4) Stats per status. (5) CSV export. (6) Dedup. (7) History (localStorage, last 20). (8) Shareable URL. (9) Niche presets (SEO, fitness, finance, travel, tech). (10) Priority scoring (high / medium / low). (11) Direct Google search link per query. (12) Per-prospect notes field.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All generation runs locally. Status and history are stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
