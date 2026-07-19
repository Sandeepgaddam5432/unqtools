import { describe, it, expect, beforeEach } from "vitest";
import {
  FIELD_TYPE_LABELS,
  DEFAULT_OPTIONS,
  parseFormData,
  parseMultiValue,
  serializeFieldValue,
  serializeFormData,
  parseFieldMapping,
  buildLabelMap,
  detectFieldType,
  formatFieldValue,
  displayFieldValue,
  validateForm,
  findRequiredFields,
  findEmptyFields,
  findRequiredEmpty,
  computeSummaryStats,
  fieldTypeDistribution,
  suggestFieldLabel,
  suggestAllLabels,
  serializeLabelMapping,
  exportFormSchema,
  serializeFormSchema,
  formatFieldList,
  buildNeedAppearancesFlag,
  buildSaveOptions,
  renderTextReport,
  renderCsv,
  renderJson,
  escapeXml,
  escapeHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  getOutputFilename,
  type FormField,
  type FieldValue,
  type ConvertOptions,
  type FieldType,
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

function field(
  name: string,
  type: FieldType,
  value = "",
  required = false,
  readOnly = false,
  options: string[] = [],
): FormField {
  return { name, type, value, required, readOnly, options, filled: !!value };
}

describe("pdfform constants", () => {
  it("has labels for all 8 field types", () => {
    expect(FIELD_TYPE_LABELS.text).toBe("Text");
    expect(FIELD_TYPE_LABELS.checkbox).toBe("Checkbox");
    expect(FIELD_TYPE_LABELS.radio).toBe("Radio group");
    expect(FIELD_TYPE_LABELS.dropdown).toBe("Dropdown");
    expect(FIELD_TYPE_LABELS.list).toBe("Option list");
    expect(FIELD_TYPE_LABELS.signature).toBe("Signature");
    expect(FIELD_TYPE_LABELS.button).toBe("Button");
    expect(FIELD_TYPE_LABELS.unknown).toBe("Unknown");
  });
  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.formData).toBe("");
    expect(DEFAULT_OPTIONS.fieldMapping).toBe("");
    expect(DEFAULT_OPTIONS.flattenForm).toBe(false);
    expect(DEFAULT_OPTIONS.preserveAppearance).toBe(true);
  });
});

describe("pdfform parseFormData", () => {
  it("returns empty for empty input", () => {
    const r = parseFormData("");
    expect(r.values).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it("skips empty lines and comments", () => {
    const r = parseFormData("\n# a comment\n   \n# another\n");
    expect(r.values).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it("parses a single field=value line", () => {
    const r = parseFormData("name=Alice");
    expect(r.values).toHaveLength(1);
    expect(r.values[0].name).toBe("name");
    expect(r.values[0].rawValue).toBe("Alice");
    expect(r.values[0].values).toEqual(["Alice"]);
  });
  it("preserves the value exactly (no trim of value)", () => {
    const r = parseFormData("text=  Hello World  ");
    expect(r.values[0].rawValue).toBe("  Hello World  ");
  });
  it("parses multi-value (pipe-separated) lines", () => {
    const r = parseFormData("colors=red|green|blue");
    expect(r.values[0].values).toEqual(["red", "green", "blue"]);
  });
  it("trims whitespace from each multi-value component", () => {
    const r = parseFormData("colors=red | green | blue");
    expect(r.values[0].values).toEqual(["red", "green", "blue"]);
  });
  it("filters out empty pipe components", () => {
    const r = parseFormData("colors=red||blue|");
    expect(r.values[0].values).toEqual(["red", "blue"]);
  });
  it("allows duplicate keys (last one wins)", () => {
    const r = parseFormData("name=Alice\nname=Bob");
    expect(r.values).toHaveLength(1);
    expect(r.values[0].rawValue).toBe("Bob");
  });
  it("reports error for lines without =", () => {
    const r = parseFormData("just text\nname=Alice");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("Line 1");
    expect(r.values).toHaveLength(1);
  });
  it("reports error for empty field name", () => {
    const r = parseFormData("=value");
    expect(r.errors).toHaveLength(1);
    expect(r.values).toEqual([]);
  });
  it("handles Windows line endings", () => {
    const r = parseFormData("a=1\r\nb=2\r\n");
    expect(r.values).toHaveLength(2);
    expect(r.values[0].name).toBe("a");
    expect(r.values[1].name).toBe("b");
  });
});

describe("pdfform parseMultiValue", () => {
  it("returns empty array for empty string", () => {
    expect(parseMultiValue("")).toEqual([]);
  });
  it("returns single value for non-pipe string", () => {
    expect(parseMultiValue("hello")).toEqual(["hello"]);
  });
  it("trims and filters", () => {
    expect(parseMultiValue("  a  |  b  |  |  c  ")).toEqual(["a", "b", "c"]);
  });
});

describe("pdfform serializeFieldValue / serializeFormData", () => {
  it("serializes a single value back to name=value", () => {
    const v: FieldValue = { name: "foo", rawValue: "bar", values: ["bar"] };
    expect(serializeFieldValue(v)).toBe("foo=bar");
  });
  it("serializes a list of values to multi-line text", () => {
    const vs: FieldValue[] = [
      { name: "a", rawValue: "1", values: ["1"] },
      { name: "b", rawValue: "2", values: ["2"] },
    ];
    expect(serializeFormData(vs)).toBe("a=1\nb=2");
  });
});

describe("pdfform parseFieldMapping", () => {
  it("returns empty for empty input", () => {
    const r = parseFieldMapping("");
    expect(r.mappings).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it("parses field_name=Display Name", () => {
    const r = parseFieldMapping("first_name=First Name");
    expect(r.mappings).toHaveLength(1);
    expect(r.mappings[0].name).toBe("first_name");
    expect(r.mappings[0].label).toBe("First Name");
  });
  it("skips comments and empty lines", () => {
    const r = parseFieldMapping("# comment\n\nfoo=Bar");
    expect(r.mappings).toHaveLength(1);
    expect(r.mappings[0].name).toBe("foo");
  });
  it("reports error for missing =", () => {
    const r = parseFieldMapping("no equals here");
    expect(r.errors).toHaveLength(1);
  });
  it("dedupes repeated field names", () => {
    const r = parseFieldMapping("a=One\na=Two");
    expect(r.mappings).toHaveLength(1);
    expect(r.mappings[0].label).toBe("One");
  });
  it("buildLabelMap falls back to original name when label is empty", () => {
    const map = buildLabelMap([{ name: "x", label: "" }]);
    expect(map.get("x")).toBe("x");
  });
});

describe("pdfform detectFieldType", () => {
  it("detects text field", () => {
    expect(detectFieldType("PDFTextField")).toBe("text");
  });
  it("detects checkbox", () => {
    expect(detectFieldType("PDFCheckBox")).toBe("checkbox");
  });
  it("detects radio group", () => {
    expect(detectFieldType("PDFRadioGroup")).toBe("radio");
  });
  it("detects dropdown", () => {
    expect(detectFieldType("PDFDropdown")).toBe("dropdown");
  });
  it("detects option list", () => {
    expect(detectFieldType("PDFOptionList")).toBe("list");
  });
  it("detects signature", () => {
    expect(detectFieldType("PDFSignature")).toBe("signature");
  });
  it("detects button", () => {
    expect(detectFieldType("PDFButton")).toBe("button");
  });
  it("returns unknown for unrecognized", () => {
    expect(detectFieldType("SomeOtherThing")).toBe("unknown");
    expect(detectFieldType("")).toBe("unknown");
  });
});

describe("pdfform formatFieldValue", () => {
  it("returns text as-is for text fields", () => {
    expect(formatFieldValue("text", "hello world")).toEqual({ text: "hello world" });
  });
  it("parses boolean values for checkboxes", () => {
    expect(formatFieldValue("checkbox", "yes").checked).toBe(true);
    expect(formatFieldValue("checkbox", "Yes").checked).toBe(true);
    expect(formatFieldValue("checkbox", "1").checked).toBe(true);
    expect(formatFieldValue("checkbox", "true").checked).toBe(true);
    expect(formatFieldValue("checkbox", "✓").checked).toBe(true);
    expect(formatFieldValue("checkbox", "off").checked).toBe(false);
    expect(formatFieldValue("checkbox", "no").checked).toBe(false);
    expect(formatFieldValue("checkbox", "0").checked).toBe(false);
  });
  it("returns selected options for radio/dropdown/list", () => {
    const opts = ["red", "green", "blue"];
    expect(formatFieldValue("dropdown", "red", opts).selected).toEqual(["red"]);
    expect(formatFieldValue("list", "red|blue", opts).selected).toEqual(["red", "blue"]);
  });
  it("returns error for value not in options", () => {
    const opts = ["red", "green", "blue"];
    const r = formatFieldValue("radio", "purple", opts);
    expect(r.selected).toEqual([]);
    expect(r.error).toContain("purple");
  });
  it("returns error for unsupported types", () => {
    expect(formatFieldValue("signature", "x").error).toContain("Signature");
    expect(formatFieldValue("button", "x").error).toContain("button");
    expect(formatFieldValue("unknown", "x").error).toContain("unknown");
  });
});

describe("pdfform displayFieldValue", () => {
  it("displays Yes/No for checkbox", () => {
    expect(displayFieldValue("checkbox", "Yes")).toBe("Yes");
    expect(displayFieldValue("checkbox", "Off")).toBe("No");
    expect(displayFieldValue("checkbox", "")).toBe("No");
  });
  it("displays pipe-separated for radio/dropdown/list with selected", () => {
    expect(displayFieldValue("radio", "", ["red", "blue"])).toBe("red|blue");
    expect(displayFieldValue("dropdown", "fallback")).toBe("fallback");
  });
  it("returns text as-is for text fields", () => {
    expect(displayFieldValue("text", "hello")).toBe("hello");
  });
});

describe("pdfform validateForm", () => {
  it("returns ok when all required fields are filled", () => {
    const fields = [
      field("name", "text", "Alice", true),
      field("age", "text", "30", false),
    ];
    const data = parseFormData("name=Alice\nage=30");
    const r = validateForm(fields, data);
    expect(r.ok).toBe(true);
    expect(r.missingRequired).toEqual([]);
  });
  it("flags missing required fields", () => {
    const fields = [
      field("name", "text", "", true),
      field("email", "text", "", true),
    ];
    const data = parseFormData("name=Alice"); // email missing
    const r = validateForm(fields, data);
    expect(r.ok).toBe(false);
    expect(r.missingRequired).toContain("email");
  });
  it("flags unknown fields in form data", () => {
    const fields = [field("name", "text", "Alice")];
    const data = parseFormData("name=Alice\nunknown_field=foo");
    const r = validateForm(fields, data);
    expect(r.ok).toBe(false);
    expect(r.unknownFields).toContain("unknown_field");
  });
  it("flags type mismatches (invalid radio value)", () => {
    const fields = [field("color", "radio", "", false, false, ["red", "green"])];
    const data = parseFormData("color=purple");
    const r = validateForm(fields, data);
    expect(r.ok).toBe(false);
    expect(r.typeMismatches.some((s) => s.includes("color"))).toBe(true);
  });
  it("treats readOnly required fields as not-required-to-fill", () => {
    const fields = [field("computed", "text", "", true, true)];
    const data = parseFormData("");
    const r = validateForm(fields, data);
    expect(r.missingRequired).toEqual([]);
  });
  it("accepts empty form data when no required fields", () => {
    const fields = [field("opt", "text", "")];
    const data = parseFormData("");
    const r = validateForm(fields, data);
    expect(r.ok).toBe(true);
  });
});

describe("pdfform required/empty finders", () => {
  it("findRequiredFields returns all required", () => {
    const fields = [
      field("a", "text", "", true),
      field("b", "text", "", false),
      field("c", "text", "", true),
    ];
    expect(findRequiredFields(fields)).toEqual(["a", "c"]);
  });
  it("findEmptyFields returns unfilled", () => {
    const fields = [
      field("a", "text", "x"),
      field("b", "text", ""),
      field("c", "text", ""),
    ];
    expect(findEmptyFields(fields)).toEqual(["b", "c"]);
  });
  it("findRequiredEmpty returns required-and-empty", () => {
    const fields = [
      field("a", "text", "x", true),
      field("b", "text", "", true),
      field("c", "text", "", false),
    ];
    expect(findRequiredEmpty(fields)).toEqual(["b"]);
  });
});

describe("pdfform computeSummaryStats", () => {
  it("handles empty field list", () => {
    const s = computeSummaryStats([]);
    expect(s.totalFields).toBe(0);
    expect(s.filledFields).toBe(0);
    expect(s.requiredEmpty).toBe(0);
  });
  it("counts fields by type and filled status", () => {
    const fields = [
      field("name", "text", "Alice", true),
      field("age", "text", "30"),
      field("agree", "checkbox", "Yes", true),
      field("country", "dropdown", "", false, false, ["US", "CA"]),
      field("notes", "text", ""),
    ];
    const s = computeSummaryStats(fields);
    expect(s.totalFields).toBe(5);
    expect(s.filledFields).toBe(3);
    expect(s.emptyFields).toBe(2);
    expect(s.requiredFields).toBe(2);
    expect(s.requiredEmpty).toBe(0);
    expect(s.byType.text).toBe(3);
    expect(s.byType.checkbox).toBe(1);
    expect(s.byType.dropdown).toBe(1);
    expect(s.byTypeFilled.text).toBe(2);
    expect(s.byTypeFilled.checkbox).toBe(1);
    expect(s.byTypeFilled.dropdown).toBe(0);
  });
});

describe("pdfform fieldTypeDistribution", () => {
  it("returns sorted percentages", () => {
    const fields = [
      field("a", "text", "x"),
      field("b", "text", "y"),
      field("c", "checkbox", "Yes"),
    ];
    const dist = fieldTypeDistribution(fields);
    expect(dist).toHaveLength(2);
    expect(dist[0].type).toBe("text");
    expect(dist[0].count).toBe(2);
    expect(dist[0].percent).toBe(66.7);
    expect(dist[1].type).toBe("checkbox");
    expect(dist[1].percent).toBe(33.3);
  });
  it("returns empty for no fields", () => {
    expect(fieldTypeDistribution([])).toEqual([]);
  });
});

describe("pdfform suggestFieldLabel", () => {
  it("strips array indices", () => {
    expect(suggestFieldLabel("foo[0]")).toBe("Foo");
  });
  it("takes last segment after dot", () => {
    expect(suggestFieldLabel("Page1.PersonalInfo.FirstName")).toBe("First Name");
  });
  it("splits camelCase", () => {
    expect(suggestFieldLabel("firstName")).toBe("First Name");
    expect(suggestFieldLabel("LastName")).toBe("Last Name");
  });
  it("replaces underscores and hyphens with spaces", () => {
    expect(suggestFieldLabel("first_name")).toBe("First Name");
    expect(suggestFieldLabel("last-name")).toBe("Last Name");
  });
  it("falls back to original for empty input", () => {
    expect(suggestFieldLabel("")).toBe("");
  });
  it("suggestAllLabels maps all fields", () => {
    const fields = [
      field("first_name", "text"),
      field("last_name", "text"),
    ];
    const labels = suggestAllLabels(fields);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toEqual({ name: "first_name", label: "First Name" });
    expect(labels[1]).toEqual({ name: "last_name", label: "Last Name" });
  });
  it("serializeLabelMapping produces editable text", () => {
    const labels = [{ name: "first_name", label: "First Name" }];
    expect(serializeLabelMapping(labels)).toBe("first_name=First Name");
  });
});

describe("pdfform exportFormSchema & serializeFormSchema", () => {
  it("exports a clean schema with metadata", () => {
    const fields = [
      field("name", "text", "Alice", true, false, []),
      field("color", "dropdown", "red", false, false, ["red", "green", "blue"]),
    ];
    const schema = exportFormSchema(fields, "form.pdf");
    expect(schema.sourceFile).toBe("form.pdf");
    expect(schema.extractedAt).toBeGreaterThan(0);
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[0]).toEqual({
      name: "name",
      type: "text",
      required: true,
      readOnly: false,
      options: [],
      defaultValue: "Alice",
    });
    expect(schema.fields[1].options).toEqual(["red", "green", "blue"]);
  });
  it("serializeFormSchema produces valid JSON", () => {
    const schema = exportFormSchema([], "x.pdf");
    const json = serializeFormSchema(schema);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).sourceFile).toBe("x.pdf");
  });
});

describe("pdfform formatFieldList", () => {
  it("formats each field with label, type, value, options", () => {
    const fields = [
      field("name", "text", "Alice", true),
      field("color", "dropdown", "", false, false, ["red", "blue"]),
    ];
    const map = buildLabelMap([
      { name: "name", label: "Full Name" },
    ]);
    const list = formatFieldList(fields, map);
    expect(list).toHaveLength(2);
    expect(list[0]).toBe("Full Name * (text) = Alice");
    expect(list[1]).toBe("color (dropdown) = (empty) [red|blue]");
  });
  it("marks read-only fields with (ro)", () => {
    const fields = [field("calc", "text", "42", false, true)];
    const list = formatFieldList(fields, new Map());
    expect(list[0]).toContain("(ro)");
  });
});

describe("pdfform buildNeedAppearancesFlag & buildSaveOptions", () => {
  it("returns NeedAppearances=true when preserve=true", () => {
    const r = buildNeedAppearancesFlag(true);
    expect(r).toEqual({ key: "NeedAppearances", value: true });
  });
  it("returns NeedAppearances=false when preserve=false", () => {
    const r = buildNeedAppearancesFlag(false);
    expect(r).toEqual({ key: "NeedAppearances", value: false });
  });
  it("buildSaveOptions reflects flatten setting", () => {
    expect(buildSaveOptions(true)).toEqual({ flatten: true });
    expect(buildSaveOptions(false)).toEqual({ flatten: false });
  });
});

describe("pdfform renderers", () => {
  const fields = [
    field("name", "text", "Alice", true),
    field("age", "text", "30"),
    field("agree", "checkbox", "Yes", true),
    field("color", "dropdown", "red", false, false, ["red", "green", "blue"]),
    field("notes", "text", ""),
  ];
  it("renderTextReport includes summary and field lines", () => {
    const report = renderTextReport(fields, new Map());
    expect(report).toContain("Total: 5 field(s)");
    expect(report).toContain("Filled: 4");
    expect(report).toContain("Required: 2");
    expect(report).toContain("name * (text) = Alice");
  });
  it("renderCsv has header row and 5 data rows", () => {
    const csv = renderCsv(fields);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("field_name,type,value,required,read_only,options");
    expect(lines).toHaveLength(6);
    expect(lines[1]).toContain("name,text,Alice,yes,no,");
    expect(lines[4]).toContain("color,dropdown,red,no,no,");
    expect(lines[4]).toContain("red|green|blue");
  });
  it("renderCsv quotes values containing commas", () => {
    const fields2 = [field("addr", "text", "1 Main St, Apt 2")];
    const csv = renderCsv(fields2);
    expect(csv).toContain('"1 Main St, Apt 2"');
  });
  it("renderJson produces valid JSON with schema", () => {
    const json = renderJson(fields, "form.pdf");
    const parsed = JSON.parse(json);
    expect(parsed.sourceFile).toBe("form.pdf");
    expect(parsed.fields).toHaveLength(5);
    expect(parsed.fields[0].name).toBe("name");
  });
});

describe("pdfform escaping", () => {
  it("escapeXml replaces all 5 special chars", () => {
    expect(escapeXml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
  it("escapeHtml replaces 4 special chars", () => {
    expect(escapeHtml("<>\"&")).toBe("&lt;&gt;&quot;&amp;");
  });
});

describe("pdfform history", () => {
  it("returns empty when nothing stored", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      ts: Date.now(),
      fileName: "form.pdf",
      fieldCount: 10,
      filledCount: 8,
      flattened: false,
    };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].fileName).toBe("form.pdf");
  });
  it("caps history at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `f${i}.pdf`,
        fieldCount: 1,
        filledCount: 1,
        flattened: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].fileName).toBe("f24.pdf");
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", fieldCount: 1, filledCount: 1, flattened: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdfform share URL", () => {
  const opts: ConvertOptions = {
    formData: "name=Alice\nage=30",
    fieldMapping: "name=Full Name",
    flattenForm: true,
    preserveAppearance: false,
  };
  it("buildShareUrl encodes form data, mapping, and flags", () => {
    const url = buildShareUrl(opts);
    expect(url).toContain("data=");
    expect(url).toContain("name%3DAlice");
    expect(url).toContain("map=");
    expect(url).toContain("flatten=1");
    expect(url).toContain("appearances=0");
  });
  it("parseShareUrl round-trips", () => {
    const url = buildShareUrl(opts);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.formData).toBe("name=Alice\nage=30");
    expect(parsed.fieldMapping).toBe("name=Full Name");
    expect(parsed.flattenForm).toBe(true);
    expect(parsed.preserveAppearance).toBe(false);
  });
  it("buildShareUrl omits empty/default options", () => {
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).not.toContain("data=");
    expect(url).not.toContain("map=");
    expect(url).not.toContain("flatten=");
    expect(url).not.toContain("appearances=");
  });
});

describe("pdfform validateOptions", () => {
  it("accepts empty defaults", () => {
    const r = validateOptions(DEFAULT_OPTIONS);
    expect(r.ok).toBe(true);
  });
  it("accepts valid form data", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, formData: "name=Alice\nage=30" });
    expect(r.ok).toBe(true);
  });
  it("rejects invalid form data (missing =)", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, formData: "invalid line without equals" });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid field mapping", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      fieldMapping: "no equals here",
    });
    expect(r.ok).toBe(false);
  });
});

describe("pdfform getOutputFilename", () => {
  it("strips .pdf and adds -filled.pdf", () => {
    expect(getOutputFilename("form.pdf")).toBe("form-filled.pdf");
    expect(getOutputFilename("data.PDF")).toBe("data-filled.pdf");
  });
  it("replaces unsafe chars", () => {
    expect(getOutputFilename("my form.pdf")).toBe("my_form-filled.pdf");
  });
  it("falls back to 'output' for empty names", () => {
    expect(getOutputFilename("")).toBe("output-filled.pdf");
  });
  it("supports custom suffix", () => {
    expect(getOutputFilename("form.pdf", "custom")).toBe("form-custom.pdf");
  });
});
