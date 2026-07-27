/**
 * App Icon Generator (iOS/Android) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "app-icon-generator-ios-android",
  name: "App Icon Generator (iOS/Android)",
  description: "Generate app icons for iOS and Android from a single source image. All required sizes.",
  category: "image",
  keywords: ["app icon", "ios icon", "android icon", "app icon generator"],
  icon: "AppWindow",
  requiresNetwork: false,
  seo: {
    title: "App Icon Generator (iOS/Android) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate app icons for iOS and Android from a single source image. All required sizes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
