import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-font-extractor",
  name: "PDF Font Extractor",
  description:
    "Extract embedded fonts from PDF — list fonts, identify type (TrueType / Type1 / OpenType / CID), " +
    "detect subsetted fonts, extract embedded font programs to a ZIP, analyze per-page usage and character counts. " +
    "4 extraction modes, multi-format metadata (JSON / CSV / text), history, shareable URL, and 100% client-side processing.",
  category: "pdf",
  keywords: [
    "extract pdf fonts",
    "pdf font list",
    "embedded fonts",
    "subset font",
    "font type detector",
    "truetype type1 opentype",
    "font extraction",
    "pdf font metadata",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "PDF Font Extractor — List & Download Embedded Fonts | UnQTools",
    faq: [
      {
        q: "What does the PDF Font Extractor do?",
        a: "It scans your PDF's font resources and lists every font used: its name, type (TrueType, Type1, OpenType, CIDFontType0, CIDFontType2), whether it is embedded or merely referenced, and whether it is a subset (the name prefix like ABCDEF+ indicates a subset). In extract mode it pulls the embedded font program bytes and bundles them into a ZIP for download. In analyze mode it computes per-page font usage and approximate character counts.",
      },
      {
        q: "What extraction modes are supported?",
        a: "Four modes: list-only (just enumerate fonts), extract-font-files (download embedded font programs as a ZIP), analyze-usage (per-page font usage + character counts), and full (all of the above). You can also filter by font format (all, TrueType, Type1, OpenType, CID) and choose whether to include subsetted fonts.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 extraction modes (list, extract, analyze, full). (2) Font type detector (5 types). (3) Font name normalizer + subset prefix stripper. (4) Font embed checker. (5) Font usage analyzer (per page). (6) Character count per font. (7) Font format filter. (8) Font file extractor. (9) Pure-JS ZIP builder for font packages. (10) Multi-format renderers (text/JSON/CSV). (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (by type, embedded count, subsetted count). (15) Font duplication detector (same font embedded multiple times). (16) Font usage ranking. (17) Standard font checker (Helvetica, Times, Courier, etc.). (18) Font subsetting recommender.",
      },
      {
        q: "Can I extract fonts that are only referenced, not embedded?",
        a: "No. If a font is only referenced (the PDF relies on the reader's installed copy), there is no font program to extract — the tool will list it and mark 'embedded: false'. You can still see the font name and where it's used, but you cannot recover bytes that aren't in the file. This is also a privacy/legal feature: extracting embedded fonts from a PDF you don't own may have licensing implications.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All font enumeration, extraction, and packaging runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
