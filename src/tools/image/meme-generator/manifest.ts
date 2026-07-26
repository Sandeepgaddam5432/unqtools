/**
 * Meme Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "meme-generator",
  name: "Meme Generator",
  description: "Create memes with top and bottom text. Classic meme templates, custom images, Impact font.",
  category: "image",
  keywords: ["meme generator", "meme maker", "create meme", "impact text"],
  icon: "Laugh",
  requiresNetwork: false,
  seo: {
    title: "Meme Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create memes with top and bottom text. Classic meme templates, custom images, Impact font." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Top/bottom text, (2) (2) Impact font, (3) (3) 10+ classic templates, (4) (4) Custom image upload, (5) (5) Text size, (6) (6) Text stroke, (7) (7) Text position, (8) (8) Download as PNG, (9) (9) Bulk meme, (10) (10) Caption presets, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
