import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "scale-pdf", name: "Scale PDF Content",
  description: "Scale PDF page content (text, images, vectors) by a percentage (25%–400%). Page size scales with content. 100% private, runs in your browser.",
  category: "pdf", keywords: ["scale pdf", "zoom pdf", "pdf content scale", "enlarge pdf", "shrink pdf content", "pdf scaler", "pdf magnify"],
  icon: "maximize", requiresNetwork: false,
  seo: { title: "Scale PDF Content Online — Zoom Pages 25%-400% Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Scaling runs entirely in your browser." },
    { q: "How is this different from Resize PDF?", a: "Resize PDF changes the page dimensions without moving content. Scale PDF scales the actual content (text, images) and the page together — everything gets bigger or smaller proportionally." },
    { q: "What scale range is supported?", a: "25% to 400%. 50% makes everything half-size, 200% doubles it. Scales below 25% or above 400% are rejected to prevent unusable output." },
  ]}, status: "done",
};
