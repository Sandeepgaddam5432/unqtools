import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-stamp", name: "Add Stamp to PDF",
  description: "Add a stamp to PDF pages — choose from APPROVED, DRAFT, CONFIDENTIAL, PAID, RECEIVED, REJECTED, or custom text. Set position, size, color, and date. 100% private.",
  category: "pdf", keywords: ["pdf stamp", "stamp pdf", "approved stamp", "draft stamp", "confidential stamp", "pdf rubber stamp", "pdf annotation stamp"],
  icon: "stamp", requiresNetwork: false,
  seo: { title: "Add Stamp to PDF Online — APPROVED, DRAFT, CUSTOM Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Stamping runs entirely in your browser." },
    { q: "What stamp presets are available?", a: "APPROVED, DRAFT, CONFIDENTIAL, PAID, RECEIVED, REJECTED, URGENT, and FINAL. You can also type custom text." },
    { q: "Can I include the date in the stamp?", a: "Yes. Check 'Include date' to append the current date (YYYY-MM-DD) to the stamp text." },
  ]}, status: "done",
};
