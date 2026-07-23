/**
 * Pixel Art Maker — Tool Manifest
 * Reference: unqtools-docs / "Blueprint — Pixel Art Maker / Sprite Editor".
 *
 * Implementation notes:
 * - 100% client-side. Bundles 25+ curated Lospec-style palettes locally (offline).
 * - gifenc (~50KB) lazy-loaded only when user exports GIF.
 * - UPNG (~80KB) lazy-loaded only when user exports APNG.
 * - JSZip (already a dep) lazy-loaded only when user exports sprite sheet bundle.
 * - Canvas API for in-editor drawing + PNG export.
 * - IndexedDB autosave (debounced 5s) for project persistence.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pixel-art-maker",
  name: "Pixel Art Maker",
  description:
    "A browser pixel-art editor for drawing and animating sprites with layers, frames, palettes, onion-skin, and export to PNG, GIF, APNG, and sprite sheets — entirely offline.",
  category: "image",
  keywords: [
    "pixel art",
    "sprite editor",
    "pixel art maker",
    "sprite animation",
    "palette",
    "gif maker",
    "sprite sheet",
    "apng",
    "pixel drawing",
    "indie game art",
    "lospec palette",
    "pixel sprite",
  ],
  icon: "grid-3x3",
  requiresNetwork: false,
  seo: {
    title: "Pixel Art Maker — Sprite Editor & Animator (PNG/GIF/APNG) | UnQTools",
    faq: [
      {
        q: "Does Pixel Art Maker support layers and animation frames?",
        a: "Yes. Each project supports unlimited layers (with per-layer opacity, visibility, lock, and reordering) and unlimited animation frames with per-frame delay (in milliseconds). Onion-skin shows previous/next frames as a tinted overlay while you draw, and the live preview plays your animation at true size with adjustable speed (0.25x to 4x).",
      },
      {
        q: "What export formats are supported?",
        a: "PNG (scaled 1x-32x with nearest-neighbor), animated GIF (via gifenc), animated APNG (via UPNG, preserves full alpha and 8-bit color depth), sprite sheet PNG with Aseprite-compatible JSON metadata, and a full project save/open JSON format that round-trips losslessly. All encoding runs locally — no uploads.",
      },
      {
        q: "Can I import Lospec palettes offline?",
        a: "Yes. 25+ popular Lospec palettes (Endesga-32, PICO-8, Sweetie-16, NES, Gameboy, DB32, EDG16, Famicube, Vinik24, and more) are bundled directly so they work offline with one click. You can also import .gpl (GIMP palette), .pal, and .hex palette files from your disk, or paste a hex list into the palette manager.",
      },
      {
        q: "Does my project autosave?",
        a: "Yes. Every change is debounced (5s after your last edit) and written to IndexedDB locally in your browser. Reopening the tool restores your last project automatically. You can also save explicit .pam.json project files anywhere on disk. Projects larger than 10MB trigger a warning so you can split your work.",
      },
      {
        q: "Is this tool private? Do my images leave my device?",
        a: "No images leave your browser. Drawing happens on local Canvas, encoding (GIF/APNG/ZIP) runs in-browser via WASM-free JS libraries, and autosave writes to IndexedDB on your device. There are zero network requests during normal use. The tool also works as an offline PWA once installed.",
      },
      {
        q: "Can I use this on a tablet or touchscreen?",
        a: "Yes. The canvas uses Pointer Events with full touch + stylus support, including palm rejection (pressure thresholds) and pan/zoom gestures. Keyboard shortcuts (B/E/G/I/[/]/X/←/→/space/?) are all wired up, and a `?` overlay shows the full cheat-sheet grouped by tools, navigation, and timeline.",
      },
      {
        q: "What extra features ship beyond the base toolset?",
        a: "Ten extras: (1) Sprite-sheet importer with auto-slice, (2) configurable onion-skin panel (prev/next tint, opacity, N frames back), (3) recent-colors strip (last 20 used), (4) animation speed control (0.25x-4x), (5) palette-swap live preview, (6) pixel-perfect stroke auto-correction, (7) Aseprite-compatible JSON export, (8) tagged colors for one-click masking, (9) keyboard shortcut overlay, and (10) tile-flip brush with rotation/mirror variants for tilemaps.",
      },
    ],
  },
  status: "done",
};
