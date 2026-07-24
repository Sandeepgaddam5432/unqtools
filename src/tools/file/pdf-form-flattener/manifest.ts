/**
 * PDF Form Flattener — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-form-flattener",
  name: "PDF Form Flattener",
  description:
    "Flatten PDF form fields and annotations into static content so they can't be edited. Locks form values, prevents further edits, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["pdf form flattener", "flatten pdf", "lock form", "pdf fields", "pdf annotations", "form fields"],
  icon: "file-lock",
  requiresNetwork: false,
  seo: {
    title: "PDF Form Flattener — Lock Form Fields + Annotations | UnQTools",
    faq: [
      { q: "What does flattening do?", a: "Flattening converts interactive form fields (AcroForm / XFA) and annotations into static PDF content. The visual appearance is preserved, but users can no longer click/edit/type into the fields. Common for signed forms, final submissions, and read-only distribution." },
      { q: "What extras does this tool have?", a: "Extras: (1) Flatten form fields, (2) Flatten annotations, (3) Flatten only specific field types, (4) Set field values before flattening, (5) Preserve or strip XFA, (6) Add password protection, (7) Set PDF permissions (no-edit, no-print), (8) Compress output, (9) Show field inventory before flattening, (10) Batch multiple PDFs, (11) Download flattened PDF, (12) Show before/after size, (13) Set PDF metadata (Title/Author), (14) Generate flattening report CSV." },
    ],
  },
  status: "done",
};
