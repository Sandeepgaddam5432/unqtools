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
  DEFAULT_OPTIONS,
  SAMPLE_SOURCE_DDL,
  SAMPLE_TARGET_DDL,
  OBJECT_TYPE_LABELS,
  parseSchema,
  diffSchemas,
  generateMigration,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DiffOptions,
  type ChangeEvent,
  type HistoryEntry,
} from "./logic";
import {
  History, GitCompareArrows, Database, AlertTriangle,
  Plus, Minus, Pencil, FileCode,
} from "lucide-react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "table", label: "Tables" },
  { value: "column", label: "Columns" },
  { value: "primaryKey", label: "Primary Keys" },
  { value: "foreignKey", label: "Foreign Keys" },
  { value: "unique", label: "Unique" },
  { value: "check", label: "Check" },
  { value: "index", label: "Indexes" },
] as const;

export default function DatabaseSchemaDiff() {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [opts, setOpts] = useState<DiffOptions>({ ...DEFAULT_OPTIONS });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts(p);
      toast.info("Loaded options from share link");
    }
  }, []);

  const sourceParse = useMemo(() => (source.trim() ? parseSchema(source) : null), [source]);
  const targetParse = useMemo(() => (target.trim() ? parseSchema(target) : null), [target]);

  const diff = useMemo(() => {
    if (!sourceParse || !targetParse) return null;
    return diffSchemas(sourceParse.schema, targetParse.schema, opts);
  }, [sourceParse, targetParse, opts]);

  const migration = useMemo(() => {
    if (!sourceParse || !targetParse) return null;
    return generateMigration(sourceParse.schema, targetParse.schema, opts);
  }, [sourceParse, targetParse, opts]);

  const filteredChanges = useMemo(() => {
    if (!diff) return [];
    if (filter === "all") return diff.changes;
    return diff.changes.filter((c) => c.objectType === filter);
  }, [diff, filter]);

  const setOpt = useCallback(
    <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleLoadSample = useCallback(() => {
    setSource(SAMPLE_SOURCE_DDL);
    setTarget(SAMPLE_TARGET_DDL);
    toast.info("Loaded sample DDL");
  }, []);

  const handleClear = useCallback(() => {
    setSource("");
    setTarget("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (diff && migration?.ok) {
      saveHistory({
        ts: Date.now(),
        dialect: opts.dialect,
        direction: opts.direction,
        sourcePreview: source.slice(0, 80),
        targetPreview: target.slice(0, 80),
        totalChanges: diff.stats.total,
        dataLossOps: diff.stats.dataLossOps,
        statementCount: migration.statementCount,
      });
      setHistory(loadHistory());
    }
  }, [diff, migration, opts, source, target]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" /> DDL input
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!source && !target} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dsd-source" className="text-xs font-medium">
                Source schema (DDL)
              </Label>
              <Textarea
                id="dsd-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={"-- older schema\nCREATE TABLE users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255)\n);"}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              {sourceParse && (
                <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="outline">{sourceParse.schema.tables.length} tables</Badge>
                  <Badge variant="outline">{sourceParse.schema.tables.reduce((n, t) => n + t.columns.length, 0)} columns</Badge>
                  <Badge variant="outline">{sourceParse.schema.standaloneIndexes.length} indexes</Badge>
                  {sourceParse.errors.length > 0 && (
                    <Badge variant="outline" className="text-yellow-700 dark:text-yellow-300">
                      {sourceParse.errors.length} parse errors
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="dsd-target" className="text-xs font-medium">
                Target schema (DDL)
              </Label>
              <Textarea
                id="dsd-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={"-- newer schema\nCREATE TABLE users (\n  id INT PRIMARY KEY,\n  email VARCHAR(320),\n  username VARCHAR(50)\n);"}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              {targetParse && (
                <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="outline">{targetParse.schema.tables.length} tables</Badge>
                  <Badge variant="outline">{targetParse.schema.tables.reduce((n, t) => n + t.columns.length, 0)} columns</Badge>
                  <Badge variant="outline">{targetParse.schema.standaloneIndexes.length} indexes</Badge>
                  {targetParse.errors.length > 0 && (
                    <Badge variant="outline" className="text-yellow-700 dark:text-yellow-300">
                      {targetParse.errors.length} parse errors
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <GitCompareArrows className="h-4 w-4" /> Diff & migration options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Dialect">
              <select
                value={opts.dialect}
                onChange={(e) => setOpt("dialect", e.target.value as DiffOptions["dialect"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Direction">
              <select
                value={opts.direction}
                onChange={(e) => setOpt("direction", e.target.value as DiffOptions["direction"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="forward">source → target</option>
                <option value="reverse">target → source</option>
              </select>
            </Field>
            <Field label="Ignore case">
              <input type="checkbox" checked={opts.ignoreCase} onChange={(e) => setOpt("ignoreCase", e.target.checked)} />
            </Field>
            <Field label="Ignore column order">
              <input type="checkbox" checked={opts.ignoreColumnOrder} onChange={(e) => setOpt("ignoreColumnOrder", e.target.checked)} />
            </Field>
            <Field label="Include drops">
              <input type="checkbox" checked={opts.includeDrops} onChange={(e) => setOpt("includeDrops", e.target.checked)} />
            </Field>
            <Field label="Data-loss warnings">
              <input type="checkbox" checked={opts.includeDataLossWarnings} onChange={(e) => setOpt("includeDataLossWarnings", e.target.checked)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {diff && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <GitCompareArrows className="h-4 w-4" /> Diff ({diff.changes.length} changes)
              </h3>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <Stat label="Tables +" value={diff.stats.tablesAdded} highlight="good" />
              <Stat label="Tables −" value={diff.stats.tablesRemoved} highlight="bad" />
              <Stat label="Cols +" value={diff.stats.columnsAdded} highlight="good" />
              <Stat label="Cols −" value={diff.stats.columnsRemoved} highlight="bad" />
              <Stat label="Cols ~" value={diff.stats.columnsModified} />
              <Stat label="Indexes +" value={diff.stats.indexesAdded} highlight="good" />
              <Stat label="Indexes −" value={diff.stats.indexesRemoved} highlight="bad" />
              <Stat label="Constraints +" value={diff.stats.constraintsAdded} highlight="good" />
              <Stat label="Constraints −" value={diff.stats.constraintsRemoved} highlight="bad" />
              <Stat label="Total" value={diff.stats.total} />
              <Stat label="Data-loss ops" value={diff.stats.dataLossOps} highlight={diff.stats.dataLossOps > 0 ? "bad" : undefined} />
              <Stat label="Direction" value={opts.direction === "forward" ? "src→tgt" : "tgt→src"} />
            </div>
            {diff.stats.dataLossOps > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {diff.stats.dataLossOps} operation(s) may cause data loss. Review the diff tree
                  and migration script carefully before applying.
                </span>
              </div>
            )}
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {filteredChanges.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No changes of this type.</p>
              ) : (
                filteredChanges.map((c, i) => <ChangeRow key={i} c={c} />)
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {migration?.ok && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> Migration script
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return migration.sql; }} label="Copy SQL" />
                <DownloadButton
                  getText={() => { handleRecordHistory(); return migration.sql; }}
                  filename="migration.sql"
                  mime="application/sql"
                  label="Download .sql"
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <Textarea readOnly value={migration.sql} className="min-h-[260px] resize-y font-mono text-xs" />
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{migration.statementCount} statements</Badge>
              <Badge variant="outline">{migration.sql.length} bytes</Badge>
              {migration.dataLossOps > 0 && (
                <Badge variant="outline" className="text-yellow-700 dark:text-yellow-300">
                  {migration.dataLossOps} data-loss ops
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {source.trim() && target.trim() && (sourceParse?.errors.length || targetParse?.errors.length) ? (
        <ErrorBanner message="One or more DDL scripts had parse errors — review the badges above. The diff and migration are best-effort." />
      ) : null}

      {!source.trim() && !target.trim() && (
        <EmptyState
          title="Paste two DDL scripts to diff"
          hint="The tool parses CREATE TABLE and CREATE INDEX statements, computes a structural diff, and generates a dependency-ordered ALTER TABLE migration script. 100% client-side."
          icon={<GitCompareArrows className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.direction}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.totalChanges} changes</Badge>
                    {h.dataLossOps > 0 && (
                      <Badge variant="outline" className="text-[10px] text-yellow-700 dark:text-yellow-300">
                        {h.dataLossOps} data-loss
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">
                    {h.sourcePreview} → {h.targetPreview}
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
            <strong className="text-foreground">Privacy:</strong> DDL is parsed and diffed entirely in your
            browser. Nothing is uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeRow({ c }: { c: ChangeEvent }) {
  const icon =
    c.kind === "added" ? <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> :
    c.kind === "removed" ? <Minus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> :
    <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
  const border =
    c.kind === "added" ? "border-l-2 border-l-emerald-500" :
    c.kind === "removed" ? "border-l-2 border-l-red-500" :
    "border-l-2 border-l-amber-500";
  return (
    <div className={`flex items-start gap-2 rounded border bg-background px-3 py-1.5 text-xs ${border}`}>
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{OBJECT_TYPE_LABELS[c.objectType]}</Badge>
          <span className="font-mono text-foreground">{c.summary}</span>
          {c.dataLoss && (
            <Badge variant="outline" className="text-[10px] text-yellow-700 dark:text-yellow-300 border-yellow-500/40">
              <AlertTriangle className="h-3 w-3 mr-0.5" /> data loss
            </Badge>
          )}
        </div>
        {c.from !== null && c.to !== null && (
          <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
            <span className="line-through">{c.from}</span> → <span>{c.to}</span>
          </div>
        )}
      </div>
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
