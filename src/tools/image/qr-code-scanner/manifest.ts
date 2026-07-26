/**
 * QR Code Scanner (from Image) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "qr-code-scanner",
  name: "QR Code Scanner (from Image)",
  description: "Scan QR codes from uploaded images. Multiple QR detection, all QR types supported.",
  category: "image",
  keywords: ["qr scanner", "qr reader", "scan qr", "qr decoder"],
  icon: "ScanLine",
  requiresNetwork: false,
  seo: {
    title: "QR Code Scanner (from Image) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Scan QR codes from uploaded images. Multiple QR detection, all QR types supported." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Image QR scan, (2) (2) Multiple QR detection, (3) (3) All QR types (URL/text/WiFi/vCard), (4) (4) Drag-drop image, (5) (5) Copy result, (6) (6) Open URL, (7) (7) History (localStorage), (8) (8) Bulk scan, (9) (9) Export results, (10) (10) Live preview, (11) (11) Error recovery, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
