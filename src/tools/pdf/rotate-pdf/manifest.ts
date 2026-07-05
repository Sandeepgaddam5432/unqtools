import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rotate-pdf",
  name: "Rotate PDF",
  description:
    "Rotate all pages, odd pages, even pages, or any specific page in a PDF by 90°, 180°, or 270°. 100% private — runs entirely in your browser.",
  category: "pdf",
  keywords: ["rotate pdf", "pdf rotation", "turn pdf", "flip pdf pages", "pdf orientation"],
  icon: "rotate-cw",
  requiresNetwork: false,
  seo: {
    title: "Rotate PDF Online — All, Odd, Even, or Specific Pages | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded to a server?",
        a: "No. Rotation happens 100% locally in your browser using JavaScript. Nothing leaves your device.",
      },
      {
        q: "Can I rotate only some pages?",
        a: "Yes. Choose from: All pages, Odd pages, Even pages, or enter specific page numbers / ranges (e.g. 1, 3-5).",
      },
      {
        q: "Will rotation change any other content in the PDF?",
        a: "No. Only the page rotation flag is updated. All content, fonts, and annotations are preserved exactly.",
      },
    ],
  },
  status: "done",
};
