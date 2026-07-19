import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-size-optimizer",
  name: "PDF Size Optimizer",
  description:
    "Optimize PDF file size — 4 optimization levels, image downsampling, unused object removal, stream recompression, font subsetting, and metadata stripping. Per-component size analysis, savings report (text/CSV/JSON). 100% client-side, no uploads.",
  category: "pdf",
  keywords: [
    "pdf optimizer",
    "pdf size reducer",
    "optimize pdf",
    "shrink pdf",
    "downsample pdf images",
    "pdf stream compressor",
    "pdf object cleanup",
    "pdf font subsetter",
    "pdf size analyzer",
    "reduce pdf file size",
  ],
  icon: "gauge",
  requiresNetwork: false,
  seo: {
    title: "PDF Size Optimizer — Downsample, Subset & Compress PDFs Free | UnQTools",
    faq: [
      {
        q: "Is my data sent anywhere?",
        a: "No. Optimization runs entirely in your browser using JavaScript and pdf-lib. Your PDF never leaves your device, and the tool works offline.",
      },
      {
        q: "What extra features does this tool include?",
        a: "4 optimization levels (safe / balanced / aggressive / maximum), per-component size analyzer (images, fonts, streams, metadata), image downsampler with 4 DPI targets (72/96/150/300), unused-object detector, stream recompressor, metadata stripper, font-subsetter integration, optimization recommender, multi-format savings reports (text/CSV/JSON), 20-entry history with shareable URLs, quality-impact assessor, image & font count analyzers, and a savings-priority ranker.",
      },
      {
        q: "What's the difference between the four optimization levels?",
        a: "Safe re-saves with object streams and strips nothing visible. Balanced additionally subsets fonts and recompresses streams. Aggressive also downsamples images to 150 DPI and removes unused objects. Maximum downsamples to 96 DPI and strips metadata — use only when small size matters more than visual quality.",
      },
      {
        q: "Does optimization affect image quality?",
        a: "Only the 'Aggressive' and 'Maximum' levels downsample images. Safe and Balanced preserve image resolution. The quality-impact assessor in the report flags exactly which optimizations may degrade visual quality for each run.",
      },
      {
        q: "Can this tool replace the simpler Compress PDF tool?",
        a: "Yes — Compress PDF is a streamlined subset of this tool's 'Safe' level. Use this optimizer when you want fine-grained control over individual optimization levers or need a per-component savings breakdown.",
      },
    ],
  },
  status: "done",
};
