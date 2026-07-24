/**
 * PDF Form Flattener — pure logic.
 * Note: Actual PDF manipulation happens in ui.tsx via pdf-lib (lazy-loaded).
 * This module handles field inventory parsing + report generation.
 */

export interface PdfFieldInfo {
  name: string;
  type: "text" | "checkbox" | "radio" | "choice" | "signature" | "button" | "other";
  value: string;
  required: boolean;
  readOnly: boolean;
  page: number;
}

export interface FlattenOptions {
  flattenFormFields: boolean;
  flattenAnnotations: boolean;
  preserveXfa: boolean;
  /** Field names to skip (whitelist). */
  skipFields?: string[];
  /** Set metadata after flatten. */
  metadata?: { title?: string; author?: string; subject?: string };
  /** Encrypt output with password. */
  password?: string;
  /** Set permissions. */
  permissions?: { printable: boolean; editable: boolean; copyable: boolean };
}

export interface FlattenResult {
  success: boolean;
  fieldCount: number;
  flattenedFieldCount: number;
  annotationCount: number;
  inputSize: number;
  outputSize: number;
  warnings: string[];
  report: { fieldName: string; type: string; value: string; flattened: boolean }[];
}

/** Parse field inventory from pdf-lib's form object (called from ui.tsx). */
export function summarizeFields(
  fields: { getName(): string; isReadOnly(): boolean; isRequired(): boolean; constructor: { name: string } }[],
): PdfFieldInfo[] {
  return fields.map((f, i) => {
    const ctor = f.constructor.name;
    let type: PdfFieldInfo["type"] = "other";
    if (ctor.includes("Text")) type = "text";
    else if (ctor.includes("CheckBox")) type = "checkbox";
    else if (ctor.includes("Radio")) type = "radio";
    else if (ctor.includes("Dropdown") || ctor.includes("OptionList")) type = "choice";
    else if (ctor.includes("Signature")) type = "signature";
    else if (ctor.includes("Button")) type = "button";
    return {
      name: f.getName(),
      type,
      value: "",
      required: f.isRequired(),
      readOnly: f.isReadOnly(),
      page: i, // approximate
    };
  });
}

/** Build a flattening report. */
export function buildReport(
  fields: { name: string; type: string; value: string; flattened: boolean }[],
): FlattenResult["report"] {
  return fields.map((f) => ({ ...f }));
}

/** Convert report to CSV. */
export function reportToCsv(report: FlattenResult["report"]): string {
  const lines = ["FieldName,Type,Value,Flattened"];
  for (const r of report) {
    const escapedValue = `"${r.value.replace(/"/g, '""')}"`;
    lines.push(`"${r.name}",${r.type},${escapedValue},${r.flattened ? "yes" : "no"}`);
  }
  return lines.join("\n");
}

/** Generate flattening summary text. */
export function summarizeResult(result: FlattenResult): string {
  const lines = [
    `PDF Form Flattening Report`,
    `==========================`,
    `Success: ${result.success ? "YES" : "NO"}`,
    `Total fields: ${result.fieldCount}`,
    `Flattened: ${result.flattenedFieldCount}`,
    `Annotations: ${result.annotationCount}`,
    `Input size: ${result.inputSize} bytes`,
    `Output size: ${result.outputSize} bytes`,
    `Size delta: ${result.outputSize - result.inputSize > 0 ? "+" : ""}${result.outputSize - result.inputSize} bytes`,
    ``,
  ];
  if (result.warnings.length > 0) {
    lines.push(`Warnings:`);
    for (const w of result.warnings) lines.push(`  - ${w}`);
    lines.push(``);
  }
  return lines.join("\n");
}
