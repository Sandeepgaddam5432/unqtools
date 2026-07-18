import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "orphan-page-detector",
  name: "Orphan Page Detector",
  description:
    "Find pages on your site that receive zero internal links. Paste your URL inventory and a list of internal links (plain URLs or <a href> tags) — we detect orphans, count internal links per URL, surface top-linked and bottom-linked pages, and extract anchor text. 100% client-side with CSV export, history (localStorage), and shareable URL. Bulk-parses HTML anchor tags with attribute-tolerant regex.",
  category: "seo",
  keywords: [
    "orphan pages", "internal links", "link audit",
    "site audit", "orphan page", "link graph",
    "internal linking", "seo audit",
  ],
  icon: "unlink",
  requiresNetwork: false,
  seo: {
    title: "Orphan Page Detector — Find Pages With No Internal Links | UnQTools",
    faq: [
      {
        q: "How does the orphan page detector work?",
        a: "Paste two lists: (1) all URLs on your site (one per line) and (2) every internal link you found while crawling (plain URLs or <a href=\"...\"> tags). The tool normalizes every URL (strips fragments, query strings, trailing slashes, lowercases the host) and counts how many times each inventory URL appears in the link list. URLs with a count of zero are flagged as orphans.",
      },
      {
        q: "How are URLs normalized?",
        a: "Each URL is parsed, the host is lowercased, fragment (#...) is stripped, query string (?...) is stripped, and any trailing slash on a non-root pathname is removed. This means /blog/seo-guide and /blog/seo-guide/?ref=nav#top are treated as the same URL.",
      },
      {
        q: "Can I paste raw HTML with <a> tags?",
        a: "Yes. The link parser is attribute-tolerant — it accepts <a href=\"...\">text</a>, <a class='x' href='...'>text</a>, single quotes, double quotes, and unquoted attributes. Anchor text is extracted and deduped per URL so you can see how each page is being linked to.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) URL normalization. (2) Orphan detection (0 internal links). (3) Internal-link count per URL. (4) Link graph summary. (5) Top linked pages. (6) Bottom linked pages. (7) Text-table render. (8) CSV render. (9) Copy + Download TXT + Download CSV. (10) History (localStorage, last 20). (11) Shareable URL. (12) Filter (orphans only / all). (13) Anchor text extraction. (14) HTML <a href> parsing.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All URL parsing and counting runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
