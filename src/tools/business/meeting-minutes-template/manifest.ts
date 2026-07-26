/**
 * Meeting Minutes Template Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meeting-minutes-template",
  name: "Meeting Minutes Template Builder",
  description: "Build structured meeting minutes with attendees, agenda, and action items. 100% private. 100% private.",
  category: "business",
  keywords: ["meeting-minutes-template".replace(/-/g, ", "), "business"],
  icon: "clipboard",
  requiresNetwork: false,
  seo: {
    title: "Meeting Minutes Template Builder | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
