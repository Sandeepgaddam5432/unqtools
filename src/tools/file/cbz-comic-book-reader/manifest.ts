import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cbz-comic-book-reader",
  name: "CBZ Comic Book Reader",
  description:
    "Read CBZ (ZIP-format) comic books in the browser — extract pages, navigate, zoom, fullscreen, bookmark. Supports JPEG/PNG/WebP/GIF pages. Drag-drop, double-page mode, continuous scroll. 100% client-side.",
  category: "file",
  keywords: [
    "cbz reader", "comic book reader", "cbz viewer", "zip comic",
    "manga reader", "comic pages", "extract cbz", "web comic viewer",
    "cbz", "cbz-comic-book-reader",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "CBZ Comic Book Reader — Read Comics in Browser | UnQTools",
    faq: [
      { q: "What is a CBZ file?", a: "A CBZ (Comic Book Zip) is a ZIP archive containing image files — typically JPEG, PNG, WebP, or GIF — one image per page. It's the standard open format for digital comics, supported by every major comic reader. CBR is the same idea but uses RAR compression (which browsers can't decompress natively, so we support CBZ only)." },
      { q: "How does this reader work?", a: "We parse the ZIP structure in JavaScript (using the STORE method, which is the most common compression for CBZ since images are already compressed). Each image is extracted to a Blob URL and displayed as a page. No server involved — everything happens in your browser." },
      { q: "Which reading modes are supported?", a: "Single page (default), double page (two pages side-by-side), and continuous scroll (all pages stacked vertically). Switch modes from the toolbar. The current mode is saved to localStorage per book." },
      { q: "Can I bookmark my place?", a: "Yes. Click the bookmark icon (or press 'B') to save the current page. Bookmarks are stored per file name in localStorage and survive browser restarts. The reader will offer to resume from your last bookmark when you reopen the same CBZ." },
      { q: "What keyboard shortcuts work?", a: "← / →: previous / next page. Space: next page (Shift+Space: previous). Home / End: first / last page. + / -: zoom in / out. 0: reset zoom. F: fullscreen. B: bookmark. D: toggle double-page mode." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file. (2) Page counter with current / total. (3) Zoom in / out / reset. (4) Fit-width / fit-height / original-size modes. (5) Page jump — type a page number. (6) Reading modes — single / double page / continuous scroll. (7) Bookmark page (localStorage). (8) Extract all pages as ZIP download. (9) File info panel — page count, file size, image types. (10) History of recently opened books (localStorage)." },
      { q: "Is my comic uploaded anywhere?", a: "No. The CBZ is parsed entirely in your browser. The image pages never leave your device. Only book names + bookmark page numbers are saved to localStorage history." },
      { q: "Why does the page order matter?", a: "Pages are sorted by filename (natural sort — 'page2.jpg' comes before 'page10.jpg'). This matches the convention used by all comic creators. If your CBZ has filenames in a different order, rename them before packaging." },
    ],
  },
  status: "done",
};
