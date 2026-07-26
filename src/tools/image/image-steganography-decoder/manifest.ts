/**
 * Image Steganography Decoder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-steganography-decoder",
  name: "Image Steganography Decoder",
  description: "Extract hidden text from steganographic images. LSB decoding with optional password.",
  category: "image",
  keywords: ["steganography decoder", "extract hidden text", "lsb decode", "stego decode"],
  icon: "Eye",
  requiresNetwork: false,
  seo: {
    title: "Image Steganography Decoder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Extract hidden text from steganographic images. LSB decoding with optional password." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) LSB extraction, (2) (2) Password decryption (XOR), (3) (3) Auto-detect hidden data, (4) (4) Multiple bit-depth, (5) (5) Drag-drop image, (6) (6) Copy extracted text, (7) (7) Export as file, (8) (8) Bulk decode, (9) (9) Magic number detection, (10) (10) Error recovery, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
