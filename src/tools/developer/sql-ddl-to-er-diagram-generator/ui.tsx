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
  PRESETS,
  DIALECT_LABELS,
  parseDdl,
  generateMermaidErd,
  generateAsciiErd,
  generateDbml,
  serializeSchema,
  topologicalSort,
  validateModel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summarizeModel,
  type HistoryEntry,
  type Dialect,
} from "./logic";
import {
  History,
  Database,
  AlertTriangle,
  Info,
  AlertOctagon,
  GitBranch,
  FileCode,
  Table2,
  Boxes,
} from "lucide-react";

type OutputFormat = "mermaid" | "ascii" | "dbml" | "json";

const FORMAT_LABELS: Record<OutputFormat, string> = {
  mermaid: "Mermaid erDiagram",
  ascii: "ASCII Crow's-foot",
  dbml: "DBML",
  json: "Schema JSON",
};

export default function SqlDdlToErDiagramGenerator() {
  const [ddl, setDdl] = useState("");
  const [inferFromNaming, setInferFromNaming] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("mermaid");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.ddl) {
        setDdl(p.ddl);
        setInferFromNaming(p.inferFromNaming);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => {
    if (!ddl.trim()) return null;
    return parseDdl(ddl, { inferFromNaming });
  }, [ddl, inferFromNaming]);

  const output = useMemo(() => {
    if (!result || result.model.tables.length === 0) return "";
    switch (format) {
      case "mermaid": return generateMermaidErd(result.model);
      case "ascii": return generateAsciiErd(result.model);
      case "dbml": return generateDbml(result.model);
      case "json": return serializeSchema(result.model);
    }
    return "";
  }, [result, format]);

  const stats = useMemo(() => result ? summarizeModel(result.model) : null, [result]);
  const topo = useMemo(() => result ? topologicalSort(result.model) : null, [result]);
  const issues = useMemo(() => result ? validateModel(result.model) : [], [result]);
  const allIssues = useMemo(
    () => [...(result?.issues ?? []), ...issues],
    [result, issues],
  );

  const handleSaveHistory = useCallback(() => {
    if (result && result.model.tables.length > 0) {
      saveHistory({
        ts: Date.now(),
        tableCount: result.model.tables.length,
        fkCount: stats?.fks ?? 0,
        dialect: result.model.dialectHint ?? "ansi",
        preview: result.model.tables.map((t) => t.name).slice(0, 5).join(", "),
      });
      setHistory(loadHistory());
    }
  }, [result, stats]);

  const handleClear = useCallback(() => {
    setDdl("");
    setInferFromNaming(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handlePreset = (idx: number) => {
    setDdl(PRESETS[idx].ddl);
    toast.info(`Loaded preset: ${PRESETS[idx].name}`);
  };

  const downloadFilename = useMemo(() => {
    switch (format) {
      case "mermaid": return "schema.mmd";
      case "ascii": return "schema.txt";
      case "dbml": return "schema.dbml";
      case "json": return "schema.json";
    }
    return "schema.txt";
  }, [format]);

  const downloadMime = format === "json" ? "application/json" : "text/plain";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ddl-input">SQL DDL (CREATE TABLE / ALTER TABLE)</Label>
            <Textarea
              id="ddl-input"
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              placeholder={"CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) UNIQUE\n);\n\nCREATE TABLE posts (\n  id SERIAL PRIMARY KEY,\n  author_id INTEGER NOT NULL REFERENCES users(id),\n  title VARCHAR(200) NOT NULL\n);"}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handlePreset(i)}
                >+ {p.name}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={inferFromNaming}
                onChange={(e) => setInferFromNaming(e.target.checked)}
              />
              Infer relationships from <code className="font-mono text-[10px] bg-muted px-1 rounded">_id</code> naming
            </label>
            {result?.model.dialectHint && (
              <Badge variant="outline" className="text-[10px]">
                Detected: {DIALECT_LABELS[result.model.dialectHint as Dialect]}
              </Badge>
            )}
            {result && (
              <Badge variant="secondary" className="text-[10px]">
                {result.statementCount} statements
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {result && result.model.tables.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Boxes className="h-4 w-4" /> Schema summary
              </h3>
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Stat label="Tables" value={stats.tables} />
                  <Stat label="Columns" value={stats.columns} />
                  <Stat label="Foreign keys" value={stats.fks} />
                  <Stat label="Indexes" value={stats.indexes} />
                  <Stat label="Checks" value={stats.checks} />
                </div>
              )}
              {topo && (
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Creation order (topological)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topo.order.map((name, i) => (
                      <Badge key={name} variant="outline" className="text-[10px] font-mono">
                        <span className="text-muted-foreground mr-1">{i + 1}.</span>
                        {name}
                      </Badge>
                    ))}
                  </div>
                  {topo.cycles.length > 0 && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>{topo.cycles.length} circular FK chain(s) detected</strong>
                        {topo.cycles.slice(0, 3).map((c, i) => (
                          <div key={i} className="font-mono">{c.join(" → ")}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {allIssues.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Validation ({allIssues.length})
                </h3>
                <div className="space-y-1 max-h-[160px] overflow-auto">
                  {allIssues.map((iss, i) => {
                    const Icon = iss.severity === "error" ? AlertOctagon
                      : iss.severity === "warning" ? AlertTriangle
                      : Info;
                    const color = iss.severity === "error"
                      ? "text-red-600 dark:text-red-400"
                      : iss.severity === "warning"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-blue-600 dark:text-blue-400";
                    return (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${color}`} />
                        <span className="text-foreground">
                          {iss.table && (
                            <Badge variant="outline" className="text-[9px] mr-1 font-mono">{iss.table}</Badge>
                          )}
                          {iss.message}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Output ({result.model.tables.length} tables)
                </h3>
                <div className="flex gap-1">
                  {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((f) => (
                    <Button
                      key={f}
                      variant={format === f ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setFormat(f)}
                    >
                      {FORMAT_LABELS[f]}
                    </Button>
                  ))}
                </div>
              </div>

              {format === "mermaid" && (
                <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <Info className="inline h-3 w-3 mr-1" />
                  Paste this into the <a className="underline" href="https://mermaid.live" target="_blank" rel="noopener noreferrer">Mermaid Live Editor</a>, GitHub, Notion, or any Mermaid renderer.
                </div>
              )}

              <pre className="text-[11px] font-mono bg-muted/40 dark:bg-muted/20 rounded p-3 max-h-[480px] overflow-auto whitespace-pre-wrap break-words">
                {output || "(empty)"}
              </pre>

              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return output; }}
                  label={`Copy ${FORMAT_LABELS[format]}`}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return output; }}
                  filename={downloadFilename}
                  mime={downloadMime}
                  label={`Download .${downloadFilename.split(".").pop()}`}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(ddl, { inferFromNaming }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table2 className="h-4 w-4" /> Tables ({result.model.tables.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {result.model.tables.map((t) => (
                  <div key={t.name} className="rounded border bg-background p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-foreground">{t.name}</span>
                      {t.primaryKeys.length > 0 && (
                        <Badge variant="secondary" className="text-[9px]">PK: {t.primaryKeys.join(",")}</Badge>
                      )}
                      {t.foreignKeys.length > 0 && (
                        <Badge variant="outline" className="text-[9px]">{t.foreignKeys.length} FK</Badge>
                      )}
                      {t.indexes.length > 0 && (
                        <Badge variant="outline" className="text-[9px]">{t.indexes.length} idx</Badge>
                      )}
                      {t.checks.length > 0 && (
                        <Badge variant="outline" className="text-[9px] text-amber-600">{t.checks.length} check</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                      {t.columns.map((c) => (
                        <div key={c.name} className="flex items-center gap-1 font-mono text-[10px]">
                          <span className="text-muted-foreground w-5">
                            {c.primaryKey || t.primaryKeys.includes(c.name) ? "PK"
                              : c.unique ? "UK"
                              : t.foreignKeys.some((fk) => fk.fromColumns.includes(c.name)) ? "FK"
                              : "·"}
                          </span>
                          <span className="text-foreground">{c.name}</span>
                          <span className="text-muted-foreground">{c.type}</span>
                          {!c.nullable && <span className="text-amber-600 dark:text-amber-400">NN</span>}
                          {c.defaultValue && <span className="text-blue-600 dark:text-blue-400">={c.defaultValue}</span>}
                        </div>
                      ))}
                    </div>
                    {t.foreignKeys.length > 0 && (
                      <div className="mt-1 pt-1 border-t flex flex-wrap gap-1">
                        {t.foreignKeys.map((fk) => (
                          <Badge key={fk.id} variant="outline" className="text-[9px] font-mono">
                            <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                            {fk.fromColumns.join(",")} → {fk.toTable}.{fk.toColumns.join(",")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste SQL DDL to generate an ER diagram"
          hint="Supports MySQL, PostgreSQL, SQLite, SQL Server, ANSI. Outputs Mermaid erDiagram, ASCII crow's-foot, DBML, and JSON. Click a preset to try one."
          icon={<Database className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.tableCount} tables</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.fkCount} FK</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.dialect}</Badge>
                  <span className="text-muted-foreground">{h.preview}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side. Your DDL never leaves the browser. History is stored in localStorage on this device only.
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
