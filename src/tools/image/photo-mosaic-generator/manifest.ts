/**
 * Photo Mosaic Generator — Tool Manifest
 * Reference: unqtools-docs / "Blueprint — Photo Mosaic Generator" (#84).
 *
 * Recreates a main image out of hundreds of small tile photos, with adjustable
 * tile size, color matching, and high-resolution export — 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "photo-mosaic-generator",
  name: "Photo Mosaic Generator",
  description:
    "Build a photo mosaic — recreate a main image out of hundreds of small tile photos, with adjustable tile size, perceptual color matching, grout spacing, and high-resolution print export. 100% client-side; your photos never leave your browser.",
  category: "image",
  keywords: [
    "photo mosaic",
    "mosaic generator",
    "tile collage",
    "photo collage",
    "image mosaic",
    "photo tiles",
    "pattern image",
    "picture mosaic",
    "perceptual color matching",
    "print mosaic",
  ],
  icon: "grid-3x3",
  requiresNetwork: false,
  seo: {
    title: "Photo Mosaic Generator – Private, Full-Res, Print-Ready | UnQTools",
    faq: [
      {
        q: "Do my photos get uploaded to a server?",
        a: "No. Every step — tile indexing, color matching, and final compositing — runs locally in your browser using Web Workers, Canvas, and IndexedDB. Your main image and tile library never leave your device. This makes the tool safe for private family photos and commercial art installations alike.",
      },
      {
        q: "How does the color matching work?",
        a: "Each tile is downsampled to a small thumbnail and its average color is computed in both RGB and CIE Lab color spaces. When the mosaic is built, every cell of the main image is matched to the nearest tile using a k-d tree for fast nearest-neighbor search. You can choose average-color matching, perceptual Lab matching (better for human vision), or edge-aware matching which also weighs structural similarity.",
      },
      {
        q: "How many tiles can I use, and will it freeze my browser?",
        a: "Tiles are processed in a Web Worker pool sized to your CPU (capped at 8 workers). Hundreds of HEIC or large JPG tiles are downscaled aggressively and cached as ~48px thumbnails, keeping memory under ~256MB. A progress bar shows live status like 'Analyzing 800 photos…'. Even 1000+ tiles work on modest hardware.",
      },
      {
        q: "Are HEIC photos from my iPhone supported?",
        a: "Yes. When a HEIC file is detected, the heic2any library (~1.5MB) is lazy-loaded on demand and decodes the file to a bitmap inside a Worker. The library is only fetched when actually needed, keeping the initial bundle slim.",
      },
      {
        q: "What if I don't have any tile photos?",
        a: "Use the built-in starter tile set — a procedurally generated palette of solid colors and gradients that keeps the bundle small (no shipped image assets). It's perfect for testing the tool or creating abstract mosaics. You can also mix starter tiles with your own photos.",
      },
      {
        q: "Can I export at print resolution?",
        a: "Yes. Choose a target DPI and paper size (A4, A3, or Letter) and the tool calculates exact pixel dimensions, then renders the mosaic in 1024x1024 chunks streamed to a single full-resolution canvas. Export as PNG (lossless) or JPG (smaller). A CSV/JSON tile-map manifest is also available for recreating the mosaic offline as a physical installation.",
      },
      {
        q: "Can I reuse my tile library across sessions?",
        a: "Yes. Tile thumbnails and their precomputed average/Lab colors are persisted to IndexedDB. Next time you open the tool, you'll see 'Reusing N tiles from last session' and can start building immediately without re-indexing. You can clear the cache at any time.",
      },
      {
        q: "What are the advanced features?",
        a: "Side-by-side original/mosaic/blend comparison slider, per-tile inspection (click any tile to see its source photo, match score, and alternatives), a tile-usage histogram showing over/under-used tiles, custom tile weighting, a reveal-animation export (tiles flipping into place via MediaRecorder), a print-resolution calculator, and a mask-regions tool to mark important areas of the main image for best-match tiles.",
      },
    ],
  },
  status: "done",
};
