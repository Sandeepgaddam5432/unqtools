/**
 * Browser Frame Mockup Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "browser-frame-mockup",
  name: "Browser Frame Mockup Maker",
  description: "Wrap screenshots in browser frame mockups. Chrome, Safari, Firefox styles with URL bar.",
  category: "image",
  keywords: ["browser mockup", "browser frame", "screenshot mockup", "browser mockup maker"],
  icon: "Monitor",
  requiresNetwork: false,
  seo: {
    title: "Browser Frame Mockup Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Wrap screenshots in browser frame mockups. Chrome, Safari, Firefox styles with URL bar." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Chrome browser frame, (2) (2) Safari browser frame, (3) (3) Firefox browser frame, (4) (4) Custom URL bar text, (5) (5) Window controls (traffic lights), (6) (6) Background color, (7) (7) Shadow effect, (8) (8) Padding control, (9) (9) Download as PNG, (10) (10) Copy HTML+CSS, (11) (11) Bulk processing, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
