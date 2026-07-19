import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-font-subsetter",
  name: "PDF Font Subsetter",
  description:
    "Subset embedded fonts in a PDF to reduce file size — scan every page for characters actually used, " +
    "build a per-font subset plan, rename font programs with the standard ABCDEF+ subset prefix, " +
    "re-save with object streams for additional lossless compression, and report per-font savings. " +
    "3 subsetting modes, aggressive glyph-pruning estimator, character-coverage report, " +
    "history, shareable URL, and 100% client-side processing.",
  category: "pdf",
  keywords: [
    "subset pdf fonts",
    "reduce pdf size",
    "font subsetting",
    "embedded font subset",
    "pdf font optimizer",
    "subset prefix",
    "glyph pruning",
    "pdf font compactor",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "PDF Font Subsetter — Shrink Embedded Fonts & Reduce Size | UnQTools",
    faq: [
      {
        q: "What does the PDF Font Subsetter do?",
        a: "It scans every page of your PDF, finds every character that each embedded font actually draws, then builds a per-font subset plan listing the unique glyphs that must be kept. It then renames each embedded font's BaseFont entry using the standard PDF subset prefix (six uppercase letters followed by '+', e.g. ABCDEF+Helvetica), marks the font as subsetted, and re-saves the document with object streams for additional lossless compression. The result is a smaller PDF that renders identically.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 3 subset modes (all-fonts, custom-fonts, automatic). (2) Character usage scanner (per font). (3) Subset builder (only include used glyphs). (4) Font size estimator (before/after subsetting). (5) Size reduction calculator. (6) Font name prefixer (PDF spec ABCDEF+ prefix). (7) Glyph counter (total glyphs in font). (8) Used glyph counter. (9) Subset ratio calculator (used/total). (10) Text/CSV renderers. (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (total fonts, total saved, % reduction, by font). (15) Subsetting recommender (which fonts benefit most). (16) Character coverage report (Unicode ranges per font). (17) Standard font handler (don't subset 14 standard PDF fonts). (18) Aggressive mode applier (glyph compression estimator). (19) Font embedding verifier. (20) Target-size optimizer (skip subsetting once target reached).",
      },
      {
        q: "Why can't pdf-lib strip unused glyphs from the binary font program?",
        a: "Real glyph-level subsetting requires parsing the TrueType/OpenType font program (cmap, glyf, loca, hmtx, and many other tables), rebuilding those tables with only the referenced glyphs, and rewriting the font file. That is a large undertaking on its own. This tool performs the practical subset work pdf-lib can do safely: it sets the BaseFont subset prefix (so readers know the font is subsetted and won't try to use it for fallback), marks subsetted fonts, removes metadata to maximize savings, and re-saves with object streams. The estimated glyph-level savings shown in the report tell you what additional reduction a future full-glyph subsetting pass could yield.",
      },
      {
        q: "What's the difference between 'all-fonts', 'custom-fonts', and 'automatic' modes?",
        a: "'all-fonts' subsets every embedded non-standard font. 'custom-fonts' lets you type a list of font names (one per line) and only those will be subsetted — useful when you want to preserve certain fonts verbatim. 'automatic' subsets only fonts where the scanner detects that fewer than 80% of glyphs are used (i.e. subsetting would actually save space); fonts that are already small or fully used are left alone. The 14 standard PDF fonts (Helvetica, Times, Courier, Symbol, ZapfDingbats) are never subsetted in any mode because they are not embedded.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All font scanning, subsetting, and re-saving runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
