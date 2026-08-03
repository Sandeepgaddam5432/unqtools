import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-attachment-embed-tool",
  name: "Add Attachment (Embedded File) to PDF",
  description: "Enhanced PDF attachment tool with file icons, MIME detection, size preview, and batch embed. All client-side with pdf-lib.",
  category: "pdf",
  keywords: ["pdf attachment", "embed file pdf", "attach files", "pdf embedded"],
  icon: "Paperclip",
  requiresNetwork: false,
  seo: {
    title: "Add Attachment to PDF — Enhanced Tool | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Embeds files as attachments in PDF documents with enhanced file preview and MIME detection." },
      { q: "Is my data safe?", a: "Yes — all processing is 100% client-side using pdf-lib." },
    ],
  },
  status: "done",
};
