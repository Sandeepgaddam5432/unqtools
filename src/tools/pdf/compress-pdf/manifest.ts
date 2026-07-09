import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "compress-pdf",
  name: "Compress PDF",
  description:
    "Reduce PDF file size by re-saving with object streams and optionally stripping metadata. 100% private — runs in your browser, no uploads.",
  category: "pdf",
  keywords: [
    "compress pdf",
    "reduce pdf size",
    "optimize pdf",
    "shrink pdf",
    "pdf compressor",
    "smaller pdf",
    "pdf optimizer",
  ],
  icon: "minimize-2",
  requiresNetwork: false,
  seo: {
    title: "Compress PDF Online — Reduce PDF File Size Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Compression runs entirely in your browser using JavaScript. Your files never leave your device, and the tool works offline.",
      },
      {
        q: "How much size reduction can I expect?",
        a: "Typically 10-40% for most PDFs. PDFs that are already heavily optimized or contain mostly compressed images (JPEG) may see little reduction. Object stream re-packaging and optional metadata stripping are the main savings.",
      },
      {
        q: "Does compression affect image quality?",
        a: "No. This tool re-saves the PDF using object streams (a structural optimization) and optionally strips metadata. It does NOT re-encode or downsample images, so visual quality is preserved exactly.",
      },
      {
        q: "What does 'Strip metadata' do?",
        a: "Removes the Title, Author, Subject, Keywords, Creator, and Producer fields from the PDF's document info dictionary. This reduces size slightly and also enhances privacy before sharing.",
      },
    ],
  },
  status: "done",
};
