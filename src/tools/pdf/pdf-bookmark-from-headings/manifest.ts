import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-bookmark-from-headings",
  name: "PDF Bookmark from Headings",
  description:
    "Auto-generate a hierarchical PDF bookmark outline from heading styles. Detect headings by font size, " +
    "bold text, regex patterns, or manual selection. Build an H1 → H2 → H3 tree, dedupe orphans, validate " +
    "destinations, and render as text/CSV/JSON. 18 extra features. 100% client-side — your PDF never leaves your browser.",
  category: "pdf",
  keywords: [
    "pdf bookmarks",
    "pdf outline",
    "table of contents",
    "headings to bookmarks",
    "pdf toc",
    "auto bookmarks",
    "heading detector",
    "bookmark generator",
    "pdf navigation",
  ],
  icon: "list-tree",
  requiresNetwork: false,
  seo: {
    title: "Auto-Generate PDF Bookmarks from Headings — Font Size, Bold, Regex | UnQTools",
    faq: [
      {
        q: "How does the PDF Bookmark from Headings tool detect headings?",
        a: "It parses each page's content stream and inspects every text-showing operator along with its current font and font size. You choose one of four detection methods: by-font-size (text larger than H1/H2/H3 thresholds), by-bold-text (bold font + minimum size), by-text-pattern (regex rules), or manual (you specify headings yourself). Detected headings are then assembled into a hierarchical H1 → H2 → H3 tree.",
      },
      {
        q: "How are the bookmarks written back to the PDF?",
        a: "Once the heading tree is built, the tool writes a PDF outline (the /Outlines dictionary) with one /OutlinRef node per heading, each pointing to its destination page via /Dest [pageRef /Fit]. Parent/child relationships are encoded via /Parent, /First, /Last, /Next, and /Prev entries, producing a clickable bookmark tree in any PDF reader.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 heading detection methods (by-font-size, by-bold-text, by-text-pattern, manual). (2) Font-size classifier (H1/H2/H3 thresholds). (3) Bold text detector. (4) Regex pattern matcher with per-line level prefix (e.g. 'H1: Chapter'). (5) Hierarchical bookmark tree builder. (6) Bookmark title formatter. (7) Page-number assigner. (8) Bookmark level validator. (9) Heading coordinate extractor. (10) Multi-format renderers (text tree / CSV / JSON). (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (by level, by page, max depth). (15) Heading distribution analyzer (count per page). (16) Orphan heading detector (H3 without parent H2). (17) Bookmark duplicate remover. (18) Heading text cleaner (whitespace normalizer). Plus destination validation against the actual page count.",
      },
      {
        q: "What text patterns can I use with the regex method?",
        a: "Enter one rule per line. Each rule can be either a bare regex (defaults to H1) or 'H2: pattern' / '1: pattern' / '3: pattern' to set the level. Example rules: 'H1: ^Chapter \\d+', 'H2: ^\\d+\\.\\d+ ', 'H3: ^Note: '. The first rule that matches a text run wins. Invalid regexes are reported as an error before processing.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All PDF parsing and outline writing runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
