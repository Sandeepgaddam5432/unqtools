import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-thumbnail-generator",
  name: "PDF Thumbnail Generator",
  description:
    "Generate thumbnail images for each PDF page — for previewing, indexing, or gallery views. 5 size presets, 3 output formats (PNG/JPEG/WebP), ZIP or single-image-sprite output. 100% client-side, no uploads.",
  category: "pdf",
  keywords: [
    "pdf thumbnail",
    "pdf preview",
    "pdf page image",
    "pdf to thumbnail",
    "pdf gallery",
    "pdf sprite sheet",
    "pdf page preview",
    "pdf index image",
  ],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "PDF Thumbnail Generator — Page Preview Images Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Thumbnail generation runs entirely in your browser using JavaScript. Your PDF never leaves your device, and the tool works offline.",
      },
      {
        q: "What extra features does this tool include?",
        a: "5 thumbnail size presets (128/256/512/1024/original), 3 output formats (PNG/JPEG/WebP), page-range selection, custom background color, three bundle modes (individual files, ZIP archive, or single-image sprite sheet), sprite-grid calculator, page-orientation detector, thumbnail-quality scorer, multi-format metadata reports (text/CSV/JSON), and 20-entry history with shareable URLs.",
      },
      {
        q: "Does pdf-lib render PDF pages to images?",
        a: "pdf-lib can read page dimensions, metadata, and structure but cannot rasterize page content to images. This tool generates dimension-accurate placeholder thumbnails (correct aspect ratio, page number, orientation indicator) and produces a complete metadata manifest (positions, sizes, filenames) that you can pair with a renderer like pdf.js or Ghostscript for the final raster. This keeps the tool 100% client-side with zero extra dependencies.",
      },
      {
        q: "What is a sprite sheet?",
        a: "A sprite sheet is a single image that combines all thumbnails in a grid. It's smaller and faster to load than many individual files, and is commonly used for web galleries, document previews, and PDF viewers. This tool generates the sprite layout (grid dimensions, per-thumbnail x/y coordinates) and a metadata JSON so you can render it directly in your app.",
      },
      {
        q: "How does the page range work?",
        a: "Use the same syntax as other UnQTools PDF tools: 'all', '1-3, 5, 8-10', '4-' (to end), or '-3' (from start). Invalid ranges are rejected with a clear error message.",
      },
    ],
  },
  status: "done",
};
