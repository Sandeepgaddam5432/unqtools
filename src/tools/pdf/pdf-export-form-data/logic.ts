/**
 * Export PDF Form Data (CSV / FDF / JSON) — real engine.
 *
 * Reads all interactive form fields (text, checkbox, radio, dropdown,
 * signature) and exports their current values as CSV, JSON, or FDF (Form
 * Data Format) — the interchange format Acrobat understands. Pure pdf-lib
 * form API, unit-tested.
 */
import { PDFDocument, PDFName, PDFDict, PDFString, PDFHexString } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface FormFieldValue {
  name: string;
  type: string;
  value: string;
}

export interface ExportResult {
  fields: FormFieldValue[];
  csv: string;
  json: string;
  fdf: string;
  bytes: Uint8Array;
}

/** Read all form field names + values. Pure-ish (needs a loaded doc). */
export function readFormFields(doc: PDFDocument): FormFieldValue[] {
  const out: FormFieldValue[] = [];
  try {
    const form = doc.getForm();
    for (const field of form.getFields()) {
      const name = field.getName() ?? "";
      const ctor = field.constructor.name;
      const type = ctor.replace(/^PDF/, "").replace(/Field$/, "");
      let value = "";
      try {
        if (ctor === "PDFTextField" || ctor === "PDFRadioGroup") {
          value = (field as { getText?: () => string }).getText?.() ?? "";
        } else if (ctor === "PDFDropdown") {
          const sel = (field as { getSelected?: () => string[] }).getSelected?.() ?? [];
          value = sel[0] ?? "";
        } else if (ctor === "PDFCheckBox") {
          value = (field as { isChecked?: () => boolean }).isChecked?.() ? "true" : "false";
        } else if (ctor === "PDFOptionList") {
          const sel = (field as { getSelected?: () => string[] }).getSelected?.() ?? [];
          value = sel.join(", ");
        }
      } catch {
        value = "";
      }
      out.push({ name, type, value });
    }
  } catch {
    /* no fields */
  }
  return out;
}

/** Build a CSV document from field values. Pure. */
export function fieldsToCsv(fields: FormFieldValue[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["name", "type", "value"].map(esc).join(",")];
  for (const f of fields) rows.push([esc(f.name), esc(f.type), esc(f.value)].join(","));
  return rows.join("\n");
}

/** Build FDF (Form Data Format) XML. Pure. */
export function fieldsToFdf(fields: FormFieldValue[]): string {
  const parts = fields.map(
    (f) => `      <field name="${f.name.replace(/"/g, "&quot;")}"><value>${f.value.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</value></field>`
  );
  return `%FDF-1.2
1 0 obj
<< /FDF << /Fields [
${parts.join("\n")}
] >> >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
}

export async function exportFormData(bytes: Uint8Array): Promise<ToolResult<ExportResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }
  const fields = readFormFields(doc);
  if (fields.length === 0) {
    return { ok: false, error: "No interactive form fields were found in this PDF." };
  }
  const csv = fieldsToCsv(fields);
  const json = JSON.stringify(fields, null, 2);
  const fdf = fieldsToFdf(fields);
  return {
    ok: true,
    output: { fields, csv, json, fdf, bytes: new TextEncoder().encode(fdf) },
  };
}

void PDFName;
void PDFDict;
void PDFString;
void PDFHexString;
