import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "resize-pdf-pages", name: "Resize PDF Pages",
  description: "Change PDF page size to A4, Letter, Legal, A3, or custom dimensions. Apply to all or selected pages. 100% private, runs in your browser.",
  category: "pdf", keywords: ["resize pdf", "change pdf size", "pdf page size", "a4 pdf", "letter pdf", "pdf dimensions", "pdf resizer"],
  icon: "scaling", requiresNetwork: false,
  seo: { title: "Resize PDF Pages Online — A4, Letter, Legal, Custom | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Resizing runs entirely in your browser." },
    { q: "Does resizing scale the content?", a: "No. Resizing changes the page dimensions (media box). Content stays at its original position. Use Scale PDF if you want to scale content to fit." },
    { q: "What page sizes are available?", a: "A4 (595×842pt), Letter (612×792pt), Legal (612×1008pt), A3 (842×1191pt), or custom width × height in points." },
  ]}, status: "done",
};
