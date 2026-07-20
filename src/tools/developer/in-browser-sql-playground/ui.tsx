"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  Database,
  execute,
  listTables,
  describeTable,
  exportDatabase,
  importDatabase,
  resultToCsv,
  resultToJson,
  resultToMarkdown,
  formatCell,
  validateSql,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  SAMPLE_DATASETS,
  type HistoryEntry,
  type QueryResult,
} from "./logic";
import {
  History, Play, Table2, Download, Upload, AlertTriangle, Database as DbIcon, FileCode2,
} from "lucide-react";

type OutputFormat = "csv" | "json" | "markdown";

const OUTPUT_LABELS: Record<OutputFormat, string> = {
  csv: "CSV",
  json: "JSON",
  markdown: "Markdown",
};

const OUTPUT_MIME: Record<OutputFormat, string> = {
  csv: "text/csv",
  json: "application/json",
  markdown: "text/markdown",
};

const OUTPUT_EXT: Record<OutputFormat, string> = { csv: "csv", json: "json", markdown: "md" };

export default function InBrowserSqlPlayground() {
  const dbRef = useRef<Database>(new Database());
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string>("");
  const [outFmt, setOutFmt] = useState<OutputFormat>("csv");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [schemaVersion, setSchemaVersion] = useState(0); // force re-render on schema changes
  const [activeTab, setActiveTab] = useState<"results" | "schema" | "history">("results");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const { sql: sharedSql } = parseShareUrl(window.location.hash);
      if (sharedSql) {
        setSql(sharedSql);
        toast.info("Loaded SQL from share link");
      }
    }
  }, []);

  const tables = useMemo(() => listTables(dbRef.current), [dbRef, schemaVersion]);

  const handleRun = useCallback(() => {
    if (!sql.trim()) {
      setError("Enter SQL to execute");
      return;
    }
    const validationError = validateSql(sql);
    if (validationError) {
      setError(`Syntax error: ${validationError}`);
      setResult(null);
      return;
    }
    try {
      setError("");
      const r = execute(dbRef.current, sql);
      setResult(r);
      setSchemaVersion((v) => v + 1);
      saveHistory({
        ts: Date.now(),
        sql,
        rowCount: r.rows.length,
        executionTimeMs: r.executionTimeMs,
        success: true,
      });
      setHistory(loadHistory());
      setActiveTab("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setResult(null);
      saveHistory({
        ts: Date.now(),
        sql,
        rowCount: 0,
        executionTimeMs: 0,
        success: false,
        error: msg,
      });
      setHistory(loadHistory());
    }
  }, [sql]);

  const output = useMemo(() => {
    if (!result) return "";
    if (outFmt === "csv") return resultToCsv(result);
    if (outFmt === "json") return resultToJson(result, true);
    return resultToMarkdown(result);
  }, [result, outFmt]);

  const handleClear = useCallback(() => {
    setSql("");
    setResult(null);
    setError("");
  }, []);

  const handleLoadSample = useCallback((sampleSql: string) => {
    setSql(sampleSql);
    setError("");
    setResult(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleResetDb = useCallback(() => {
    dbRef.current = new Database();
    setResult(null);
    setSchemaVersion((v) => v + 1);
    toast.success("Database reset");
  }, []);

  const handleExportDb = useCallback(() => {
    const json = exportDatabase(dbRef.current);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground-db.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Database exported");
  }, []);

  const handleImportDb = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      dbRef.current = importDatabase(text);
      setSchemaVersion((v) => v + 1);
      toast.success(`Imported database (${listTables(dbRef.current).length} tables)`);
    } catch {
      toast.error("Could not import database");
    } finally {
      e.target.value = "";
    }
  }, []);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setSql(entry.sql);
    setActiveTab("results");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sql-input">SQL (semicolon-separated statements)</Label>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_DATASETS.map((ds) => (
                <Button
                  key={ds.name}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => handleLoadSample(ds.sql)}
                  title={ds.description}
                >+ {ds.name}</Button>
              ))}
            </div>
          </div>
          <Textarea
            id="sql-input"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={"CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO users VALUES (1, 'Alice');\nSELECT * FROM users;"}
            className="min-h-[200px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleRun} label="Run SQL" />
            <CopyButton getText={() => sql} label="Copy SQL" disabled={!sql} />
            <ShareButton getUrl={() => buildShareUrl(sql)} disabled={!sql} />
            <ClearButton onClick={handleClear} disabled={!sql && !result} />
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={handleExportDb} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export DB
            </Button>
            <label className="inline-flex">
              <Button variant="ghost" size="sm" asChild className="gap-1.5 cursor-pointer">
                <span><Upload className="h-3.5 w-3.5" /> Import DB</span>
              </Button>
              <input type="file" accept=".json,application/json" onChange={handleImportDb} className="hidden" />
            </label>
            <Button variant="ghost" size="sm" onClick={handleResetDb} className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{result.affectedRows} row(s)</Badge>
                <Badge variant="outline" className="text-[10px]">{result.executionTimeMs} ms</Badge>
                <span className="text-xs text-muted-foreground">{result.message}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={outFmt}
                  onChange={(e) => setOutFmt(e.target.value as OutputFormat)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                </select>
                <DownloadButton
                  getText={() => output}
                  filename={`query-result.${OUTPUT_EXT[outFmt]}`}
                  mime={OUTPUT_MIME[outFmt]}
                  label="Download"
                />
                <CopyButton getText={() => output} label="Copy" />
              </div>
            </div>

            <div className="flex gap-2 border-b">
              {(["results", "schema", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "results" ? "Results" : t === "schema" ? "Schema" : "History"}
                </button>
              ))}
            </div>

            {activeTab === "results" && (
              result.columns.length > 0 ? (
                <div className="overflow-auto max-h-[500px] rounded border">
                  <table className="min-w-full text-xs font-mono">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {result.columns.map((c, i) => (
                          <th key={i} className="text-left px-2 py-1 border-b whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 200).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          {result.columns.map((c, j) => {
                            const v = row[c];
                            const isNull = v === null || v === undefined;
                            return (
                              <td key={j} className={`px-2 py-1 border-b whitespace-nowrap ${isNull ? "text-muted-foreground italic" : ""}`}>
                                {isNull ? "NULL" : formatCell(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rows.length > 200 && (
                    <div className="p-2 text-center text-[10px] text-muted-foreground">
                      … showing first 200 of {result.rows.length} rows
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="Query executed — no rows returned"
                  hint="The SQL ran successfully but produced no result rows (e.g. INSERT, CREATE TABLE, or an empty result set)."
                  icon={<Play className="h-8 w-8" />}
                />
              )
            )}

            {activeTab === "schema" && (
              <SchemaBrowser db={dbRef.current} schemaVersion={schemaVersion} />
            )}

            {activeTab === "history" && (
              <HistoryPanel history={history} onClick={handleHistoryClick} onClear={handleClearHistory} />
            )}
          </CardContent>
        </Card>
      )}

      {!result && !error && (
        <EmptyState
          title="Write SQL and hit Run"
          hint="Multi-statement scripts are supported — separate statements with semicolons. Click a sample dataset button above to populate the editor with a runnable example."
          icon={<DbIcon className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> The SQL engine runs entirely in your browser — no server, no WASM, no network calls. Your data and queries never leave this device. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SchemaBrowser({ db, schemaVersion }: { db: Database; schemaVersion: number }) {
  void schemaVersion;
  const tables = listTables(db);
  if (tables.length === 0) {
    return (
      <EmptyState
        title="No tables yet"
        hint="Run a CREATE TABLE statement to define a schema, or load a sample dataset."
        icon={<Table2 className="h-8 w-8" />}
      />
    );
  }
  return (
    <div className="space-y-3 max-h-[500px] overflow-auto">
      {tables.map((t) => {
        const desc = describeTable(db, t.name);
        return (
          <div key={t.name} className="rounded border bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <DbIcon className="h-4 w-4 text-primary" />
              <span className="font-mono font-semibold text-sm">{t.name}</span>
              <Badge variant="outline" className="text-[10px]">{t.rowCount} row(s)</Badge>
              <Badge variant="outline" className="text-[10px]">{t.columnCount} col(s)</Badge>
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left px-2 py-1">Column</th>
                  <th className="text-left px-2 py-1">Type</th>
                  <th className="text-left px-2 py-1">Nullable</th>
                  <th className="text-left px-2 py-1">PK</th>
                </tr>
              </thead>
              <tbody>
                {desc?.columns.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="px-2 py-1 font-mono">{c.name}</td>
                    <td className="px-2 py-1"><Badge variant="secondary" className="text-[10px]">{c.type}</Badge></td>
                    <td className="px-2 py-1">{c.nullable ? "YES" : "NO"}</td>
                    <td className="px-2 py-1">{c.primaryKey ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function HistoryPanel({
  history,
  onClick,
  onClear,
}: {
  history: HistoryEntry[];
  onClick: (e: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="No history yet"
        hint="Executed queries will appear here for the last 20 runs. Click one to reload it into the editor."
        icon={<History className="h-8 w-8" />}
      />
    );
  }
  return (
    <div className="space-y-2 max-h-[500px] overflow-auto">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear}>Clear history</Button>
      </div>
      {history.map((h, i) => (
        <button
          key={i}
          onClick={() => onClick(h)}
          className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            {h.success ? (
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">{h.rowCount} rows</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400">error</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
            {h.executionTimeMs > 0 && (
              <span className="text-[10px] text-muted-foreground">· {h.executionTimeMs} ms</span>
            )}
          </div>
          <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap line-clamp-3">{h.sql}</pre>
          {h.error && (
            <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 font-mono">{h.error}</div>
          )}
        </button>
      ))}
    </div>
  );
}
