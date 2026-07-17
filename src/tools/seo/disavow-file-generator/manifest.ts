import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "disavow-file-generator",
  name: "Disavow File Generator",
  description:
    "Generate Google Disavow files from URL lists. Domain-level or URL-level entries, comments, dedup, alphabetical sort, stats, and download as .txt. 100% client-side — your data never leaves the browser.",
  category: "seo",
  keywords: [
    "disavow", "google disavow", "backlinks", "spam links",
    "disavow file", "search console", "link penalty", "penguin",
  ],
  icon: "shield-off",
  requiresNetwork: false,
  seo: {
    title: "Disavow File Generator — Google Search Console | UnQTools",
    faq: [
      {
        q: "What is a Google Disavow file?",
        a: "A Disavow file is a text file you submit to Google Search Console telling it to ignore specific backlinks pointing to your site. Use it when you have spammy or low-quality links you can't remove manually — typically after a manual penalty or to protect against algorithmic link issues.",
      },
      {
        q: "When should I use the disavow tool?",
        a: "Only when you have a manual link penalty (visible in Search Console) or you've identified clearly spammy links pointing at your site. Google recommends caution — disavowing good links can hurt your rankings. Always try to remove links manually first by contacting the linking site.",
      },
      {
        q: "What's the difference between domain: and URL-level disavow?",
        a: "domain:example.com disavows ALL links from that entire domain (and subdomains). A full URL like https://example.com/page disavows only links from that specific page. Domain-level is broader and more common for spammy sites — URL-level is more surgical for specific problematic pages.",
      },
      {
        q: "What format does the disavow file use?",
        a: "Plain text, one entry per line. Domain-level lines start with 'domain:' (e.g. 'domain:spam.com'). URL-level lines are the full URL (e.g. 'https://spam.com/page'). Comments start with '#'. Empty lines are ignored. Submit at: Search Console → your property → Links → Disavow links.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Domain-level vs URL-level toggle. (2) Bulk paste — one URL per line. (3) Comment support (#). (4) Dedup URLs case-insensitively. (5) Sort alphabetically (domains first). (6) Stats — URL count, domain count, dup count, invalid count. (7) Google Disavow docs link. (8) Copy to clipboard. (9) History (localStorage, last 20). (10) Shareable URL — encode form state in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Disavow file generation is pure string manipulation in your browser. History is stored in localStorage on this device only. We don't submit the file to Google — you do that manually in Search Console.",
      },
    ],
  },
  status: "done",
};
