import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-metadata-editor",
  name: "PDF Metadata Editor",
  description:
    "View and edit PDF metadata: title, author, subject, keywords, creator, and producer. One-click privacy clean to strip all metadata before sharing. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "pdf metadata editor",
    "edit pdf properties",
    "pdf title author",
    "strip pdf metadata",
    "pdf info editor",
    "pdf privacy clean",
  ],
  icon: "file-pen",
  requiresNetwork: false,
  seo: {
    title: "PDF Metadata Editor Online — Edit Title, Author & Strip Metadata | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded to a server?",
        a: "No. All metadata reading and writing happens in your browser. The file never leaves your device.",
      },
      {
        q: "What metadata fields can I edit?",
        a: "Title, Author, Subject, Keywords, Creator, and Producer. Creation and modification dates are read-only.",
      },
      {
        q: "What does Privacy clean do?",
        a: "It blanks all six editable metadata fields at once — handy before sharing a PDF externally to avoid leaking personal or tool information.",
      },
    ],
  },
  status: "done",
};
