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
  DEPARTMENT_PRESETS,
  parseRoles,
  parseProcessSteps,
  parseTools,
  parseReferences,
  parseTroubleshooting,
  calculateNextReviewDate,
  calculateTotalProcessDuration,
  formatDuration,
  suggestSopId,
  validateSop,
  summaryStats,
  renderText,
  renderMarkdown,
  renderHtml,
  renderQuickReferenceCard,
  renderQuickReferenceCardHtml,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SopInput,
  type HistoryEntry,
} from "./logic";
import {
  ClipboardList, History, Download, AlertTriangle, FileText, FileCode, Zap,
} from "lucide-react";

const DEFAULT_INPUT: SopInput = {
  sopTitle: "",
  sopId: "",
  version: "1.0",
  department: "",
  lastReviewedDate: new Date().toISOString().slice(0, 10),
  nextReviewDate: "",
  purpose: "",
  scope: "",
  roles: "",
  process: "",
  tools: "",
  troubleshooting: "",
  references: "",
};

type PreviewTab = "text" | "markdown" | "html" | "quickref";

export default function SopGenerator() {
  const [input, setInput] = useState<SopInput>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      ...DEFAULT_INPUT,
      lastReviewedDate: today,
      nextReviewDate: calculateNextReviewDate(today),
    };
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<PreviewTab>("text");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => {
          const merged = { ...prev, ...parsed };
          if (parsed.lastReviewedDate && !parsed.nextReviewDate) {
            merged.nextReviewDate = calculateNextReviewDate(parsed.lastReviewedDate);
          }
          return merged;
        });
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Auto-calc next review date when last reviewed changes
  useEffect(() => {
    if (!input.lastReviewedDate) {
      setInput((prev) => (prev.nextReviewDate === "" ? prev : { ...prev, nextReviewDate: "" }));
      return;
    }
    const next = calculateNextReviewDate(input.lastReviewedDate);
    if (next && next !== input.nextReviewDate) {
      setInput((prev) => ({ ...prev, nextReviewDate: next }));
    }
  }, [input.lastReviewedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsedSteps = useMemo(() => parseProcessSteps(input.process), [input.process]);
  const parsedRoles = useMemo(() => parseRoles(input.roles), [input.roles]);
  const parsedTrouble = useMemo(() => parseTroubleshooting(input.troubleshooting), [input.troubleshooting]);
  const tools = useMemo(() => parseTools(input.tools), [input.tools]);
  const references = useMemo(() => parseReferences(input.references), [input.references]);
  const stats = useMemo(
    () => summaryStats(parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references),
    [parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references],
  );
  const errors = useMemo(() => validateSop(input, parsedSteps.items), [input, parsedSteps.items]);

  const text = useMemo(
    () => renderText(input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats),
    [input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats],
  );
  const md = useMemo(
    () => renderMarkdown(input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats),
    [input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats],
  );
  const html = useMemo(
    () => renderHtml(input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats),
    [input, parsedSteps.items, parsedRoles.items, tools, parsedTrouble.items, references, stats],
  );
  const quickRefText = useMemo(
    () => renderQuickReferenceCard(input, parsedSteps.items, stats),
    [input, parsedSteps.items, stats],
  );
  const quickRefHtml = useMemo(
    () => renderQuickReferenceCardHtml(input, parsedSteps.items, stats),
    [input, parsedSteps.items, stats],
  );
  const csv = useMemo(() => renderCsv(parsedSteps.items), [parsedSteps.items]);

  const update = useCallback((patch: Partial<SopInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (parsedSteps.items.length > 0) {
      saveHistory({
        ts: Date.now(),
        sopTitle: input.sopTitle || "(untitled)",
        sopId: input.sopId,
        department: input.department,
        version: input.version,
        lastReviewedDate: input.lastReviewedDate,
        stepCount: parsedSteps.items.length,
        totalDurationMinutes: stats.totalDurationMinutes,
      });
      setHistory(loadHistory());
    }
  }, [parsedSteps.items, input, stats.totalDurationMinutes]);

  const fileBase = useMemo(
    () => (input.sopTitle || "sop").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sop",
    [input.sopTitle],
  );

  const applyPreset = useCallback((presetValue: string) => {
    const preset = DEPARTMENT_PRESETS.find((p) => p.value === presetValue);
    if (!preset) return;
    const today = new Date().toISOString().slice(0, 10);
    setInput((prev) => ({
      ...prev,
      department: preset.label,
      sopTitle: prev.sopTitle || preset.sampleSopTitle,
      roles: prev.roles || preset.sampleRoles,
      process: prev.process || preset.sampleProcess,
      tools: prev.tools || preset.sampleTools,
      lastReviewedDate: prev.lastReviewedDate || today,
      nextReviewDate: prev.nextReviewDate || calculateNextReviewDate(today),
    }));
    toast.success(`Applied ${preset.label} preset`);
  }, []);

  const handleSuggestId = useCallback(() => {
    const seq = history.filter((h) => h.department === input.department).length + 1;
    const suggested = suggestSopId(input.department, seq);
    update({ sopId: suggested });
    toast.success(`Suggested: ${suggested}`);
  }, [history, input.department, update]);

  const handleDownloadHtml = useCallback(
    (content: string, suffix: string) => {
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}-${suffix}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      handleSaveHistory();
      toast.success(`HTML downloaded`);
    },
    [fileBase, handleSaveHistory],
  );

  const handleClear = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setInput({
      ...DEFAULT_INPUT,
      lastReviewedDate: today,
      nextReviewDate: calculateNextReviewDate(today),
    });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasOutput = parsedSteps.items.length > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground self-center mr-1">Department preset:</span>
            {DEPARTMENT_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => applyPreset(p.value)}
              >+ {p.label}</Button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sop-title">SOP title *</Label>
              <Input
                id="sop-title"
                value={input.sopTitle}
                onChange={(e) => update({ sopTitle: e.target.value })}
                placeholder="Code Review Process"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-id">SOP ID</Label>
              <div className="flex gap-1.5">
                <Input
                  id="sop-id"
                  value={input.sopId}
                  onChange={(e) => update({ sopId: e.target.value })}
                  placeholder="SOP-2026-ENG-001"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestId}
                  disabled={!input.department}
                  title={input.department ? "Suggest next SOP ID for this department" : "Pick a department first"}
                >Suggest</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-version">Version</Label>
              <Input
                id="sop-version"
                value={input.version}
                onChange={(e) => update({ version: e.target.value })}
                placeholder="1.0"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-dept">Department</Label>
              <Input
                id="sop-dept"
                value={input.department}
                onChange={(e) => update({ department: e.target.value })}
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-last">Last reviewed date</Label>
              <Input
                id="sop-last"
                type="date"
                value={input.lastReviewedDate}
                onChange={(e) => update({ lastReviewedDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-next">Next review date (auto: +1 year)</Label>
              <Input
                id="sop-next"
                type="date"
                value={input.nextReviewDate}
                onChange={(e) => update({ nextReviewDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sop-purpose">Purpose * — why this SOP exists</Label>
            <Textarea
              id="sop-purpose"
              value={input.purpose}
              onChange={(e) => update({ purpose: e.target.value })}
              placeholder="Ensure consistent code quality before merging changes to main."
              className="min-h-[60px] resize-y text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sop-scope">Scope — what this SOP covers</Label>
            <Textarea
              id="sop-scope"
              value={input.scope}
              onChange={(e) => update({ scope: e.target.value })}
              placeholder="Applies to all pull requests targeting the main branch."
              className="min-h-[60px] resize-y text-xs"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sop-roles">
                Roles —{" "}
                <code className="font-mono text-[11px]">role,responsibility</code>{" "}
                per line
              </Label>
              <Textarea
                id="sop-roles"
                value={input.roles}
                onChange={(e) => update({ roles: e.target.value })}
                placeholder={"Manager,Approves final deliverable\nEngineer,Executes the work"}
                className="min-h-[90px] resize-y font-mono text-xs"
              />
              {parsedRoles.errors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {parsedRoles.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-process">
                Process —{" "}
                <code className="font-mono text-[11px]">step_number,action,duration_minutes</code>{" "}
                per line *
              </Label>
              <Textarea
                id="sop-process"
                value={input.process}
                onChange={(e) => update({ process: e.target.value })}
                placeholder={"1,Gather requirements,30\n2,Design solution,60"}
                className="min-h-[90px] resize-y font-mono text-xs"
              />
              {parsedSteps.errors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {parsedSteps.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sop-tools">Tools &amp; resources — one per line</Label>
              <Textarea
                id="sop-tools"
                value={input.tools}
                onChange={(e) => update({ tools: e.target.value })}
                placeholder={"GitHub\nJira\nSlack"}
                className="min-h-[70px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sop-trouble">
                Troubleshooting —{" "}
                <code className="font-mono text-[11px]">issue,solution</code>{" "}
                per line
              </Label>
              <Textarea
                id="sop-trouble"
                value={input.troubleshooting}
                onChange={(e) => update({ troubleshooting: e.target.value })}
                placeholder={"PR has conflicts,Rebase against main\nTests failing,Run locally and fix"}
                className="min-h-[70px] resize-y font-mono text-xs"
              />
              {parsedTrouble.errors.length > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {parsedTrouble.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sop-refs">References — one per line</Label>
            <Textarea
              id="sop-refs"
              value={input.references}
              onChange={(e) => update({ references: e.target.value })}
              placeholder={"CONTRIBUTING.md\nInternal Style Guide"}
              className="min-h-[50px] resize-y font-mono text-xs"
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Required fields
              </div>
              {errors.map((e, i) => (<div key={i}>• {e}</div>))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasOutput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Process steps" value={String(stats.stepCount)} />
                <Stat label="Total duration" value={formatDuration(stats.totalDurationMinutes)} />
                <Stat label="Roles" value={String(stats.roleCount)} />
                <Stat label="Tools" value={String(stats.toolCount)} />
                <Stat label="Troubleshooting" value={String(stats.troubleshootingCount)} />
                <Stat label="References" value={String(stats.referenceCount)} />
                <Stat label="Department" value={input.department || "—"} />
                <Stat label="Next review" value={input.nextReviewDate || "—"} />
              </div>

              {parsedSteps.items.length > 0 && (
                <div className="rounded border bg-background overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-left">
                        <th className="px-2 py-2 font-medium w-10">#</th>
                        <th className="px-2 py-2 font-medium">Action</th>
                        <th className="px-2 py-2 font-medium text-right w-24">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedSteps.items.map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1.5 font-mono text-muted-foreground">{s.stepNumber}</td>
                          <td className="px-2 py-1.5">{s.action}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatDuration(s.durationMinutes)}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/20">
                        <td className="px-2 py-1.5 font-medium" colSpan={2}>Total</td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium">{formatDuration(stats.totalDurationMinutes)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" /> SOP Preview
                </h3>
                <div className="flex flex-wrap gap-1">
                  <TabButton active={activeTab === "text"} onClick={() => setActiveTab("text")} icon={<FileText className="h-3 w-3" />} label="Text" />
                  <TabButton active={activeTab === "markdown"} onClick={() => setActiveTab("markdown")} icon={<FileCode className="h-3 w-3" />} label="Markdown" />
                  <TabButton active={activeTab === "html"} onClick={() => setActiveTab("html")} icon={<FileCode className="h-3 w-3" />} label="HTML" />
                  <TabButton active={activeTab === "quickref"} onClick={() => setActiveTab("quickref")} icon={<Zap className="h-3 w-3" />} label="Quick Ref" />
                </div>
              </div>

              {activeTab === "text" && (
                <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {text}
                </pre>
              )}
              {activeTab === "markdown" && (
                <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {md}
                </pre>
              )}
              {activeTab === "html" && (
                <iframe
                  title="SOP HTML Preview"
                  className="w-full h-[400px] rounded border bg-white"
                  srcDoc={html}
                />
              )}
              {activeTab === "quickref" && (
                <>
                  <iframe
                    title="Quick Reference Card Preview"
                    className="w-full h-[300px] rounded border bg-white"
                    srcDoc={quickRefHtml}
                  />
                  <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                    {quickRefText}
                  </pre>
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return activeTab === "markdown" ? md : activeTab === "quickref" ? quickRefText : text;
                  }}
                  label="Copy"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`${fileBase}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => md}
                  filename={`${fileBase}.md`}
                  mime="text/markdown"
                  label="Download .md"
                />
                <Button variant="outline" size="sm" onClick={() => handleDownloadHtml(html, "sop")} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadHtml(quickRefHtml, "quickref")} className="gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Quick Ref HTML
                </Button>
                <DownloadButton
                  getText={() => csv}
                  filename={`${fileBase}-process.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter at least one process step to generate the SOP"
          hint="Use the format: step_number,action,duration_minutes — one per line. Pick a department preset to seed sample data."
          icon={<ClipboardList className="h-8 w-8" />}
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
                  {h.sopId && <Badge variant="outline" className="text-[10px] font-mono">{h.sopId}</Badge>}
                  <span className="font-medium text-foreground">{h.sopTitle}</span>
                  {h.department && <Badge variant="secondary" className="text-[10px]">{h.department}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{h.stepCount} steps</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatDuration(h.totalDurationMinutes)}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All SOP parsing, date math, duration calculation, and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
