import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "numbers-to-pdf-converter",
  name: "Numbers to PDF Converter",
  description:
    "Convert Apple Numbers (.numbers) spreadsheets to PDF in the browser — pure JavaScript ZIP parser + pdf-lib. Extracts metadata, parses sheet info from .iwa files (limited), and renders placeholder tables to PDF. Honest about not rendering actual cell content. 100% client-side.",
  category: "file",
  keywords: [
    "numbers to pdf", "numbers converter", "numbers pdf",
    "apple numbers", ".numbers file", "iwork numbers",
    "spreadsheet to pdf", "numbers viewer",
    "numbers-to-pdf-converter", "numbers spreadsheet",
  ],
  icon: "table",
  requiresNetwork: false,
  seo: {
    title: "Numbers to PDF Converter — Convert .numbers to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts Apple Numbers (.numbers) spreadsheets to PDF in your browser. Numbers files are ZIP archives containing: (1) metadata.json with sheet count, title, author; (2) Document.iwa — Snappy-compressed Protobuf with the actual sheet/cell data; (3) preview.jpg — thumbnail of the first sheet. We extract metadata, count sheets, and render placeholder table pages to PDF with the title, sheet numbers, and an honest disclaimer that cell content is not rendered." },
      { q: "Why can't you render the actual cell content?", a: "Numbers stores all data in Document.iwa — Snappy-compressed Protocol Buffers with Apple's undocumented schema. Decoding would require: (1) Snappy decompression (5KB pure-JS decoder); (2) Protobuf parsing (Apple's iWork schema is undocumented and changes between versions); (3) Cell model interpretation (formulas, formatting, charts, images). The total implementation effort is months of reverse engineering. The honest path is what we do: extract metadata, count sheets, render placeholder pages." },
      { q: "What's in the Numbers ZIP?", a: "A typical .numbers file contains: metadata.json (sheet count, title, author, creation date); Document.iwa (compressed Protobuf with cell data); preview.jpg (thumbnail); Tables/ folder with per-table .iwa files; and a 'Indexes/' folder. We parse metadata.json and preview.jpg; we count sheet .iwa files but cannot decompress them." },
      { q: "How are sheets counted?", a: "We count sheet .iwa files in the ZIP. Each Numbers sheet corresponds to one or more .iwa files. If metadata.json contains an explicit sheet count, we use that. Otherwise, we fall back to counting .iwa files matching the 'sheet' pattern. The count is approximate — some .iwa files are for tables within a sheet, not separate sheets." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Sheet count from metadata.json (with .iwa fallback). (3) Placeholder rendering with sheet numbers (1 of N). (4) Stats — sheet count, file size, PDF size. (5) Custom page size (Letter landscape / A4 landscape / A4 portrait). (6) Honest disclaimer about content rendering. (7) Title extraction from metadata. (8) Sheet info panel (sheet count, dimensions). (9) History (localStorage — last 10 conversions). (10) Shareable URL with options." },
      { q: "Is my Numbers file uploaded anywhere?", a: "No. All ZIP parsing, metadata extraction, and PDF generation runs in your browser using pure JavaScript. File contents never leave your device. Only file summaries (filename, sheet count, title) are saved to local history." },
      { q: "How do I render the actual cell content?", a: "Use Apple Numbers (macOS, free) or iCloud.com web Numbers (free Apple ID) to open the .numbers file and export to PDF (File → Export To → PDF). Both render full cell content, formulas, charts, and formatting. For Windows/Linux without an Apple ID, use a third-party converter like CloudConvert or Zamzar (but those upload your file)." },
    ],
  },
  status: "done",
};
