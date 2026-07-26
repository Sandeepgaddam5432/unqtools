/**
 * Image to SVG (Vectorizer) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-to-svg-vectorizer",
  name: "Image to SVG (Vectorizer)",
  description: "Convert raster images (PNG/JPG) to SVG vector. Edge detection, color quantization, path tracing.",
  category: "image",
  keywords: ["image to svg", "vectorize", "raster to vector", "svg converter"],
  icon: "Spline",
  requiresNetwork: false,
  seo: {
    title: "Image to SVG (Vectorizer) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert raster images (PNG/JPG) to SVG vector. Edge detection, color quantization, path tracing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Edge detection, (2) (2) Color quantization, (3) (3) Path tracing, (4) (4) Smoothness control, (5) (5) Color count, (6) (6) Detail level, (7) (7) Download SVG, (8) (8) Copy SVG, (9) (9) Before/after, (10) (10) Bulk vectorize, (11) (11) SVG optimization, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
