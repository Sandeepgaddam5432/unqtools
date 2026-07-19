import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-translation-overlay",
  name: "PDF Translation Overlay",
  description:
    "Overlay translated text on PDF pages for multilingual documents. 4 position presets (above / below / beside / replace original), 3 standard PDF fonts (Helvetica / Times-Roman / Courier), hex color + optional background highlight, page-range parser, text-direction (LTR/RTL) detector, RTL handler, basic Unicode language detection, multi-line batch parser (page|x|y|text|size), text-width estimator, overlay collision detector, CSV + text reports, history (localStorage, last 20), shareable URL. 100% client-side — your PDF never leaves your device.",
  category: "pdf",
  keywords: [
    "pdf translation", "translation overlay", "multilingual pdf",
    "pdf subtitle", "translate pdf", "pdf bilingual",
    "overlay text pdf", "pdf language", "pdf annotate",
    "rtl pdf overlay", "ltr pdf", "pdf second language",
  ],
  icon: "languages",
  requiresNetwork: false,
  seo: {
    title: "PDF Translation Overlay — Add Translated Text to PDFs Free | UnQTools",
    faq: [
      {
        q: "How does the PDF Translation Overlay work?",
        a: "Load a PDF, then enter one translation entry per line in the format `page|x|y|translated_text|font_size` (the last two fields are optional). Pick a position preset (above / below / beside / replace the original), font family, font size, and color; the overlay is drawn onto each specified page using pdf-lib. The result PDF downloads instantly — no upload, no server.",
      },
      {
        q: "Can I overlay translations on specific pages only?",
        a: "Yes. Each translation entry targets a single page+coordinate (e.g. `1|72|700|Hello|12`). The Page Range field further restricts which pages are eligible — set it to `all` (default), or `1-3, 5, 8-` for a subset. Entries outside the page range are skipped.",
      },
      {
        q: "Does this tool translate the PDF for me?",
        a: "No. This is an overlay tool — you provide the translated text. It does NOT call any translation API (no network). Use it after you have translations from your preferred translator. The tool's job is to render those translations onto the right place on the PDF, with optional background highlight and proper LTR/RTL handling.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Page-range parser. (2) Translation parser (page|x|y|text|size). (3) 4 position presets (above / below / beside / replace). (4) 3 standard PDF fonts (Helvetica / Times-Roman / Courier). (5) Hex color parser. (6) Optional background highlight. (7) Text-width estimator. (8) Overlay collision detector. (9) Text-direction (LTR/RTL) detector. (10) RTL text handler. (11) Basic Unicode language detection. (12) Multi-line batch parser. (13) Text + CSV reports. (14) Copy + Download. (15) History (localStorage, last 20). (16) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All PDF loading, overlay rendering, and saving run entirely in your browser via pdf-lib. History is stored in localStorage on this device only. Nothing is uploaded — there is no translation API call.",
      },
    ],
  },
  status: "done",
};
