import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_FIELD_TYPES,
  DEFAULT_OPTIONS,
  FIELD_TYPE_LABELS,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_MIME,
  GROUP_MODES,
  GROUP_MODE_LABELS,
  OUTPUT_FORMATS,
  detectFieldType,
  extractFieldProperties,
  formatFieldValueByType,
  locateFieldPages,
  groupFields,
  markRequiredFields,
  markReadOnlyFields,
  extractChoices,
  normalizeFieldName,
  suggestAllLabels,
  detectDuplicateNames,
  reportRequiredEmpty,
  validateFields,
  computeSummaryStats,
  parseFieldMapping,
  buildLabelMap,
  escapeXml,
  escapeHtml,
  escapeCsv,
  renderJson,
  renderCsv,
  renderText,
  renderHtmlTable,
  renderOutput,
  exportFormSchema,
  serializeFormSchema,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type FormField,
  type ConvertOptions,
  type OutputFormat,
  type GroupMode,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// Helper builders ------------------------------------------------------------

function textField(overrides: Partial<FormField> = {}): FormField {
  return {
    name: "firstName",
    type: "text",
    value: "Alice",
    page: 1,
    required: true,
    readOnly: false,
    maxLength: 50,
    options: [],
    filled: true,
    multiline: false,
    password: false,
    fileSelect: false,
    multiSelect: false,
    combo: false,
    additionalProperties: {},
    ...overrides,
  };
}

function checkboxField(overrides: Partial<FormField> = {}): FormField {
  return {
    name: "agree",
    type: "checkbox",
    value: "Yes",
    page: 1,
    required: true,
    readOnly: false,
    maxLength: 0,
    options: [],
    filled: true,
    multiline: false,
    password: false,
    fileSelect: false,
    multiSelect: false,
    combo: false,
    additionalProperties: {},
    ...overrides,
  };
}

function dropdownField(overrides: Partial<FormField> = {}): FormField {
  return {
    name: "country",
    type: "dropdown",
    value: "US",
    page: 2,
    required: false,
    readOnly: false,
    maxLength: 0,
    options: ["US", "CA", "MX"],
    filled: true,
    multiline: false,
    password: false,
    fileSelect: false,
    multiSelect: false,
    combo: true,
    additionalProperties: {},
    ...overrides,
  };
}

// Tests ----------------------------------------------------------------------

describe("pdf-form-field-extractor constants", () => {
  it("exports 8 field types in display order", () => {
    expect(ALL_FIELD_TYPES).toHaveLength(8);
    expect(ALL_FIELD_TYPES[0]).toBe("text");
    expect(ALL_FIELD_TYPES).toContain("signature");
    expect(ALL_FIELD_TYPES).toContain("button");
    expect(ALL_FIELD_TYPES).toContain("unknown");
  });

  it("has labels for every type", () => {
    for (const t of ALL_FIELD_TYPES) {
      expect(FIELD_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  it("has 4 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(4);
    expect(OUTPUT_FORMATS).toContain("json");
    expect(OUTPUT_FORMATS).toContain("csv");
    expect(OUTPUT_FORMATS).toContain("text");
    expect(OUTPUT_FORMATS).toContain("html-table");
  });

  it("maps format extensions and MIME types", () => {
    expect(FORMAT_EXTENSIONS["json"]).toBe("json");
    expect(FORMAT_EXTENSIONS["html-table"]).toBe("html");
    expect(FORMAT_MIME["csv"]).toBe("text/csv");
    expect(FORMAT_LABELS["text"]).toBeTruthy();
  });

  it("has 3 group modes", () => {
    expect(GROUP_MODES).toHaveLength(3);
    expect(GROUP_MODE_LABELS["page"]).toBeTruthy();
    expect(GROUP_MODE_LABELS["none"]).toBeTruthy();
  });

  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe("json");
    expect(DEFAULT_OPTIONS.includeValues).toBe(true);
    expect(DEFAULT_OPTIONS.includeProperties).toBe(true);
    expect(DEFAULT_OPTIONS.groupBy).toBe("page");
  });
});

describe("pdf-form-field-extractor detectFieldType", () => {
  it("detects PDFTextField as text", () => {
    expect(detectFieldType("PDFTextField")).toBe("text");
  });
  it("detects PDFCheckBox as checkbox", () => {
    expect(detectFieldType("PDFCheckBox")).toBe("checkbox");
  });
  it("detects PDFRadioGroup as radio", () => {
    expect(detectFieldType("PDFRadioGroup")).toBe("radio");
  });
  it("detects PDFDropdown as dropdown", () => {
    expect(detectFieldType("PDFDropdown")).toBe("dropdown");
  });
  it("detects PDFOptionList as list", () => {
    expect(detectFieldType("PDFOptionList")).toBe("list");
  });
  it("detects PDFSignature as signature", () => {
    expect(detectFieldType("PDFSignature")).toBe("signature");
  });
  it("detects PDFButton as button", () => {
    expect(detectFieldType("PDFButton")).toBe("button");
  });
  it("returns unknown for unrecognized names", () => {
    expect(detectFieldType("PDFSomeOtherThing")).toBe("unknown");
    expect(detectFieldType("")).toBe("unknown");
  });
});

describe("pdf-form-field-extractor extractFieldProperties", () => {
  it("extracts name, type, and flags from a text field", () => {
    const f = extractFieldProperties({
      getName: () => "email",
      isRequired: () => true,
      isReadOnly: () => false,
      getText: () => "a@b.com",
      maxLength: () => 100,
      isMultiline: () => false,
      isPassword: () => false,
      isFileSelect: () => false,
      constructor: { name: "PDFTextField" },
    });
    expect(f.name).toBe("email");
    expect(f.type).toBe("text");
    expect(f.required).toBe(true);
    expect(f.readOnly).toBe(false);
    expect(f.value).toBe("a@b.com");
    expect(f.maxLength).toBe(100);
    expect(f.filled).toBe(true);
  });

  it("extracts checked-state from a checkbox", () => {
    const f = extractFieldProperties({
      getName: () => "agree",
      isChecked: () => true,
      isRequired: () => true,
      constructor: { name: "PDFCheckBox" },
    });
    expect(f.type).toBe("checkbox");
    expect(f.value).toBe("Yes");
    expect(f.filled).toBe(true);
  });

  it("extracts options from a dropdown", () => {
    const f = extractFieldProperties({
      getName: () => "country",
      getOptions: () => ["US", "CA", "MX"],
      isCombo: () => true,
      constructor: { name: "PDFDropdown" },
    });
    expect(f.type).toBe("dropdown");
    expect(f.options).toEqual(["US", "CA", "MX"]);
    expect(f.combo).toBe(true);
  });

  it("falls back to (unnamed) when getName throws", () => {
    const f = extractFieldProperties({
      getName: () => { throw new Error("nope"); },
      constructor: { name: "PDFTextField" },
    });
    expect(f.name).toBe("(unnamed)");
    expect(f.type).toBe("text");
  });

  it("uses default page when no widgets", () => {
    const f = extractFieldProperties({
      getName: () => "x",
      constructor: { name: "PDFTextField" },
    }, 5);
    expect(f.page).toBe(5);
  });

  it("extracts page from widget ref when available", () => {
    const f = extractFieldProperties({
      getName: () => "x",
      constructor: { name: "PDFTextField" },
      acroField: { widgets: [{ page: 2 }] }, // 0-based → 1-based
    });
    expect(f.page).toBe(3);
  });

  it("marks unfilled text fields correctly", () => {
    const f = extractFieldProperties({
      getName: () => "empty",
      getText: () => "",
      constructor: { name: "PDFTextField" },
    });
    expect(f.filled).toBe(false);
    expect(f.value).toBe("");
  });
});

describe("pdf-form-field-extractor formatFieldValueByType", () => {
  it("formats Yes/Off for checkbox", () => {
    expect(formatFieldValueByType(textField({ type: "checkbox", value: "Yes" }))).toBe("Yes");
    expect(formatFieldValueByType(textField({ type: "checkbox", value: "Off" }))).toBe("Off");
  });
  it("shows (none selected) for empty dropdown", () => {
    expect(formatFieldValueByType(dropdownField({ value: "" }))).toBe("(none selected)");
  });
  it("shows (signed) / (unsigned) for signature", () => {
    expect(formatFieldValueByType(textField({ type: "signature", filled: true }))).toBe("(signed)");
    expect(formatFieldValueByType(textField({ type: "signature", filled: false }))).toBe("(unsigned)");
  });
  it("shows (button) for button type", () => {
    expect(formatFieldValueByType(textField({ type: "button" }))).toBe("(button)");
  });
  it("shows (empty) for empty text", () => {
    expect(formatFieldValueByType(textField({ value: "" }))).toBe("(empty)");
  });
});

describe("pdf-form-field-extractor locateFieldPages", () => {
  it("groups fields by page", () => {
    const map = locateFieldPages([
      textField({ page: 1 }),
      checkboxField({ page: 1 }),
      dropdownField({ page: 2 }),
    ]);
    expect(map.get(1)).toHaveLength(2);
    expect(map.get(2)).toHaveLength(1);
  });
  it("buckets page=0 fields as unknown", () => {
    const map = locateFieldPages([textField({ page: 0 })]);
    expect(map.get(0)).toHaveLength(1);
  });
  it("returns empty map for no fields", () => {
    expect(locateFieldPages([]).size).toBe(0);
  });
});

describe("pdf-form-field-extractor groupFields", () => {
  const sample = [
    textField({ page: 1, type: "text" }),
    checkboxField({ page: 1 }),
    dropdownField({ page: 2 }),
  ];

  it("groups by page (sorted ascending)", () => {
    const groups = groupFields(sample, "page");
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Page 1");
    expect(groups[1].label).toBe("Page 2");
    expect(groups[0].fields).toHaveLength(2);
  });
  it("groups by type", () => {
    const groups = groupFields(sample, "type");
    const labels = groups.map((g) => g.label);
    expect(labels).toContain("Text");
    expect(labels).toContain("Checkbox");
    expect(labels).toContain("Dropdown");
  });
  it("flat mode returns single group", () => {
    const groups = groupFields(sample, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].fields).toHaveLength(3);
  });
  it("unknown page bucket uses 'Unknown page' label", () => {
    const groups = groupFields([textField({ page: 0 })], "page");
    expect(groups[0].label).toBe("Unknown page");
  });
});

describe("pdf-form-field-extractor markers", () => {
  it("markRequiredFields returns required field names", () => {
    expect(markRequiredFields([
      textField({ name: "a", required: true }),
      textField({ name: "b", required: false }),
    ])).toEqual(["a"]);
  });
  it("markReadOnlyFields returns read-only field names", () => {
    expect(markReadOnlyFields([
      textField({ name: "a", readOnly: true }),
      textField({ name: "b", readOnly: false }),
    ])).toEqual(["a"]);
  });
});

describe("pdf-form-field-extractor extractChoices", () => {
  it("returns choices for radio/dropdown/list", () => {
    const out = extractChoices([
      textField(),
      dropdownField(),
      checkboxField(),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("country");
    expect(out[0].choices).toEqual(["US", "CA", "MX"]);
  });
});

describe("pdf-form-field-extractor normalizeFieldName", () => {
  it("strips array indices", () => {
    expect(normalizeFieldName("items[0]")).toBe("Items");
  });
  it("takes last dotted segment", () => {
    expect(normalizeFieldName("Page1.PersonalInfo.FirstName")).toBe("First Name");
  });
  it("splits camelCase", () => {
    expect(normalizeFieldName("firstName")).toBe("First Name");
  });
  it("replaces underscores and hyphens with spaces", () => {
    expect(normalizeFieldName("first_name")).toBe("First Name");
    expect(normalizeFieldName("first-name")).toBe("First Name");
  });
  it("returns original if name is empty", () => {
    expect(normalizeFieldName("")).toBe("");
  });
  it("suggestAllLabels produces mappings for all fields", () => {
    const out = suggestAllLabels([textField({ name: "firstName" }), dropdownField({ name: "country" })]);
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe("First Name");
  });
});

describe("pdf-form-field-extractor detectDuplicateNames", () => {
  it("finds names spanning multiple pages", () => {
    expect(detectDuplicateNames([
      textField({ name: "addr", page: 1 }),
      textField({ name: "addr", page: 3 }),
    ])).toEqual(["addr"]);
  });
  it("returns empty for unique fields", () => {
    expect(detectDuplicateNames([
      textField({ name: "a", page: 1 }),
      textField({ name: "b", page: 2 }),
    ])).toEqual([]);
  });
});

describe("pdf-form-field-extractor reportRequiredEmpty and validateFields", () => {
  it("reports required fields with no value", () => {
    expect(reportRequiredEmpty([
      textField({ name: "x", required: true, filled: true }),
      textField({ name: "y", required: true, filled: false }),
      textField({ name: "z", required: false, filled: false }),
    ])).toEqual(["y"]);
  });
  it("does not flag read-only required-empty fields", () => {
    expect(reportRequiredEmpty([
      textField({ name: "ro", required: true, filled: false, readOnly: true }),
    ])).toEqual([]);
  });
  it("validateFields combines both checks", () => {
    const v = validateFields([
      textField({ name: "addr", page: 1, required: true, filled: false }),
      textField({ name: "addr", page: 2 }),
    ]);
    expect(v.requiredEmpty).toEqual(["addr"]);
    expect(v.duplicateNames).toEqual(["addr"]);
    expect(v.ok).toBe(false);
  });
  it("validateFields ok=true for clean form", () => {
    const v = validateFields([
      textField({ name: "a", required: true, filled: true }),
      textField({ name: "b", required: false }),
    ]);
    expect(v.ok).toBe(true);
  });
});

describe("pdf-form-field-extractor computeSummaryStats", () => {
  it("computes correct stats", () => {
    const stats = computeSummaryStats([
      textField({ page: 1, required: true, filled: true }),
      checkboxField({ page: 1, required: true, filled: true }),
      dropdownField({ page: 2, required: false, filled: true, readOnly: true }),
    ]);
    expect(stats.totalFields).toBe(3);
    expect(stats.filledFields).toBe(3);
    expect(stats.emptyFields).toBe(0);
    expect(stats.requiredFields).toBe(2);
    expect(stats.readOnlyFields).toBe(1);
    expect(stats.byType.text).toBe(1);
    expect(stats.byType.checkbox).toBe(1);
    expect(stats.byType.dropdown).toBe(1);
    expect(stats.byPage[1]).toBe(2);
    expect(stats.byPage[2]).toBe(1);
    expect(stats.pagesWithFields).toBe(2);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalFields).toBe(0);
    expect(stats.pagesWithFields).toBe(0);
  });
});

describe("pdf-form-field-extractor parseFieldMapping and buildLabelMap", () => {
  it("parses name=label lines", () => {
    const r = parseFieldMapping("first_name=First Name\ncountry=Country");
    expect(r.mappings).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.mappings[0].label).toBe("First Name");
  });
  it("skips comments and blanks", () => {
    const r = parseFieldMapping("# comment\n\nfirst=First");
    expect(r.mappings).toHaveLength(1);
  });
  it("reports errors for lines without =", () => {
    const r = parseFieldMapping("no_equals_here");
    expect(r.errors).toHaveLength(1);
  });
  it("buildLabelMap falls back to original name", () => {
    const m = buildLabelMap([{ name: "a", label: "" }]);
    expect(m.get("a")).toBe("a");
  });
});

describe("pdf-form-field-extractor escaping", () => {
  it("escapeXml escapes 5 chars", () => {
    expect(escapeXml(`<a>"x"&'y'`)).toBe("&lt;a&gt;&quot;x&quot;&amp;&apos;y&apos;");
  });
  it("escapeHtml escapes 4 chars", () => {
    expect(escapeHtml(`<a>"x"&amp;`)).toBe("&lt;a&gt;&quot;x&quot;&amp;amp;");
  });
  it("escapeCsv quotes when needed", () => {
    expect(escapeCsv("hello, world")).toBe('"hello, world"');
    expect(escapeCsv("plain")).toBe("plain");
  });
  it("escapeCsv doubles inner quotes", () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("pdf-form-field-extractor renderers", () => {
  const sample = [
    textField({ name: "first", page: 1, required: true, filled: true }),
    checkboxField({ name: "agree", page: 1 }),
    dropdownField({ name: "country", page: 2 }),
  ];
  const opts: ConvertOptions = { ...DEFAULT_OPTIONS };

  it("renderJson produces a FormSchema JSON", () => {
    const out = renderJson(sample, opts, "form.pdf");
    const parsed = JSON.parse(out);
    expect(parsed.sourceFile).toBe("form.pdf");
    expect(parsed.totalFields).toBe(3);
    expect(parsed.fields[0].name).toBe("first");
    expect(parsed.fields[0].maxLength).toBe(50);
  });

  it("renderJson omits values when includeValues=false", () => {
    const out = renderJson(sample, { ...opts, includeValues: false });
    const parsed = JSON.parse(out);
    expect(parsed.fields.every((f: { defaultValue: string }) => f.defaultValue === "")).toBe(true);
  });

  it("renderJson omits properties when includeProperties=false", () => {
    const out = renderJson(sample, { ...opts, includeProperties: false });
    const parsed = JSON.parse(out);
    expect(parsed.fields[0].maxLength).toBe(0);
    expect(parsed.fields[0].options).toEqual([]);
  });

  it("renderCsv has header and rows", () => {
    const csv = renderCsv(sample, opts);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("field_name");
    expect(lines[0]).toContain("max_length");
    expect(lines).toHaveLength(4); // header + 3 rows
  });

  it("renderCsv respects includeProperties=false", () => {
    const csv = renderCsv(sample, { ...opts, includeProperties: false });
    expect(csv.split("\n")[0]).toBe("field_name,type,value,page,required,read_only");
  });

  it("renderText has header and groups", () => {
    const txt = renderText(sample, { ...opts, groupBy: "page" });
    expect(txt).toContain("PDF Form Field Extraction Report");
    expect(txt).toContain("Total fields:");
    expect(txt).toContain("[Page 1]");
    expect(txt).toContain("[Page 2]");
  });

  it("renderText in flat mode has no group headers", () => {
    const txt = renderText(sample, { ...opts, groupBy: "none" });
    expect(txt).not.toContain("[Page 1]");
  });

  it("renderHtmlTable produces valid HTML with table", () => {
    const html = renderHtmlTable(sample, opts, undefined, "form.pdf");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<table>");
    expect(html).toContain("first");
    expect(html).toContain("Page 1");
  });

  it("renderOutput dispatches to the right renderer", () => {
    expect(renderOutput(sample, { ...opts, outputFormat: "json" })).toContain('"fields"');
    expect(renderOutput(sample, { ...opts, outputFormat: "csv" })).toContain("field_name");
    expect(renderOutput(sample, { ...opts, outputFormat: "text" })).toContain("Extraction Report");
    expect(renderOutput(sample, { ...opts, outputFormat: "html-table" })).toContain("<table>");
  });
});

describe("pdf-form-field-extractor exportFormSchema and serializeFormSchema", () => {
  it("exports a schema with all field properties", () => {
    const schema = exportFormSchema([textField()], "src.pdf");
    expect(schema.sourceFile).toBe("src.pdf");
    expect(schema.totalFields).toBe(1);
    expect(schema.fields[0].name).toBe("firstName");
    expect(schema.fields[0].defaultValue).toBe("Alice");
  });
  it("serializeFormSchema returns JSON string", () => {
    const s = serializeFormSchema(exportFormSchema([textField()], ""));
    expect(() => JSON.parse(s)).not.toThrow();
  });
});

describe("pdf-form-field-extractor getOutputFilename", () => {
  it("appends -fields.<ext> to base name", () => {
    expect(getOutputFilename("json", "my form.pdf")).toBe("my_form-fields.json");
    expect(getOutputFilename("csv", "report.pdf")).toBe("report-fields.csv");
  });
  it("falls back to output for empty name", () => {
    expect(getOutputFilename("text", "")).toBe("output-fields.txt");
  });
});

describe("pdf-form-field-extractor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 3, fieldCount: 5, format: "json" });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.pdf");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, fieldCount: 1, format: "csv" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, fieldCount: 1, format: "json" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-form-field-extractor shareable URL", () => {
  it("builds share URL with non-default options", () => {
    const url = buildShareUrl({
      ...DEFAULT_OPTIONS,
      outputFormat: "csv",
      groupBy: "type",
      includeValues: false,
      includeProperties: false,
      fieldMapping: "x=X",
    });
    expect(url).toContain("format=csv");
    expect(url).toContain("group=type");
    expect(url).toContain("values=0");
    expect(url).toContain("props=0");
    expect(url).toContain("map=x");
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("format=csv&group=type&values=0&props=0&map=a%3DA");
    expect(parsed.outputFormat).toBe("csv");
    expect(parsed.groupBy).toBe("type");
    expect(parsed.includeValues).toBe(false);
    expect(parsed.includeProperties).toBe(false);
    expect(parsed.fieldMapping).toBe("a=A");
  });
  it("filters unknown enum values", () => {
    const parsed = parseShareUrl("format=bogus&group=also-bogus");
    expect(parsed.outputFormat).toBeUndefined();
    expect(parsed.groupBy).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf-form-field-extractor validateOptions", () => {
  it("accepts valid options", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown output format", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, outputFormat: "bogus" as OutputFormat });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown group mode", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, groupBy: "bogus" as GroupMode });
    expect(r.ok).toBe(false);
  });
  it("rejects bad field mapping", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, fieldMapping: "no_equals" });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toContain("Field mapping");
  });
});

// Suppress unused-import lint
export type _Unused = OutputFormat | GroupMode;
