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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  SQL_DIALECTS,
  KEYWORD_CASE_OPTIONS,
  IDENTIFIER_CASE_OPTIONS,
  COMMA_STYLE_OPTIONS,
  INDENT_STYLE_OPTIONS,
  DEFAULT_OPTIONS,
  PRESETS,
  SAMPLE_SQL,
  formatSql,
  validateSql,
  computeInputStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FormatOptions,
  type HistoryEntry,
} from "./logic";
import { History, Database, Wand2, AlertTriangle } from "lucide-react";

export default function SqlFormatterBeautifier() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<FormatOptions>({ ...DEFAULT_OPTIONS });
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
  const result = useMemo(() => (input.trim() ? formatSql(input, opts) : null), [input, opts]);
  const inStats = useMemo(() => computeInputStats(input), [input]);

  const setOpt = useCallback(
    <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyPreset = useCallback((presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setOpts({ ...p.options });
      toast.success(`Applied preset: ${p.label}`);
    }
  }, []);

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
        keywordCase: opts.keywordCase,
        commaStyle: opts.commaStyle,
        inputPreview: input.slice(0, 80),
        outputPreview: result.output.slice(0, 80),
        inputBytes: input.length,
        outputBytes: result.output.length,
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
            <Label htmlFor="sql-fmt-input" className="text-sm font-semibold">
              SQL input
            </Label>
            <div className="flex flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && applyPreset(e.target.value)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">Apply preset…</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample SQL</Button>
              <ClearButton onClick={handleClear} disabled={!input} />
            </div>
          </div>
          <Textarea
            id="sql-fmt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="paste your SQL here…"
            className="min-h-[140px] resize-y font-mono text-xs"
          />
          {inStats.bytes > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{inStats.bytes} bytes</Badge>
              <Badge variant="outline">{inStats.lines} lines</Badge>
              <Badge variant="outline">{inStats.statements} statement(s)</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Format options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Dialect">
              <select
                value={opts.dialect}
                onChange={(e) => setOpt("dialect", e.target.value as FormatOptions["dialect"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Keyword case">
              <select
                value={opts.keywordCase}
                onChange={(e) => setOpt("keywordCase", e.target.value as FormatOptions["keywordCase"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {KEYWORD_CASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Identifier case">
              <select
                value={opts.identifierCase}
                onChange={(e) => setOpt("identifierCase", e.target.value as FormatOptions["identifierCase"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {IDENTIFIER_CASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Comma style">
              <select
                value={opts.commaStyle}
                onChange={(e) => setOpt("commaStyle", e.target.value as FormatOptions["commaStyle"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {COMMA_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Indent">
              <select
                value={opts.indent}
                onChange={(e) => setOpt("indent", e.target.value as FormatOptions["indent"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {INDENT_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Indent size">
              <Input
                type="number"
                min={1}
                max={16}
                value={opts.indentSize}
                onChange={(e) => setOpt("indentSize", Math.max(1, Math.min(16, Number(e.target.value) || 2)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Newline before clause">
              <input
                type="checkbox"
                checked={opts.newLineBeforeClause}
                onChange={(e) => setOpt("newLineBeforeClause", e.target.checked)}
              />
            </Field>
            <Field label="Preserve comments">
              <input
                type="checkbox"
                checked={opts.preserveComments}
                onChange={(e) => setOpt("preserveComments", e.target.checked)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {validation && !validation.ok && (
        <ErrorBanner message={`Cannot format: ${validation.error}`} />
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
                <Database className="h-4 w-4" /> Formatted SQL
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return output; }} label="Copy" />
                <DownloadButton
                  getText={() => { handleRecordHistory(); return output; }}
                  filename="formatted.sql"
                  mime="application/sql"
                  label="Download .sql"
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <Textarea
              readOnly
              value={output}
              className="min-h-[260px] resize-y font-mono text-xs"
            />
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Input bytes" value={stats.inputBytes} />
                <Stat label="Output bytes" value={stats.outputBytes} />
                <Stat label="Input lines" value={stats.inputLines} />
                <Stat label="Output lines" value={stats.outputLines} />
                <Stat label="Tokens" value={stats.tokenCount} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste SQL and see it beautified instantly"
          hint="Select a dialect and style preset, or load the sample. String literals and comments are preserved verbatim. 100% client-side."
          icon={<Database className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.keywordCase}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.commaStyle}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.inputPreview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> SQL is tokenized and reformatted entirely in your
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
