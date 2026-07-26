/**
 * Image Drawing Markup Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-drawing-markup",
  name: "Image Drawing Markup Tool",
  description: "Draw and annotate images. Pen, arrow, rectangle, ellipse, text, highlighter with color control.",
  category: "image",
  keywords: ["image drawing", "image annotation", "markup tool", "image markup"],
  icon: "PenTool",
  requiresNetwork: false,
  seo: {
    title: "Image Drawing Markup Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Draw and annotate images. Pen, arrow, rectangle, ellipse, text, highlighter with color control." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Pen tool (freehand), (2) (2) Arrow tool, (3) (3) Rectangle, (4) (4) Ellipse, (5) (5) Text tool, (6) (6) Highlighter, (7) (7) Color picker, (8) (8) Stroke width, (9) (9) Undo/redo, (10) (10) Download annotated, (11) (11) Clear all, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
