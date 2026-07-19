/**
 * PDF Form Field Extractor — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF form reading
 * lives in ui.tsx; this module handles field-type detection, property
 * extraction, multi-format rendering, grouping, validation, history, and
 * shareable URLs.
 */

import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Field types (7 AcroForm types + unknown)
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "list"
  | "signature"
  | "button"
  | "unknown";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  checkbox: "Checkbox",
  radio: "Radio Group",
  dropdown: "Dropdown",
  list: "Option List",
  signature: "Signature",
  button: "Button",
  unknown: "Unknown",
};

/** All known field types in display order. */
export const ALL_FIELD_TYPES: FieldType[] = [
  "text",
  "checkbox",
  "radio",
  "dropdown",
  "list",
  "signature",
  "button",
  "unknown",
];

// ---------------------------------------------------------------------------
// Output formats and group modes
// ---------------------------------------------------------------------------

export type OutputFormat = "json" | "csv" | "text" | "html-table";

export const OUTPUT_FORMATS: OutputFormat[] = ["json", "csv", "text", "html-table"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  json: "JSON (full schema)",
  csv: "CSV (spreadsheet)",
  text: "Text report (grouped)",
  "html-table": "HTML table (printable)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  json: "json",
  csv: "csv",
  text: "txt",
  "html-table": "html",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  text: "text/plain",
  "html-table": "text/html",
};

export type GroupMode = "page" | "type" | "none";

export const GROUP_MODES: GroupMode[] = ["page", "type", "none"];

export const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  page: "By page",
  type: "By field type",
  none: "Flat (no grouping)",
};

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

/**
 * A single form field as extracted from the PDF.
 * Mirrors pdf-lib's PDFField but with all extra properties needed for export.
 */
export interface FormField {
  /** Fully qualified field name. */
  name: string;
  /** Field type. */
  type: FieldType;
  /** Current value (text for text fields, "Yes"/"Off" for checkboxes, selected option for radio/dropdown/list). */
  value: string;
  /** 1-based page number of the first widget for this field (0 if unknown). */
  page: number;
  /** Whether the field is marked required. */
  required: boolean;
  /** Whether the field is read-only. */
  readOnly: boolean;
  /** Maximum text length for text fields (0 = no limit). */
  maxLength: number;
  /** Available options for radio/dropdown/list fields. */
  options: string[];
  /** True if the field has a non-empty value. */
  filled: boolean;
  /** Whether the field is multi-line (text fields only). */
  multiline: boolean;
  /** Whether the field is a password field (text fields only). */
  password: boolean;
  /** Whether the field supports file selection (text fields only). */
  fileSelect: boolean;
  /** Whether the choice field allows multiple selections. */
  multiSelect: boolean;
  /** Whether the choice field allows user-typed entries (combo box). */
  combo: boolean;
  /** Additional raw properties for debugging/inspection. */
  additionalProperties: Record<string, string | number | boolean>;
}

/** Display-name mapping entry (original → friendly label). */
export interface FieldMapping {
  name: string;
  label: string;
}

export interface ConvertOptions {
  outputFormat: OutputFormat;
  includeValues: boolean;
  includeProperties: boolean;
  groupBy: GroupMode;
  fieldMapping: string;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  outputFormat: "json",
  includeValues: true,
  includeProperties: true,
  groupBy: "page",
  fieldMapping: "",
};

export interface SummaryStats {
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  requiredFields: number;
  readOnlyFields: number;
  byType: Record<FieldType, number>;
  byPage: Record<number, number>;
  pagesWithFields: number;
}

export interface ValidationResult {
  /** Required fields that are still empty. */
  requiredEmpty: string[];
  /** Field names that appear more than once (multiple widgets on different pages). */
  duplicateNames: string[];
  /** True if no issues. */
  ok: boolean;
}

export interface FormSchema {
  sourceFile: string;
  extractedAt: number;
  totalFields: number;
  fields: {
    name: string;
    type: FieldType;
    page: number;
    required: boolean;
    readOnly: boolean;
    maxLength: number;
    options: string[];
    defaultValue: string;
    multiline: boolean;
    password: boolean;
    fileSelect: boolean;
    multiSelect: boolean;
    combo: boolean;
  }[];
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  fieldCount: number;
  format: OutputFormat;
}

// ---------------------------------------------------------------------------
// Field-type detector (uses pdf-lib's constructor name)
// ---------------------------------------------------------------------------

/**
 * Detect the field type from a pdf-lib constructor name like "PDFTextField".
 * Falls back to "unknown" for unrecognized types.
 */
export function detectFieldType(constructorName: string): FieldType {
  const n = (constructorName ?? "").toLowerCase();
  if (n.includes("textfield")) return "text";
  if (n.includes("checkbox")) return "checkbox";
  if (n.includes("radiogroup")) return "radio";
  if (n.includes("dropdown")) return "dropdown";
  if (n.includes("optionlist")) return "list";
  if (n.includes("signature")) return "signature";
  if (n.includes("button")) return "button";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Field-property extractor
// ---------------------------------------------------------------------------

/**
 * Extract all relevant properties from a raw pdf-lib field into our FormField shape.
 * The `rawField` is a duck-typed object — ui.tsx passes the actual pdf-lib PDFField
 * instance. All property access is wrapped in try/catch so a single bad field
 * never breaks extraction.
 *
 * `defaultPage` is used when the field has no widget ref we can inspect.
 */
export function extractFieldProperties(
  rawField: {
    getName?: () => string;
    isRequired?: () => boolean;
    isReadOnly?: () => boolean;
    getText?: () => string | null;
    isChecked?: () => boolean;
    getOptions?: () => string[];
    maxLength?: () => number | undefined;
    isMultiline?: () => boolean;
    isPassword?: () => boolean;
    isFileSelect?: () => boolean;
    isMultiSelect?: () => boolean;
    isCombo?: () => boolean;
    acroField?: { widgets?: Array<{ page?: unknown }> } & Record<string, unknown>;
    constructor?: { name?: string };
  },
  defaultPage = 0,
): FormField {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  const name = safe(() => rawField.getName?.() ?? "", "") || "(unnamed)";
  const type = detectFieldType(rawField?.constructor?.name ?? "");
  const required = safe(() => !!rawField.isRequired?.(), false);
  const readOnly = safe(() => !!rawField.isReadOnly?.(), false);
  const maxLength = safe(() => Number(rawField.maxLength?.() ?? 0) || 0, 0);
  const multiline = safe(() => !!rawField.isMultiline?.(), false);
  const password = safe(() => !!rawField.isPassword?.(), false);
  const fileSelect = safe(() => !!rawField.isFileSelect?.(), false);
  const multiSelect = safe(() => !!rawField.isMultiSelect?.(), false);
  const combo = safe(() => !!rawField.isCombo?.(), false);

  // Value extraction varies by type
  let value = "";
  if (type === "text") {
    value = safe(() => rawField.getText?.() ?? "", "");
  } else if (type === "checkbox") {
    value = safe(() => (rawField.isChecked?.() ? "Yes" : "Off"), "Off");
  }
  // Radio / dropdown / list selected value is opaque from pdf-lib's public API;
  // ui.tsx may overwrite this with a deeper read.

  const options = safe(() => rawField.getOptions?.() ?? [], []);
  const filled = !!value && value !== "Off";

  // Try to find the page from the first widget ref
  const page = safe(() => {
    const widgets = rawField.acroField?.widgets;
    if (!widgets || !Array.isArray(widgets) || widgets.length === 0) return defaultPage;
    const first = widgets[0];
    if (first && typeof first === "object" && "page" in first) {
      const p = (first as { page?: { pageNumber?: number } | number }).page;
      if (typeof p === "number") return p + 1; // 0-based → 1-based
      if (p && typeof p === "object" && typeof p.pageNumber === "number") return p.pageNumber;
    }
    return defaultPage;
  }, defaultPage);

  return {
    name,
    type,
    value,
    page,
    required,
    readOnly,
    maxLength,
    options: Array.isArray(options) ? options.slice() : [],
    filled,
    multiline,
    password,
    fileSelect,
    multiSelect,
    combo,
    additionalProperties: {},
  };
}

// ---------------------------------------------------------------------------
// Field value formatter per type
// ---------------------------------------------------------------------------

/** Format a field value for display in reports. */
export function formatFieldValueByType(field: FormField): string {
  if (field.type === "checkbox") {
    return field.value === "Yes" ? "Yes" : "Off";
  }
  if (field.type === "radio" || field.type === "dropdown" || field.type === "list") {
    return field.value || "(none selected)";
  }
  if (field.type === "signature") {
    return field.filled ? "(signed)" : "(unsigned)";
  }
  if (field.type === "button") {
    return "(button)";
  }
  return field.value || "(empty)";
}

// ---------------------------------------------------------------------------
// Page locator
// ---------------------------------------------------------------------------

/**
 * Build a lookup from page number → list of fields on that page.
 * Fields with page=0 (unknown) go into a "Unknown page" bucket.
 */
export function locateFieldPages(fields: FormField[]): Map<number, FormField[]> {
  const map = new Map<number, FormField[]>();
  for (const f of fields) {
    const key = f.page || 0;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Field grouper (page / type / none)
// ---------------------------------------------------------------------------

export interface FieldGroup {
  key: string;
  label: string;
  fields: FormField[];
}

/** Group fields by page, by type, or return a single flat group. */
export function groupFields(fields: FormField[], mode: GroupMode): FieldGroup[] {
  if (mode === "none") {
    return [{ key: "all", label: "All fields", fields }];
  }
  const map = new Map<string, FormField[]>();
  for (const f of fields) {
    let key: string;
    let label: string;
    if (mode === "page") {
      key = `page-${f.page || 0}`;
      label = f.page > 0 ? `Page ${f.page}` : "Unknown page";
    } else {
      key = f.type;
      label = FIELD_TYPE_LABELS[f.type];
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  const groups: FieldGroup[] = [];
  for (const [key, list] of map) {
    let label: string;
    if (mode === "page") {
      const pageNum = Number(key.replace("page-", ""));
      label = pageNum > 0 ? `Page ${pageNum}` : "Unknown page";
    } else {
      label = FIELD_TYPE_LABELS[key as FieldType] ?? key;
    }
    groups.push({ key, label, fields: list });
  }
  if (mode === "page") {
    groups.sort((a, b) => {
      const pa = Number(a.key.replace("page-", ""));
      const pb = Number(b.key.replace("page-", ""));
      return pa - pb;
    });
  } else {
    const order = ALL_FIELD_TYPES;
    groups.sort((a, b) => order.indexOf(a.key as FieldType) - order.indexOf(b.key as FieldType));
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Required / read-only markers
// ---------------------------------------------------------------------------

/** Return the names of all required fields. */
export function markRequiredFields(fields: FormField[]): string[] {
  return fields.filter((f) => f.required).map((f) => f.name);
}

/** Return the names of all read-only fields. */
export function markReadOnlyFields(fields: FormField[]): string[] {
  return fields.filter((f) => f.readOnly).map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Choice extractor (for dropdowns/lists/radio)
// ---------------------------------------------------------------------------

/** Return all available choices/options for choice fields (radio, dropdown, list). */
export function extractChoices(fields: FormField[]): { name: string; choices: string[] }[] {
  return fields
    .filter((f) => f.type === "radio" || f.type === "dropdown" || f.type === "list")
    .map((f) => ({ name: f.name, choices: f.options.slice() }));
}

// ---------------------------------------------------------------------------
// Field-name normalizer (clean display names)
// ---------------------------------------------------------------------------

/**
 * Generate a clean, human-readable display name from a fully-qualified
 * field name like "Page1.PersonalInfo.FirstName[0]".
 */
export function normalizeFieldName(name: string): string {
  let s = (name ?? "").replace(/\[\d+\]/g, "");
  const lastDot = s.lastIndexOf(".");
  if (lastDot >= 0) s = s.slice(lastDot + 1);
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  s = s.replace(/[_\-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 0) {
    s = s
      .split(" ")
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return s || name;
}

/** Generate a full mapping (name → suggested label) for all fields. */
export function suggestAllLabels(fields: FormField[]): FieldMapping[] {
  return fields.map((f) => ({ name: f.name, label: normalizeFieldName(f.name) }));
}

// ---------------------------------------------------------------------------
// Duplicate-name detector (same name on different pages)
// ---------------------------------------------------------------------------

/**
 * Find fields that share a name across multiple widgets on different pages.
 * Returns the duplicate field names.
 */
export function detectDuplicateNames(fields: FormField[]): string[] {
  const byName = new Map<string, Set<number>>();
  for (const f of fields) {
    if (!byName.has(f.name)) byName.set(f.name, new Set());
    byName.get(f.name)!.add(f.page);
  }
  const out: string[] = [];
  for (const [name, pages] of byName) {
    if (pages.size > 1) out.push(name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Field validation reporter (required but empty)
// ---------------------------------------------------------------------------

/** Return the names of required fields that have no value. */
export function reportRequiredEmpty(fields: FormField[]): string[] {
  return fields
    .filter((f) => f.required && !f.filled && !f.readOnly)
    .map((f) => f.name);
}

/** Combined validation: required-empty + duplicates. */
export function validateFields(fields: FormField[]): ValidationResult {
  const requiredEmpty = reportRequiredEmpty(fields);
  const duplicateNames = detectDuplicateNames(fields);
  return {
    requiredEmpty,
    duplicateNames,
    ok: requiredEmpty.length === 0 && duplicateNames.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(fields: FormField[]): SummaryStats {
  const byType: Record<FieldType, number> = {
    text: 0, checkbox: 0, radio: 0, dropdown: 0, list: 0, signature: 0, button: 0, unknown: 0,
  };
  const byPage: Record<number, number> = {};
  let filled = 0;
  let required = 0;
  let readOnly = 0;
  for (const f of fields) {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
    const pageKey = f.page || 0;
    byPage[pageKey] = (byPage[pageKey] ?? 0) + 1;
    if (f.filled) filled++;
    if (f.required) required++;
    if (f.readOnly) readOnly++;
  }
  return {
    totalFields: fields.length,
    filledFields: filled,
    emptyFields: fields.length - filled,
    requiredFields: required,
    readOnlyFields: readOnly,
    byType,
    byPage,
    pagesWithFields: Object.keys(byPage).filter((k) => Number(k) > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Field-mapping parser (field_name=Display Name)
// ---------------------------------------------------------------------------

export function parseFieldMapping(text: string): { mappings: FieldMapping[]; errors: string[] } {
  const mappings: FieldMapping[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = (text ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) {
      errors.push(`Line ${i + 1}: no "=" found (use field_name=Display Name)`);
      continue;
    }
    const name = line.slice(0, eq).trim();
    const label = line.slice(eq + 1).trim();
    if (!name) {
      errors.push(`Line ${i + 1}: empty field name`);
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    mappings.push({ name, label });
  }
  return { mappings, errors };
}

export function buildLabelMap(mappings: FieldMapping[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of mappings) m.set(x.name, x.label || x.name);
  return m;
}

// ---------------------------------------------------------------------------
// Escaping helpers
// ---------------------------------------------------------------------------

export function escapeXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

/**
 * Render fields as a JSON form schema (full property export).
 * Honors includeValues (skip the defaultValue) and includeProperties (skip extras).
 */
export function renderJson(fields: FormField[], opts: ConvertOptions, sourceFile = ""): string {
  const schema = exportFormSchema(fields, sourceFile);
  if (!opts.includeValues) {
    schema.fields = schema.fields.map((f) => ({ ...f, defaultValue: "" }));
  }
  if (!opts.includeProperties) {
    schema.fields = schema.fields.map((f) => ({
      name: f.name,
      type: f.type,
      page: f.page,
      required: f.required,
      readOnly: f.readOnly,
      maxLength: 0,
      options: [],
      defaultValue: opts.includeValues ? f.defaultValue : "",
      multiline: false,
      password: false,
      fileSelect: false,
      multiSelect: false,
      combo: false,
    }));
  }
  return JSON.stringify(schema, null, 2);
}

/** Render fields as CSV (header + one row per field). */
export function renderCsv(fields: FormField[], opts: ConvertOptions): string {
  const header = opts.includeProperties
    ? "field_name,type,value,page,required,read_only,max_length,options,multiline,password,combo,multi_select"
    : "field_name,type,value,page,required,read_only";
  const rows = [header];
  for (const f of fields) {
    const value = opts.includeValues ? escapeCsv(formatFieldValueByType(f)) : "";
    if (opts.includeProperties) {
      rows.push([
        escapeCsv(f.name),
        f.type,
        value,
        String(f.page),
        f.required ? "yes" : "no",
        f.readOnly ? "yes" : "no",
        String(f.maxLength),
        escapeCsv(f.options.join("|")),
        f.multiline ? "yes" : "no",
        f.password ? "yes" : "no",
        f.combo ? "yes" : "no",
        f.multiSelect ? "yes" : "no",
      ].join(","));
    } else {
      rows.push([
        escapeCsv(f.name),
        f.type,
        value,
        String(f.page),
        f.required ? "yes" : "no",
        f.readOnly ? "yes" : "no",
      ].join(","));
    }
  }
  return rows.join("\n");
}

/** Render fields as a human-readable text report (grouped by selected mode). */
export function renderText(fields: FormField[], opts: ConvertOptions, labelMap?: Map<string, string>): string {
  const stats = computeSummaryStats(fields);
  const validation = validateFields(fields);
  const header = [
    "PDF Form Field Extraction Report",
    "================================",
    `Total fields:        ${stats.totalFields}`,
    `  Filled:            ${stats.filledFields}`,
    `  Empty:             ${stats.emptyFields}`,
    `  Required:          ${stats.requiredFields}`,
    `  Read-only:         ${stats.readOnlyFields}`,
    `  Pages with fields: ${stats.pagesWithFields}`,
    "",
    "By type:",
    ...ALL_FIELD_TYPES.filter((t) => stats.byType[t] > 0).map((t) => `  ${FIELD_TYPE_LABELS[t]}: ${stats.byType[t]}`),
    "",
    validation.ok
      ? "Validation: OK — no required-empty fields, no duplicate names."
      : `Validation: ${validation.requiredEmpty.length} required-empty, ${validation.duplicateNames.length} duplicate name(s).`,
    validation.requiredEmpty.length > 0 ? `  Required & empty: ${validation.requiredEmpty.join(", ")}` : "",
    validation.duplicateNames.length > 0 ? `  Duplicate names:  ${validation.duplicateNames.join(", ")}` : "",
    "",
    "Fields:",
  ].filter(Boolean).join("\n");

  const groups = groupFields(fields, opts.groupBy);
  const body: string[] = [];
  for (const g of groups) {
    if (opts.groupBy !== "none") body.push(`\n[${g.label}] (${g.fields.length} field${g.fields.length === 1 ? "" : "s"})`);
    for (const f of g.fields) {
      const label = labelMap?.get(f.name) ?? f.name;
      const req = f.required ? " *" : "";
      const ro = f.readOnly ? " (ro)" : "";
      const valuePart = opts.includeValues ? ` = ${formatFieldValueByType(f)}` : "";
      const propPart = opts.includeProperties
        ? `  [type=${f.type}, page=${f.page}, maxLen=${f.maxLength}${f.options.length > 0 ? `, opts=${f.options.join("|")}` : ""}]`
        : "";
      body.push(`  - ${label}${req}${ro} (${f.type})${valuePart}${propPart}`);
    }
  }
  return header + "\n" + body.join("\n");
}

/** Render fields as a printable HTML table. */
export function renderHtmlTable(fields: FormField[], opts: ConvertOptions, labelMap?: Map<string, string>, sourceFile = ""): string {
  const groups = groupFields(fields, opts.groupBy);
  const stats = computeSummaryStats(fields);

  const sections = groups.map((g) => {
    if (opts.groupBy !== "none") {
      const heading = `<h2>${escapeHtml(g.label)} <span class="count">(${g.fields.length})</span></h2>`;
      return heading + renderHtmlTableBody(g.fields, opts, labelMap);
    }
    return renderHtmlTableBody(g.fields, opts, labelMap);
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PDF Form Fields — ${escapeHtml(sourceFile || "report")}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #111; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; font-size: 0.85rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  .required { color: #c00; font-weight: 600; }
  .readonly { color: #888; }
  .count { color: #777; font-weight: normal; font-size: 0.85em; }
  @media print { body { margin: 0; } h2 { page-break-before: always; } }
</style>
</head>
<body>
<h1>PDF Form Field Report</h1>
<div class="meta">
  Source: <strong>${escapeHtml(sourceFile || "(unknown)")}</strong> ·
  ${stats.totalFields} fields · ${stats.filledFields} filled ·
  ${stats.requiredFields} required · ${stats.readOnlyFields} read-only
</div>
${sections}
</body>
</html>`;
}

function renderHtmlTableBody(fields: FormField[], opts: ConvertOptions, labelMap?: Map<string, string>): string {
  const cols = opts.includeProperties
    ? ["#", "Field name", "Type", "Page", "Value", "Required", "Read-only", "Max length", "Options"]
    : ["#", "Field name", "Type", "Page", "Value", "Required", "Read-only"];
  const head = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
  const rows = fields.map((f, i) => {
    const label = escapeHtml(labelMap?.get(f.name) ?? f.name);
    const req = f.required ? '<span class="required">yes</span>' : "no";
    const ro = f.readOnly ? '<span class="readonly">yes</span>' : "no";
    const value = opts.includeValues ? escapeHtml(formatFieldValueByType(f)) : "";
    const base = [
      `<td>${i + 1}</td>`,
      `<td>${label}${f.name !== (labelMap?.get(f.name) ?? f.name) ? `<br/><small>${escapeHtml(f.name)}</small>` : ""}</td>`,
      `<td>${f.type}</td>`,
      `<td>${f.page || "-"}</td>`,
      `<td>${value}</td>`,
      `<td>${req}</td>`,
      `<td>${ro}</td>`,
    ];
    if (opts.includeProperties) {
      base.push(`<td>${f.maxLength || "-"}</td>`);
      base.push(`<td>${f.options.length > 0 ? escapeHtml(f.options.join(", ")) : "-"}</td>`);
    }
    return `<tr>${base.join("")}</tr>`;
  }).join("\n");
  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

/** Dispatch to the matching renderer. */
export function renderOutput(fields: FormField[], opts: ConvertOptions, labelMap?: Map<string, string>, sourceFile = ""): string {
  switch (opts.outputFormat) {
    case "json": return renderJson(fields, opts, sourceFile);
    case "csv": return renderCsv(fields, opts);
    case "text": return renderText(fields, opts, labelMap);
    case "html-table": return renderHtmlTable(fields, opts, labelMap, sourceFile);
    default: return renderJson(fields, opts, sourceFile);
  }
}

// ---------------------------------------------------------------------------
// Form-schema exporter (for reuse with the form-filler tool)
// ---------------------------------------------------------------------------

export function exportFormSchema(fields: FormField[], sourceFile: string): FormSchema {
  return {
    sourceFile,
    extractedAt: Date.now(),
    totalFields: fields.length,
    fields: fields.map((f) => ({
      name: f.name,
      type: f.type,
      page: f.page,
      required: f.required,
      readOnly: f.readOnly,
      maxLength: f.maxLength,
      options: f.options.slice(),
      defaultValue: f.value,
      multiline: f.multiline,
      password: f.password,
      fileSelect: f.fileSelect,
      multiSelect: f.multiSelect,
      combo: f.combo,
    })),
  };
}

export function serializeFormSchema(schema: FormSchema): string {
  return JSON.stringify(schema, null, 2);
}

// ---------------------------------------------------------------------------
// Output filename helper
// ---------------------------------------------------------------------------

export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}-fields.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-form-field-extractor:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set<OutputFormat>(OUTPUT_FORMATS);
const VALID_GROUPS = new Set<GroupMode>(GROUP_MODES);

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.outputFormat !== "json") params.set("format", opts.outputFormat);
  if (!opts.includeValues) params.set("values", "0");
  if (!opts.includeProperties) params.set("props", "0");
  if (opts.groupBy !== "page") params.set("group", opts.groupBy);
  if (opts.fieldMapping.trim()) params.set("map", opts.fieldMapping);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConvertOptions> = {};
  const format = params.get("format");
  if (format && VALID_FORMATS.has(format as OutputFormat)) out.outputFormat = format as OutputFormat;
  const values = params.get("values");
  if (values !== null) out.includeValues = values !== "0";
  const props = params.get("props");
  if (props !== null) out.includeProperties = props !== "0";
  const group = params.get("group");
  if (group && VALID_GROUPS.has(group as GroupMode)) out.groupBy = group as GroupMode;
  const map = params.get("map");
  if (map) out.fieldMapping = map;
  return out;
}

// ---------------------------------------------------------------------------
// Options validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: ConvertOptions): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_FORMATS.has(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  if (!VALID_GROUPS.has(opts.groupBy)) {
    return { ok: false, error: `Unknown group mode: ${opts.groupBy}` };
  }
  if (opts.fieldMapping.trim()) {
    const mp = parseFieldMapping(opts.fieldMapping);
    if (mp.errors.length > 0) {
      return { ok: false, error: `Field mapping errors:\n${mp.errors.join("\n")}` };
    }
  }
  return { ok: true, output: { ...opts } };
}
