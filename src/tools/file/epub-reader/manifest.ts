import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "epub-reader",
  name: "EPUB Reader",
  description:
    "Read EPUB ebooks in the browser — extract chapters, table of contents navigation, prev/next, font size + family, dark/light reading mode, search within text, bookmarks. 100% client-side.",
  category: "file",
  keywords: [
    "epub reader", "ebook reader", "epub viewer", "epub browser",
    "read epub", "book reader", "opk manifest", "toc navigation",
    "ebook", "epub-reader",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "EPUB Reader — Read Ebooks in Browser | UnQTools",
    faq: [
      { q: "What is an EPUB file?", a: "EPUB is the open standard ebook format. It's a ZIP archive containing XHTML chapters, images, stylesheets, and an OPF manifest that lists every piece of content plus a NCX/NAV table of contents. Every major ebook store sells EPUBs and most libraries lend them." },
      { q: "How does this reader work?", a: "We parse the EPUB (ZIP) structure, read the OPF manifest to identify the spine (reading order), then render each chapter as HTML in your browser. Images and stylesheets are resolved relative to each chapter and inlined as Blob URLs." },
      { q: "Which EPUB versions are supported?", a: "EPUB 2 (uses NCX for TOC) and EPUB 3 (uses NAV XHTML for TOC). We parse both formats and fall back gracefully — if no NAV is found, we use NCX; if neither exists, we build a TOC from chapter titles." },
      { q: "Can I change the font?", a: "Yes. Font size (sm / md / lg / xl / 2xl), font family (sans / serif / mono), and a dark / light reading mode toggle. Settings are saved to localStorage per book so they persist between sessions." },
      { q: "Can I search within the book?", a: "Yes. The search bar scans every chapter's text content and returns matching paragraphs with surrounding context. Click a result to jump straight to that chapter." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file. (2) Chapter list sidebar with current-chapter highlight. (3) Font family selection (sans / serif / mono). (4) Dark / light reading mode. (5) Bookmark chapter (localStorage — resume from last chapter on reopen). (6) Search within book text with result jumping. (7) Reading progress percentage (chapters read / total). (8) Copy selected chapter text. (9) File info panel — title, author, chapter count, file size. (10) History of recently opened books (localStorage)." },
      { q: "Is my book uploaded anywhere?", a: "No. The EPUB is parsed entirely in your browser. Chapter content, images, and metadata never leave your device. Only book titles + current chapter indices are saved to localStorage for resume." },
      { q: "What about DRM-protected EPUBs?", a: "DRM (Adobe ADEPT, Apple FairPlay, etc.) requires a license key — we cannot decrypt those. If your EPUB fails to open, check that it's DRM-free. Most Project Gutenberg, Standard Ebooks, and Humble Bundle books are DRM-free." },
    ],
  },
  status: "done",
};
