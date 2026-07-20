"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  DIALECTS,
  FAKER_TYPES,
  PRESET_DDL,
  parseDdl,
  generateDataset,
  formatDatasetInserts,
  formatDatasetCsv,
  formatDatasetJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Dialect,
  type TableSchema,
  type GenerationConfig,
  type HistoryEntry,
} from "./logic";
import {
  History, Database, Play, AlertTriangle, FileCode, FileText, Braces,
  Wand2, Table2, Hash, Link2,
} from "lucide-react";

type OutputFormat = "sql" | "csv" | "json";

const DEFAULT_DDL = `CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  age TINYINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (email)
);`;

export default function MockSqlDataGenerator() {
  const [ddl, setDdl] = useState(DEFAULT_DDL);
  const [dialect, setDialect] = useState<Dialect>("mysql");
  const [rowCount, setRowCount] = useState(20);
  const [seed, setSeed] = useState(42);
  const [batchSize, setBatchSize] = useState(1);
  const [format, setFormat] = useState<OutputFormat>("sql");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setDdl(parsed.ddl);
        setDialect(parsed.dialect);
        setRowCount(parsed.rowCount);
        setSeed(parsed.seed);
        setBatchSize(parsed.batchSize);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const tables = useMemo(() => parseDdl(ddl, dialect), [ddl, dialect]);
  const config: GenerationConfig = useMemo(
    () => ({ rowCount, seed, batchSize, locale: "en" }),
    [rowCount, seed, batchSize],
  );
  const result = useMemo(
    () => (tables.length > 0 ? generateDataset(tables, config) : null),
    [tables, config],
  );

  const output = useMemo(() => {
    if (!result || !result.ok) return "";
    if (format === "sql") return formatDatasetInserts(result.dataset, dialect, batchSize, tables);
    if (format === "csv") return formatDatasetCsv(result.dataset);
    return formatDatasetJson(result.dataset);
  }, [result, format, dialect, batchSize, tables]);

  const totalRows = result && result.ok
    ? Object.values(result.dataset).reduce((sum, t) => sum + t.rows.length, 0)
    : 0;
  const warnings = result && result.ok ? result.warnings : [];

  const applyPreset = useCallback((idx: number) => {
    const p = PRESET_DDL[idx];
    if (p) {
      setDdl(p.ddl);
      setDialect(p.dialect);
      toast.success(`Loaded preset: ${p.label}`);
    }
  }, []);

  const handleClear = useCallback(() => {
    setDdl("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const recordHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      tableCount: tables.length,
      totalRows,
      dialect,
      seed,
    });
    setHistory(loadHistory());
  }, [tables.length, totalRows, dialect, seed]);

  const outputFilename = format === "sql" ? "mock-data.sql" : format === "csv" ? "mock-data.csv" : "mock-data.json";
  const outputMime = format === "sql" ? "text/sql" : format === "csv" ? "text/csv" : "application/json";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Top: dialect + presets + config */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="msdg-dialect" className="text-xs">Dialect</Label>
              <select
                id="msdg-dialect"
                value={dialect}
                onChange={(e) => setDialect(e.target.value as Dialect)}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msdg-rows" className="text-xs">Rows / table</Label>
              <Input
                id="msdg-rows"
                type="number"
                min={0}
                max={100000}
                value={rowCount}
                onChange={(e) => setRowCount(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msdg-seed" className="text-xs">Seed</Label>
              <Input
                id="msdg-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msdg-batch" className="text-xs">INSERT batch size</Label>
              <Input
                id="msdg-batch"
                type="number"
                min={1}
                max={1000}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msdg-preset" className="text-xs">Preset DDL</Label>
              <select
                id="msdg-preset"
                value=""
                onChange={(e) => e.target.value && applyPreset(Number(e.target.value))}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                <option value="">Choose a preset…</option>
                {PRESET_DDL.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="text-[10px]">
              <Table2 className="h-3 w-3 mr-1" />{tables.length} tables
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Database className="h-3 w-3 mr-1" />{totalRows} rows
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Link2 className="h-3 w-3 mr-1" />
              {tables.reduce((sum, t) => sum + t.foreignKeys.length, 0)} FKs
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Hash className="h-3 w-3 mr-1" />seed: {seed}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* DDL input */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4" /> CREATE TABLE DDL
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setDdl(DEFAULT_DDL)} className="text-xs">
              <Wand2 className="h-3 w-3 mr-1" />Reset to sample
            </Button>
          </div>
          <Textarea
            value={ddl}
            onChange={(e) => setDdl(e.target.value)}
            placeholder="Paste one or more CREATE TABLE statements..."
            className="min-h-[200px] font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            The tool parses columns, types, NOT NULL, defaults, ENUM values, inline REFERENCES, table-level FOREIGN KEY clauses, PRIMARY KEY and UNIQUE constraints. Inline REFERENCES are promoted to FK relationships automatically.
          </p>
        </CardContent>
      </Card>

      {/* Parsed tables summary */}
      {tables.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> Parsed tables ({tables.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {tables.map((t) => (
                <div key={t.name} className="rounded border bg-background p-3 text-xs">
                  <div className="font-mono font-semibold text-foreground">{t.name}</div>
                  <div className="text-muted-foreground mt-1">
                    {t.columns.length} columns · {t.foreignKeys.length} FK · {t.uniques.length} unique
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.columns.slice(0, 6).map((c) => (
                      <Badge key={c.name} variant="outline" className="text-[10px] font-mono">
                        {c.name}: {c.sqlType}
                      </Badge>
                    ))}
                    {t.columns.length > 6 && (
                      <Badge variant="outline" className="text-[10px]">+{t.columns.length - 6} more</Badge>
                    )}
                  </div>
                  {t.foreignKeys.length > 0 && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      FKs: {t.foreignKeys.map((f, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          {f.columns.join(",")} → {f.refTable}.{f.refColumns.join(",")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5" />{warnings.length} warning(s)
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-muted-foreground">• {w}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Output format selector */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Output
            </h3>
            <div className="flex gap-2">
              {(["sql", "csv", "json"] as OutputFormat[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  onClick={() => setFormat(f)}
                  className="gap-1.5"
                >
                  {f === "sql" && <FileCode className="h-3.5 w-3.5" />}
                  {f === "csv" && <FileText className="h-3.5 w-3.5" />}
                  {f === "json" && <Braces className="h-3.5 w-3.5" />}
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { recordHistory(); return output; }}
              label={`Copy ${format.toUpperCase()}`}
              disabled={!output}
            />
            <DownloadButton
              getText={() => { recordHistory(); return output; }}
              filename={outputFilename}
              mime={outputMime}
              label={`Download .${format}`}
              disabled={!output}
            />
            <ShareButton
              getUrl={() => buildShareUrl({ ddl, dialect, rowCount, seed, batchSize })}
            />
            <ClearButton onClick={handleClear} />
          </div>
          {result && !result.ok ? (
            <ErrorBanner message={result.error} />
          ) : !output ? (
            <EmptyState
              title="Paste CREATE TABLE DDL to generate mock data"
              hint="The tool parses your schema and produces realistic INSERT statements, CSV, or JSON. Choose a preset above to get started."
              icon={<Database className="h-8 w-8" />}
            />
          ) : (
            <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
              {output}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Faker type reference */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Faker type reference ({FAKER_TYPES.length})
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Column types are inferred automatically from the SQL type and column name (e.g. <code>email</code> → email, <code>price</code> → money, <code>created_at</code> → timestamp). To override, manually edit the parsed schema (advanced — not exposed in this UI; consider using the CREATE TABLE Generator tool to design schemas with explicit faker hints).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 text-[10px]">
            {FAKER_TYPES.map((f) => (
              <div key={f.value} className="rounded border bg-background px-2 py-1">
                <span className="font-mono font-medium text-foreground">{f.value}</span>
                <span className="text-muted-foreground ml-1">— {f.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.dialect}</Badge>
                  <span className="text-foreground">{h.tableCount} tables</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="text-foreground">{h.totalRows} rows</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="text-muted-foreground">seed: {h.seed}</span>
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
            <strong className="text-foreground">Privacy:</strong> All mock data generation runs locally. Your DDL and generated data never leave the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
