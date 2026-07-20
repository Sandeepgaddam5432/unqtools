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
  ORM_TARGETS,
  NAMING_STRATEGIES,
  DDL_PRESETS,
  parseDdl,
  generateOrm,
  convertDdlToOrm,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type OrmTarget,
  type NamingStrategy,
  type HistoryEntry,
  type OrmNote,
} from "./logic";
import {
  History,
  Database,
  AlertTriangle,
  Info,
  AlertOctagon,
  Wand2,
  FileCode,
  Table2,
} from "lucide-react";

export default function SqlToOrmCodeConverter() {
  const [ddl, setDdl] = useState("");
  const [target, setTarget] = useState<OrmTarget>("prisma");
  const [naming, setNaming] = useState<NamingStrategy>("camelcase");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAllTargets, setShowAllTargets] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.ddl) setDdl(p.ddl);
        setTarget(p.target);
        setNaming(p.naming);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const schema = useMemo(() => (ddl.trim() ? parseDdl(ddl) : null), [ddl]);

  const result = useMemo(() => {
    if (!ddl.trim()) return null;
    return convertDdlToOrm(ddl, { target, naming });
  }, [ddl, target, naming]);

  const allResults = useMemo(() => {
    if (!ddl.trim() || !schema || schema.tables.length === 0) return [];
    return ORM_TARGETS.map((t) =>
      generateOrm(schema, { target: t.value, naming }),
    );
  }, [ddl, schema, naming]);

  const notes: OrmNote[] = useMemo(() => {
    if (!result || !result.ok) return [];
    return result.notes;
  }, [result]);

  const handleSaveHistory = useCallback(() => {
    if (schema && schema.tables.length > 0) {
      saveHistory({
        ts: Date.now(),
        target,
        naming,
        tableCount: schema.tables.length,
        preview: schema.tables.map((t) => t.name).join(", ").slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [schema, target, naming]);

  const handleClear = useCallback(() => {
    setDdl("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadPreset = (id: string) => {
    const p = DDL_PRESETS.find((x) => x.id === id);
    if (p) {
      setDdl(p.ddl);
      toast.info(`Loaded preset: ${p.label}`);
    }
  };

  const currentCode = useMemo(() => {
    if (showAllTargets && allResults.length > 0) {
      return allResults
        .map((r) => `// === ${r.target.toUpperCase()} ===\n${r.code}`)
        .join("\n\n");
    }
    if (result && result.ok && result.results[0]) {
      return result.results[0].code;
    }
    return "";
  }, [showAllTargets, allResults, result]);

  const fileExtension = target === "sqlalchemy" || target === "django" ? "py" : target === "prisma" ? "prisma" : "ts";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="s2o-ddl">CREATE TABLE DDL</Label>
              <div className="flex flex-wrap gap-1">
                {DDL_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => loadPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              id="s2o-ddl"
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              placeholder={"CREATE TABLE users (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  email VARCHAR(255) NOT NULL UNIQUE,\n  role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n);"}
              className="min-h-[200px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target ORM</Label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as OrmTarget)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {ORM_TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Naming strategy</Label>
              <select
                value={naming}
                onChange={(e) => setNaming(e.target.value as NamingStrategy)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {NAMING_STRATEGIES.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="s2o-all-targets"
              type="checkbox"
              checked={showAllTargets}
              onChange={(e) => setShowAllTargets(e.target.checked)}
            />
            <label htmlFor="s2o-all-targets" className="text-xs cursor-pointer">
              Generate all 6 targets (combined output)
            </label>
          </div>
        </CardContent>
      </Card>

      {result && !result.ok && (
        <ErrorBanner message={result.error} />
      )}

      {schema && schema.tables.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table2 className="h-4 w-4" /> Parsed schema ({schema.tables.length} tables)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Tables" value={schema.tables.length} />
                <Stat label="Columns" value={schema.tables.reduce((a, t) => a + t.columns.length, 0)} />
                <Stat label="Foreign keys" value={schema.tables.reduce((a, t) => a + t.foreignKeys.length, 0)} />
                <Stat label="Indexes" value={schema.tables.reduce((a, t) => a + t.indexes.length, 0)} />
              </div>
              <div className="space-y-1 pt-2">
                {schema.tables.map((t) => (
                  <div key={t.name} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-foreground">{t.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.columns.length} cols</Badge>
                      {t.foreignKeys.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">{t.foreignKeys.length} FK</Badge>
                      )}
                      {t.indexes.filter((i) => !i.primary).length > 0 && (
                        <Badge variant="outline" className="text-[10px]">{t.indexes.filter((i) => !i.primary).length} idx</Badge>
                      )}
                      {t.checks.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">{t.checks.length} CHECK</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {notes.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Notes ({notes.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {notes.map((n, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-start gap-2">
                      <NoteBadge severity={n.severity} />
                      <span className="font-mono text-[10px] text-muted-foreground">{n.table}:</span>
                      <span className="text-foreground">{n.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileCode className="h-4 w-4" />
                  {showAllTargets ? "All 6 ORM targets" : ORM_TARGETS.find((t) => t.value === target)?.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return currentCode; }}
                    label="Copy code"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return currentCode; }}
                    filename={`schema.${fileExtension}`}
                    mime="text/plain"
                    label={`Download .${fileExtension}`}
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(ddl, target, naming); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[500px] text-foreground whitespace-pre">
                {currentCode || "// (no output)"}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste CREATE TABLE DDL to generate ORM models"
          hint="Supports Prisma, Sequelize, TypeORM, Drizzle, SQLAlchemy, and Django. Click a preset to try it out, or paste your own schema."
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
                  <Badge variant="outline" className="mr-2">{h.target}</Badge>
                  <Badge variant="outline" className="mr-2">{h.naming}</Badge>
                  <Badge variant="outline" className="mr-2">{h.tableCount} tables</Badge>
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
            <strong className="text-foreground">Honesty:</strong> Always test generated models against your schema. Unmappable constructs (CHECK constraints, vendor-specific types) are flagged in the notes rather than silently dropped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function NoteBadge({ severity }: { severity: OrmNote["severity"] }) {
  if (severity === "info") {
    return <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 gap-1"><Info className="h-3 w-3" /> info</Badge>;
  }
  if (severity === "warning") {
    return <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 gap-1"><AlertTriangle className="h-3 w-3" /> warn</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400 gap-1"><AlertOctagon className="h-3 w-3" /> manual</Badge>;
}

// Suppress unused-import lint
export type _Unused = typeof Wand2;
