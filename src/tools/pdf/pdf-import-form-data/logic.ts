/**
 * Import/Fill PDF Form Data — real engine.
 *
 * Fills a PDF's interactive form fields from FDF, JSON, or CSV input.
 * Supported inputs:
 *   - FDF text (%FDF-1.x with <field name="...">value</field>)
 *   - JSON array [{name, value}]
 *   - CSV with header row name,value
 * Pure pdf-lib form API; reports which fields were set.
 */
import { PDFDocument } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface FieldValueInput {
  name: string;
  value: string;
}

export interface ImportResult {
  bytes: Uint8Array;
  setCount: number;
  totalFields: number;
  skipped: string[];
}

/** Parse FDF text into field/value pairs. Pure + testable. */
export function parseFdf(fdf: string): FieldValueInput[] {
  const out: FieldValueInput[] = [];
  const re = /<field\s+name="([^"]+)"[^>]*>\s*<value>([\s\S]*?)<\/value>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fdf)) !== null) {
    out.push({ name: m[1]!, value: m[2]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") });
  }
  return out;
}

/** Parse a JSON array (or {fields:[...]}) into pairs. Pure. */
export function parseJsonInput(json: string): FieldValueInput[] {
  const parsed = JSON.parse(json);
  const arr = Array.isArray(parsed) ? parsed : parsed.fields ?? [];
  return arr
    .map((f: { name?: string; value?: string | boolean | number }) => ({
      name: String(f.name ?? ""),
      value: f.value === undefined ? "" : String(f.value),
    }))
    .filter((f: FieldValueInput) => f.name);
}

/** Parse CSV with a name,value header into pairs. Pure. */
export function parseCsvInput(csv: string): FieldValueInput[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const out: FieldValueInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [name, ...rest] = lines[i]!.split(",");
    const value = rest.join(",").replace(/^"|"$/g, "").replace(/""/g, '"');
    if (name && name.trim()) out.push({ name: name.trim().replace(/^"|"$/g, ""), value });
  }
  return out;
}

export async function importFormData(
  bytes: Uint8Array,
  input: FieldValueInput[],
  format: "fdf" | "json" | "csv",
  raw: string
): Promise<ToolResult<ImportResult>> {
  let pairs: FieldValueInput[];
  try {
    pairs =
      format === "fdf" ? parseFdf(raw) : format === "json" ? parseJsonInput(raw) : parseCsvInput(raw);
  } catch {
    return { ok: false, error: "Could not parse the input file." };
  }
  if (pairs.length === 0) return { ok: false, error: "No field values found in the input." };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  try {
    const form = doc.getForm();
    const fields = form.getFields();
    const fieldMap = new Map(fields.map((f) => [f.getName(), f]));
    let setCount = 0;
    const skipped: string[] = [];

    for (const p of pairs) {
      const field = fieldMap.get(p.name);
      if (!field) {
        skipped.push(p.name);
        continue;
      }
      try {
        const ctor = field.constructor.name;
        if (ctor === "PDFTextField") {
          (field as { setText: (v: string) => void }).setText(p.value);
        } else if (ctor === "PDFCheckBox") {
          const cb = field as { check: () => void; uncheck: () => void };
          if (p.value === "true" || p.value === "1" || p.value === "yes") cb.check();
          else cb.uncheck();
        } else if (ctor === "PDFDropdown" || ctor === "PDFRadioGroup") {
          (field as { select: (v: string) => void }).select(p.value);
        }
        setCount++;
      } catch {
        skipped.push(p.name);
      }
    }

    return {
      ok: true,
      output: { bytes: await doc.save(), setCount, totalFields: fields.length, skipped },
    };
  } catch {
    return { ok: false, error: "Something went wrong while filling the form." };
  }
}
