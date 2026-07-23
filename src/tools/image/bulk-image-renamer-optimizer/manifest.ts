/**
 * Bulk Image Renamer + Optimizer — Tool Manifest.
 *
 * Differentiator vs `image-compressor`: this tool emphasizes the RENAME layer
 * (token system, sequence counter, find-replace, case transforms, EXIF/date
 * tokens, perceptual-hash duplicate detection, drag-reorder, conflict
 * auto-resolve) and bundles optimization in the same pass — all 100% in the
 * browser via Canvas + Web Workers.
 *
 * Reference: unqtools-docs / "Blueprint #100 Bulk Image Renamer + Optimizer".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-image-renamer-optimizer",
  name: "Bulk Image Renamer + Optimizer",
  description:
    "Batch-rename and optimize many images in one pass with live preview, token templates, conflict auto-resolve, perceptual-hash dedupe, and a single ZIP download — 100% in your browser.",
  category: "image",
  keywords: [
    "bulk image renamer",
    "image renamer",
    "batch rename images",
    "image optimizer",
    "compress images",
    "rename photos",
    "exif renamer",
    "sequential rename",
    "image resizer",
    "image converter",
    "webp batch",
    "jpeg batch",
    "photo renamer",
    "file rename tokens",
    "perceptual hash",
  ],
  icon: "images",
  requiresNetwork: false,
  seo: {
    title: "Bulk Image Renamer + Optimizer – Private Batch Rename & Compress | UnQTools",
    faq: [
      {
        q: "Are my images uploaded to a server?",
        a: "No. All renaming, optimization, EXIF parsing, perceptual hashing, and ZIP packaging happens locally in your browser via the Canvas API, exifr, and Web Workers. Your files never leave your device — this is the single biggest privacy advantage over server-based batch tools.",
      },
      {
        q: "What rename tokens are supported?",
        a: "Tokens available in the pattern field: {index} (1-based position in the queue), {counter} (configurable start/step/pad), {original} (original filename without extension), {date} (file last-modified date YYYY-MM-DD), {exif:date} (EXIF DateTimeOriginal, falls back to {date} when missing), and {width}x{height} (post-resize dimensions). Combine with prefix, suffix, find-replace, and case transforms (lower/kebab/snake).",
      },
      {
        q: "How are filename conflicts handled?",
        a: "After applying your rename rule, the tool scans the resulting names. Any duplicates are auto-resolved by appending an incrementing suffix (e.g. photo.jpg, photo-1.jpg, photo-2.jpg). Conflicts are highlighted in red in the preview table, and a warning badge tells you how many names were auto-suffixed.",
      },
      {
        q: "What image formats are supported?",
        a: "Input: JPEG, PNG, WebP, GIF, BMP, and HEIC (HEIC is decoded via heic2any which lazy-loads only when a HEIC file is detected, keeping the initial bundle small). Output: JPEG, PNG, WebP. AVIF output is not yet supported because the browser Canvas API does not expose AVIF encoding — this is deferred to a later phase that will add a WASM encoder. For now WebP gives the best size/quality ratio in modern browsers.",
      },
      {
        q: "How does this differ from the standalone Image Compressor tool?",
        a: "The existing image-compressor tool focuses on compress/resize/convert for a small set of files. This tool layers a full rename engine on top (tokens, sequence counter, find-replace, case transforms, EXIF/date substitution), adds a drag-reorder live preview table, perceptual-hash duplicate detection, audit CSV/JSON export, watermarking, history with localStorage, and shareable URL presets. If you only need to compress a few images, use image-compressor; if you need to rename + optimize a large batch with a consistent pattern, use this tool.",
      },
      {
        q: "Can it handle hundreds of files?",
        a: "Yes. Processing runs in a Web Worker pool (OffscreenCanvas when available, main-thread fallback otherwise) so the UI stays responsive. A memory cap (~256 MB total) is enforced; if you exceed it the tool pauses and warns you. ZIP output is built incrementally so even large batches download as a single archive without holding every blob in memory at once.",
      },
      {
        q: "What extras are included beyond the core feature set?",
        a: "Ten extras: (1) operation history with localStorage (last 10 runs, one-click re-apply), (2) shareable URL presets (config encoded in the URL hash), (3) audit CSV/JSON export (full old-to-new name + size map), (4) perceptual-hash duplicate detector (skips near-duplicate images even with different filenames), (5) side-by-side thumbnail diff viewer, (6) live throughput dashboard (files/sec, MB processed, ETA, peak memory), (7) per-format quality matrix preview (5 quality levels side-by-side), (8) visual folder-structure editor for output tree, (9) bulk EXIF metadata inspector panel, (10) text watermark embed with position/opacity/color.",
      },
      {
        q: "Does this strip EXIF metadata?",
        a: "Optionally. Canvas re-encoding inherently drops most original metadata; the 'Strip EXIF' toggle (on by default) confirms this behavior. Turn it off only if you specifically need to preserve metadata — note that EXIF-based rename tokens like {exif:date} still work because EXIF is read from the source file before re-encoding, regardless of the strip setting.",
      },
    ],
  },
  status: "done",
};
