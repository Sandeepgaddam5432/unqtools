"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  ROUNDING_PRESETS,
  ROUNDING_LABELS,
  MS_PER_SECOND,
  formatDuration,
  computeDuration,
  computeBillableAmount,
  validateEntry,
  normalizeTaskName,
  normalizeProjectName,
  buildEntry,
  groupByDay,
  groupByWeek,
  projectSummary,
  billableSummary,
  summaryStats,
  suggestProjects,
  formatCost,
  renderText,
  renderCsv,
  loadEntries,
  addEntry,
  removeEntry,
  clearEntries,
  buildShareUrl,
  parseShareUrl,
  type TimeEntry,
  type RoundingPreset,
  type TimerState,
} from "./logic";
import {
  History, Timer, Play, Pause, Square, Trash2, Clock, DollarSign,
  ListChecks, FolderKanban, CalendarDays,
} from "lucide-react";

const DEFAULT_ROUNDING: RoundingPreset = "none";

export default function TimeTracker() {
  // Task form state
  const [taskName, setTaskName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [billable, setBillable] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(60);
  const [notes, setNotes] = useState("");
  const [rounding, setRounding] = useState<RoundingPreset>(DEFAULT_ROUNDING);

  // Timer state
  const [timer, setTimer] = useState<TimerState>({
    status: "idle",
    startMs: 0,
    accumulatedMs: 0,
    lastResumeMs: 0,
  });
  const [nowMs, setNowMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Entries
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    setEntries(loadEntries());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.length > 0) {
        setEntries(parsed);
        // Don't auto-save parsed entries — user can choose to save
        toast.info(`Loaded ${parsed.length} entr${parsed.length === 1 ? "y" : "ies"} from share link`);
      }
    }
  }, []);

  // Tick loop while running
  useEffect(() => {
    if (timer.status === "running") {
      intervalRef.current = setInterval(() => setNowMs(Date.now()), 250);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }
    return undefined;
  }, [timer.status]);

  const elapsedMs = useMemo(() => {
    if (timer.status === "running") {
      return timer.accumulatedMs + (nowMs - timer.lastResumeMs);
    }
    return timer.accumulatedMs;
  }, [timer, nowMs]);

  const elapsedDisplay = formatDuration(elapsedMs);

  const projectSuggestions = useMemo(() => suggestProjects(entries, 8), [entries]);

  // Stats / groupings
  const stats = useMemo(() => summaryStats(entries), [entries]);
  const days = useMemo(() => groupByDay(entries), [entries]);
  const weeks = useMemo(() => groupByWeek(entries), [entries]);
  const projects = useMemo(() => projectSummary(entries), [entries]);
  const bill = useMemo(() => billableSummary(entries), [entries]);
  const text = useMemo(() => renderText(entries), [entries]);
  const csv = useMemo(() => renderCsv(entries), [entries]);

  // Timer controls
  const handleStart = useCallback(() => {
    const validation = validateEntry(taskName, 1); // duration not yet known, but task name must be present
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    const now = Date.now();
    setTimer({
      status: "running",
      startMs: timer.startMs || now,
      accumulatedMs: timer.accumulatedMs,
      lastResumeMs: now,
    });
    setNowMs(now);
    toast.success("Timer started");
  }, [taskName, timer]);

  const handlePause = useCallback(() => {
    if (timer.status !== "running") return;
    const now = Date.now();
    setTimer({
      status: "paused",
      startMs: timer.startMs,
      accumulatedMs: timer.accumulatedMs + (now - timer.lastResumeMs),
      lastResumeMs: 0,
    });
    toast.info("Timer paused");
  }, [timer]);

  const handleResume = useCallback(() => {
    if (timer.status !== "paused") return;
    const now = Date.now();
    setTimer({
      status: "running",
      startMs: timer.startMs,
      accumulatedMs: timer.accumulatedMs,
      lastResumeMs: now,
    });
    setNowMs(now);
    toast.success("Timer resumed");
  }, [timer]);

  const handleStop = useCallback(() => {
    if (timer.status === "idle") return;
    const now = Date.now();
    const finalMs =
      timer.status === "running"
        ? timer.accumulatedMs + (now - timer.lastResumeMs)
        : timer.accumulatedMs;
    const validation = validateEntry(taskName, finalMs);
    if (!validation.valid) {
      toast.error(validation.errors.join("; "));
      // Reset timer anyway so user can start fresh
      setTimer({ status: "idle", startMs: 0, accumulatedMs: 0, lastResumeMs: 0 });
      return;
    }
    const entry = buildEntry({
      taskName,
      projectName,
      billable,
      hourlyRate,
      notes,
      startMs: timer.startMs,
      endMs: now,
      rounding,
    });
    const next = addEntry(entry);
    setEntries(next);
    setTimer({ status: "idle", startMs: 0, accumulatedMs: 0, lastResumeMs: 0 });
    toast.success(`Saved entry: ${formatDuration(finalMs)}`);
  }, [timer, taskName, projectName, billable, hourlyRate, notes, rounding]);

  const handleReset = useCallback(() => {
    setTimer({ status: "idle", startMs: 0, accumulatedMs: 0, lastResumeMs: 0 });
    setTaskName("");
    setProjectName("");
    setNotes("");
    toast.info("Cleared");
  }, []);

  const handleRemove = useCallback((id: string) => {
    const next = removeEntry(id);
    setEntries(next);
    toast.success("Entry removed");
  }, []);

  const handleClearAll = useCallback(() => {
    clearEntries();
    setEntries([]);
    toast.success("All entries cleared");
  }, []);

  const handleShareSave = useCallback(() => {
    // Save current entries to localStorage (in case they came from a share link and weren't yet saved)
    const next = loadEntries();
    if (next.length !== entries.length) {
      // Persist the current entries list
      try {
        localStorage.setItem("unqtools:time-tracker:entries", JSON.stringify(entries));
      } catch {
        // ignore
      }
    }
  }, [entries]);

  const isRunning = timer.status === "running";
  const isPaused = timer.status === "paused";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Task input + timer */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tt-task">Task name *</Label>
              <Input
                id="tt-task"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Implement login API"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-project">Project (optional)</Label>
              <Input
                id="tt-project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Auth module"
                list="tt-project-suggestions"
              />
              <datalist id="tt-project-suggestions">
                {projectSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tt-billable">Billable</Label>
              <select
                id="tt-billable"
                value={billable ? "yes" : "no"}
                onChange={(e) => setBillable(e.target.value === "yes")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-rate">Hourly rate ($)</Label>
              <Input
                id="tt-rate"
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                disabled={!billable}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-round">Time rounding</Label>
              <select
                id="tt-round"
                value={rounding}
                onChange={(e) => setRounding(e.target.value as RoundingPreset)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROUNDING_PRESETS.map((r) => (
                  <option key={r} value={r}>{ROUNDING_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Suggestions</Label>
              <div className="flex flex-wrap gap-1 items-center h-9">
                {projectSuggestions.slice(0, 3).map((p) => (
                  <Button
                    key={p}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setProjectName(p)}
                  >+ {p}</Button>
                ))}
                {projectSuggestions.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tt-notes">Notes (optional)</Label>
            <Textarea
              id="tt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context for this time entry…"
              className="min-h-[60px] resize-y text-xs"
            />
          </div>

          {/* Timer display */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Timer className={`h-6 w-6 ${isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Elapsed</div>
                  <div className="text-3xl font-mono font-bold tabular-nums">
                    {elapsedDisplay}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {timer.status === "idle" && (
                  <Button size="sm" onClick={handleStart} className="gap-1.5">
                    <Play className="h-3.5 w-3.5" /> Start
                  </Button>
                )}
                {isRunning && (
                  <Button size="sm" variant="outline" onClick={handlePause} className="gap-1.5">
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                )}
                {isPaused && (
                  <Button size="sm" onClick={handleResume} className="gap-1.5">
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                )}
                {(isRunning || isPaused) && (
                  <Button size="sm" variant="default" onClick={handleStop} className="gap-1.5">
                    <Square className="h-3.5 w-3.5" /> Stop & Save
                  </Button>
                )}
                <ClearButton onClick={handleReset} disabled={timer.status !== "idle"} />
              </div>
            </div>
            {billable && hourlyRate > 0 && elapsedMs > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Running cost: <span className="font-mono font-medium text-foreground">
                  {formatCost(computeBillableAmount(elapsedMs, hourlyRate, true, rounding))}
                </span>{" "}
                (rounded to {ROUNDING_LABELS[rounding]})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 ? (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total entries" value={String(stats.entryCount)} />
                <Stat label="Total time" value={`${stats.totalHours.toFixed(2)} hrs`} />
                <Stat label="Billable hours" value={stats.billableHours.toFixed(2)} />
                <Stat label="Total cost" value={formatCost(stats.totalCost)} highlight="good" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Billable entries" value={String(stats.billableEntries)} />
                <Stat label="Avg rate" value={bill.avgRate > 0 ? `$${bill.avgRate.toFixed(2)}/hr` : "—"} />
                <Stat label="Unique projects" value={String(stats.uniqueProjects)} />
                <Stat label="Last entry" value={entries[0] ? formatDuration(entries[0].durationMs) : "—"} />
              </div>

              {/* Projects breakdown */}
              {projects.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" /> By Project
                  </div>
                  {projects.map((p, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{p.project}</span>
                      <Badge variant="outline" className="text-[10px]">{p.entryCount} entries</Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.totalHours.toFixed(2)} hrs</Badge>
                      {p.cost > 0 && (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          {formatCost(p.cost)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Weeks */}
              {weeks.length > 1 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> By Week
                  </div>
                  {weeks.map((w, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{w.weekKey}</span>
                      <span className="text-muted-foreground text-[10px]">wk of {w.weekStart}</span>
                      <Badge variant="secondary" className="text-[10px]">{w.totalHours.toFixed(2)} hrs</Badge>
                      {w.cost > 0 && (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          {formatCost(w.cost)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Entries table */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Entries ({entries.length})
                </h3>
                <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </Button>
              </div>
              <div className="space-y-3 max-h-[440px] overflow-auto pr-1">
                {days.map((d, di) => (
                  <div key={di} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-dashed pb-1">
                      <span className="font-mono">{d.date}</span>
                      <span>{d.totalHours.toFixed(2)} hrs · {formatCost(d.cost)}</span>
                    </div>
                    {d.entries.map((e) => (
                      <div key={e.id} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground flex-1 min-w-[120px] truncate">{e.taskName}</span>
                        {e.projectName && <Badge variant="outline" className="text-[10px]">{e.projectName}</Badge>}
                        <Badge variant="secondary" className="text-[10px] font-mono">{formatDuration(e.durationMs)}</Badge>
                        {e.billable ? (
                          <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            <DollarSign className="h-3 w-3 inline" />${e.hourlyRate}/hr · {formatCost(computeBillableAmount(e.durationMs, e.hourlyRate, true, e.rounding))}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">non-bill</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(e.id)}
                          className="text-destructive h-7 w-7"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Text report + downloads */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Report
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => text} label="Copy text" />
                <DownloadButton
                  getText={() => text}
                  filename={`timesheet-${new Date().toISOString().slice(0, 10)}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename={`timesheet-${new Date().toISOString().slice(0, 10)}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleShareSave(); return buildShareUrl(entries); }} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="No entries yet — start tracking time"
          hint="Enter a task name above, pick billable + hourly rate, then click Start. Use Stop & Save to log the entry. Pause/Resume if you step away."
          icon={<Timer className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> The timer runs entirely in your browser. Entries are stored in localStorage on this device only (max 100). Nothing is uploaded.
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
