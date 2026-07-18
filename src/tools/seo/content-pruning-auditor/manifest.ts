import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "content-pruning-auditor",
  name: "Content Pruning Auditor",
  description:
    "Audit content inventory for keep/improve/merge/redirect/delete decisions. CSV parser, weighted pruning score, Conservative/Balanced/Aggressive presets, threshold customization, summary stats, CSV/text export, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "content pruning", "content audit", "decat", "thin content",
    "merge pages", "redirect map", "content inventory", "deletion candidate",
    "seo audit", "low quality content",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Content Pruning Auditor — Keep / Improve / Merge / Redirect / Delete | UnQTools",
    faq: [
      {
        q: "What is content pruning?",
        a: "Content pruning is the process of reviewing every page on a site and deciding whether to keep, improve, merge, redirect, or delete it. Removing low-quality or thin pages consolidates crawl budget and link equity so higher-value pages can rank better.",
      },
      {
        q: "How is the pruning decision made?",
        a: "Each URL is scored on traffic (40%), backlinks (30%), age (15%), and word count (15%). A high score = keep/improve; a low score with low traffic + low backlinks + old + thin content = delete; medium scores with similar paths suggest merge; old low-value pages without enough authority = redirect.",
      },
      {
        q: "What input format does the tool expect?",
        a: "CSV-like rows: url,traffic,backlinks,word_count,age_months,last_updated_months_ago. Missing fields fall back to safe defaults so you can paste just url,traffic at minimum. The bulk parser handles up to thousands of rows.",
      },
      {
        q: "What extra features does this tool have?",
        a: "(1) CSV input parser with field validation. (2) 5-way decision matrix (keep/improve/merge/redirect/delete). (3) Weighted pruning score. (4) Conservative/Balanced/Aggressive presets. (5) Summary stats per decision. (6) Text table render. (7) CSV render. (8) Copy + Download TXT + Download CSV. (9) History (localStorage, max 20). (10) Shareable URL with preset encoded. (11) Bulk parse with field defaults. (12) Color-coded decision badges. (13) Custom threshold overrides (advanced).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All processing runs locally in the browser. History is stored in localStorage on this device only and never uploaded.",
      },
    ],
  },
  status: "done",
};
