import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-form-field-extractor",
  name: "PDF Form Field Extractor",
  description:
    "List and extract every AcroForm field from a PDF — text fields, checkboxes, radio buttons, dropdowns, option lists, signatures, and buttons — with full property inspection (page, required, read-only, max length, choices, current values). Export as JSON, CSV, text, or printable HTML table; group by page, type, or flat; auto-detect duplicate names and required-but-empty fields; reuse the schema with the PDF Form Filler. 100% client-side — no uploads.",
  category: "pdf",
  keywords: [
    "pdf form fields",
    "extract pdf form",
    "pdf acroform",
    "pdf field list",
    "pdf checkbox extractor",
    "pdf radio button",
    "pdf dropdown",
    "pdf form schema",
    "inspect pdf form",
    "fillable pdf fields",
  ],
  icon: "list-checks",
  requiresNetwork: false,
  seo: {
    title: "PDF Form Field Extractor — List & Inspect AcroForm Fields | UnQTools",
    faq: [
      {
        q: "How does the PDF form field extractor work?",
        a: "It loads your PDF with pdf-lib's AcroForm API and enumerates every field. For each field it records the type (text, checkbox, radio group, dropdown, option list, signature, or button), the current value, the page number of its first widget, required/read-only flags, max length (for text fields), and the available options for choice fields. You can export the result as JSON, CSV, text, or an HTML table.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Field-type detector covering 7 AcroForm types. (2) Full field-property extractor (name, type, value, page, required, read-only, max length, options). (3) Per-type value formatter. (4) Page locator (which page each widget is on). (5) Three group modes (page, type, flat). (6) Required + read-only markers. (7) Choice extractor for dropdowns/lists/radio. (8) Four renderers (JSON / CSV / text / HTML table). (9) Copy + download. (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats (total / by type / required / read-only / by page). (13) Field-name normalizer (clean display names). (14) Duplicate-name detector (same field on multiple pages). (15) Required-but-empty validation reporter. (16) Form-schema exporter for reuse with the PDF Form Filler.",
      },
      {
        q: "Can this tool fill or modify form fields?",
        a: "No — this tool is read-only. It only lists and exports the existing fields and their current values. To fill or modify values, use the related PDF Form Filler tool and feed it the schema exported here (JSON format) so you can prepare your field_name=value list offline.",
      },
      {
        q: "Does it handle XFA (LiveCycle Designer) forms?",
        a: "XFA-only forms are not fully supported because pdf-lib reads the standard AcroForm dictionary. If a hybrid PDF has both AcroForm and XFA, the AcroForm fields will still be listed. XFA-specific widgets (LiveCycle dynamic layouts) won't appear.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All field enumeration, property extraction, and rendering happen 100% locally in your browser using JavaScript. Your PDF never leaves your device, and the tool works offline. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
