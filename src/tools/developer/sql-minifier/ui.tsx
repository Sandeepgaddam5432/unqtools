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
  NEWLINE_MODES,
  DEFAULT_OPTIONS,
  SAMPLE_SQL,
  minifySql,
  validateSql,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MinifyOptions,
  type HistoryEntry,
} from "./logic";
import { History, Minimize2, FileCode, AlertTriangle } from "lucide-react";

export default function SqlMinifier() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<MinifyOptions>({ ...DEFAULT_OPTIONS });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      toast.info("Loaded options from share link");
    }
  }, []);

  const validation = useMemo(() => (input.trim() ? validateSql(input) : null), [input]);
  const result = useMemo(() => (input.trim() ? minifySql(input, opts) : null), [input, opts]);

  const setOpt = useCallback(
    <K extends keyof MinifyOptions>(key: K, value: MinifyOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleLoadSample = useCallback(() => {
    setInput(SAMPLE_SQL);
    toast.info("Loaded sample SQL");
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
    if (result?.ok && input.trim()) {
      saveHistory({
        ts: Date.now(),
        dialect: opts.dialect,
        removeComments: opts.removeComments,
        inputPreview: input.slice(0, 80),
        outputPreview: result.output.slice(0, 80),
        inputBytes: input.length,
        outputBytes: result.output.length,
        savedPercent: result.stats.savedPercent,
      });
      setHistory(loadHistory());
    }
  }, [result, input, opts]);

  const output = result?.ok ? result.output : "";
  const stats = result?.ok ? result.stats : null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sql-min-input" className="text-sm font-semibold">
              SQL input
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample SQL</Button>
              <ClearButton onClick={handleClear} disabled={!input} />
            </div>
          </div>
          <Textarea
            id="sql-min-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"-- paste SQL with comments and indentation\nselect a, b from t where x = 1;"}
            className="min-h-[140px] resize-y font-mono text-xs"
          />
          {input && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{input.length} bytes</Badge>
              <Badge variant="outline">{input.split(/\r?\n/).length} lines</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Minimize2 className="h-4 w-4" /> Minify options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Dialect">
              <select
                value={opts.dialect}
                onChange={(e) => setOpt("dialect", e.target.value as MinifyOptions["dialect"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Newlines">
              <select
                value={opts.newlines}
                onChange={(e) => setOpt("newlines", e.target.value as MinifyOptions["newlines"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {NEWLINE_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Remove comments">
              <input
                type="checkbox"
                checked={opts.removeComments}
                onChange={(e) => setOpt("removeComments", e.target.checked)}
              />
            </Field>
            <Field label="Normalize ;; → ;">
              <input
                type="checkbox"
                checked={opts.normalizeSemicolons}
                onChange={(e) => setOpt("normalizeSemicolons", e.target.checked)}
              />
            </Field>
            <Field label="Output as JS string">
              <input
                type="checkbox"
                checked={opts.asJsString}
                onChange={(e) => setOpt("asJsString", e.target.checked)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {validation && !validation.ok && (
        <ErrorBanner message={`Cannot minify: ${validation.error}`} />
      )}
      {validation && validation.ok && "warnings" in validation && validation.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{validation.warnings.join(" ")}</span>
        </div>
      )}

      {output ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> Minified SQL
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return output; }} label="Copy" />
                <DownloadButton
                  getText={() => { handleRecordHistory(); return output; }}
                  filename="minified.sql"
                  mime="application/sql"
                  label="Download .sql"
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <Textarea
              readOnly
              value={output}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            {stats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Stat label="Input bytes" value={stats.inputBytes} />
                  <Stat label="Output bytes" value={stats.outputBytes} />
                  <Stat label="Saved" value={`${stats.savedBytes} B`} highlight="good" />
                  <Stat label="Savings" value={`${stats.savedPercent}%`} highlight="good" />
                  <Stat label="Statements" value={stats.statementCount} />
                </div>
                <div className="w-full h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.max(0, stats.savedPercent))}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste SQL to minify into a single line"
          hint="Comments are removed, whitespace is collapsed, but string literals and quoted identifiers are preserved exactly. 100% client-side."
          icon={<Minimize2 className="h-8 w-8" />}
        />
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
                    <Badge variant="outline" className="text-[10px]">{h.dialect}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.savedPercent}% saved</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.outputPreview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> SQL is tokenized and minified entirely in your
            browser. Nothing is uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
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
