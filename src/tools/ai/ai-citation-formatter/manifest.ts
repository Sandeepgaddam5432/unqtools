import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-citation-formatter",
  name: "AI Citation Formatter",
  description:
    "Format citations in APA 7, MLA 9, Chicago, Harvard, and IEEE styles for books, journal articles, websites, and newspapers. Per-style full-reference + in-text citation generators, author parser, page-range formatter, sortable reference list, confidence flags per field, validators for DOI/ISBN/URL, and export to plain text, Markdown, HTML, BibTeX, RIS, and JSON. Local library persistence (localStorage), history (last 20), shareable URL. 100% client-side formatting with optional BYO-key LLM polish. No ads, no login, no uploads.",
  category: "ai",
  keywords: [
    "citation formatter", "apa citation generator", "mla citation generator",
    "chicago citation", "harvard citation", "ieee citation",
    "bibliography maker", "reference list", "bibtex generator",
    "ris export", "citation machine alternative", "zotero bib alternative",
    "free citation tool", "no ads citation", "doi to citation",
  ],
  icon: "quote",
  requiresNetwork: false,
  seo: {
    title: "AI Citation Formatter — APA, MLA, Chicago, Harvard, IEEE | UnQTools",
    faq: [
      {
        q: "How does the citation formatter work?",
        a: "Pick a citation style (APA 7, MLA 9, Chicago, Harvard, or IEEE) and a source type (book, journal article, website, or newspaper). Enter the source details — title, authors, year, journal/publisher, volume/issue, pages, URL, DOI/ISBN — and the tool formats a complete reference-list entry plus a matching in-text citation according to the rules of the chosen style. You can build a multi-source reference list, sort it (alphabetical, by year, by type), and export the whole thing to plain text, Markdown, HTML, BibTeX, RIS, or JSON.",
      },
      {
        q: "How accurate are the formatted citations?",
        a: "The formatters implement the official rules for each supported style (APA 7th edition, MLA 9th edition, Chicago notes-bibliography, Harvard author-date, IEEE numeric). They handle the common cases correctly — author inversion, multiple authors with 'et al.' thresholds, page range formats (pp. vs plain), italics for titles/journals, year placement, and DOI/URL suffixes. Edge cases (translated works, edited volumes, chapters, conference proceedings, social media) are not all covered — always verify the output against your institution's style guide. The tool flags uncertain fields with a 'verify' marker.",
      },
      {
        q: "Can this tool fetch metadata from a DOI, ISBN, or URL?",
        a: "The tool validates DOI / ISBN / URL formats offline and flags low-confidence fields with a 'verify this' prompt — but per the privacy-by-default design, the actual metadata lookup step (which would hit public Crossref / OpenLibrary / DOI APIs) is intentionally NOT performed. The blueprint explicitly says metadata lookups happen server-side at other tools and we keep formatting 100% local. If you want to autofill, paste the metadata yourself; the formatting engine does the rest.",
      },
      {
        q: "What extra features does this tool have compared to other citation tools?",
        a: "(1) 5 citation styles (APA 7, MLA 9, Chicago, Harvard, IEEE). (2) 4 source types (book, journal, website, newspaper). (3) In-text citation generator per style. (4) Full reference-list builder. (5) Sort references (alphabetical / by year / by type). (6) Export to plain text, Markdown, HTML, BibTeX, RIS, JSON. (7) Confidence flags per field ('verify this' markers). (8) Local library persistence (localStorage). (9) History (localStorage, last 20). (10) Shareable URL with all source fields encoded. (11) DOI/ISBN/URL format validators (no fetch). (12) Optional BYO-key LLM polish (OpenAI/Anthropic). (13) Honesty disclaimer about metadata verification (per Purdue OWL). (14) Author parser handles 'Last, First' / 'First Last' / multiple authors. (15) Page-range formatter (pp. 12–34). (16) Year/date formatter per style. (17) Multi-source list with copy / download. (18) BibTeX key generator (unique keys per entry).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All citation formatting, sorting, exporting, library persistence, and history run locally in your browser. Your sources never leave this device. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
