/**
 * Open Graph Social Card Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "open-graph-social-card-generator",
  name: "Open Graph Social Card Generator",
  description:
    "Design and export social share cards (OG + Twitter). Canvas-based with templates, fonts, gradients, brand kit, and 10+ extras. 100% private.",
  category: "seo",
  keywords: ["open graph", "social card", "og image", "twitter card", "share image", "1200x630", "card designer"],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Open Graph Social Card Generator — Canvas Designer + Export PNG | UnQTools",
    faq: [
      { q: "What size should a social card be?", a: "Standard OG card: 1200×630 pixels (1.91:1 ratio). Twitter large card: same 1200×630. Square card: 1200×1200. Pinterest pin: 1000×1500. This tool supports all common sizes." },
      { q: "What extras does this tool have?", a: "Extras: (1) Canvas-based visual editor, (2) 5 preset templates, (3) Custom title + subtitle + brand, (4) Gradient + solid background, (5) Image upload as background, (6) Logo overlay, (7) 8 web fonts, (8) Text alignment, (9) Multiple sizes (1200×630, 1200×1200, 1080×1080, 1000×1500), (10) Export as PNG (download), (11) Export as JPEG, (12) Copy data URL, (13) Save/restore canvas state (localStorage), (14) Live preview with social platform mock." },
    ],
  },
  status: "done",
};
