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
  DELIMITER_OPTIONS,
  INSERT_MODES,
  DEFAULT_OPTIONS,
  TYPE_LABELS,
  SAMPLE_CSV,
  convertCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ConvertOptions,
  type ColumnType,
  type HistoryEntry,
} from "./logic";
import { History, FileCode, Table, AlertTriangle, Database } from "lucide-react";

const TYPE_COLORS: Record<ColumnType, string> = {
  integer: "text-emerald-600 dark:text-emerald-400",
  decimal: "text-blue-600 dark:text-blue-400",
  boolean: "text-purple-600 dark:text-purple-400",
  date: "text-amber-600 dark:text-amber-400",
  text: "text-muted-foreground",
};

export default function CsvToSqlInsertConverter() {
  const [csv, setCsv] = useState("");
  const [opts, setOpts] = useState<ConvertOptions>({ ...DEFAULT_OPTIONS });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts(p);
      toast.info("Loaded options from share link");
    }
  }, []);

  const result = useMemo(() => (csv.trim() ? convertCsv(csv, opts) : null), [csv, opts]);

  const setOpt = useCallback(
    <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleLoadSample = useCallback(() => {
    setCsv(SAMPLE_CSV);
    toast.info("Loaded sample CSV");
  }, []);

  const handleClear = useCallback(() => {
    setCsv("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (result?.ok && result.stats.rowCount > 0) {
      saveHistory({
        ts: Date.now(),
        dialect: opts.dialect,
        mode: opts.mode,
        tableName: opts.tableName,
        rowCount: result.stats.rowCount,
        columnCount: result.stats.columnCount,
        insertCount: result.stats.insertCount,
        nullCount: result.stats.nullCount,
      });
      setHistory(loadHistory());
    }
  }, [result, opts]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="csv-input" className="text-sm font-semibold">
              CSV input
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample CSV</Button>
              <ClearButton onClick={handleClear} disabled={!csv} />
            </div>
          </div>
          <Textarea
            id="csv-input"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"id,name,email,age\n1,Alice,alice@example.com,30\n2,Bob,bob@example.com,25"}
            className="min-h-[160px] resize-y font-mono text-xs"
          />
          {csv && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{csv.length} bytes</Badge>
              <Badge variant="outline">{csv.split(/\r?\n/).length} lines</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Database className="h-4 w-4" /> Conversion options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Dialect">
              <select
                value={opts.dialect}
                onChange={(e) => setOpt("dialect", e.target.value as ConvertOptions["dialect"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Table name">
              <Input
                value={opts.tableName}
                onChange={(e) => setOpt("tableName", e.target.value)}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Delimiter">
              <select
                value={opts.delimiter}
                onChange={(e) => setOpt("delimiter", e.target.value as ConvertOptions["delimiter"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {DELIMITER_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Insert mode">
              <select
                value={opts.mode}
                onChange={(e) => setOpt("mode", e.target.value as ConvertOptions["mode"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {INSERT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Batch size">
              <Input
                type="number"
                min={1}
                value={opts.batchSize}
                onChange={(e) => setOpt("batchSize", Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="NULL token">
              <Input
                value={opts.nullToken}
                onChange={(e) => setOpt("nullToken", e.target.value)}
                className="h-8 text-xs"
              />
            </Field>
            {opts.mode === "upsert" && (
              <Field label="Conflict column">
                <Input
                  value={opts.conflictColumn}
                  onChange={(e) => setOpt("conflictColumn", e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            )}
            <Field label="First row is header">
              <input
                type="checkbox"
                checked={opts.hasHeader}
                onChange={(e) => setOpt("hasHeader", e.target.checked)}
              />
            </Field>
            <Field label="Empty = NULL">
              <input
                type="checkbox"
                checked={opts.emptyAsNull}
                onChange={(e) => setOpt("emptyAsNull", e.target.checked)}
              />
            </Field>
            <Field label="Generate CREATE TABLE">
              <input
                type="checkbox"
                checked={opts.includeCreateTable}
                onChange={(e) => setOpt("includeCreateTable", e.target.checked)}
              />
            </Field>
            <Field label="Quote identifiers">
              <input
                type="checkbox"
                checked={opts.quoteIdentifiers}
                onChange={(e) => setOpt("quoteIdentifiers", e.target.checked)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {result && !result.ok && (
        <ErrorBanner message={`Conversion failed: ${result.error}`} />
      )}

      {result?.ok && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Table className="h-4 w-4" /> Inferred schema
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.headers.map((h, i) => {
                  const t = result.types[i] ?? "text";
                  return (
                    <div key={i} className="rounded border bg-background px-2 py-1 text-xs">
                      <span className="font-mono text-foreground">{h}</span>
                      <span className={`ml-1.5 font-mono ${TYPE_COLORS[t]}`}>{TYPE_LABELS[t]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Rows" value={result.stats.rowCount} />
                <Stat label="Columns" value={result.stats.columnCount} />
                <Stat label="INSERTs" value={result.stats.insertCount} />
                <Stat label="NULLs" value={result.stats.nullCount} highlight={result.stats.nullCount > 0 ? "good" : undefined} />
                <Stat label="Output bytes" value={result.stats.bytes} />
                <Stat label="Dialect" value={opts.dialect} />
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {(Object.keys(result.stats.typeCounts) as ColumnType[]).map((t) => (
                  <Badge key={t} variant="outline" className={`text-[10px] ${TYPE_COLORS[t]}`}>
                    {TYPE_LABELS[t]}: {result.stats.typeCounts[t]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileCode className="h-4 w-4" /> SQL output
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { handleRecordHistory(); return result.sql; }} label="Copy SQL" />
                  <DownloadButton
                    getText={() => { handleRecordHistory(); return result.sql; }}
                    filename={`${opts.tableName || "data"}.sql`}
                    mime="application/sql"
                    label="Download .sql"
                  />
                  <ShareButton getUrl={() => buildShareUrl(opts)} />
                </div>
              </div>
              <Textarea readOnly value={result.sql} className="min-h-[280px] resize-y font-mono text-xs" />
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>Always review generated SQL before running on a production database.</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!csv.trim() && (
        <EmptyState
          title="Paste CSV data to generate SQL INSERTs"
          hint="Smart type inference (int/decimal/boolean/date/text), RFC 4180-correct parsing, NULL handling, batched multi-row inserts, optional CREATE TABLE, and UPSERT support. 100% client-side."
          icon={<FileCode className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.rowCount} rows</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.insertCount} INSERTs</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">
                    table: {h.tableName} · {h.columnCount} cols · {h.nullCount} NULLs
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> CSV parsing and SQL generation run
            entirely in your browser. Nothing is uploaded. History (last 20) is stored in localStorage
            on this device only.
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
