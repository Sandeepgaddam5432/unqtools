/**
 * ASCII Art Generator — Tool Manifest
 * Reference: unqtools-docs / "Blueprint — ASCII Art Generator (Image & Text)".
 *
 * Implementation notes:
 * - 100% client-side. figlet.js (~150KB) ships as a dependency and is
 *   lazy-loaded per font; only the 60+ popular FIGlet fonts listed in
 *   `logic.ts → listFigletFonts()` are bundled, each as a separate chunk.
 * - Image pipeline uses Canvas 2D for sampling luminance per cell; all
 *   filters (brightness / contrast / gamma / invert / grayscale / Sobel
 *   edge-detect) are pure functions that operate on a `Uint8ClampedArray`.
 * - Dithering engines (none, Floyd–Steinberg, Atkinson, JJN, Stucki) run
 *   synchronously on the main thread for typical widths (≤400 chars) and
 *   in a Web Worker for very large images (delegated by the UI).
 * - PDF export uses pdf-lib (already a project dependency) — no jspdf.
 * - Webcam mode uses getUserMedia + requestAnimationFrame; never uploads
 *   frames (frames stay in the page until tab is closed).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ascii-art-generator",
  name: "ASCII Art Generator",
  description:
    "Convert images and text into ASCII art — image-to-ASCII with 5 dithering engines, text-to-ASCII with 60+ FIGlet fonts, plus webcam mode and TXT/PNG/SVG/HTML/ANSI/PDF export, all in your browser.",
  category: "image",
  keywords: [
    "ascii art",
    "ascii",
    "figlet",
    "image to ascii",
    "text to ascii",
    "dithering",
    "floyd steinberg",
    "atkinson",
    "ansi art",
    "ascii banner",
    "ascii generator",
    "image to text",
  ],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "ASCII Art Generator – Image & Text to ASCII, Webcam, FIGlet | UnQTools",
    faq: [
      {
        q: "Does image-to-ASCII upload my image?",
        a: "No. All processing happens locally with the Canvas API. The image is drawn to an offscreen canvas, luminance is sampled per cell, and mapped to a character ramp — entirely on your device.",
      },
      {
        q: "Which dithering engines are available?",
        a: "Five: None (basic luminance threshold), Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke (JJN), and Stucki. Each produces visibly different texture; switch instantly with the dithering picker. Large images can run in a Web Worker to avoid jank.",
      },
      {
        q: "How many FIGlet fonts ship with the text mode?",
        a: "60+ curated FIGlet fonts (Standard, Big, Block, Banner, Slant, ANSI Shadow, Star Wars, Doom, Ghost, Shadow, Small, Mini, and many more). Each font chunk is lazy-loaded on first use to keep the initial bundle small.",
      },
      {
        q: "Can I use my webcam as the source?",
        a: "Yes — the Webcam tab captures frames via getUserMedia + requestAnimationFrame and re-renders ASCII in real time. Frames never leave the page. Webcam requires HTTPS in production (Cloudflare Pages serves HTTPS by default).",
      },
      {
        q: "What export formats are supported?",
        a: "Plain TXT, PNG (rasterized monospace), SVG (vector text), colored HTML (true-color or 256/16-color ANSI mapping), ANSI terminal escape codes, print-ready PDF, and one-click copy. ANSI output pastes byte-correct into terminal-aware editors.",
      },
      {
        q: "Why does the output look stretched without aspect correction?",
        a: "Monospace characters are taller than they are wide (~0.5 cell ratio). Toggle 'Aspect correction' so the height is halved — otherwise faces look stretched vertically. The correction is applied automatically to the default preset.",
      },
    ],
  },
  status: "done",
};
