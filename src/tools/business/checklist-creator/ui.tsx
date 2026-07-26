"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  getTemplates, createFromTemplate, createEmpty, addItem, toggleItem, removeItem, updateItem,
  computeStats, exportMarkdown, exportCsv, exportJson, renderReport, planBatch, renderBatchCsv,
  type Checklist,
} from "./logic";

export default function ChecklistCreator() {
  const templates = useMemo(() => getTemplates(), []);
  const [list, setList] = useState<Checklist>(() => createFromTemplate("code-review") ?? createEmpty("Untitled"));
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(list), [list]);
  const visibleItems = useMemo(() => {
    if (filter === "pending") return list.items.filter((i) => !i.done);
    if (filter === "done") return list.items.filter((i) => i.done);
    return list.items;
  }, [list, filter]);

  const applyTemplate = (id: string) => {
    setError(null);
    const newList = createFromTemplate(id);
    if (newList) setList(newList);
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    setList(addItem(list, newText.trim(), newCategory || undefined, newPriority));
    setNewText("");
  };

  const exportBatch = () => {
    setError(null);
    try { planBatch([list, createFromTemplate("pre-flight")!, createFromTemplate("deployment")!]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">Templates:</span>
            {templates.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t.id)} className="text-xs text-primary hover:underline cursor-pointer">{t.label}</button>
            ))}
            <button onClick={() => setList(createEmpty("Untitled"))} className="text-xs text-primary hover:underline cursor-pointer">+ Empty</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={list.title} onChange={(e) => setList({ ...list, title: e.target.value })} className="flex-1 min-w-[200px] rounded-md border bg-background px-2 py-1.5 text-sm font-medium" />
            <Badge variant="outline" className="text-xs">{stats.done}/{stats.total} done ({(stats.completionRate * 100).toFixed(0)}%)</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_auto] gap-2">
            <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="New item…" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")} className="rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
            <button onClick={handleAdd} className="rounded-md border bg-primary text-primary-foreground px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/90">+ Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => exportMarkdown(list)} label="Copy MD" />
            <CopyButton getText={() => exportJson(list)} label="Copy JSON" />
            <DownloadButton getText={() => exportMarkdown(list)} filename="checklist.md" mime="text/markdown" label="Download MD" />
            <DownloadButton getText={() => exportCsv(list)} filename="checklist.csv" mime="text/csv" label="Download CSV" />
            <DownloadButton getText={() => exportJson(list)} filename="checklist.json" mime="application/json" label="Download JSON" />
            <DownloadButton getText={() => renderReport(list)} filename="checklist-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(planBatch([list]))} filename="checklist-batch.csv" mime="text/csv" label="Download batch CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 lists)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Items ({visibleItems.length} shown)</Label>
            <div className="flex gap-1">
              {(["all", "pending", "done"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2 py-0.5 rounded cursor-pointer ${filter === f ? "bg-primary text-primary-foreground" : "border hover:bg-muted/40"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {visibleItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[24px_1fr_auto] gap-2 items-center text-sm py-1 border-b border-border/40 last:border-0">
                <input type="checkbox" checked={item.done} onChange={() => setList(toggleItem(list, item.id))} className="cursor-pointer" />
                <div>
                  <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.text}</span>
                  {item.category && <Badge variant="outline" className="text-[10px] ml-2">{item.category}</Badge>}
                  {item.priority === "high" && <span className="ml-2 text-xs text-destructive">●</span>}
                  {item.priority === "medium" && <span className="ml-2 text-xs text-amber-600">●</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setList(updateItem(list, item.id, { done: !item.done }))} className="text-xs text-muted-foreground hover:underline cursor-pointer">toggle</button>
                  <button onClick={() => setList(removeItem(list, item.id))} className="text-xs text-destructive hover:underline cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {visibleItems.length === 0 && <div className="text-xs text-muted-foreground py-2">No items.</div>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">By category</Label>
            {Object.entries(stats.byCategory).map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span>{cat}</span>
                <span className="font-mono">{data.done}/{data.total}</span>
              </div>
            ))}
            {Object.keys(stats.byCategory).length === 0 && <div className="text-xs text-muted-foreground">No categories.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">By priority</Label>
            {Object.entries(stats.byPriority).map(([pri, data]) => (
              <div key={pri} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span className="capitalize">{pri}</span>
                <span className="font-mono">{data.done}/{data.total}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
