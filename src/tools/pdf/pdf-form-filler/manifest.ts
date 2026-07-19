import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-form-filler",
  name: "PDF Form Filler",
  description:
    "Fill PDF AcroForm fields (text, checkbox, radio, dropdown, list) with user-provided data in your browser. Supports field mapping/renaming, multi-value fields (radio/checkbox), flatten-after-fill, NeedAppearances flag, required-field validation, summary stats, and form-schema export for reuse. Includes history and shareable URL. 100% private — no uploads.",
  category: "pdf",
  keywords: [
    "pdf form filler",
    "fill pdf form",
    "acroform",
    "pdf fields",
    "pdf checkbox",
    "pdf radio button",
    "pdf dropdown",
    "edit pdf form",
    "pdf form data",
    "fillable pdf",
  ],
  icon: "form-input",
  requiresNetwork: false,
  seo: {
    title: "PDF Form Filler — AcroForm Fields, Checkbox, Radio, Dropdown | UnQTools",
    faq: [
      {
        q: "How does the PDF form filler work?",
        a: "It loads your PDF with pdf-lib's AcroForm API, reads all fields (text fields, checkboxes, radio groups, dropdowns, option lists), and applies the values you provide via simple `field_name=value` lines (one per field). Multi-value fields like radio groups and checkboxes use pipe-separated values: `field=opt1|opt2`. You can optionally flatten the form after filling (so it can't be edited) and toggle the NeedAppearances flag.",
      },
      {
        q: "How do I know what fields my PDF has?",
        a: "After loading a PDF, the tool lists every form field with its name, type, current value, and whether it's required. You can also export the form schema (field name, type, options, required flag) as JSON to reuse with different PDFs or to pre-build your value list. Use the optional `field_name=Display Name` mapping textarea to rename fields in the UI for easier editing.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Form-data parser with multi-value (pipe) support. (2) Field-mapping parser for renaming fields in the UI. (3) Field-type detector (5 types: text/checkbox/radio/dropdown/list). (4) Field-value formatter per type. (5) Field validator (required + type checks). (6) Flattened-form flag setter. (7) NeedAppearances flag setter. (8) Text/CSV/JSON renderers. (9) Copy + download (multi-format). (10) History (localStorage, last 20). (11) Shareable URL. (12) Summary stats (total/filled/required/by-type). (13) Required-field checker. (14) Empty-field finder. (15) Field-type distribution. (16) Multi-value parser for checkboxes. (17) Field-rename suggestion (clean display names from field names). (18) Form-schema exporter (reuse with different PDFs).",
      },
      {
        q: "Can it fill XFA (LiveCycle Designer) forms?",
        a: "No — pdf-lib does not support XFA. Most fillable PDFs use standard AcroForm fields which this tool handles fully. If your PDF was made in Adobe LiveCycle Designer with XFA, you'll see a warning that XFA data was detected and (optionally) stripped so readers fall back to the standard AcroForm fields.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All form reading, value application, flattening, and saving happen locally in your browser. No file is ever uploaded. History is stored in your own localStorage.",
      },
    ],
  },
  status: "done",
};
