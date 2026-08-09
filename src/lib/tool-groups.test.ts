/**
 * Unit tests for src/lib/tool-groups.ts — task-based grouping.
 */
import { describe, it, expect } from "vitest";
import { groupIdFor, groupTools, type ToolGroupDef } from "./tool-groups";
import type { ToolCategory, ToolManifest } from "./tool";

const tool = (overrides: Partial<ToolManifest> & { id: string }): ToolManifest =>
  ({
    name: overrides.id,
    description: "",
    category: "pdf",
    keywords: [],
    icon: "x",
    status: "done",
    ...overrides,
  }) as ToolManifest;

describe("groupIdFor", () => {
  it("matches PDF page editing by name", () => {
    expect(groupIdFor("pdf", tool({ id: "rotate-pdf", name: "Rotate PDF" }))).toBe("page-edit");
    expect(groupIdFor("pdf", tool({ id: "x", name: "Delete PDF Pages" }))).toBe("page-edit");
  });

  it("matches PDF compress by keyword", () => {
    expect(
      groupIdFor(
        "pdf",
        tool({ id: "x", name: "PDF Optimizer", keywords: ["reduce pdf size", "compress"] })
      )
    ).toBe("compress");
  });

  it("matches convert-to-pdf", () => {
    expect(groupIdFor("pdf", tool({ id: "x", name: "HTML to PDF" }))).toBe("convert-to");
    expect(groupIdFor("pdf", tool({ id: "x", name: "Images to PDF" }))).toBe("convert-to");
  });

  it("matches convert-from-pdf", () => {
    expect(groupIdFor("pdf", tool({ id: "x", name: "PDF to Word" }))).toBe("convert-from");
    expect(groupIdFor("pdf", tool({ id: "x", name: "Extract Text from PDF" }))).toBe("convert-from");
  });

  it("matches protect & sign", () => {
    expect(groupIdFor("pdf", tool({ id: "x", name: "PDF Password Encryptor" }))).toBe("protect");
    expect(groupIdFor("pdf", tool({ id: "x", name: "PDF Watermark" }))).toBe("protect");
  });

  it("falls back to other for unknown tools", () => {
    expect(groupIdFor("pdf", tool({ id: "x", name: "Some Odd Thing" }))).toBe("other");
    // categories without a map always go to other
    expect(groupIdFor("ai", tool({ id: "x", name: "AI Anything" }))).toBe("other");
  });

  it("matches developer format group", () => {
    expect(groupIdFor("developer", tool({ id: "x", name: "JSON Formatter" }))).toBe("format");
    expect(groupIdFor("developer", tool({ id: "x", name: "JS Beautifier" }))).toBe("format");
  });

  it("matches image compress group", () => {
    expect(groupIdFor("image", tool({ id: "x", name: "Image Compressor" }))).toBe("compress");
    expect(groupIdFor("image", tool({ id: "x", name: "PNG to JPG" }))).toBe("convert");
  });
});

describe("groupTools", () => {
  it("groups tools into ordered buckets with done first", () => {
    const tools: ToolManifest[] = [
      tool({ id: "a", name: "Rotate PDF", status: "done" }),
      tool({ id: "b", name: "PDF to Word", status: "done" }),
      tool({ id: "c", name: "Compress PDF", status: "planned" }),
      tool({ id: "d", name: "Delete Pages", status: "done" }),
      tool({ id: "e", name: "Something Weird", status: "done" }),
    ];
    const out = groupTools("pdf", tools);
    const labels = out.map((g) => g.group?.label ?? "Other");
    expect(labels).toContain("Page editing");
    expect(labels).toContain("Convert from PDF");
    expect(labels).toContain("Compress & optimize");
    expect(labels).toContain("Other");

    const pageEdit = out.find((g) => g.group?.label === "Page editing")!;
    expect(pageEdit.items.map((t) => t.id).sort()).toEqual(["a", "d"]);
    const compress = out.find((g) => g.group?.label === "Compress & optimize")!;
    // planned tool still present, but group exists
    expect(compress.items.map((t) => t.id)).toEqual(["c"]);
  });

  it("returns a single bucket for unmapped categories", () => {
    const out = groupTools("ai", [
      tool({ id: "a", name: "AI Chat" }),
      tool({ id: "b", name: "AI Writer" }),
    ]);
    expect(out.length).toBe(1);
    expect(out[0]!.group).toBeNull();
    expect(out[0]!.items.length).toBe(2);
  });

  it("sorts planned tools after done within a group", () => {
    const out = groupTools("pdf", [
      tool({ id: "z", name: "Rotate PDF Pages", status: "planned" }),
      tool({ id: "a", name: "Delete PDF Pages", status: "done" }),
    ]);
    const pageEdit = out.find((g) => g.group?.label === "Page editing")!;
    expect(pageEdit.items[0]!.id).toBe("a");
    expect(pageEdit.items[1]!.id).toBe("z");
  });
});

// keep type import used
void (null as unknown as ToolGroupDef);
