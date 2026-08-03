/**
 * Add Attachment to PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-add-attachment",
  name: "Add Attachment to PDF",
  description: "Embed files as attachments in PDF documents. Supports any file type. Uses pdf-lib — 100% client-side.",
  category: "pdf",
  keywords: ["pdf attachment", "embed file", "pdf attach", "add file to pdf", "pdf embedded file"],
  icon: "Paperclip",
  requiresNetwork: false,
  seo: {
    title: "Add Attachment to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Embeds files (any type) as attachments inside a PDF document using the Embedded File specification." },
      { q: "What file types are supported?", a: "Any file type can be attached — PDFs, images, text files, spreadsheets, etc." },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
    ],
  },
  status: "done",
};
