import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-alt-text-generator",
  name: "PDF Alt Text Generator",
  description:
    "Add alternative text to images in PDFs for accessibility (WCAG 2.1 / PDF/UA). " +
    "Enumerates every image on every page, lists those missing alt text, lets you " +
    "batch-add alt text via a pipe-separated textarea, auto-generates placeholder " +
    "alt text ('Image N on page M'), marks decorative images so screen readers skip " +
    "them, and validates alt text quality. Multi-format reports (text/CSV/JSON), " +
    "WCAG compliance scoring, history, shareable URL, and 100% client-side.",
  category: "pdf",
  keywords: [
    "pdf alt text",
    "pdf accessibility",
    "image alt text",
    "pdf ua",
    "wcag alt text",
    "alt text generator",
    "decorative image",
    "screen reader pdf",
  ],
  icon: "image-plus",
  requiresNetwork: false,
  seo: {
    title: "PDF Alt Text Generator — Add Image Alt Text for WCAG & PDF/UA | UnQTools",
    faq: [
      {
        q: "What does the PDF Alt Text Generator do?",
        a: "It loads your PDF in the browser using pdf-lib and walks every page's XObject resources to enumerate all images. For each image it checks whether an /Alt (or /ActualText) entry already exists, then lets you add or override alt text through a pipe-separated textarea (one image per line: page|image_index|alt_text). You can also auto-generate placeholder alt text ('Image N on page M'), mark images without meaningful content as decorative so screen readers skip them, and download the updated PDF. A WCAG 2.1 SC 1.1.1 compliance score is computed based on how many images have alt text.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser (reuse shared module). (2) Image enumerator per page. (3) Pipe-separated alt-text parser. (4) Alt-text applier (sets /Alt entry on image XObject). (5) Decorative-image marker (empty /Alt + artifact). (6) Image list formatter for UI display. (7) Alt-text validator (length, descriptiveness, no-filename-only). (8) Auto-alt-text generator ('Image N on page M'). (9) Missing-alt-text finder. (10) Multi-format renderers (text/CSV/JSON). (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats (total images, with alt, without alt, decorative count). (15) Alt-text quality scorer. (16) Image type detector (photo/diagram/chart/decorative heuristic). (17) WCAG 2.1 compliance checker. (18) Page-by-page image count.",
      },
      {
        q: "How does the decorative-image marker work?",
        a: "When you mark an image as decorative, the tool sets its /Alt entry to an empty string and adds an /Artifact flag (PDF/UA convention). Screen readers conforming to PDF/UA will skip these images entirely. This is the WCAG 2.1 technique for purely decorative images that convey no information (borders, background patterns, spacer GIFs).",
      },
      {
        q: "What format does the alt-text textarea use?",
        a: "One image per line in the format: page|image_index|alt_text. The pipe (|) separates fields; the alt_text field may contain spaces and commas. Lines starting with # are ignored as comments. Whitespace around the alt_text is trimmed. Example: '1|0|Company logo showing blue circle with white checkmark'.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All alt-text processing runs 100% in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
