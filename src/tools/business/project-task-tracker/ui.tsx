"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  STATUS_PRESETS,
  PRIORITY_PRESETS,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_WEIGHTS,
  parseTasks,
  filterTasks,
  sortTasks,
  computeStats,
  summaryStats,
  nextAction,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FilterBy,
  type SortBy,
  type Status,
  type HistoryEntry,
} from "./logic";
import { History, KanbanSquare, AlertTriangle, ArrowRight } from "lucide-react";

const DEFAULT_TASKS = `Design homepage,high,todo,2026-08-01,Alice
Setup API,urgent,in-progress,2026-07-25,Bob
Write docs,medium,todo,2026-08-10,Alice
Database schema,high,done,2026-07-15,Bob
QA pass,low,todo,2026-08-20,Carol`;

const STATUS_COLORS: Record<Status, string> = {
  todo: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  "in-progress": "bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  blocked: "bg-amber-200 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-200 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-slate-400",
};

export default function ProjectTaskTracker() {
  const [projectName, setProjectName] = useState("Website Redesign");
  const [tasksText, setTasksText] = useState(DEFAULT_TASKS);
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [filterValue, setFilterValue] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.projectName) setProjectName(p.projectName);
      if (p.tasksText) setTasksText(p.tasksText);
      setFilterBy(p.filterBy);
      setFilterValue(p.filterValue);
      setSortBy(p.sortBy);
      if (p.projectName || p.tasksText) toast.info("Loaded from share link");
    }
  }, []);

  const parsed = useMemo(() => parseTasks(tasksText), [tasksText]);
  const filtered = useMemo(
    () => sortTasks(filterTasks(parsed.tasks, filterBy, filterValue, today), sortBy),
    [parsed.tasks, filterBy, filterValue, sortBy, today],
  );
  const stats = useMemo(() => computeStats(parsed.tasks, today), [parsed.tasks, today]);
  const summary = useMemo(() => summaryStats(parsed.tasks, today), [parsed.tasks, today]);
  const next = useMemo(() => nextAction(parsed.tasks), [parsed.tasks]);
  const text = useMemo(() => renderText(filtered, projectName, today), [filtered, projectName, today]);
  const csv = useMemo(() => renderCsv(filtered, today), [filtered, today]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.tasks.length > 0) {
      saveHistory({
        ts: Date.now(),
        projectName,
        taskCount: parsed.tasks.length,
        completionPct: stats.completionPct,
      });
      setHistory(loadHistory());
    }
  }, [parsed.tasks.length, projectName, stats.completionPct]);

  const handleClear = useCallback(() => {
    setProjectName("");
    setTasksText("");
    setFilterBy("all");
    setFilterValue("");
    setSortBy("priority");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const filteredGrouped = useMemo(() => {
    const out: Record<Status, typeof filtered> = {
      todo: [], "in-progress": [], blocked: [], done: [],
    };
    for (const t of filtered) out[t.status].push(t);
    return out;
  }, [filtered]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ptt-proj">Project name</Label>
            <Input
              id="ptt-proj"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Project"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ptt-tasks">
              Tasks — one per line:{" "}
              <code className="font-mono text-[11px]">title,priority,status,due_date,assignee</code>
            </Label>
            <Textarea
              id="ptt-tasks"
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              placeholder={DEFAULT_TASKS}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            {parsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {parsed.tasks.length} valid task(s)
              {parsed.errors.length > 0 && ` · ${parsed.errors.length} error(s)`}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ptt-filter" className="text-xs">Filter by</Label>
              <select
                id="ptt-filter"
                value={filterBy}
                onChange={(e) => { setFilterBy(e.target.value as FilterBy); setFilterValue(""); }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {FILTER_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ptt-sort" className="text-xs">Sort by</Label>
              <select
                id="ptt-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          {filterBy !== "all" && filterBy !== "overdue" && (
            <div className="space-y-1.5">
              <Label htmlFor="ptt-fv" className="text-xs">Filter value</Label>
              {filterBy === "by-priority" ? (
                <select
                  id="ptt-fv"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select priority…</option>
                  {PRIORITY_PRESETS.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              ) : filterBy === "by-status" ? (
                <select
                  id="ptt-fv"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select status…</option>
                  {STATUS_PRESETS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id="ptt-fv"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder="assignee name…"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {parsed.tasks.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <KanbanSquare className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tasks" value={String(stats.total)} />
                <Stat label="Done" value={String(stats.byStatus.done)} highlight="good" />
                <Stat label="Overdue" value={String(stats.overdue)} highlight={stats.overdue > 0 ? "bad" : undefined} />
                <Stat label="Completion" value={`${stats.completionPct}%`} highlight={stats.completionPct === 100 ? "good" : undefined} />
              </div>
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${stats.completionPct}%` }}
                  />
                </div>
              </div>
              {/* Status breakdown */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By status</div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_PRESETS.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {STATUS_LABELS[s]}: {stats.byStatus[s]}
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Priority breakdown */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By priority</div>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_PRESETS.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] flex items-center gap-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[p]}`} />
                      {PRIORITY_LABELS[p]}: {stats.byPriority[p]}
                    </Badge>
                  ))}
                </div>
              </div>
              {/* Next action */}
              {next && (
                <div className="rounded border bg-background px-3 py-2 text-xs flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Next action</div>
                    <div className="font-medium text-foreground">{next.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      <Badge variant="outline" className="text-[10px] mr-1">{PRIORITY_LABELS[next.priority]} (w{PRIORITY_WEIGHTS[next.priority]})</Badge>
                      {next.dueDate && <span className="mr-2">due {next.dueDate}</span>}
                      {next.assignee && <span>@{next.assignee}</span>}
                    </div>
                  </div>
                </div>
              )}
              {/* Summary extras */}
              <div className="text-[11px] text-muted-foreground">
                {summary.uniqueAssignees} assignee(s) · today is {today}
                {summary.nextDueTask && (
                  <> · next due: <strong className="text-foreground">{summary.nextDueTask.title}</strong> ({summary.nextDueTask.dueDate})</>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <KanbanSquare className="h-4 w-4" /> Kanban Board ({filtered.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {STATUS_PRESETS.map((s) => (
                  <div key={s} className="rounded border bg-muted/30 p-2 min-h-[120px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{STATUS_LABELS[s]}</span>
                      <Badge variant="secondary" className="text-[10px]">{filteredGrouped[s].length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {filteredGrouped[s].length === 0 && (
                        <div className="text-[10px] text-muted-foreground italic">No tasks</div>
                      )}
                      {filteredGrouped[s].map((t, i) => {
                        const overdue = t.dueDate && t.dueDate < today && t.status !== "done";
                        return (
                          <div key={i} className={`rounded px-2 py-1.5 text-[11px] ${STATUS_COLORS[s]}`}>
                            <div className="flex items-start gap-1">
                              <span className={`inline-block h-2 w-2 rounded-full mt-1 flex-shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                              <span className="flex-1 font-medium break-words">{t.title}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] opacity-80">
                              {t.dueDate && (
                                <span className={overdue ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
                                  {overdue && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />}
                                  {t.dueDate}
                                </span>
                              )}
                              {t.assignee && <span>@{t.assignee}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="project-tasks.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="project-tasks.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ projectName, tasksText, filterBy, filterValue, sortBy }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add tasks to track"
          hint="One per line in format: title,priority,status,due_date,assignee — e.g. Design homepage,high,todo,2026-08-01,Alice"
          icon={<KanbanSquare className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">{h.projectName || "(untitled)"}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.taskCount} tasks</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.completionPct}% done</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All task parsing, filtering, sorting and stats run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
