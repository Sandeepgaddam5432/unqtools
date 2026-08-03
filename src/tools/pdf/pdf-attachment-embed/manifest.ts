import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-attachment-embed",
  name: "Add Attachment (Embedded File) to PDF",
  description: "Embed any files as PDF attachments with drag-and-drop. MIME type detection, batch embed. 100% client-side with pdf-lib.",
  category: "pdf",
  keywords: ["pdf embed", "pdf attachment", "attach files pdf", "embedded file", "drag drop pdf"],
  icon: "Paperclip",
  requiresNetwork: false,
  seo: {
    title: "Add Attachment (Embedded File) to PDF — UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Embeds any files as attachments inside PDF documents using drag-and-drop." },
      { q: "Is my data sent to a server?", a: "No. Everything runs locally using pdf-lib." },
      { q: "What file types can I attach?", a: "Any file type — PDFs, images, documents, code files, etc." },
    ],
  },
  status: "done",
};
