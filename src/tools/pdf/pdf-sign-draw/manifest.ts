import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-sign-draw", name: "Draw Signature on PDF",
  description: "Place a signature image (PNG/JPEG) on any PDF page at a custom position and size. Draw your signature on paper, photograph it, then overlay it. 100% private.",
  category: "pdf", keywords: ["pdf signature", "sign pdf", "draw signature", "pdf sign", "esign pdf", "signature overlay", "pdf signer"],
  icon: "pen-tool", requiresNetwork: false,
  seo: { title: "Draw Signature on PDF Online — Place Signature Image Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Signature placement runs entirely in your browser." },
    { q: "What image formats are supported for the signature?", a: "PNG and JPEG. PNG is recommended for signatures with transparency." },
    { q: "How do I create a signature image?", a: "Draw your signature on paper, photograph it with your phone, and upload the image. Or use a drawing app to create a digital signature and save as PNG." },
  ]}, status: "done",
};
