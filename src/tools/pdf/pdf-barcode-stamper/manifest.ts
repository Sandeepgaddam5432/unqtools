import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-barcode-stamper",
  name: "PDF Barcode Stamper",
  description:
    "Stamp barcodes onto PDF pages — CODE128, EAN-13, UPC-A, Code39, and ITF. 6 position presets, customizable width/height, optional text label, per-type validators, checksum calculators for EAN/UPC, bars → rectangles converter, batch per-page entries, page-range expander (\"all\" keyword), hex color parser, data-format suggester, summary stats, text + CSV reports, history (localStorage), shareable URL. 100% client-side — your PDF never leaves your device.",
  category: "pdf",
  keywords: [
    "barcode pdf", "stamp barcode", "pdf barcode",
    "code128 pdf", "ean13 pdf", "upc pdf", "code39 pdf", "itf pdf",
    "barcode stamper", "add barcode",
  ],
  icon: "barcode",
  requiresNetwork: false,
  seo: {
    title: "PDF Barcode Stamper — Add CODE128, EAN-13, UPC, Code39, ITF Barcodes | UnQTools",
    faq: [
      {
        q: "Which barcode types does the stamper support?",
        a: "Five types: CODE128 (any ASCII), EAN-13 (13 digits with checksum), UPC-A (12 digits with checksum), Code39 (alphanumeric + - . $ / + % space), and ITF (Interleaved 2 of 5, even digit count). Each line in the data textarea specifies `page,TYPE,data` (or `page|TYPE|data`).",
      },
      {
        q: "Do the barcodes scan with a real barcode reader?",
        a: "The encoders generate spec-compliant bar/space patterns for CODE39, EAN-13, UPC-A, and ITF — including start/stop guards, checksums, and quiet zones. CODE128 uses the standard character patterns for the printable ASCII range. Most modern barcode readers should scan the CODE39/EAN/UPC/ITF output; CODE128 B works for standard ASCII text. Test on your target reader before relying on it for production.",
      },
      {
        q: "How do I know which barcode type to use for my data?",
        a: "Use the type suggester: paste your data and the tool detects the best-fit type — 12 digits → UPC-A, 13 digits → EAN-13, only digits with even count → ITF, alphanumeric with code39 charset → Code39, otherwise CODE128. You can override the detected type per line in the textarea.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Multi-line batch parser (page|type|data). (2) 5 barcode type encoders (CODE128, EAN-13, UPC-A, CODE39, ITF). (3) 6 position presets. (4) Width/height size calculator. (5) Hex color parser. (6) Checksum calculators (EAN, UPC). (7) Per-type barcode validators. (8) Bars → rectangles converter. (9) Optional text label with position calculator. (10) Text/CSV renderers. (11) Copy + Download. (12) History (localStorage, last 20). (13) Shareable URL. (14) Summary stats. (15) Data-format type suggester. (16) Multi-type batch processor with per-entry validation.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All barcode encoding, PDF loading, and stamping run entirely in your browser via pdf-lib. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};
