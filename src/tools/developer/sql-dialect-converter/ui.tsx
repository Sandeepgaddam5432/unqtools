"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  SQL_DIALECTS,
  TYPE_MAPPINGS,
  FUNCTION_MAPPINGS,
  IDENTIFIER_QUOTE,
  PRESETS,
  convertSql,
  countManualReviews,
  renderChangeLog,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SqlDialect,
  type HistoryEntry,
  type ChangeSeverity,
} from "./logic";
import { History, GitCompare, ArrowRight, AlertTriangle, Info, AlertOctagon, Table2 } from "lucide-react";

export default function SqlDialectConverter() {
  const [input, setInput] = useState("");
  const [from, setFrom] = useState<SqlDialect>("mysql");
  const [to, setTo] = useState<SqlDialect>("postgresql");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showMappings, setShowMappings] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.input) setInput(p.input);
        setFrom(p.from);
        setTo(p.to);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => (input.trim() ? convertSql(input, from, to) : null), [input, from, to]);
  const output = result?.ok ? result.output : "";
  const changes = result?.ok ? result.changes : [];
  const manualCount = countManualReviews(changes);
  const warningCount = changes.filter((c) => c.severity === "warning").length;
  const infoCount = changes.filter((c) => c.severity === "info").length;

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const applyPreset = useCallback((presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setInput(p.sql);
      setFrom(p.from);
      setTo(p.to);
      toast.success(`Loaded preset: ${p.label}`);
    }
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (result?.ok && output) {
      saveHistory({
        ts: Date.now(),
        from,
        to,
        inputPreview: input.slice(0, 80),
        outputPreview: output.slice(0, 80),
        changeCount: changes.length,
        manualReviewCount: manualCount,
      });
      setHistory(loadHistory());
    }
  }, [result, output, input, from, to, changes, manualCount]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <GitCompare className="h-4 w-4" /> Conversion
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && applyPreset(e.target.value)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">Load preset…</option>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => setShowMappings((s) => !s)}>
                {showMappings ? "Hide" : "Show"} mappings
              </Button>
              <ClearButton onClick={handleClear} disabled={!input} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</Label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as SqlDialect)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <Button variant="ghost" size="icon" onClick={swap} title="Swap">
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</Label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value as SqlDialect)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {showMappings && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> Mapping reference ({from} → {to})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-1">Data types</h4>
                <div className="text-[11px] font-mono space-y-0.5 max-h-[260px] overflow-auto">
                  {Object.entries(TYPE_MAPPINGS)
                    .filter(([, targets]) => targets[from] && targets[to])
                    .map(([name, targets]) => (
                      <div key={name} className="flex gap-2">
                        <span className="text-muted-foreground w-32 flex-shrink-0">{name}</span>
                        <span className="text-foreground">{targets[from]?.template}</span>
                        <ArrowRight className="h-3 w-3 mx-1 my-auto text-muted-foreground" />
                        <span className="text-foreground">{targets[to]?.template}</span>
                        {targets[to]?.severity === "manual" && <AlertOctagon className="h-3 w-3 text-amber-500" />}
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-1">Functions</h4>
                <div className="text-[11px] font-mono space-y-0.5 max-h-[260px] overflow-auto">
                  {Object.entries(FUNCTION_MAPPINGS)
                    .filter(([, targets]) => targets[from] && targets[to])
                    .map(([name, targets]) => (
                      <div key={name} className="flex gap-2">
                        <span className="text-muted-foreground w-32 flex-shrink-0">{name}</span>
                        <span className="text-foreground">{targets[from]}</span>
                        <ArrowRight className="h-3 w-3 mx-1 my-auto text-muted-foreground" />
                        <span className="text-foreground">{targets[to]}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Identifier quoting: {from} <code className="text-foreground">{IDENTIFIER_QUOTE[from].open}…{IDENTIFIER_QUOTE[from].close}</code>
              {" → "}
              {to} <code className="text-foreground">{IDENTIFIER_QUOTE[to].open}…{IDENTIFIER_QUOTE[to].close}</code>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="sdc-input" className="text-sm font-semibold">Source SQL ({from})</Label>
          <Textarea
            id="sdc-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"paste your SQL here…"}
            className="min-h-[180px] resize-y font-mono text-xs"
          />
        </CardContent>
      </Card>

      {result && !result.ok && (
        <ErrorBanner message={result.error} />
      )}

      {manualCount > 0 && output && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4" /> {manualCount} construct(s) need manual review
          </div>
          <p>Always test converted SQL before production. The converter never silently mistranslates — flagged items were left in place or commented out for your review.</p>
        </div>
      )}

      {output ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <GitCompare className="h-4 w-4" /> Converted SQL ({to})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return output; }} label="Copy" />
                <DownloadButton
                  getText={() => { handleRecordHistory(); return output; }}
                  filename={`converted.${to === "postgresql" ? "pgsql" : to === "sqlserver" ? "sql" : "sql"}`}
                  mime="application/sql"
                  label="Download .sql"
                />
                <DownloadButton
                  getText={() => renderChangeLog(changes)}
                  filename="conversion-changelog.md"
                  mime="text/markdown"
                  label="Download changelog"
                />
                <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(input, from, to); }} />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[180px] resize-y font-mono text-xs" />
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
                <Info className="h-3 w-3 mr-1" />{infoCount} info
              </Badge>
              <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1" />{warningCount} warning(s)
              </Badge>
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                <AlertOctagon className="h-3 w-3 mr-1" />{manualCount} manual review
              </Badge>
              <Badge variant="outline">{from} → {to}</Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste SQL and convert between dialects"
          hint="Choose from/to dialects (or load a preset). Identifier quoting, LIMIT/TOP/ROWNUM, AUTO_INCREMENT, string concat, date functions, and common types are converted deterministically. 100% client-side."
          icon={<GitCompare className="h-8 w-8" />}
        />
      )}

      {changes.length > 0 && output && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">Change log ({changes.length})</h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {changes.map((c, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={c.severity} />
                    <span className="text-foreground flex-1">{c.description}</span>
                  </div>
                  {c.before && c.after && (
                    <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                      <span className="line-through">{c.before}</span>
                      {" → "}
                      <span className="text-foreground">{c.after}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.from} → {h.to}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.changeCount} changes</Badge>
                    {h.manualReviewCount > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600">{h.manualReviewCount} manual</Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate font-mono">{h.inputPreview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy &amp; honesty:</strong> 100% client-side and deterministic —
            no AI, no server, no telemetry. Same input + dialect pair always yields the same output. Constructs with no
            clean equivalent are flagged, never silently mistranslated. Always test converted SQL before production.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: ChangeSeverity }) {
  if (severity === "info") return <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">INFO</Badge>;
  if (severity === "warning") return <Badge variant="outline" className="text-[10px] text-yellow-600 dark:text-yellow-400">WARN</Badge>;
  return <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">MANUAL</Badge>;
}
