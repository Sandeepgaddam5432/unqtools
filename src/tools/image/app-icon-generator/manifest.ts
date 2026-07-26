/**
 * App Icon Generator (iOS/Android) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "app-icon-generator",
  name: "App Icon Generator (iOS/Android)",
  description: "Generate app icons for iOS and Android from a single source image. All required sizes in one click.",
  category: "image",
  keywords: ["app icon", "ios icon", "android icon", "app icon generator"],
  icon: "AppWindow",
  requiresNetwork: false,
  seo: {
    title: "App Icon Generator (iOS/Android) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate app icons for iOS and Android from a single source image. All required sizes in one click." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) iOS icon sizes (29-1024pt), (2) (2) Android icon sizes (mdpi-xxxhdpi), (3) (3) Source image upload, (4) (4) All sizes batch generation, (5) (5) Round/square/circle variants, (6) (6) Adaptive icon (Android), (7) (7) Asset catalog export, (8) (8) PNG transparency preservation, (9) (9) Download as ZIP, (10) (10) Single icon download, (11) (11) Preview all sizes, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
