import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-qr-code-stamper",
  name: "PDF QR Code Stamper",
  description:
    "Stamp QR codes onto PDF pages for links, document IDs, or verification tokens. 7 position presets, customizable size/color, optional text labels, 4 error-correction levels, batch per-page entries, page-range expander (\"all\" keyword), hex color parser, QR version calculator, data-capacity checker, URL validator, summary stats, text + CSV reports, history (localStorage), shareable URL. 100% client-side — your PDF never leaves your device.",
  category: "pdf",
  keywords: [
    "qr code pdf", "stamp qr", "pdf qr", "qr stamper",
    "qr on pdf", "add qr code", "pdf verification qr",
    "document qr", "qr label", "qr encoder",
  ],
  icon: "qr-code",
  requiresNetwork: false,
  seo: {
    title: "PDF QR Code Stamper — Add QR Codes to PDF Pages Free | UnQTools",
    faq: [
      {
        q: "How does the PDF QR Code Stamper work?",
        a: "Load a PDF, then enter one entry per line in the format `page,data` (or `all,data` to stamp every page). Pick a position, size, and color; the QR is rendered as vector rectangles onto each specified page using pdf-lib. The result PDF downloads instantly — no upload, no server.",
      },
      {
        q: "Can I stamp different QR data on different pages?",
        a: "Yes. Each line in the QR data textarea targets a page (or \"all\") with its own data. For example: `1,https://example.com/intro` and `2,DOC-2024-0001`. Use \"all\" to stamp every page with the same data.",
      },
      {
        q: "What does the QR error-correction setting do?",
        a: "QR codes support 4 levels — L (7% recovery), M (15%), Q (25%), H (30%). Higher levels let the code survive more damage (smudging, partial obscuring) at the cost of larger matrices for the same data. The default M is the sweet spot for printed PDFs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-line batch parser (page|data). (2) 7 position presets. (3) Size validator (50–500 px). (4) Hex color parser. (5) QR matrix generator with finder + timing patterns. (6) Matrix → rectangles converter. (7) Optional text label with position calculator. (8) Margin calculator. (9) Page-range expander (\"all\" keyword). (10) Text report. (11) CSV export. (12) Copy + Download. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats. (16) QR error-correction selector (L/M/Q/H). (17) QR version calculator. (18) URL validator. (19) Data capacity checker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All QR generation, PDF loading, stamping, and saving run entirely in your browser via pdf-lib. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
