/**
 * Image Steganography (Hide Text) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-steganography-hide",
  name: "Image Steganography (Hide Text)",
  description: "Hide text messages inside images using LSB (Least Significant Bit) steganography. Password protection.",
  category: "image",
  keywords: ["steganography", "hide text in image", "lsb steganography", "secret message"],
  icon: "EyeOff",
  requiresNetwork: false,
  seo: {
    title: "Image Steganography (Hide Text) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Hide text messages inside images using LSB (Least Significant Bit) steganography. Password protection." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) LSB steganography, (2) (2) Password protection (XOR), (3) (3) Text message hide, (4) (4) PNG output (lossless), (5) (5) Capacity indicator, (6) (6) Extract from existing, (7) (7) Download stego image, (8) (8) Copy extraction info, (9) (9) Bulk hide, (10) (10) Quality preservation, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
