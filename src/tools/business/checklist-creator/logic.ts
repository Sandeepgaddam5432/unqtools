/**
 * Checklist Creator — pure logic.
 * Templates, items, progress tracking, categories, export.
 */

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  category?: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  createdAt: string;
  tags: string[];
}

export interface ChecklistStats {
  total: number;
  done: number;
  pending: number;
  completionRate: number;
  byCategory: Record<string, { total: number; done: number }>;
  byPriority: Record<string, { total: number; done: number }>;
}

export interface ChecklistTemplate {
  id: string;
  label: string;
  description: string;
  items: { text: string; category?: string; priority?: "low" | "medium" | "high" }[];
  tags: string[];
}

const TEMPLATES: ChecklistTemplate[] = [
  {
    id: "pre-flight", label: "Pre-flight checklist (pilot)", description: "Standard Cessna 172 pre-flight inspection.",
    tags: ["aviation", "safety"],
    items: [
      { text: "Verify fuel quantity and grade", category: "Fuel", priority: "high" },
      { text: "Sump fuel tanks for contaminants", category: "Fuel", priority: "high" },
      { text: "Check oil level (minimum 6 quarts)", category: "Engine", priority: "high" },
      { text: "Inspect propeller for nicks", category: "Engine", priority: "medium" },
      { text: "Check tire pressure and condition", category: "Landing gear", priority: "medium" },
      { text: "Verify control surfaces move freely", category: "Controls", priority: "high" },
      { text: "Test pitot heat", category: "Instruments", priority: "medium" },
      { text: "Verify no knots in safety wire", category: "Airframe", priority: "low" },
    ],
  },
  {
    id: "code-review", label: "Code review checklist", description: "Standard pull-request review.",
    tags: ["dev", "quality"],
    items: [
      { text: "Code follows style guide", category: "Style", priority: "low" },
      { text: "Tests added for new functionality", category: "Testing", priority: "high" },
      { text: "No security vulnerabilities introduced", category: "Security", priority: "high" },
      { text: "Documentation updated", category: "Docs", priority: "medium" },
      { text: "Performance impact assessed", category: "Performance", priority: "medium" },
      { text: "Error handling is comprehensive", category: "Quality", priority: "high" },
    ],
  },
  {
    id: "deployment", label: "Production deployment", description: "Pre-deployment go-live checks.",
    tags: ["devops", "release"],
    items: [
      { text: "All tests pass on CI", category: "CI", priority: "high" },
      { text: "Staging environment validated", category: "Staging", priority: "high" },
      { text: "Rollback plan documented", category: "Recovery", priority: "high" },
      { text: "On-call engineer notified", category: "Comms", priority: "medium" },
      { text: "Database migrations applied", category: "Database", priority: "high" },
      { text: "Monitoring dashboards verified", category: "Observability", priority: "medium" },
    ],
  },
  {
    id: "travel", label: "Travel packing", description: "Personal travel packing list.",
    tags: ["personal", "travel"],
    items: [
      { text: "Passport / ID", category: "Documents", priority: "high" },
      { text: "Tickets and itinerary", category: "Documents", priority: "high" },
      { text: "Phone charger and adapter", category: "Electronics", priority: "medium" },
      { text: "Medications (3-day extra)", category: "Health", priority: "high" },
      { text: "Comfortable walking shoes", category: "Clothing", priority: "medium" },
      { text: "Travel insurance details", category: "Documents", priority: "medium" },
    ],
  },
];

export function getTemplates(): ChecklistTemplate[] {
  return [...TEMPLATES];
}

export function getTemplate(id: string): ChecklistTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Generate a unique id (deterministic for testing). */
export function generateId(seed?: number): string {
  if (seed !== undefined) return `item-${seed}`;
  return `item-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Create a checklist from a template. */
export function createFromTemplate(templateId: string, title?: string): Checklist | null {
  const template = getTemplate(templateId);
  if (!template) return null;
  return {
    id: generateId(),
    title: title ?? template.label,
    items: template.items.map((item, i) => ({
      id: generateId(i + 1),
      text: item.text,
      done: false,
      category: item.category,
      priority: item.priority,
    })),
    createdAt: new Date().toISOString(),
    tags: [...template.tags],
  };
}

/** Create an empty checklist. */
export function createEmpty(title: string): Checklist {
  return { id: generateId(), title, items: [], createdAt: new Date().toISOString(), tags: [] };
}

/** Add an item to a checklist. */
export function addItem(list: Checklist, text: string, category?: string, priority?: "low" | "medium" | "high"): Checklist {
  return {
    ...list,
    items: [...list.items, { id: generateId(list.items.length + 1), text, done: false, category, priority }],
  };
}

/** Toggle an item's done status. */
export function toggleItem(list: Checklist, itemId: string): Checklist {
  return { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item) };
}

/** Remove an item by id. */
export function removeItem(list: Checklist, itemId: string): Checklist {
  return { ...list, items: list.items.filter((item) => item.id !== itemId) };
}

/** Update an item's text or category. */
export function updateItem(list: Checklist, itemId: string, patch: Partial<ChecklistItem>): Checklist {
  return { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) };
}

/** Reorder items. */
export function reorderItems(list: Checklist, fromIndex: number, toIndex: number): Checklist {
  const items = [...list.items];
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return list;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return { ...list, items };
}

/** Compute stats for a checklist. */
export function computeStats(list: Checklist): ChecklistStats {
  const total = list.items.length;
  const done = list.items.filter((i) => i.done).length;
  const pending = total - done;
  const byCategory: Record<string, { total: number; done: number }> = {};
  const byPriority: Record<string, { total: number; done: number }> = {};
  for (const item of list.items) {
    const cat = item.category ?? "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, done: 0 };
    byCategory[cat].total++;
    if (item.done) byCategory[cat].done++;
    const pri = item.priority ?? "medium";
    if (!byPriority[pri]) byPriority[pri] = { total: 0, done: 0 };
    byPriority[pri].total++;
    if (item.done) byPriority[pri].done++;
  }
  return { total, done, pending, completionRate: total > 0 ? done / total : 0, byCategory, byPriority };
}

/** Filter items by done status / category / priority. */
export function filterItems(list: Checklist, filter: { done?: boolean; category?: string; priority?: "low" | "medium" | "high" }): ChecklistItem[] {
  return list.items.filter((item) => {
    if (filter.done !== undefined && item.done !== filter.done) return false;
    if (filter.category !== undefined && (item.category ?? "Uncategorized") !== filter.category) return false;
    if (filter.priority !== undefined && (item.priority ?? "medium") !== filter.priority) return false;
    return true;
  });
}

/** Export a checklist as Markdown. */
export function exportMarkdown(list: Checklist): string {
  const lines: string[] = [];
  lines.push(`# ${list.title}`);
  lines.push("");
  if (list.tags.length) lines.push(`Tags: ${list.tags.join(", ")}`);
  lines.push(`Created: ${list.createdAt}`);
  lines.push("");
  for (const item of list.items) {
    const check = item.done ? "[x]" : "[ ]";
    const cat = item.category ? ` *(${item.category})*` : "";
    const pri = item.priority === "high" ? " 🔴" : item.priority === "medium" ? " 🟡" : item.priority === "low" ? " 🟢" : "";
    lines.push(`- ${check} ${item.text}${cat}${pri}`);
  }
  return lines.join("\n");
}

/** Export a checklist as CSV. */
export function exportCsv(list: Checklist): string {
  const lines: string[] = ["id,text,done,category,priority"];
  for (const item of list.items) {
    const text = `"${item.text.replace(/"/g, '""')}"`;
    lines.push([item.id, text, String(item.done), item.category ?? "", item.priority ?? ""].join(","));
  }
  return lines.join("\n");
}

/** Export a checklist as JSON. */
export function exportJson(list: Checklist): string {
  return JSON.stringify(list, null, 2);
}

/** Import a checklist from JSON. */
export function importJson(json: string): Checklist | null {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed as Checklist;
  } catch {
    return null;
  }
}

/** Render a stats report. */
export function renderReport(list: Checklist): string {
  const stats = computeStats(list);
  const lines: string[] = [];
  lines.push(`Checklist Report: ${list.title}`);
  lines.push("=".repeat((20 + list.title.length)));
  lines.push(`Total items: ${stats.total}`);
  lines.push(`Completed: ${stats.done} (${(stats.completionRate * 100).toFixed(1)}%)`);
  lines.push(`Pending: ${stats.pending}`);
  lines.push("");
  lines.push("By category:");
  for (const [cat, data] of Object.entries(stats.byCategory)) {
    lines.push(`  ${cat}: ${data.done}/${data.total}`);
  }
  lines.push("");
  lines.push("By priority:");
  for (const [pri, data] of Object.entries(stats.byPriority)) {
    lines.push(`  ${pri}: ${data.done}/${data.total}`);
  }
  return lines.join("\n");
}

/** Plan batch stats. */
export function planBatch(lists: Checklist[]): ChecklistStats[] {
  return lists.map(computeStats);
}

/** Render batch CSV. */
export function renderBatchCsv(stats: ChecklistStats[]): string {
  const lines: string[] = ["index,total,done,pending,completion_rate_pct"];
  stats.forEach((s, i) => {
    lines.push([String(i + 1), String(s.total), String(s.done), String(s.pending), (s.completionRate * 100).toFixed(1)].join(","));
  });
  return lines.join("\n");
}
