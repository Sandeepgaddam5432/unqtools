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
  DIALECTS,
  DIALECT_LABELS,
  COLUMN_TYPES,
  TYPE_LABELS,
  ON_ACTIONS,
  PRESETS,
  createEmptyModel,
  createColumn,
  addEntity,
  removeEntity,
  renameEntity,
  addColumn,
  updateColumn,
  removeColumn,
  addRelationship,
  removeRelationship,
  generateDdl,
  generateDbml,
  generateMigration,
  topologicalSort,
  validateModel,
  serializeModel,
  deserializeModel,
  importFromSchemaModel,
  parseDbml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summarizeModel,
  type Dialect,
  type DesignerModel,
  type DesignerEntity,
  type DesignerColumn,
  type ColumnType,
  type OnAction,
  type HistoryEntry,
  type ValidationIssue,
} from "./logic";
import {
  History,
  Database,
  AlertTriangle,
  Info,
  AlertOctagon,
  Plus,
  Trash2,
  Table2,
  GitBranch,
  FileCode,
  Boxes,
  Wand2,
} from "lucide-react";

type OutputFormat = "ddl" | "migration" | "dbml" | "json";

const FORMAT_LABELS: Record<OutputFormat, string> = {
  ddl: "CREATE TABLE DDL",
  migration: "Migration script",
  dbml: "DBML",
  json: "Schema JSON",
};

export default function ErDiagramDesigner() {
  const [model, setModel] = useState<DesignerModel>(createEmptyModel());
  const [dialect, setDialect] = useState<Dialect>("postgres");
  const [format, setFormat] = useState<OutputFormat>("ddl");
  const [baselineModel, setBaselineModel] = useState<DesignerModel | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dbmlImport, setDbmlImport] = useState("");
  const [jsonImport, setJsonImport] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.model) {
        setModel(p.model);
        setDialect(p.dialect);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const stats = useMemo(() => summarizeModel(model), [model]);
  const topo = useMemo(() => topologicalSort(model), [model]);
  const issues = useMemo(() => validateModel(model), [model]);

  const output = useMemo(() => {
    if (model.entities.length === 0) return "";
    switch (format) {
      case "ddl": return generateDdl(model, dialect);
      case "migration":
        return baselineModel
          ? generateMigration(baselineModel, model, dialect)
          : "-- Set a baseline (Save baseline) to compute a migration diff.\n-- The current schema DDL is shown below:\n\n" + generateDdl(model, dialect);
      case "dbml": return generateDbml(model);
      case "json": return serializeModel(model);
    }
    return "";
  }, [model, dialect, format, baselineModel]);

  const handleSaveHistory = useCallback(() => {
    if (model.entities.length > 0) {
      saveHistory({
        ts: Date.now(),
        entityCount: model.entities.length,
        columnCount: stats.columns,
        fkCount: model.relationships.length,
        dialect,
        preview: model.entities.map((e) => e.name).slice(0, 5).join(", "),
      });
      setHistory(loadHistory());
    }
  }, [model, dialect, stats]);

  const handleAddEntity = useCallback(() => {
    const name = `table_${model.entities.length + 1}`;
    setModel((m) => addEntity(m, name));
  }, [model.entities.length]);

  const handlePreset = (idx: number) => {
    setModel(PRESETS[idx].build());
    toast.info(`Loaded preset: ${PRESETS[idx].name}`);
  };

  const handleClear = useCallback(() => {
    setModel(createEmptyModel());
    setBaselineModel(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveBaseline = useCallback(() => {
    setBaselineModel(JSON.parse(JSON.stringify(model)) as DesignerModel);
    toast.success("Baseline saved — switch to Migration script to view the diff");
  }, [model]);

  const handleImportDbml = useCallback(() => {
    if (!dbmlImport.trim()) {
      toast.error("Paste DBML first");
      return;
    }
    const parsed = parseDbml(dbmlImport);
    if (parsed.entities.length === 0) {
      toast.error("No tables found in DBML");
      return;
    }
    setModel(parsed);
    toast.success(`Imported ${parsed.entities.length} tables from DBML`);
    setDbmlImport("");
  }, [dbmlImport]);

  const handleImportJson = useCallback(() => {
    if (!jsonImport.trim()) {
      toast.error("Paste JSON first");
      return;
    }
    // Try schema model first (from #267), then designer model
    const imported = importFromSchemaModel(jsonImport) ?? deserializeModel(jsonImport);
    if (!imported) {
      toast.error("Invalid JSON");
      return;
    }
    setModel(imported);
    toast.success(`Imported ${imported.entities.length} tables`);
    setJsonImport("");
  }, [jsonImport]);

  const handleRenameEntity = (entityId: string, name: string) => {
    setModel((m) => renameEntity(m, entityId, name));
  };
  const handleRemoveEntity = (entityId: string) => {
    setModel((m) => removeEntity(m, entityId));
  };
  const handleAddColumn = (entityId: string) => {
    setModel((m) => addColumn(m, entityId));
  };
  const handleUpdateColumn = (entityId: string, colId: string, patch: Partial<DesignerColumn>) => {
    setModel((m) => updateColumn(m, entityId, colId, patch));
  };
  const handleRemoveColumn = (entityId: string, colId: string) => {
    setModel((m) => removeColumn(m, entityId, colId));
  };
  const handleAddRelationship = () => {
    if (model.entities.length < 2) {
      toast.error("Need at least 2 entities to add a relationship");
      return;
    }
    // Default: link first column of last entity to first column of first entity
    const fromE = model.entities[model.entities.length - 1];
    const toE = model.entities[0];
    if (fromE.columns.length === 0 || toE.columns.length === 0) {
      toast.error("Both entities need at least one column");
      return;
    }
    setModel((m) => addRelationship(m, {
      fromTableId: fromE.id,
      fromColumnIds: [fromE.columns[0].id],
      toTableId: toE.id,
      toColumnIds: [toE.columns[0].id],
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    }));
  };
  const handleRemoveRelationship = (relId: string) => {
    setModel((m) => removeRelationship(m, relId));
  };

  const downloadFilename = format === "ddl" ? `schema.${dialect === "sqlserver" ? "sql" : "sql"}`
    : format === "migration" ? "migration.sql"
    : format === "dbml" ? "schema.dbml"
    : "schema.json";
  const downloadMime = format === "json" ? "application/json" : "text/plain";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Boxes className="h-4 w-4" /> Designer
            </h3>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p, i) => (
                <Button key={i} variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => handlePreset(i)}>
                  + {p.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleAddEntity} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add entity
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddRelationship} className="gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Add relationship
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveBaseline} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Save baseline
            </Button>
            {baselineModel && (
              <Badge variant="secondary" className="text-[10px]">
                Baseline: {baselineModel.entities.length} entities
              </Badge>
            )}
            <ClearButton onClick={handleClear} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Import DBML</Label>
              <Textarea
                value={dbmlImport}
                onChange={(e) => setDbmlImport(e.target.value)}
                placeholder={"Table users {\n  id integer [pk]\n  email varchar [unique]\n}\nRef: posts.author_id > users.id"}
                className="min-h-[60px] resize-y font-mono text-[10px]"
              />
              <Button size="sm" variant="outline" onClick={handleImportDbml} className="h-6 text-[11px]">Import DBML</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Import JSON (from #267 or this tool)</Label>
              <Textarea
                value={jsonImport}
                onChange={(e) => setJsonImport(e.target.value)}
                placeholder={'{"tables":[...]} or {"entities":[...], "relationships":[...]}'}
                className="min-h-[60px] resize-y font-mono text-[10px]"
              />
              <Button size="sm" variant="outline" onClick={handleImportJson} className="h-6 text-[11px]">Import JSON</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Validation ({issues.length})
            </h3>
            <div className="space-y-1 max-h-[120px] overflow-auto">
              {issues.map((iss, i) => <IssueRow key={i} issue={iss} />)}
            </div>
          </CardContent>
        </Card>
      )}

      {model.entities.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Schema ({model.entities.length} entities, {model.relationships.length} FKs)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Entities" value={stats.entities} />
                <Stat label="Columns" value={stats.columns} />
                <Stat label="Relationships" value={stats.relationships} />
                <Stat label="Errors" value={stats.pkFkIssues} highlight={stats.pkFkIssues > 0 ? "bad" : "good"} />
              </div>
              {topo.cycles.length > 0 && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>{topo.cycles.length} circular FK chain(s) detected</strong> — tables will still be emitted in name order.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table2 className="h-4 w-4" /> Entities
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {model.entities.map((e) => (
                  <EntityEditor
                    key={e.id}
                    entity={e}
                    model={model}
                    onRename={(name) => handleRenameEntity(e.id, name)}
                    onRemove={() => handleRemoveEntity(e.id)}
                    onAddColumn={() => handleAddColumn(e.id)}
                    onUpdateColumn={(colId, patch) => handleUpdateColumn(e.id, colId, patch)}
                    onRemoveColumn={(colId) => handleRemoveColumn(e.id, colId)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {model.relationships.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4" /> Relationships ({model.relationships.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {model.relationships.map((r) => {
                    const fromE = model.entities.find((e) => e.id === r.fromTableId);
                    const toE = model.entities.find((e) => e.id === r.toTableId);
                    if (!fromE || !toE) return null;
                    const fromCols = r.fromColumnIds.map((id) => fromE.columns.find((c) => c.id === id)?.name).filter(Boolean).join(",");
                    const toCols = r.toColumnIds.map((id) => toE.columns.find((c) => c.id === id)?.name).filter(Boolean).join(",");
                    return (
                      <div key={r.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <Badge variant="secondary" className="text-[10px] font-mono">{fromE.name}.{fromCols}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{toE.name}.{toCols}</Badge>
                        {r.onDelete !== "NO ACTION" && <Badge variant="outline" className="text-[10px]">del: {r.onDelete}</Badge>}
                        {r.onUpdate !== "NO ACTION" && <Badge variant="outline" className="text-[10px]">upd: {r.onUpdate}</Badge>}
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => handleRemoveRelationship(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
                  <FileCode className="h-4 w-4" /> Output
                </h3>
                <div className="flex gap-1">
                  <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value as Dialect)}
                    className="h-7 text-[11px] rounded border bg-background px-2"
                  >
                    {DIALECTS.map((d) => <option key={d} value={d}>{DIALECT_LABELS[d]}</option>)}
                  </select>
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

              {format === "migration" && !baselineModel && (
                <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  <Info className="inline h-3 w-3 mr-1" />
                  Save a baseline first to compute the migration diff. The current schema DDL is shown below as a placeholder.
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
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(model, dialect); }} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Design your schema visually"
          hint="Add entities, columns, and relationships, then generate clean CREATE TABLE DDL for PostgreSQL, MySQL, SQLite, or SQL Server. Click a preset to start, or import DBML / schema JSON from the SQL DDL to ER Diagram Generator (#267)."
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.entityCount} entities</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.columnCount} cols</Badge>
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
            <strong className="text-foreground">Privacy:</strong> 100% client-side. Your schema never leaves the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Entity editor ----------

function EntityEditor({
  entity,
  model,
  onRename,
  onRemove,
  onAddColumn,
  onUpdateColumn,
  onRemoveColumn,
}: {
  entity: DesignerEntity;
  model: DesignerModel;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddColumn: () => void;
  onUpdateColumn: (colId: string, patch: Partial<DesignerColumn>) => void;
  onRemoveColumn: (colId: string) => void;
}) {
  return (
    <div className="rounded border bg-background p-2">
      <div className="flex items-center gap-2 mb-2">
        <Input
          value={entity.name}
          onChange={(e) => onRename(e.target.value)}
          className="h-7 text-xs font-mono font-semibold flex-1"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove} title="Remove entity">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {entity.columns.map((c) => (
          <ColumnEditor
            key={c.id}
            column={c}
            isPkInFk={model.relationships.some(
              (r) => r.fromTableId === entity.id && r.fromColumnIds.includes(c.id)
                || r.toTableId === entity.id && r.toColumnIds.includes(c.id),
            )}
            onUpdate={(patch) => onUpdateColumn(c.id, patch)}
            onRemove={() => onRemoveColumn(c.id)}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="h-6 text-[11px] mt-1" onClick={onAddColumn}>
        <Plus className="h-3 w-3 mr-1" /> Add column
      </Button>
    </div>
  );
}

function ColumnEditor({
  column,
  isPkInFk,
  onUpdate,
  onRemove,
}: {
  column: DesignerColumn;
  isPkInFk: boolean;
  onUpdate: (patch: Partial<DesignerColumn>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-1 items-center text-[10px]">
      <input
        type="checkbox"
        checked={column.primaryKey}
        onChange={(e) => onUpdate({ primaryKey: e.target.checked, nullable: e.target.checked ? false : column.nullable })}
        title="Primary key"
        className="col-span-1 h-3 w-3"
      />
      <Input
        value={column.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="col-span-3 h-6 text-[10px] font-mono"
      />
      <select
        value={column.type}
        onChange={(e) => onUpdate({ type: e.target.value as ColumnType })}
        className="col-span-4 h-6 text-[10px] rounded border bg-background px-1"
        title={TYPE_LABELS[column.type]}
      >
        {COLUMN_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>
      <Input
        type="number"
        value={column.length ?? ""}
        onChange={(e) => onUpdate({ length: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="len"
        className="col-span-2 h-6 text-[10px]"
        title="Length / precision"
      />
      <input
        type="checkbox"
        checked={!column.nullable}
        onChange={(e) => onUpdate({ nullable: !e.target.checked })}
        title="NOT NULL"
        className="col-span-1 h-3 w-3"
      />
      <Button variant="ghost" size="icon" className="col-span-1 h-5 w-5" onClick={onRemove} title="Remove column" disabled={isPkInFk}>
        <Trash2 className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}

// ---------- helpers ----------

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

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const Icon = issue.severity === "error" ? AlertOctagon
    : issue.severity === "warning" ? AlertTriangle
    : Info;
  const color = issue.severity === "error"
    ? "text-red-600 dark:text-red-400"
    : issue.severity === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-blue-600 dark:text-blue-400";
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${color}`} />
      <span className="text-foreground">{issue.message}</span>
    </div>
  );
}
