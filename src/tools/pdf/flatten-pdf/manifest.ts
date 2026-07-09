import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "flatten-pdf", name: "Flatten PDF",
  description: "Flatten a PDF by converting interactive form fields and annotations into static content. Prevents further editing of form data. 100% private, runs in your browser.",
  category: "pdf", keywords: ["flatten pdf", "pdf flattener", "lock pdf form", "static pdf", "pdf form to static", "pdf field flatten", "pdf convert to static"],
  icon: "layers", requiresNetwork: false,
  seo: { title: "Flatten PDF Online — Convert Form Fields to Static Free | UnQTools", faq: [
    { q: "Are my PDFs uploaded to a server?", a: "No. Flattening runs entirely in your browser." },
    { q: "What does flattening do?", a: "Copies all pages to a new PDF, dropping interactive form fields and their appearances. The visual appearance of each page is preserved, but form fields can no longer be edited or filled." },
    { q: "Will my filled form data be preserved?", a: "The visible text from filled fields is preserved as part of the page appearance. Only the interactive field elements (checkboxes, text inputs, dropdowns) are removed." },
  ]}, status: "done",
};
