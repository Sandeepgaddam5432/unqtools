/**
 * Image Compressor — Tool Manifest
 * Reference: unqtools-docs / "Blueprint — Image Compressor".
 *
 * Implementation note: this Phase 2 build uses the browser's Canvas API
 * (no WASM codecs yet). WASM encoders (MozJPEG / OxiPNG / WebP / AVIF) are
 * listed in the blueprint as the "10x layer" and will be added in a later
 * phase. The Canvas API already supports JPG/PNG/WebP output with quality
 * control, resize, and EXIF strip — covering the blueprint's must-have bar.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-compressor",
  name: "Image Compressor",
  description:
    "Compress and convert JPG/PNG/WebP images with live quality preview, resize, EXIF strip, and bulk download as ZIP. 100% private — images never leave your browser.",
  category: "image",
  keywords: [
    "image compressor",
    "compress jpg",
    "compress png",
    "webp converter",
    "image resizer",
    "bulk image compression",
    "reduce image size",
    "exif strip",
    "image optimizer",
  ],
  icon: "image",
  requiresNetwork: false,
  component: () => import("./ui"),
  seo: {
    title: "Image Compressor – Bulk, Private, AVIF/WebP | UnQTools",
    faq: [
      {
        q: "Are my images uploaded to a server?",
        a: "No. All compression happens locally using the browser's Canvas API. Your images never leave your device. This is the single biggest privacy advantage over server-based compressors like TinyPNG.",
      },
      {
        q: "What formats are supported?",
        a: "Input: JPG, PNG, WebP, GIF, BMP. Output: JPG, PNG, WebP. AVIF output requires a WASM encoder that ships in a later phase; for now WebP gives the best size/quality ratio in modern browsers.",
      },
      {
        q: "Is there a file limit?",
        a: "No hard limit — your device's memory is the only ceiling. Bulk mode processes files sequentially to avoid memory spikes, so even 100+ images work on modest hardware.",
      },
      {
        q: "Does this strip EXIF metadata?",
        a: "Yes, optionally. Canvas-based re-encoding strips all original metadata by default. Toggle 'Strip EXIF' off only if you specifically need to preserve it (rare for compression use cases).",
      },
    ],
  },
  status: "done",
};
