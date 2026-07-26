/**
 * GIF Splitter (to Frames) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gif-splitter",
  name: "GIF Splitter (to Frames)",
  description: "Split animated GIFs into individual PNG frames. Extract frame metadata, delays, disposal methods.",
  category: "image",
  keywords: ["gif splitter", "gif to frames", "gif extract", "gif frames"],
  icon: "Grid3x3",
  requiresNetwork: false,
  seo: {
    title: "GIF Splitter (to Frames) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Split animated GIFs into individual PNG frames. Extract frame metadata, delays, disposal methods." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) GIF to PNG frames, (2) (2) Frame delay extraction, (3) (3) Disposal method info, (4) (4) Frame count, (5) (5) Download as ZIP, (6) (6) Individual frame download, (7) (7) Frame timeline, (8) (8) Bulk split, (9) (9) Frame metadata export, (10) (10) Per-frame preview, (11) (11) FPS calculation, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
