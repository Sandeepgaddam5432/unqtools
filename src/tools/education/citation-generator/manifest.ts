import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "citation-generator",
  name: "Citation Generator",
  description:
    "Generate academic citations in APA, MLA, Chicago, and Harvard styles for books, journals, websites, newspapers, magazines, conference papers, and theses. Author formatter, multiple-author handler with et al., title formatter, year placement, page range, URL + accessed date, in-text citations, DOI validator, bibliography sorter, text/HTML/Markdown/CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "education",
  keywords: [
    "citation", "apa", "mla", "chicago", "harvard",
    "bibliography", "references", "academic", "research",
    "doi", "citation generator", "citation maker",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "Citation Generator — APA, MLA, Chicago, Harvard | UnQTools",
    faq: [
      {
        q: "How does the citation generator work?",
        a: "Pick a citation style (APA, MLA, Chicago, or Harvard) and a source type (book, journal article, website, newspaper, magazine, conference paper, or thesis), fill in the available fields (title, authors, year, publisher, journal, volume, issue, pages, URL, accessed date, DOI), and the tool formats a properly styled citation. Author names, year placement, title formatting (italic/quoted/plain), page ranges, and URL/accessed-date handling all follow per-style conventions.",
      },
      {
        q: "What citation styles and source types are supported?",
        a: "Four styles (APA 7th, MLA 9th, Chicago, Harvard) and seven source types (book, journal-article, website, newspaper, magazine, conference-paper, thesis). Each combination has its own formatter that follows the standard convention for that style.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 citation styles. (2) 7 source types. (3) Per-style author formatter. (4) Multiple-author handler with 'et al.' for 3+ authors. (5) Title formatter (italic/quoted/plain per style + type). (6) Year placement per style. (7) Page range formatter with proper en-dash. (8) URL + accessed-date formatter. (9) Render as text bibliography. (10) Render as HTML bibliography with hanging indent. (11) Render as Markdown bibliography. (12) Render as CSV. (13) Copy + download .txt/.html/.md/.csv. (14) History (localStorage, max 20). (15) Shareable URL. (16) Summary stats (total, by style, by type). (17) In-text citation generator (APA, MLA, Chicago, Harvard). (18) DOI validator. (19) Bibliography sorter (alphabetical by first author).",
      },
      {
        q: "Can I generate in-text citations too?",
        a: "Yes. Each citation also produces a matching in-text citation — APA: (Smith, 2020); MLA: (Smith 25); Chicago: (Smith 2020, 25); Harvard: (Smith, 2020, p.25). Useful for both bibliography and parenthetical references.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All citation generation runs locally in your browser. History is stored in localStorage on this device only. No references, DOI lookups, or field data are ever sent to a server.",
      },
    ],
  },
  status: "done",
};
