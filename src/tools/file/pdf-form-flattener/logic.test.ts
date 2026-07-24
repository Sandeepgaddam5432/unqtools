/**
 * PDF Form Flattener — unit tests.
 */
import { describe, it, expect } from "vitest";
import { reportToCsv, summarizeResult, summarizeFields, type FlattenResult } from "./logic";

describe("summarizeFields", () => {
  it("categorizes text fields", () => {
    const fakeFields = [
      { getName: () => "first_name", isReadOnly: () => false, isRequired: () => true, constructor: { name: "PDFTextField" } },
    ];
    const r = summarizeFields(fakeFields);
    expect(r[0]!.name).toBe("first_name");
    expect(r[0]!.type).toBe("text");
    expect(r[0]!.required).toBe(true);
  });
  it("categorizes checkbox fields", () => {
    const fakeFields = [
      { getName: () => "agree", isReadOnly: () => false, isRequired: () => false, constructor: { name: "PDFCheckBox" } },
    ];
    expect(summarizeFields(fakeFields)[0]!.type).toBe("checkbox");
  });
  it("categorizes radio fields", () => {
    const fakeFields = [
      { getName: () => "gender", isReadOnly: () => false, isRequired: () => false, constructor: { name: "PDFRadioGroup" } },
    ];
    expect(summarizeFields(fakeFields)[0]!.type).toBe("radio");
  });
  it("marks unknown types as 'other'", () => {
    const fakeFields = [
      { getName: () => "weird", isReadOnly: () => false, isRequired: () => false, constructor: { name: "SomeUnknownThing" } },
    ];
    expect(summarizeFields(fakeFields)[0]!.type).toBe("other");
  });
});

describe("reportToCsv", () => {
  it("generates CSV with header", () => {
    const report = [
      { name: "first_name", type: "text", value: "John", flattened: true },
      { name: "agree", type: "checkbox", value: "Yes", flattened: true },
    ];
    const csv = reportToCsv(report);
    expect(csv.split("\n")[0]).toBe("FieldName,Type,Value,Flattened");
    expect(csv).toContain("first_name");
    expect(csv).toContain("John");
    expect(csv).toContain("yes");
  });
  it("escapes quotes in values", () => {
    const report = [
      { name: "name", type: "text", value: 'Has "quotes"', flattened: false },
    ];
    const csv = reportToCsv(report);
    expect(csv).toContain('""quotes""');
  });
});

describe("summarizeResult", () => {
  it("generates summary text", () => {
    const r: FlattenResult = {
      success: true,
      fieldCount: 5,
      flattenedFieldCount: 5,
      annotationCount: 2,
      inputSize: 1000,
      outputSize: 1100,
      warnings: ["XFA preserved"],
      report: [],
    };
    const s = summarizeResult(r);
    expect(s).toContain("Success: YES");
    expect(s).toContain("Total fields: 5");
    expect(s).toContain("Size delta: +100");
    expect(s).toContain("XFA preserved");
  });
  it("handles failed flatten", () => {
    const r: FlattenResult = {
      success: false,
      fieldCount: 0,
      flattenedFieldCount: 0,
      annotationCount: 0,
      inputSize: 0,
      outputSize: 0,
      warnings: ["Failed to load PDF"],
      report: [],
    };
    const s = summarizeResult(r);
    expect(s).toContain("Success: NO");
  });
});
