/**
 * Passport ID Photo Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "passport-id-photo-maker",
  name: "Passport ID Photo Maker",
  description: "Create passport/ID photos with correct dimensions for 30+ countries. Crop, background, print layout.",
  category: "image",
  keywords: ["passport photo", "id photo", "passport photo maker", "visa photo"],
  icon: "CreditCard",
  requiresNetwork: false,
  seo: {
    title: "Passport ID Photo Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create passport/ID photos with correct dimensions for 30+ countries. Crop, background, print layout." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 30+ country presets (US, UK, EU, IN, etc.), (2) (2) Correct dimensions (2x2 inch, 35x45mm), (3) (3) Background color, (4) (4) Crop guide (head position), (5) (5) Print layout (4x6, A4), (6) (6) DPI control, (7) (7) Download, (8) (8) Bulk generate, (9) (9) Print-ready, (10) (10) Per-country requirements, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
