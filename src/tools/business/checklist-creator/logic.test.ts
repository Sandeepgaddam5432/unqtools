import { describe, it, expect } from "vitest";
import {
  getTemplates, getTemplate, createFromTemplate, createEmpty, addItem, toggleItem, removeItem,
  updateItem, reorderItems, computeStats, filterItems, exportMarkdown, exportCsv, exportJson,
  importJson, renderReport, planBatch, renderBatchCsv,
} from "./logic";

describe("checklist-creator getTemplates / getTemplate", () => {
  it("returns 4 templates", () => {
    expect(getTemplates().length).toBe(4);
  });
  it("finds template by id", () => {
    expect(getTemplate("pre-flight")?.label).toMatch(/Pre-flight/);
  });
  it("returns null for unknown", () => {
    expect(getTemplate("x")).toBeNull();
  });
});

describe("checklist-creator createFromTemplate", () => {
  it("creates a checklist from a template", () => {
    const list = createFromTemplate("pre-flight");
    expect(list).not.toBeNull();
    expect(list!.items.length).toBeGreaterThan(0);
    expect(list!.items.every((i) => !i.done)).toBe(true);
  });
  it("returns null for unknown template", () => {
    expect(createFromTemplate("x")).toBeNull();
  });
  it("uses provided title", () => {
    const list = createFromTemplate("code-review", "Custom Title");
    expect(list!.title).toBe("Custom Title");
  });
});

describe("checklist-creator createEmpty", () => {
  it("creates an empty checklist", () => {
    const list = createEmpty("Empty");
    expect(list.items.length).toBe(0);
    expect(list.title).toBe("Empty");
  });
});

describe("checklist-creator addItem", () => {
  it("adds an item to the end", () => {
    const list = addItem(createEmpty("Test"), "Task 1", "Work", "high");
    expect(list.items.length).toBe(1);
    expect(list.items[0].text).toBe("Task 1");
    expect(list.items[0].done).toBe(false);
  });
});

describe("checklist-creator toggleItem", () => {
  it("toggles done status", () => {
    let list = addItem(createEmpty("Test"), "Task 1");
    list = toggleItem(list, list.items[0].id);
    expect(list.items[0].done).toBe(true);
    list = toggleItem(list, list.items[0].id);
    expect(list.items[0].done).toBe(false);
  });
});

describe("checklist-creator removeItem", () => {
  it("removes an item by id", () => {
    let list = addItem(addItem(createEmpty("Test"), "Task 1"), "Task 2");
    const firstId = list.items[0].id;
    list = removeItem(list, firstId);
    expect(list.items.length).toBe(1);
    expect(list.items[0].text).toBe("Task 2");
  });
});

describe("checklist-creator updateItem", () => {
  it("updates an item's text", () => {
    let list = addItem(createEmpty("Test"), "Task 1");
    list = updateItem(list, list.items[0].id, { text: "Updated", priority: "high" });
    expect(list.items[0].text).toBe("Updated");
    expect(list.items[0].priority).toBe("high");
  });
});

describe("checklist-creator reorderItems", () => {
  it("reorders items", () => {
    let list = createEmpty("Test");
    list = addItem(list, "A");
    list = addItem(list, "B");
    list = addItem(list, "C");
    list = reorderItems(list, 0, 2);
    expect(list.items[0].text).toBe("B");
    expect(list.items[2].text).toBe("A");
  });
  it("returns unchanged for out-of-range indices", () => {
    let list = addItem(createEmpty("Test"), "A");
    const original = list;
    list = reorderItems(list, 0, 5);
    expect(list).toEqual(original);
  });
});

describe("checklist-creator computeStats", () => {
  it("computes stats correctly", () => {
    let list = createEmpty("Test");
    list = addItem(list, "A", "Work", "high");
    list = addItem(list, "B", "Work", "low");
    list = addItem(list, "C", "Personal", "medium");
    list = toggleItem(list, list.items[0].id);
    const stats = computeStats(list);
    expect(stats.total).toBe(3);
    expect(stats.done).toBe(1);
    expect(stats.pending).toBe(2);
    expect(stats.completionRate).toBeCloseTo(1 / 3, 5);
    expect(stats.byCategory.Work.done).toBe(1);
    expect(stats.byCategory.Work.total).toBe(2);
    expect(stats.byPriority.high.done).toBe(1);
  });
  it("handles empty list", () => {
    const stats = computeStats(createEmpty("Empty"));
    expect(stats.total).toBe(0);
    expect(stats.completionRate).toBe(0);
  });
});

describe("checklist-creator filterItems", () => {
  it("filters by done status", () => {
    let list = createEmpty("Test");
    list = addItem(list, "A");
    list = addItem(list, "B");
    list = toggleItem(list, list.items[0].id);
    expect(filterItems(list, { done: true }).length).toBe(1);
    expect(filterItems(list, { done: false }).length).toBe(1);
  });
  it("filters by category", () => {
    let list = createEmpty("Test");
    list = addItem(list, "A", "Work");
    list = addItem(list, "B", "Personal");
    expect(filterItems(list, { category: "Work" }).length).toBe(1);
  });
});

describe("checklist-creator exportMarkdown", () => {
  it("exports Markdown with title and items", () => {
    let list = createEmpty("Test List");
    list = addItem(list, "Task 1", "Work", "high");
    list = toggleItem(list, list.items[0].id);
    const md = exportMarkdown(list);
    expect(md).toContain("# Test List");
    expect(md).toContain("[x] Task 1");
  });
});

describe("checklist-creator exportCsv", () => {
  it("exports CSV with header", () => {
    let list = createEmpty("Test");
    list = addItem(list, "Task 1");
    const csv = exportCsv(list);
    expect(csv.split("\n")[0]).toBe("id,text,done,category,priority");
  });
  it("escapes quotes in text", () => {
    let list = createEmpty("Test");
    list = addItem(list, 'Task with "quotes"');
    const csv = exportCsv(list);
    expect(csv).toContain('""quotes""');
  });
});

describe("checklist-creator exportJson / importJson", () => {
  it("round-trips through JSON", () => {
    let list = createEmpty("Test");
    list = addItem(list, "Task 1", "Work", "high");
    const json = exportJson(list);
    const imported = importJson(json);
    expect(imported).not.toBeNull();
    expect(imported!.title).toBe("Test");
    expect(imported!.items.length).toBe(1);
  });
  it("returns null for invalid JSON", () => {
    expect(importJson("not json")).toBeNull();
  });
  it("returns null for object without items", () => {
    expect(importJson('{"foo":"bar"}')).toBeNull();
  });
});

describe("checklist-creator renderReport", () => {
  it("renders a stats report", () => {
    let list = createFromTemplate("pre-flight")!;
    const report = renderReport(list);
    expect(report).toContain("Checklist Report");
    expect(report).toContain("Total items");
    expect(report).toContain("By category");
  });
});

describe("checklist-creator planBatch / renderBatchCsv", () => {
  it("computes stats for batch", () => {
    const lists = [createFromTemplate("pre-flight")!, createFromTemplate("code-review")!];
    const stats = planBatch(lists);
    expect(stats.length).toBe(2);
  });
  it("renders batch CSV", () => {
    const lists = [createFromTemplate("pre-flight")!];
    const csv = renderBatchCsv(planBatch(lists));
    expect(csv.split("\n")[0]).toContain("index,total,done");
  });
});
