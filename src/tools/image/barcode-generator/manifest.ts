/**
 * Barcode Generator — Tool Manifest
 * Reference: unqtools-docs / "Blueprint #81 — Barcode Generator (Linear / 1D)".
 *
 * Generates 1D/linear barcodes (Code128, Code39, Code93, EAN-13, EAN-8,
 * UPC-A, UPC-E, ITF-14, GS1-128, Codabar, MSI, Pharmacode) plus bonus 2D
 * formats (QR, DataMatrix, PDF417, Aztec). Live preview, PNG/SVG/PDF export,
 * bulk CSV batches, sequence generator, label-sheet print, scan-test camera,
 * and a symbology cheat-sheet. 100% client-side — bwip-js is the engine.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "barcode-generator",
  name: "Barcode Generator",
  description:
    "Generate scannable 1D/linear barcodes (Code128, EAN-13, UPC-A, ITF-14, GS1-128, Codabar, MSI, Pharmacode) with live preview, PNG/SVG/PDF export, bulk CSV batches, label sheets, and a camera scan-test — fully in-browser.",
  category: "image",
  keywords: [
    "barcode generator",
    "code128",
    "code 128",
    "ean13",
    "ean-13",
    "upc",
    "upc-a",
    "itf-14",
    "gs1-128",
    "codabar",
    "msi",
    "pharmacode",
    "label sheet",
    "barcode scanner",
    "scan test",
    "qr code",
    "datamatrix",
    "pdf417",
    "aztec",
  ],
  icon: "barcode",
  requiresNetwork: false,
  seo: {
    title: "Barcode Generator – Code128 / EAN-13 / GS1-128 / QR | UnQTools",
    faq: [
      {
        q: "Which barcode formats does this tool support?",
        a: "1D/linear: Code128 (with auto A/B/C subset switching), Code39, Code93, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, GS1-128 (with application-identifier helper), Codabar, MSI, Pharmacode. Bonus 2D formats: QR Code, DataMatrix, PDF417, Aztec. All powered by bwip-js.",
      },
      {
        q: "Is anything uploaded to a server?",
        a: "No. Rendering uses bwip-js entirely in your browser. The scan-test feature uses your device camera via getUserMedia and processes frames locally with @zxing/browser — no frame ever leaves your device. Works fully offline after first load.",
      },
      {
        q: "Can I generate hundreds of barcodes in bulk?",
        a: "Yes. Paste a CSV or upload a CSV file, pick a format, and click Generate. Batches larger than 100 barcodes run in a Web Worker so the UI stays responsive. You can download the result as a ZIP of PNG/SVG files, a print-ready label sheet (Avery 5160 / L7160 templates or a custom spec), or a manifest CSV with metadata for every barcode.",
      },
      {
        q: "How does the scan-test feature work?",
        a: "After generating a barcode, click Scan-test to open your camera. The tool decodes the on-screen or printed barcode using @zxing/browser and reports whether it is readable. The last 10 scan-test results are kept in a history panel. Camera access requires HTTPS — already the case on Cloudflare Pages.",
      },
      {
        q: "Are checksums calculated automatically?",
        a: "Yes. For EAN-13, EAN-8, UPC-A, UPC-E, ITF-14 and MSI the check digit is auto-computed and appended. If you type a value with the wrong length or wrong check digit the tool shows an inline error explaining the reason — it never renders a broken image.",
      },
      {
        q: "Can I print labels on Avery / L7160 sheets?",
        a: "Yes. Pick a built-in template (Avery 5160, Avery L7160, etc.) or define a custom label sheet (columns, rows, margins, label size, gaps). The tool produces a print-ready PDF with crop marks and a live print-preview modal showing the layout grid for A4, Letter or Legal paper.",
      },
      {
        q: "What extras are included beyond the core feature set?",
        a: "Ten bonus features: (1) 2D formats QR/DataMatrix/PDF417/Aztec, (2) bulk manifest CSV/JSON export, (3) print-preview modal with paper sizes + layout grid, (4) custom label-template library saved to localStorage, (5) copy-as-data-URI for HTML/email embedding, (6) sequence generator for product runs (start/step/count), (7) color-contrast checker that warns when colors won't scan, (8) symbology cheat-sheet tooltips, (9) quiet-zone auto-calculator per ISO/IEC, (10) scan-test history panel of last 10 codes.",
      },
    ],
  },
  status: "done",
};
