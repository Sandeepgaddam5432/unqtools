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
  TYPE_LIST,
  PRESET_MODELS,
  dialectInfo,
  buildCreateTable,
  buildDropTable,
  buildSeedInserts,
  buildDdl,
  validateModel,
  inferFromCsv,
  inferFromJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  newId,
  type Dialect,
  type ColumnDef,
  type ForeignKeyDef,
  type UniqueDef,
  type CheckDef,
  type IndexDef,
  type TableModel,
  type ValidationIssue,
  type HistoryEntry,
  type OnAction,
} from "./logic";
import {
  History, Database, Plus, Trash2, AlertTriangle, Info,
  Table2, Key, Link2, CheckCircle2, FileCode, Wand2, GripVertical,
} from "lucide-react";

const ON_ACTIONS: OnAction[] = ["cascade", "set null", "set default", "restrict", "no action"];

function emptyModel(): TableModel {
  return {
    name: "my_table",
    dialect: "mysql",
    columns: [
      { id: newId("col"), name: "id", type: "bigint", nullable: false, autoIncrement: true },
      { id: newId("col"), name: "name", type: "varchar", length: 255, nullable: false },
    ],
    primaryKey: [],
    foreignKeys: [],
    uniques: [],
    checks: [],
    indexes: [],
    options: { ifNotExists: true, engine: "InnoDB", charset: "utf8mb4" },
  };
}

export default function CreateTableGenerator() {
  const [model, setModel] = useState<TableModel>(emptyModel);
  const [seedCount, setSeedCount] = useState(3);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [csvInput, setCsvInput] = useState("");
  const [showCsv, setShowCsv] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setModel(parsed);
        toast.info("Loaded model from share link");
      }
    }
  }, []);

  const info = dialectInfo(model.dialect);
  const issues = useMemo(() => validateModel(model), [model]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const ddl = useMemo(() => buildDdl(model, seedCount), [model, seedCount]);

  const update = useCallback((patch: Partial<TableModel>) => {
    setModel((m) => ({ ...m, ...patch }));
  }, []);

  const updateOptions = useCallback((patch: Partial<TableModel["options"]>) => {
    setModel((m) => ({ ...m, options: { ...m.options, ...patch } }));
  }, []);

  const addColumn = useCallback(() => {
    setModel((m) => ({
      ...m,
      columns: [...m.columns, { id: newId("col"), name: `col_${m.columns.length + 1}`, type: "varchar", length: 255, nullable: true }],
    }));
  }, []);

  const updateColumn = useCallback((id: string, patch: Partial<ColumnDef>) => {
    setModel((m) => ({
      ...m,
      columns: m.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeColumn = useCallback((id: string) => {
    setModel((m) => ({
      ...m,
      columns: m.columns.filter((c) => c.id !== id),
      primaryKey: m.primaryKey.filter((pk) => pk !== id),
      foreignKeys: m.foreignKeys.map((fk) => ({ ...fk, columns: fk.columns.filter((c) => c !== id) })).filter((fk) => fk.columns.length > 0),
      uniques: m.uniques.map((u) => ({ ...u, columns: u.columns.filter((c) => c !== id) })).filter((u) => u.columns.length > 0),
      indexes: m.indexes.map((i) => ({ ...i, columns: i.columns.filter((c) => c !== id) })).filter((i) => i.columns.length > 0),
    }));
  }, []);

  const togglePk = useCallback((id: string) => {
    setModel((m) => {
      const pk = m.primaryKey.includes(id)
        ? m.primaryKey.filter((x) => x !== id)
        : [...m.primaryKey, id];
      // Mark PK columns as NOT NULL
      const columns = m.columns.map((c) =>
        pk.includes(c.id) ? { ...c, nullable: false } : c,
      );
      return { ...m, primaryKey: pk, columns };
    });
  }, []);

  const addForeignKey = useCallback(() => {
    setModel((m) => ({
      ...m,
      foreignKeys: [...m.foreignKeys, { id: newId("fk"), columns: [], refTable: "", refColumns: [] }],
    }));
  }, []);

  const updateForeignKey = useCallback((id: string, patch: Partial<ForeignKeyDef>) => {
    setModel((m) => ({
      ...m,
      foreignKeys: m.foreignKeys.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeForeignKey = useCallback((id: string) => {
    setModel((m) => ({ ...m, foreignKeys: m.foreignKeys.filter((f) => f.id !== id) }));
  }, []);

  const addUnique = useCallback(() => {
    setModel((m) => ({
      ...m,
      uniques: [...m.uniques, { id: newId("uq"), columns: [] }],
    }));
  }, []);

  const updateUnique = useCallback((id: string, patch: Partial<UniqueDef>) => {
    setModel((m) => ({
      ...m,
      uniques: m.uniques.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }));
  }, []);

  const removeUnique = useCallback((id: string) => {
    setModel((m) => ({ ...m, uniques: m.uniques.filter((u) => u.id !== id) }));
  }, []);

  const addCheck = useCallback(() => {
    setModel((m) => ({
      ...m,
      checks: [...m.checks, { id: newId("ck"), expression: "" }],
    }));
  }, []);

  const updateCheck = useCallback((id: string, patch: Partial<CheckDef>) => {
    setModel((m) => ({
      ...m,
      checks: m.checks.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeCheck = useCallback((id: string) => {
    setModel((m) => ({ ...m, checks: m.checks.filter((c) => c.id !== id) }));
  }, []);

  const addIndex = useCallback(() => {
    setModel((m) => ({
      ...m,
      indexes: [...m.indexes, { id: newId("idx"), columns: [] }],
    }));
  }, []);

  const updateIndex = useCallback((id: string, patch: Partial<IndexDef>) => {
    setModel((m) => ({
      ...m,
      indexes: m.indexes.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const removeIndex = useCallback((id: string) => {
    setModel((m) => ({ ...m, indexes: m.indexes.filter((i) => i.id !== id) }));
  }, []);

  const applyPreset = useCallback((idx: number) => {
    const p = PRESET_MODELS[idx];
    if (p) {
      // Deep clone with fresh ids so user can edit independently
      const clone: TableModel = JSON.parse(JSON.stringify(p.model));
      setModel(clone);
      toast.success(`Loaded preset: ${p.label}`);
    }
  }, []);

  const handleInfer = useCallback(() => {
    const trimmed = csvInput.trim();
    if (!trimmed) return;
    let inferred: ColumnDef[] = [];
    if (trimmed.startsWith("[")) {
      inferred = inferFromJson(trimmed, model.dialect);
    } else {
      inferred = inferFromCsv(trimmed, model.dialect);
    }
    if (inferred.length === 0) {
      toast.error("Could not infer columns from input");
      return;
    }
    setModel((m) => ({ ...m, columns: [...m.columns, ...inferred] }));
    toast.success(`Inferred ${inferred.length} columns`);
    setCsvInput("");
    setShowCsv(false);
  }, [csvInput, model.dialect]);

  const handleClear = useCallback(() => {
    setModel(emptyModel());
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
      tableName: model.name,
      dialect: model.dialect,
      columnCount: model.columns.length,
      fkCount: model.foreignKeys.length,
      indexCount: model.indexes.length,
    });
    setHistory(loadHistory());
  }, [model]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Top: table name + dialect + presets */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctg-table-name" className="text-xs">Table name</Label>
              <Input
                id="ctg-table-name"
                value={model.name}
                onChange={(e) => update({ name: e.target.value })}
                className="font-mono text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-dialect" className="text-xs">Dialect</Label>
              <select
                id="ctg-dialect"
                value={model.dialect}
                onChange={(e) => update({ dialect: e.target.value as Dialect })}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-preset" className="text-xs">Preset schemas</Label>
              <select
                id="ctg-preset"
                value=""
                onChange={(e) => e.target.value && applyPreset(Number(e.target.value))}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                <option value="">Choose a preset…</option>
                {PRESET_MODELS.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="text-[10px]">
              <Table2 className="h-3 w-3 mr-1" />{model.columns.length} columns
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Key className="h-3 w-3 mr-1" />PK: {model.primaryKey.length}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Link2 className="h-3 w-3 mr-1" />FK: {model.foreignKeys.length}
            </Badge>
            <Badge variant="outline" className="text-[10px]">UQ: {model.uniques.length}</Badge>
            <Badge variant="outline" className="text-[10px]">CHK: {model.checks.length}</Badge>
            <Badge variant="outline" className="text-[10px]">IDX: {model.indexes.length}</Badge>
            <Badge variant="outline" className="text-[10px]">Max ident: {info.maxIdentifierLength}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Validation issues */}
      {errors.length > 0 && (
        <ErrorBanner message={`${errors.length} error(s): ${errors[0].message}`} />
      )}
      {warnings.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3.5 w-3.5" />{warnings.length} warning(s)
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-muted-foreground">• {w.message}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Columns */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Columns
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCsv((s) => !s)} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />Infer from CSV/JSON
              </Button>
              <Button size="sm" onClick={addColumn} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Add column
              </Button>
            </div>
          </div>
          {showCsv && (
            <div className="space-y-2 rounded border bg-muted/30 p-3">
              <Label className="text-xs">Paste CSV (with header) or JSON array of objects</Label>
              <Textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder={"id,name,active\n1,alice,true\n2,bob,false"}
                className="min-h-[100px] font-mono text-xs"
              />
              <Button size="sm" onClick={handleInfer} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />Infer & append columns
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-1 pr-1"></th>
                  <th className="py-1 pr-2">PK</th>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Type</th>
                  <th className="py-1 pr-2">Len</th>
                  <th className="py-1 pr-2">Scale</th>
                  <th className="py-1 pr-2">Null</th>
                  <th className="py-1 pr-2">Default</th>
                  <th className="py-1 pr-2">Expr?</th>
                  <th className="py-1 pr-2">AI</th>
                  {model.dialect === "mysql" && <th className="py-1 pr-2">U</th>}
                  <th className="py-1 pr-2">Comment</th>
                  <th className="py-1 pr-2">Enum values</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {model.columns.map((col) => (
                  <tr key={col.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="py-1 pr-1 text-muted-foreground"><GripVertical className="h-3 w-3" /></td>
                    <td className="py-1 pr-2">
                      <input
                        type="checkbox"
                        checked={model.primaryKey.includes(col.id)}
                        onChange={() => togglePk(col.id)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        value={col.name}
                        onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                        className="h-7 w-28 font-mono text-xs"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        value={col.type}
                        onChange={(e) => updateColumn(col.id, { type: e.target.value as ColumnDef["type"] })}
                        className="h-7 rounded border bg-background px-1 text-xs w-24"
                      >
                        {TYPE_LIST[model.dialect].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="enum">enum</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        value={col.length ?? ""}
                        onChange={(e) => updateColumn(col.id, { length: e.target.value ? Number(e.target.value) : undefined })}
                        className="h-7 w-14 text-xs"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        value={col.scale ?? ""}
                        onChange={(e) => updateColumn(col.id, { scale: e.target.value ? Number(e.target.value) : undefined })}
                        className="h-7 w-14 text-xs"
                      />
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={col.nullable}
                        onChange={(e) => updateColumn(col.id, { nullable: e.target.checked })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        value={col.defaultValue ?? ""}
                        onChange={(e) => updateColumn(col.id, { defaultValue: e.target.value })}
                        placeholder="(none)"
                        className="h-7 w-24 font-mono text-xs"
                      />
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!col.defaultIsExpression}
                        onChange={(e) => updateColumn(col.id, { defaultIsExpression: e.target.checked })}
                        title="Treat default as expression (e.g. CURRENT_TIMESTAMP)"
                      />
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!col.autoIncrement}
                        onChange={(e) => updateColumn(col.id, { autoIncrement: e.target.checked })}
                      />
                    </td>
                    {model.dialect === "mysql" && (
                      <td className="py-1 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!col.unsigned}
                          onChange={(e) => updateColumn(col.id, { unsigned: e.target.checked })}
                        />
                      </td>
                    )}
                    <td className="py-1 pr-2">
                      <Input
                        value={col.comment ?? ""}
                        onChange={(e) => updateColumn(col.id, { comment: e.target.value })}
                        placeholder="(none)"
                        className="h-7 w-24 text-xs"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        value={(col.enumValues ?? []).join(",")}
                        onChange={(e) => updateColumn(col.id, { enumValues: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : [] })}
                        placeholder="a,b,c"
                        className="h-7 w-28 font-mono text-xs"
                        disabled={col.type !== "enum"}
                      />
                    </td>
                    <td className="py-1">
                      <Button variant="ghost" size="icon" onClick={() => removeColumn(col.id)} className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Foreign Keys */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Link2 className="h-4 w-4" /> Foreign Keys
            </h3>
            <Button size="sm" variant="outline" onClick={addForeignKey} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />Add FK
            </Button>
          </div>
          {model.foreignKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">No foreign keys. Click "Add FK" to define one.</p>
          ) : (
            <div className="space-y-2">
              {model.foreignKeys.map((fk) => (
                <div key={fk.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center rounded border bg-background p-2">
                  <select
                    multiple
                    value={fk.columns}
                    onChange={(e) => updateForeignKey(fk.id, { columns: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                    className="h-16 rounded border bg-background px-1 text-xs"
                    size={Math.min(4, Math.max(2, model.columns.length))}
                  >
                    {model.columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Input
                    value={fk.refTable}
                    onChange={(e) => updateForeignKey(fk.id, { refTable: e.target.value })}
                    placeholder="ref_table"
                    className="h-8 font-mono text-xs"
                  />
                  <Input
                    value={fk.refColumns.join(",")}
                    onChange={(e) => updateForeignKey(fk.id, { refColumns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="ref_col1,ref_col2"
                    className="h-8 font-mono text-xs"
                  />
                  <select
                    value={fk.onDelete ?? ""}
                    onChange={(e) => updateForeignKey(fk.id, { onDelete: (e.target.value || undefined) as OnAction | undefined })}
                    className="h-8 rounded border bg-background px-1 text-xs"
                  >
                    <option value="">ON DELETE (none)</option>
                    {ON_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={fk.onUpdate ?? ""}
                    onChange={(e) => updateForeignKey(fk.id, { onUpdate: (e.target.value || undefined) as OnAction | undefined })}
                    className="h-8 rounded border bg-background px-1 text-xs"
                  >
                    <option value="">ON UPDATE (none)</option>
                    {ON_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeForeignKey(fk.id)} className="h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unique + Check + Index in a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Unique
              </h3>
              <Button size="sm" variant="ghost" onClick={addUnique}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {model.uniques.map((u) => (
              <div key={u.id} className="flex gap-2 items-center">
                <Input
                  value={u.name ?? ""}
                  onChange={(e) => updateUnique(u.id, { name: e.target.value || undefined })}
                  placeholder="name?"
                  className="h-7 w-20 text-xs"
                />
                <select
                  multiple
                  value={u.columns}
                  onChange={(e) => updateUnique(u.id, { columns: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                  className="flex-1 h-16 rounded border bg-background px-1 text-xs"
                  size={3}
                >
                  {model.columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button variant="ghost" size="icon" onClick={() => removeUnique(u.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {model.uniques.length === 0 && <p className="text-xs text-muted-foreground">No unique constraints.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Check
              </h3>
              <Button size="sm" variant="ghost" onClick={addCheck}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {model.checks.map((c) => (
              <div key={c.id} className="flex gap-2 items-center">
                <Input
                  value={c.name ?? ""}
                  onChange={(e) => updateCheck(c.id, { name: e.target.value || undefined })}
                  placeholder="name?"
                  className="h-7 w-20 text-xs"
                />
                <Input
                  value={c.expression}
                  onChange={(e) => updateCheck(c.id, { expression: e.target.value })}
                  placeholder="age >= 0"
                  className="flex-1 h-7 font-mono text-xs"
                />
                <Button variant="ghost" size="icon" onClick={() => removeCheck(c.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {model.checks.length === 0 && <p className="text-xs text-muted-foreground">No CHECK constraints.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Indexes
              </h3>
              <Button size="sm" variant="ghost" onClick={addIndex}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {model.indexes.map((idx) => (
              <div key={idx.id} className="space-y-1 rounded border bg-background p-2">
                <div className="flex gap-2 items-center">
                  <Input
                    value={idx.name ?? ""}
                    onChange={(e) => updateIndex(idx.id, { name: e.target.value || undefined })}
                    placeholder="name?"
                    className="h-7 w-20 text-xs"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!idx.unique}
                      onChange={(e) => updateIndex(idx.id, { unique: e.target.checked })}
                    />UNIQUE
                  </label>
                  <select
                    value={idx.method ?? ""}
                    onChange={(e) => updateIndex(idx.id, { method: (e.target.value || undefined) as IndexDef["method"] })}
                    className="h-7 rounded border bg-background px-1 text-xs"
                  >
                    <option value="">auto</option>
                    <option value="btree">BTREE</option>
                    {model.dialect === "postgresql" && <option value="hash">HASH</option>}
                    {model.dialect === "postgresql" && <option value="gin">GIN</option>}
                    {model.dialect === "postgresql" && <option value="gist">GIST</option>}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeIndex(idx.id)} className="h-7 w-7 ml-auto">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <select
                  multiple
                  value={idx.columns}
                  onChange={(e) => updateIndex(idx.id, { columns: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                  className="w-full h-16 rounded border bg-background px-1 text-xs"
                  size={3}
                >
                  {model.columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {model.indexes.length === 0 && <p className="text-xs text-muted-foreground">No indexes.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Table options */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileCode className="h-4 w-4" /> Table options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={model.options.ifNotExists}
                onChange={(e) => updateOptions({ ifNotExists: e.target.checked })}
              />IF NOT EXISTS
            </label>
            {info.supportsEngineCharset && (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px]">ENGINE</Label>
                  <Input
                    value={model.options.engine ?? ""}
                    onChange={(e) => updateOptions({ engine: e.target.value || undefined })}
                    className="h-7 text-xs"
                    placeholder="InnoDB"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">CHARSET</Label>
                  <Input
                    value={model.options.charset ?? ""}
                    onChange={(e) => updateOptions({ charset: e.target.value || undefined })}
                    className="h-7 text-xs"
                    placeholder="utf8mb4"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">COLLATE</Label>
                  <Input
                    value={model.options.collate ?? ""}
                    onChange={(e) => updateOptions({ collate: e.target.value || undefined })}
                    className="h-7 text-xs"
                    placeholder="utf8mb4_unicode_ci"
                  />
                </div>
              </>
            )}
            {info.supportsWithoutRowid && (
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={!!model.options.withoutRowid}
                  onChange={(e) => updateOptions({ withoutRowid: e.target.checked })}
                />WITHOUT ROWID
              </label>
            )}
          </div>
          {(info.supportsTableComment || info.supportsInlineComment) && (
            <div className="space-y-1">
              <Label className="text-xs">Table comment</Label>
              <Input
                value={model.options.comment ?? ""}
                onChange={(e) => updateOptions({ comment: e.target.value || undefined })}
                className="h-8 text-sm"
                placeholder="Optional description"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seed count */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="ctg-seed" className="text-xs whitespace-nowrap">Seed INSERTs to generate</Label>
            <Input
              id="ctg-seed"
              type="number"
              min={0}
              max={100}
              value={seedCount}
              onChange={(e) => setSeedCount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="h-8 w-20 text-sm"
            />
            <span className="text-xs text-muted-foreground">(0 = none; max 100)</span>
          </div>
        </CardContent>
      </Card>

      {/* DDL output */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-4 w-4" /> Generated DDL
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { recordHistory(); return buildCreateTable(model); }}
                label="Copy CREATE"
              />
              <CopyButton
                getText={() => buildDropTable(model)}
                label="Copy DROP"
              />
              <CopyButton
                getText={() => buildSeedInserts(model, seedCount)}
                label="Copy INSERTs"
                disabled={seedCount === 0}
              />
              <DownloadButton
                getText={() => { recordHistory(); return ddl.full; }}
                filename={`${model.name || "table"}.sql`}
                mime="text/sql"
                label="Download .sql"
              />
              <ShareButton getUrl={() => buildShareUrl(model)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          {errors.length > 0 ? (
            <ErrorBanner message={`Cannot render: ${errors[0].message}`} />
          ) : (
            <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
              {ddl.full}
            </pre>
          )}
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
                  <span className="font-mono text-foreground">{h.tableName}</span>
                  <span className="text-muted-foreground ml-2">
                    · {h.columnCount} cols · {h.fkCount} FK · {h.indexCount} idx
                  </span>
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
            <strong className="text-foreground">Privacy:</strong> All DDL generation runs locally. The schema model and history are stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
