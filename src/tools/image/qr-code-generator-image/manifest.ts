/**
 * QR Code Generator (Image) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "qr-code-generator-image",
  name: "QR Code Generator (Image)",
  description: "Generate QR codes as images. URL, text, WiFi, vCard, SMS, email. Custom colors, logo overlay.",
  category: "image",
  keywords: ["qr code", "qr generator", "qr code image", "qr maker"],
  icon: "QrCode",
  requiresNetwork: false,
  seo: {
    title: "QR Code Generator (Image) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate QR codes as images. URL, text, WiFi, vCard, SMS, email. Custom colors, logo overlay." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) URL QR, (2) (2) Text QR, (3) (3) WiFi QR, (4) (4) vCard QR, (5) (5) SMS/email QR, (6) (6) Custom colors, (7) (7) Error correction (L/M/Q/H), (8) (8) Logo overlay, (9) (9) Size control, (10) (10) Download as PNG, (11) (11) Download as SVG, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
