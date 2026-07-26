/**
 * Image Metadata (EXIF) Stripper — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-exif-stripper",
  name: "Image Metadata (EXIF) Stripper",
  description: "Strip EXIF metadata from images (GPS, camera info, timestamps). Privacy protection.",
  category: "image",
  keywords: ["exif stripper", "metadata remover", "exif remove", "image privacy"],
  icon: "FileX",
  requiresNetwork: false,
  seo: {
    title: "Image Metadata (EXIF) Stripper — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Strip EXIF metadata from images (GPS, camera info, timestamps). Privacy protection." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) EXIF removal, (2) (2) GPS data removal, (3) (3) Camera info removal, (4) (4) Timestamp removal, (5) (5) Preserve image quality, (6) (6) Bulk processing, (7) (7) Download stripped, (8) (8) Before/after metadata, (9) (9) Per-image download, (10) (10) ZIP download, (11) (11) Privacy report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
