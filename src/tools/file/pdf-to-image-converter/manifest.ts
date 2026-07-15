import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-image-converter",
  name: "PDF to Image Converter",
  description:
    "Convert PDF pages to PNG, JPEG, or WebP images in your browser. Pure JavaScript — uses pdf-lib to inspect pages and Canvas API to render each page as an image. Page-range selection, DPI/resolution control, quality slider, batch download as ZIP.",
  category: "file",
  keywords: [
    "pdf to image", "convert pdf to png", "pdf to jpg",
    "pdf to jpeg", "pdf to webp", "pdf page to image",
    "pdf image converter", "pdf to image converter", "pdf to picture",
    "extract images from pdf", "pdf screenshots",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "PDF to Image Converter — Convert PDF to PNG/JPEG/WebP in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It loads your PDF with pdf-lib, enumerates page dimensions, and renders each page to a <canvas> element at your chosen DPI. The canvas is then exported as PNG, JPEG, or WebP via toDataURL. You can download each image individually or batch-download all of them as a ZIP." },
      { q: "Why do I need to pick a DPI?", a: "PDF pages are vector — they have no inherent pixel size. We multiply the page's point dimensions (1 pt = 1/72 inch) by your chosen DPI to get the canvas dimensions. 72 DPI matches the PDF's native size, 150 DPI is good for screen preview, 300 DPI is print quality, 600 DPI is for archival." },
      { q: "What PDF features are supported?", a: "We use pdf-lib for page metadata (dimensions, page count, page ranges). Actual rendering uses the browser's Canvas API — we don't include a full PDF rasterizer. For pure-text PDFs this works perfectly. For PDFs with complex graphics (gradients, embedded images, custom fonts), the rendered image may not be a pixel-perfect match — but text is preserved." },
      { q: "Why is rendering done in the UI and not in the logic tests?", a: "Canvas rendering requires a real browser environment (the <canvas> element and its 2D context). The pure-logic tests cover everything that can be tested in Node: page metadata extraction, page range parsing, filename template generation, format/quality handling, stats computation. The UI runs the canvas rendering in your browser." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector (e.g. '1-3,5,7-9'). (3) Three image formats — PNG, JPEG, WebP. (4) Quality slider for JPEG/WebP (0.1–1.0). (5) Resolution control (DPI 72–600). (6) Batch download as a ZIP. (7) Stats — page count, total image bytes, average size per page. (8) Live preview thumbnails. (9) Custom filename template ({name}-{page}.{ext}). (10) Conversion history in localStorage (last 10)." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing, canvas rendering, and image generation happens in your browser. File contents never leave your device." },
      { q: "What's the maximum PDF size?", a: "There's no hard limit, but very large PDFs (1000+ pages) at 300 DPI will consume a lot of memory (each canvas can be 10MB+). We recommend processing in batches of 50–100 pages for high-DPI settings." },
    ],
  },
  status: "done",
};
