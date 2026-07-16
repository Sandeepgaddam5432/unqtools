import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "keynote-to-pdf-converter",
  name: "Keynote to PDF Converter",
  description:
    "Convert Apple Keynote (.key) presentations to PDF in the browser — pure JavaScript ZIP parser + pdf-lib. Extracts metadata.json for slide count + title, parses preview.jpg, and renders placeholder slides to PDF (with title, slide numbers, and an honest disclaimer about not rendering actual slide content). 100% client-side.",
  category: "file",
  keywords: [
    "keynote to pdf", "keynote converter", "key pdf",
    "apple keynote", ".key file", "iwork converter",
    "keynote viewer", "keynote slides",
    "keynote-to-pdf-converter", "presentation to pdf",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "Keynote to PDF Converter — Convert .key to PDF in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Converts Apple Keynote (.key) presentations to PDF in your browser. Keynote files are ZIP archives containing: (1) metadata.json — a JSON file with the slide count, title, author, and creation date; (2) preview.jpg — a thumbnail of the first slide; (3) slide content in .iwa files — proprietary Snappy-compressed Protocol Buffers that we cannot decode in pure JavaScript. We extract the metadata + preview, then generate a PDF with placeholder slides showing the title, slide count, slide numbers, and an honest disclaimer that actual slide content (text, images, animations) is not rendered." },
      { q: "Why can't you render the actual slide content?", a: "Keynote's slide content lives inside .iwa files, which are Protocol Buffers (Google's binary serialization format) wrapped in Snappy compression (Google's LZ77-like compressor). To render a slide, we'd need to: (1) Snappy-decompress the .iwa (a pure-JS Snappy decoder is ~5KB); (2) parse the Protobuf schema (Apple's iWork schema is undocumented and changes between versions); (3) interpret the slide objects (text boxes, shapes, images, transitions) into a render tree; (4) draw it. Steps 2-4 are not feasible in pure JS without months of reverse engineering. The honest path is what we do: extract metadata, show the preview, render placeholders." },
      { q: "What's in the Keynote ZIP?", a: "A typical .key file contains: metadata.json (slide count, title, author, creation date, size); preview.jpg (thumbnail of the first slide); a 'Data/' folder with .iwa files (compressed slide content); a 'Index/' folder with thumbnails; and 'Indexes/' with metadata indexes. We parse metadata.json and preview.jpg; we list the .iwa files but cannot decompress them." },
      { q: "What are the page size options?", a: "We support 4:3 (1024x768 — classic projector), 16:9 (1920x1080 — modern widescreen), and Letter (8.5x11in). Choose 4:3 for older Keynote files, 16:9 for newer ones (default since Keynote 6.0 in 2013), and Letter if you want a printable PDF." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Slide count from metadata.json. (3) Placeholder rendering with slide numbers (1 of N). (4) Stats — slide count, file size, metadata fields. (5) Preview.jpg extraction and display. (6) Custom page size (4:3 / 16:9 / Letter). (7) Honest disclaimer about content rendering (displayed prominently). (8) Title extraction from metadata.json. (9) History (localStorage — last 10 conversions). (10) Shareable URL with conversion options." },
      { q: "Is my Keynote file uploaded anywhere?", a: "No. All ZIP parsing, metadata extraction, and PDF generation runs in your browser using pure JavaScript. File contents never leave your device. Only file summaries (filename, slide count, title) are saved to local history." },
      { q: "Can I render the actual slides with a desktop tool?", a: "Yes — use Apple Keynote (macOS only, free with the OS) to open the .key file and export to PDF (File → Export To → PDF). For non-Mac users, use iCloud.com's web Keynote (free Apple ID required) to open and export the file. Both render the full slide content. This tool is for quick metadata inspection + placeholder PDF generation when you don't have Keynote available." },
    ],
  },
  status: "done",
};
