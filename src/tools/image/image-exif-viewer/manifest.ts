/**
 * Image Metadata (EXIF) Viewer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-exif-viewer",
  name: "Image Metadata (EXIF) Viewer",
  description: "View EXIF metadata from images. Camera, lens, GPS, settings, timestamps. Export to JSON/CSV.",
  category: "image",
  keywords: ["exif viewer", "image metadata", "exif data", "photo metadata"],
  icon: "FileSearch",
  requiresNetwork: false,
  seo: {
    title: "Image Metadata (EXIF) Viewer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "View EXIF metadata from images. Camera, lens, GPS, settings, timestamps. Export to JSON/CSV." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Camera make/model, (2) (2) Lens info, (3) (3) Exposure settings, (4) (4) GPS coordinates, (5) (5) Timestamps, (6) (6) Software info, (7) (7) Bulk view, (8) (8) Export JSON, (9) (9) Export CSV, (10) (10) Copy metadata, (11) (11) Map link (GPS), (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
