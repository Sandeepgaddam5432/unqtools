/**
 * PDF Form Filler — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF form reading and
 * filling lives in ui.tsx; this module handles form-data parsing, field-type
 * detection, value formatting, validation, multi-format rendering, history,
 * and shareable URLs.
 */

export type FieldType = "text" | "checkbox" | "radio" | "dropdown" | "list" | "signature" | "button" | "unknown";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  checkbox: "Checkbox",
  radio: "Radio group",
  dropdown: "Dropdown",
  list: "Option list",
  signature: "Signature",
  button: "Button",
  unknown: "Unknown",
};

/** A single form field as detected from the PDF (mirrors pdf-lib's PDFField). */
export interface FormField {
  /** Fully qualified field name. */
  name: string;
  /** Field type. */
  type: FieldType;
  /** Current value (text for text fields, "Yes"/"No" for checkboxes, selected option for radio/dropdown/list). */
  value: string;
  /** Whether the field is marked required. */
  required: boolean;
  /** Whether the field is read-only. */
  readOnly: boolean;
  /** Available options for radio/dropdown/list fields. */
  options: string[];
  /** True if the field is currently filled (non-empty). */
  filled: boolean;
}

/** A user-provided value to apply to a field. */
export interface FieldValue {
  /** Field name (must match a FormField.name exactly). */
  name: string;
  /** Value as a string (for text) or pipe-separated options (for multi-value fields). */
  rawValue: string;
  /** Parsed multi-value list (split on pipe). */
  values: string[];
}

/** Result of parsing the form-data textarea. */
export interface ParsedFormData {
  values: FieldValue[];
  /** Lines that couldn't be parsed (no `=` found). */
  errors: string[];
}

/** Display-name mapping entry. */
export interface FieldMapping {
  /** Original field name. */
  name: string;
  /** Friendly display name. */
  label: string;
}

/** Result of parsing the field-mapping textarea. */
export interface ParsedFieldMapping {
  mappings: FieldMapping[];
  errors: string[];
}

export interface ConvertOptions {
  /** Multi-line `field_name=value` text. */
  formData: string;
  /** Optional multi-line `field_name=Display Name` text. */
  fieldMapping: string;
  /** Flatten the form after filling (so it can't be edited further). */
  flattenForm: boolean;
  /** Preserve NeedAppearances flag (true) or clear it (false). */
  preserveAppearance: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  formData: "",
  fieldMapping: "",
  flattenForm: false,
  preserveAppearance: true,
};

export interface SummaryStats {
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  requiredFields: number;
  requiredEmpty: number;
  byType: Record<FieldType, number>;
  byTypeFilled: Record<FieldType, number>;
}

export interface ValidationResult {
  /** Field names that are required but not filled. */
  missingRequired: string[];
  /** Field names in the form data that don't exist in the form. */
  unknownFields: string[];
  /** Field names with values that don't match the type (e.g. text in a checkbox). */
  typeMismatches: string[];
  /** True if everything is OK (no missing required, no unknowns). */
  ok: boolean;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  fieldCount: number;
  filledCount: number;
  flattened: boolean;
}

export interface FormSchema {
  /** Source PDF filename. */
  sourceFile: string;
  /** When the schema was extracted. */
  extractedAt: number;
  /** Fields in order. */
  fields: {
    name: string;
    type: FieldType;
    required: boolean;
    readOnly: boolean;
    options: string[];
    defaultValue: string;
  }[];
}

// ---------------------------------------------------------------------------
// Form-data parser (field_name=value, multi-value via pipe)
// ---------------------------------------------------------------------------

/**
 * Parse a multi-line form-data string into FieldValue entries.
 * Each line: `field_name=value`. Empty lines and `#`-prefixed comments are skipped.
 * For multi-value fields (radio/checkbox/list), use `field=opt1|opt2|opt3`.
 *
 * Note: only leading/trailing whitespace of the *line* and *field name* is trimmed.
 * The value text after `=` is preserved verbatim (so leading/trailing spaces in
 * the value are kept — important for free-form text fields).
 */
export function parseFormData(text: string): ParsedFormData {
  const values: FieldValue[] = [];
  const errors: string[] = [];
  const lines = (text ?? "").split(/\r?\n/);
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Trim only the leading/trailing whitespace of the line for parsing, but
    // preserve the value content after `=` exactly as typed.
    const lineLeadTrimmed = raw.replace(/^\s+/, "");
    if (!lineLeadTrimmed.trim()) continue;
    if (lineLeadTrimmed.startsWith("#")) continue;
    const eq = lineLeadTrimmed.indexOf("=");
    if (eq < 0) {
      errors.push(`Line ${i + 1}: no "=" found (use field_name=value)`);
      continue;
    }
    const name = lineLeadTrimmed.slice(0, eq).trim();
    const rawValue = lineLeadTrimmed.slice(eq + 1);
    if (!name) {
      errors.push(`Line ${i + 1}: empty field name`);
      continue;
    }
    if (seen.has(name)) {
      // Allow duplicate entries — last one wins (override)
      const existing = values.find((v) => v.name === name);
      if (existing) {
        existing.rawValue = rawValue;
        existing.values = parseMultiValue(rawValue);
      }
      continue;
    }
    seen.add(name);
    values.push({
      name,
      rawValue,
      values: parseMultiValue(rawValue),
    });
  }
  return { values, errors };
}

/** Split a value into multiple values on `|`. Returns trimmed non-empty values. */
export function parseMultiValue(raw: string): string[] {
  return (raw ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Serialize a FieldValue back to a single text line. */
export function serializeFieldValue(value: FieldValue): string {
  return `${value.name}=${value.rawValue}`;
}

/** Serialize a list of FieldValues to multi-line text. */
export function serializeFormData(values: FieldValue[]): string {
  return values.map(serializeFieldValue).join("\n");
}

// ---------------------------------------------------------------------------
// Field-mapping parser (field_name=Display Name)
// ---------------------------------------------------------------------------

export function parseFieldMapping(text: string): ParsedFieldMapping {
  const mappings: FieldMapping[] = [];
  const errors: string[] = [];
  const lines = (text ?? "").split(/\r?\n/);
  const seen = new Set<string>();
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

/** Build a lookup map from field name → display label (falls back to original name). */
export function buildLabelMap(mappings: FieldMapping[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of mappings) {
    map.set(m.name, m.label || m.name);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Field type detection
// ---------------------------------------------------------------------------

/**
 * Detect the type of a pdf-lib field based on its constructor name.
 * Accepts the raw class name string (e.g. "PDFTextField").
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
// Field value formatter per type
// ---------------------------------------------------------------------------

/**
 * Format a user-provided raw value for application to a field of the given type.
 * Returns a single string (for text/checkbox) or an array of selected options
 * (for radio/dropdown/list).
 */
export function formatFieldValue(
  type: FieldType,
  rawValue: string,
  options: string[] = [],
): { text?: string; checked?: boolean; selected?: string[]; error?: string } {
  const values = parseMultiValue(rawValue);
  switch (type) {
    case "text": {
      return { text: rawValue };
    }
    case "checkbox": {
      // Boolean parsing: true/yes/1/on/check/✓/x → checked
      const v = rawValue.trim().toLowerCase();
      const checked = ["true", "yes", "1", "on", "check", "checked", "✓", "x", "y"].includes(v);
      return { checked, error: checked ? undefined : undefined };
    }
    case "radio":
    case "dropdown":
    case "list": {
      // Each value must match an option
      const invalid = values.filter((v) => options.length > 0 && !options.includes(v));
      if (invalid.length > 0) {
        return { selected: [], error: `Value(s) not in options: ${invalid.join(", ")}` };
      }
      return { selected: values };
    }
    case "signature": {
      return { text: rawValue, error: "Signature fields cannot be filled programmatically" };
    }
    case "button":
    case "unknown":
    default:
      return { error: `Cannot fill field of type: ${type}` };
  }
}

/** Render a field's value for display (e.g. "Yes"/"No" for checkboxes). */
export function displayFieldValue(type: FieldType, value: string, selected: string[] = []): string {
  if (type === "checkbox") {
    if (!value) return "No";
    const v = value.toLowerCase();
    return ["off", "", "no", "false", "0"].includes(v) ? "No" : "Yes";
  }
  if (type === "radio" || type === "dropdown" || type === "list") {
    return selected.length > 0 ? selected.join("|") : value;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Field validator
// ---------------------------------------------------------------------------

/**
 * Validate the form data against the form fields.
 * - Required fields must have a non-empty value.
 * - Field names in form data that don't exist in the form are flagged.
 * - Type mismatches (e.g. checkbox value not parseable as boolean) are flagged.
 */
export function validateForm(
  fields: FormField[],
  formData: ParsedFormData,
): ValidationResult {
  const missingRequired: string[] = [];
  const unknownFields: string[] = [];
  const typeMismatches: string[] = [];
  const fieldMap = new Map(fields.map((f) => [f.name, f]));
  const providedMap = new Map(formData.values.map((v) => [v.name, v]));

  // Unknown fields (provided but not in form)
  for (const v of formData.values) {
    if (!fieldMap.has(v.name)) {
      unknownFields.push(v.name);
    }
  }

  // Required + type checks
  for (const field of fields) {
    const provided = providedMap.get(field.name);
    const isFilled = provided ? provided.values.some((s) => s.length > 0) : field.filled;
    if (field.required && !isFilled && !field.readOnly) {
      missingRequired.push(field.name);
    }
    if (provided && field.type !== "unknown" && field.type !== "button" && field.type !== "signature") {
      const fmt = formatFieldValue(field.type, provided.rawValue, field.options);
      if (fmt.error) typeMismatches.push(`${field.name}: ${fmt.error}`);
    }
  }

  return {
    missingRequired,
    unknownFields,
    typeMismatches,
    ok: missingRequired.length === 0 && unknownFields.length === 0 && typeMismatches.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Required-field checker / empty-field finder
// ---------------------------------------------------------------------------

/** Return the names of all required fields in the form. */
export function findRequiredFields(fields: FormField[]): string[] {
  return fields.filter((f) => f.required).map((f) => f.name);
}

/** Return the names of all unfilled (empty) fields in the form. */
export function findEmptyFields(fields: FormField[]): string[] {
  return fields.filter((f) => !f.filled).map((f) => f.name);
}

/** Return the names of required fields that are still empty. */
export function findRequiredEmpty(fields: FormField[]): string[] {
  return fields.filter((f) => f.required && !f.filled).map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(fields: FormField[]): SummaryStats {
  const byType: Record<FieldType, number> = {
    text: 0, checkbox: 0, radio: 0, dropdown: 0, list: 0, signature: 0, button: 0, unknown: 0,
  };
  const byTypeFilled: Record<FieldType, number> = {
    text: 0, checkbox: 0, radio: 0, dropdown: 0, list: 0, signature: 0, button: 0, unknown: 0,
  };
  let filled = 0;
  let required = 0;
  let requiredEmpty = 0;
  for (const f of fields) {
    byType[f.type] = (byType[f.type] ?? 0) + 1;
    if (f.filled) {
      filled++;
      byTypeFilled[f.type] = (byTypeFilled[f.type] ?? 0) + 1;
    }
    if (f.required) {
      required++;
      if (!f.filled) requiredEmpty++;
    }
  }
  return {
    totalFields: fields.length,
    filledFields: filled,
    emptyFields: fields.length - filled,
    requiredFields: required,
    requiredEmpty,
    byType,
    byTypeFilled,
  };
}

/** Compute the field-type distribution as percentage breakdown. */
export function fieldTypeDistribution(fields: FormField[]): { type: FieldType; count: number; percent: number }[] {
  const stats = computeSummaryStats(fields);
  const total = fields.length;
  const types: FieldType[] = ["text", "checkbox", "radio", "dropdown", "list", "signature", "button", "unknown"];
  return types
    .map((type) => ({
      type,
      count: stats.byType[type] ?? 0,
      percent: total === 0 ? 0 : Math.round((stats.byType[type] / total) * 1000) / 10,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Field-rename suggestion (clean display names from field names)
// ---------------------------------------------------------------------------

/**
 * Generate a clean, human-readable display name from a fully-qualified
 * field name like "Page1.PersonalInfo.FirstName[0]".
 */
export function suggestFieldLabel(name: string): string {
  // Strip array indices like [0], [1]
  let s = (name ?? "").replace(/\[\d+\]/g, "");
  // Take the last segment after the last "."
  const lastDot = s.lastIndexOf(".");
  if (lastDot >= 0) s = s.slice(lastDot + 1);
  // Insert spaces before capital letters: "FirstName" → "First Name"
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Replace underscores and hyphens with spaces
  s = s.replace(/[_-]+/g, " ");
  // Collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();
  // Title-case each word
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
  return fields.map((f) => ({ name: f.name, label: suggestFieldLabel(f.name) }));
}

/** Serialize a label mapping to the textarea format. */
export function serializeLabelMapping(mappings: FieldMapping[]): string {
  return mappings.map((m) => `${m.name}=${m.label}`).join("\n");
}

// ---------------------------------------------------------------------------
// Form-schema exporter
// ---------------------------------------------------------------------------

export function exportFormSchema(fields: FormField[], sourceFile: string): FormSchema {
  return {
    sourceFile,
    extractedAt: Date.now(),
    fields: fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: f.required,
      readOnly: f.readOnly,
      options: [...f.options],
      defaultValue: f.value,
    })),
  };
}

export function serializeFormSchema(schema: FormSchema): string {
  return JSON.stringify(schema, null, 2);
}

// ---------------------------------------------------------------------------
// Field list formatter (for UI display)
// ---------------------------------------------------------------------------

export function formatFieldList(fields: FormField[], labelMap: Map<string, string>): string[] {
  return fields.map((f) => {
    const label = labelMap.get(f.name) ?? f.name;
    const required = f.required ? " *" : "";
    const readOnly = f.readOnly ? " (ro)" : "";
    const value = f.value || "(empty)";
    const options = f.options.length > 0 ? ` [${f.options.join("|")}]` : "";
    return `${label}${required}${readOnly} (${f.type}) = ${value}${options}`;
  });
}

// ---------------------------------------------------------------------------
// Flag setters — return doc-level flags for ui.tsx to apply
// ---------------------------------------------------------------------------

/** Returns the dict entries to set NeedAppearances on the AcroForm. */
export function buildNeedAppearancesFlag(preserve: boolean): { key: string; value: boolean } | null {
  // When preserve=true (default), set NeedAppearances=true so readers regenerate
  // the appearance streams. When preserve=false, clear it (we've already generated
  // appearance streams via pdf-lib's updateFieldAppearances).
  return { key: "NeedAppearances", value: preserve };
}

/** Returns the doc-save options for flatten behavior. */
export function buildSaveOptions(flatten: boolean): { flatten: boolean } {
  return { flatten };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

/** Render as a human-readable text report (one line per field). */
export function renderTextReport(fields: FormField[], labelMap: Map<string, string>): string {
  const lines = formatFieldList(fields, labelMap);
  const header = `PDF Form Fields Report
======================
Total: ${fields.length} field(s)
Filled: ${fields.filter((f) => f.filled).length}
Required: ${fields.filter((f) => f.required).length}
`;
  return header + "\n" + lines.join("\n");
}

/** Render as CSV (field_name, type, value, required, options). */
export function renderCsv(fields: FormField[]): string {
  const escape = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = ["field_name,type,value,required,read_only,options"];
  for (const f of fields) {
    rows.push([
      escape(f.name),
      escape(f.type),
      escape(f.value),
      f.required ? "yes" : "no",
      f.readOnly ? "yes" : "no",
      escape(f.options.join("|")),
    ].join(","));
  }
  return rows.join("\n");
}

/** Render as JSON (full form schema). */
export function renderJson(fields: FormField[], sourceFile = ""): string {
  const schema = exportFormSchema(fields, sourceFile);
  return serializeFormSchema(schema);
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

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-form-filler:history";
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
// Shareable URL (encode form data in hash)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.formData.trim()) {
    // Encode newlines as %0A automatically by URLSearchParams
    params.set("data", opts.formData);
  }
  if (opts.fieldMapping.trim()) {
    params.set("map", opts.fieldMapping);
  }
  if (opts.flattenForm) params.set("flatten", "1");
  if (!opts.preserveAppearance) params.set("appearances", "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConvertOptions> = {};
  const data = params.get("data");
  if (data) out.formData = data;
  const map = params.get("map");
  if (map) out.fieldMapping = map;
  const flatten = params.get("flatten");
  if (flatten !== null) out.flattenForm = flatten === "1";
  const appearances = params.get("appearances");
  if (appearances !== null) out.preserveAppearance = appearances !== "0";
  return out;
}

// ---------------------------------------------------------------------------
// Validation of options
// ---------------------------------------------------------------------------

import type { ToolResult } from "../../../lib/tool";

export function validateOptions(opts: ConvertOptions): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  const parsed = parseFormData(opts.formData);
  if (parsed.errors.length > 0) {
    return { ok: false, error: `Form data errors:\n${parsed.errors.join("\n")}` };
  }
  if (opts.fieldMapping.trim()) {
    const mp = parseFieldMapping(opts.fieldMapping);
    if (mp.errors.length > 0) {
      return { ok: false, error: `Field mapping errors:\n${mp.errors.join("\n")}` };
    }
  }
  return { ok: true, output: { ...opts } };
}

// ---------------------------------------------------------------------------
// Output filename helper
// ---------------------------------------------------------------------------

export function getOutputFilename(originalName: string, suffix = "filled"): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}-${suffix}.pdf`;
}
