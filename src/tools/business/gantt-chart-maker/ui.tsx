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
  COLOR_PRESETS,
  COLOR_PRESET_LABELS,
  parseTasks,
  computeTaskTimings,
  validateDateRanges,
  detectOverlaps,
  getTaskColor,
  renderAsciiGantt,
  renderHtmlGantt,
  renderText,
  renderCsv,
  summaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ColorPreset,
  type HistoryEntry,
} from "./logic";
import { History, BarChart3, AlertTriangle, Download } from "lucide-react";

const DEFAULT_INPUT = {
  projectStartDate: "2026-07-01",
  projectEndDate: "2026-07-31",
  tasksText: "Design,2026-07-01,2026-07-05,100\nDevelop,2026-07-06,2026-07-15,60\nTest,2026-07-12,2026-07-22,20\nDeploy,2026-07-23,2026-07-25,0",
  showProgress: true,
  showToday: true,
  colorPreset: "rainbow" as ColorPreset,
  showWeekends: true,
};

export default function GanttChartMaker() {
  const [projectStartDate, setProjectStartDate] = useState(DEFAULT_INPUT.projectStartDate);
  const [projectEndDate, setProjectEndDate] = useState(DEFAULT_INPUT.projectEndDate);
  const [tasksText, setTasksText] = useState(DEFAULT_INPUT.tasksText);
  const [showProgress, setShowProgress] = useState(DEFAULT_INPUT.showProgress);
  const [showToday, setShowToday] = useState(DEFAULT_INPUT.showToday);
  const [showWeekends, setShowWeekends] = useState(DEFAULT_INPUT.showWeekends);
  const [colorPreset, setColorPreset] = useState<ColorPreset>(DEFAULT_INPUT.colorPreset);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        if (p.projectStartDate) setProjectStartDate(p.projectStartDate);
        if (p.projectEndDate) setProjectEndDate(p.projectEndDate);
        if (p.tasksText) setTasksText(p.tasksText);
        if (p.showProgress !== undefined) setShowProgress(p.showProgress);
        if (p.showToday !== undefined) setShowToday(p.showToday);
        if (p.colorPreset) setColorPreset(p.colorPreset);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseTasks(tasksText), [tasksText]);
  const validationErrors = useMemo(
    () => validateDateRanges(parsed.tasks, projectStartDate, projectEndDate),
    [parsed.tasks, projectStartDate, projectEndDate],
  );
  const overlaps = useMemo(() => detectOverlaps(parsed.tasks), [parsed.tasks]);
  const timed = useMemo(() => computeTaskTimings(parsed.tasks, projectStartDate), [parsed.tasks, projectStartDate]);
  const stats = useMemo(
    () => summaryStats(parsed.tasks, projectStartDate, projectEndDate),
    [parsed.tasks, projectStartDate, projectEndDate],
  );
  const renderOpts = { showProgress, showToday, showWeekends, colorPreset, today };
  const ascii = useMemo(
    () => renderAsciiGantt(parsed.tasks, projectStartDate, projectEndDate, renderOpts),
    [parsed.tasks, projectStartDate, projectEndDate, showProgress, showToday, showWeekends, colorPreset, today],
  );
  const html = useMemo(
    () => renderHtmlGantt(parsed.tasks, projectStartDate, projectEndDate, renderOpts),
    [parsed.tasks, projectStartDate, projectEndDate, showProgress, showToday, showWeekends, colorPreset, today],
  );
  const text = useMemo(() => renderText(parsed.tasks, projectStartDate, projectEndDate), [parsed.tasks, projectStartDate, projectEndDate]);
  const csv = useMemo(() => renderCsv(parsed.tasks, projectStartDate), [parsed.tasks, projectStartDate]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.tasks.length > 0 && projectStartDate && projectEndDate) {
      saveHistory({
        ts: Date.now(),
        projectStartDate,
        projectEndDate,
        taskCount: parsed.tasks.length,
        projectDurationDays: stats.projectDurationDays,
      });
      setHistory(loadHistory());
    }
  }, [parsed.tasks.length, projectStartDate, projectEndDate, stats.projectDurationDays]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gantt-${projectStartDate}-to-${projectEndDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, projectStartDate, projectEndDate, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setProjectStartDate("");
    setProjectEndDate("");
    setTasksText("");
    setShowProgress(true);
    setShowToday(true);
    setShowWeekends(true);
    setColorPreset("rainbow");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const input = {
    projectStartDate, projectEndDate, tasksText, showProgress, showToday, colorPreset,
  };

  const hasValidProject = projectStartDate && projectEndDate && projectEndDate >= projectStartDate;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gcm-start">Project start date</Label>
              <Input
                id="gcm-start"
                type="date"
                value={projectStartDate}
                onChange={(e) => setProjectStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gcm-end">Project end date</Label>
              <Input
                id="gcm-end"
                type="date"
                value={projectEndDate}
                onChange={(e) => setProjectEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gcm-tasks">
              Tasks — one per line:{" "}
              <code className="font-mono text-[11px]">title,start_date,end_date,progress</code>
            </Label>
            <Textarea
              id="gcm-tasks"
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              placeholder={DEFAULT_INPUT.tasksText}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            {parsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {validationErrors.length > 0 && parsed.tasks.length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                {validationErrors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {parsed.tasks.length} valid task(s)
              {parsed.errors.length > 0 && ` · ${parsed.errors.length} error(s)`}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Display options</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
                  Show progress
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} />
                  Show today
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
                  Show weekends
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gcm-color" className="text-xs">Color preset</Label>
              <select
                id="gcm-color"
                value={colorPreset}
                onChange={(e) => setColorPreset(e.target.value as ColorPreset)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COLOR_PRESETS.map((c) => (
                  <option key={c} value={c}>{COLOR_PRESET_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed.tasks.length > 0 && hasValidProject ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tasks" value={String(stats.totalTasks)} />
                <Stat label="Project days" value={String(stats.projectDurationDays)} />
                <Stat label="Completed" value={String(stats.completedTasks)} highlight="good" />
                <Stat label="In progress" value={String(stats.inProgressTasks)} />
                <Stat label="Not started" value={String(stats.notStartedTasks)} />
                <Stat label="Avg progress" value={`${stats.avgProgress}%`} />
                <Stat label="Overlaps" value={String(stats.overlapCount)} highlight={stats.overlapCount > 0 ? "bad" : undefined} />
              </div>
              {overlaps.length > 0 && (
                <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> {overlaps.length} overlap(s) detected
                  </div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-800 dark:text-amber-300">
                    {overlaps.slice(0, 5).map((o, i) => (
                      <li key={i}>"{o.titleA}" ⨯ "{o.titleB}" ({o.rangeStart} → {o.rangeEnd})</li>
                    ))}
                    {overlaps.length > 5 && <li>… and {overlaps.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> ASCII Gantt
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre">
                {ascii}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return ascii; }}
                  label="Copy ASCII"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="gantt-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <Button variant="outline" size="sm" onClick={handleDownloadHtml} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <DownloadButton
                  getText={() => csv}
                  filename="gantt-tasks.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> HTML Preview
              </h3>
              <div className="rounded border bg-background overflow-auto max-h-[400px]">
                <iframe
                  title="Gantt preview"
                  srcDoc={html}
                  className="w-full h-[400px] bg-white"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Task list with computed timings
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Title</th>
                      <th className="px-2 py-1.5 font-medium">Start</th>
                      <th className="px-2 py-1.5 font-medium">End</th>
                      <th className="px-2 py-1.5 font-medium text-right">Offset</th>
                      <th className="px-2 py-1.5 font-medium text-right">Duration</th>
                      <th className="px-2 py-1.5 font-medium text-right">Progress</th>
                      <th className="px-2 py-1.5 font-medium">Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timed.map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium">{t.title}</td>
                        <td className="px-2 py-1.5 font-mono">{t.startDate}</td>
                        <td className="px-2 py-1.5 font-mono">{t.endDate}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{t.offsetDays}d</td>
                        <td className="px-2 py-1.5 text-right font-mono">{t.durationDays}d</td>
                        <td className="px-2 py-1.5 text-right font-mono">{t.progress}%</td>
                        <td className="px-2 py-1.5">
                          <span
                            className="inline-block h-3 w-8 rounded"
                            style={{ background: getTaskColor(colorPreset, i, timed.length) }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Set project dates and add tasks to generate the Gantt chart"
          hint="Use the format: title,start_date,end_date,progress — one per line. Progress is 0–100."
          icon={<BarChart3 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">{h.projectStartDate} → {h.projectEndDate}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.taskCount} tasks</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.projectDurationDays} days</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All Gantt chart generation, parsing and calculations run 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
