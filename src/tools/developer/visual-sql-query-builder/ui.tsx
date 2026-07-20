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
  JOIN_TYPES,
  WHERE_OPERATORS,
  AGGREGATES,
  SORT_DIRECTIONS,
  PRESETS,
  SAMPLE_SCHEMA_JSON,
  createEmptyModel,
  createId,
  buildSql,
  validateModel,
  parseSchemaJson,
  modelFromSchema,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QueryModel,
  type SqlDialect,
  type TableRef,
  type ColumnRef,
  type JoinDef,
  type Predicate,
  type OrderByClause,
  type GroupByColumn,
  type WhereOperator,
  type JoinType,
  type SortDirection,
  type LogicalOp,
  type HistoryEntry,
} from "./logic";
import { History, Database, Wand2, Plus, Trash2, Table2, Filter, GitBranch, ArrowDownUp, Layers } from "lucide-react";

export default function VisualSqlQueryBuilder() {
  const [model, setModel] = useState<QueryModel>(createEmptyModel);
  const [dialect, setDialect] = useState<SqlDialect>("ansi");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [schemaText, setSchemaText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.model) {
        setModel(p.model);
        toast.info("Loaded query from share link");
      }
      if (p.dialect) setDialect(p.dialect);
    }
  }, []);

  const issues = useMemo(() => validateModel(model), [model]);
  const result = useMemo(() => buildSql(model, dialect), [model, dialect]);
  const sql = result.ok ? result.sql : "";
  const warnings = result.ok ? result.warnings : [];

  // ---- table ops ----
  const addTable = useCallback(() => {
    setModel((m) => ({
      ...m,
      tables: [...m.tables, { id: createId("t"), name: `table_${m.tables.length + 1}` }],
    }));
  }, []);
  const updateTable = useCallback((id: string, patch: Partial<TableRef>) => {
    setModel((m) => ({
      ...m,
      tables: m.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);
  const removeTable = useCallback((id: string) => {
    setModel((m) => ({
      ...m,
      tables: m.tables.filter((t) => t.id !== id),
      columns: m.columns.filter((c) => c.tableId !== id),
      joins: m.joins.filter((j) => j.leftTableId !== id),
    }));
  }, []);

  // ---- column ops ----
  const addColumn = useCallback(() => {
    setModel((m) => ({
      ...m,
      columns: [...m.columns, { id: createId("c"), name: "col" }],
    }));
  }, []);
  const updateColumn = useCallback((id: string, patch: Partial<ColumnRef>) => {
    setModel((m) => ({
      ...m,
      columns: m.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);
  const removeColumn = useCallback((id: string) => {
    setModel((m) => ({ ...m, columns: m.columns.filter((c) => c.id !== id) }));
  }, []);

  // ---- join ops ----
  const addJoin = useCallback(() => {
    setModel((m) => {
      if (m.tables.length === 0) {
        toast.error("Add a FROM table first");
        return m;
      }
      return {
        ...m,
        joins: [...m.joins, {
          id: createId("j"),
          type: "INNER",
          table: "table_b",
          alias: "b",
          leftTableId: m.tables[0].id,
          leftColumn: "a.id",
          rightColumn: "b.a_id",
        }],
      };
    });
  }, []);
  const updateJoin = useCallback((id: string, patch: Partial<JoinDef>) => {
    setModel((m) => ({
      ...m,
      joins: m.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
  }, []);
  const removeJoin = useCallback((id: string) => {
    setModel((m) => ({ ...m, joins: m.joins.filter((j) => j.id !== id) }));
  }, []);

  // ---- where ops ----
  const addWhere = useCallback(() => {
    setModel((m) => ({
      ...m,
      where: [...m.where, {
        id: createId("w"),
        column: "col",
        operator: "=",
        value: "",
        conjunction: "AND",
      }],
    }));
  }, []);
  const updateWhere = useCallback((id: string, patch: Partial<Predicate>) => {
    setModel((m) => ({
      ...m,
      where: m.where.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }, []);
  const removeWhere = useCallback((id: string) => {
    setModel((m) => ({ ...m, where: m.where.filter((w) => w.id !== id) }));
  }, []);

  // ---- having ops ----
  const addHaving = useCallback(() => {
    setModel((m) => ({
      ...m,
      having: [...m.having, {
        id: createId("h"),
        column: "agg_col",
        operator: ">",
        value: "0",
        conjunction: "AND",
      }],
    }));
  }, []);
  const updateHaving = useCallback((id: string, patch: Partial<Predicate>) => {
    setModel((m) => ({
      ...m,
      having: m.having.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  }, []);
  const removeHaving = useCallback((id: string) => {
    setModel((m) => ({ ...m, having: m.having.filter((h) => h.id !== id) }));
  }, []);

  // ---- group by ops ----
  const addGroupBy = useCallback(() => {
    setModel((m) => ({ ...m, groupBy: [...m.groupBy, { id: createId("g"), column: "col" }] }));
  }, []);
  const updateGroupBy = useCallback((id: string, patch: Partial<GroupByColumn>) => {
    setModel((m) => ({
      ...m,
      groupBy: m.groupBy.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }, []);
  const removeGroupBy = useCallback((id: string) => {
    setModel((m) => ({ ...m, groupBy: m.groupBy.filter((g) => g.id !== id) }));
  }, []);

  // ---- order by ops ----
  const addOrderBy = useCallback(() => {
    setModel((m) => ({
      ...m,
      orderBy: [...m.orderBy, { id: createId("o"), column: "col", direction: "ASC" }],
    }));
  }, []);
  const updateOrderBy = useCallback((id: string, patch: Partial<OrderByClause>) => {
    setModel((m) => ({
      ...m,
      orderBy: m.orderBy.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);
  const removeOrderBy = useCallback((id: string) => {
    setModel((m) => ({ ...m, orderBy: m.orderBy.filter((o) => o.id !== id) }));
  }, []);

  // ---- model-level ops ----
  const toggleDistinct = useCallback(() => {
    setModel((m) => ({ ...m, distinct: !m.distinct }));
  }, []);
  const setLimit = useCallback((v: string) => {
    const n = v === "" ? null : Math.max(0, Number(v) || 0);
    setModel((m) => ({ ...m, limit: Number.isFinite(n as number) ? n : null }));
  }, []);
  const setOffset = useCallback((v: string) => {
    const n = v === "" ? null : Math.max(0, Number(v) || 0);
    setModel((m) => ({ ...m, offset: Number.isFinite(n as number) ? n : null }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      // Deep clone to avoid shared mutable references.
      setModel(JSON.parse(JSON.stringify(p.model)) as QueryModel);
      toast.success(`Loaded preset: ${p.label}`);
    }
  }, []);

  const handleImportSchema = useCallback(() => {
    try {
      const schema = parseSchemaJson(schemaText || SAMPLE_SCHEMA_JSON);
      const m = modelFromSchema(schema);
      setModel(m);
      toast.success(`Imported ${schema.tables.length} table(s); first table loaded as starter model`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid schema JSON");
    }
  }, [schemaText]);

  const handleClear = useCallback(() => {
    setModel(createEmptyModel());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (result.ok && sql) {
      saveHistory({
        ts: Date.now(),
        dialect,
        sqlPreview: sql.slice(0, 80),
        tables: model.tables.map((t) => t.name),
        columnCount: model.columns.length,
        joinCount: model.joins.length,
        whereCount: model.where.length,
      });
      setHistory(loadHistory());
    }
  }, [result, sql, dialect, model]);

  const errors = issues.filter((i) => i.severity === "error");

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Dialect &amp; presets
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && applyPreset(e.target.value)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">Load preset…</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value as SqlDialect)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {SQL_DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={handleImportSchema}>Import schema</Button>
              <ClearButton onClick={handleClear} disabled={model.tables.length === 0} />
            </div>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Schema JSON (paste then click Import)</summary>
            <Textarea
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              placeholder={SAMPLE_SCHEMA_JSON}
              className="mt-2 min-h-[100px] resize-y font-mono text-[11px]"
            />
          </details>
        </CardContent>
      </Card>

      {/* Tables */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> FROM tables ({model.tables.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addTable} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add table
            </Button>
          </div>
          {model.tables.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input
                value={t.name}
                onChange={(e) => updateTable(t.id, { name: e.target.value })}
                placeholder="table_name"
                className="h-8 text-xs font-mono"
              />
              <Input
                value={t.alias ?? ""}
                onChange={(e) => updateTable(t.id, { alias: e.target.value })}
                placeholder="alias (optional)"
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeTable(t.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.tables.length === 0 && (
            <p className="text-xs text-muted-foreground">No tables yet. Click “Add table” to start.</p>
          )}
        </CardContent>
      </Card>

      {/* Columns */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> SELECT columns ({model.columns.length})
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1.5">
                <input type="checkbox" checked={model.distinct} onChange={toggleDistinct} />
                DISTINCT
              </label>
              <Button variant="outline" size="sm" onClick={addColumn} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add column
              </Button>
            </div>
          </div>
          {model.columns.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_1fr_1.2fr_1fr_auto] gap-2 items-center">
              <select
                value={c.tableId ?? ""}
                onChange={(e) => updateColumn(c.id, { tableId: e.target.value || undefined })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">(unqualified)</option>
                {model.tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.alias ?? t.name}</option>
                ))}
              </select>
              <Input
                value={c.name}
                onChange={(e) => updateColumn(c.id, { name: e.target.value })}
                placeholder="column or *"
                className="h-8 text-xs font-mono"
              />
              <select
                value={c.aggregate ?? ""}
                onChange={(e) => updateColumn(c.id, { aggregate: (e.target.value || undefined) as ColumnRef["aggregate"] })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">(no agg)</option>
                {AGGREGATES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <Input
                value={c.alias ?? ""}
                onChange={(e) => updateColumn(c.id, { alias: e.target.value })}
                placeholder="AS alias (opt.)"
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeColumn(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.columns.length === 0 && (
            <p className="text-xs text-muted-foreground">No columns selected.</p>
          )}
        </CardContent>
      </Card>

      {/* Joins */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" /> JOINs ({model.joins.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addJoin} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add join
            </Button>
          </div>
          {model.joins.map((j) => (
            <div key={j.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <select
                value={j.type}
                onChange={(e) => updateJoin(j.id, { type: e.target.value as JoinType })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {JOIN_TYPES.map((jt) => <option key={jt.value} value={jt.value}>{jt.label}</option>)}
              </select>
              <Input
                value={j.table}
                onChange={(e) => updateJoin(j.id, { table: e.target.value })}
                placeholder="table"
                className="h-8 text-xs font-mono"
              />
              <Input
                value={j.alias ?? ""}
                onChange={(e) => updateJoin(j.id, { alias: e.target.value })}
                placeholder="alias"
                className="h-8 text-xs font-mono"
              />
              <Input
                value={`${j.leftColumn} = ${j.rightColumn}`}
                onChange={(e) => {
                  const m = e.target.value.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/);
                  if (m) updateJoin(j.id, { leftColumn: m[1].trim(), rightColumn: m[2].trim() });
                }}
                placeholder="left.col = right.col"
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeJoin(j.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.joins.length === 0 && (
            <p className="text-xs text-muted-foreground">No JOINs. The first table in your JOIN will be added to the FROM clause.</p>
          )}
        </CardContent>
      </Card>

      {/* WHERE */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Filter className="h-4 w-4" /> WHERE ({model.where.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addWhere} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add condition
            </Button>
          </div>
          {model.where.map((w, i) => (
            <div key={w.id} className="grid grid-cols-[80px_1fr_140px_1fr_auto] gap-2 items-center">
              <select
                value={w.conjunction}
                onChange={(e) => updateWhere(w.id, { conjunction: e.target.value as LogicalOp })}
                className="h-8 text-xs rounded border bg-background px-2"
                disabled={i === 0}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
              <Input
                value={w.column}
                onChange={(e) => updateWhere(w.id, { column: e.target.value })}
                placeholder="column"
                className="h-8 text-xs font-mono"
              />
              <select
                value={w.operator}
                onChange={(e) => updateWhere(w.id, { operator: e.target.value as WhereOperator })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {WHERE_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Input
                value={w.value}
                onChange={(e) => updateWhere(w.id, { value: e.target.value })}
                placeholder={WHERE_OPERATORS.find((o) => o.value === w.operator)?.needsValue ? "value" : "(no value)"}
                disabled={!WHERE_OPERATORS.find((o) => o.value === w.operator)?.needsValue}
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeWhere(w.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.where.length === 0 && (
            <p className="text-xs text-muted-foreground">No WHERE conditions.</p>
          )}
        </CardContent>
      </Card>

      {/* GROUP BY + HAVING */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> GROUP BY ({model.groupBy.length}) &amp; HAVING ({model.having.length})
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addGroupBy} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> GROUP BY
              </Button>
              <Button variant="outline" size="sm" onClick={addHaving} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> HAVING
              </Button>
            </div>
          </div>
          {model.groupBy.map((g) => (
            <div key={g.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <Input
                value={g.column}
                onChange={(e) => updateGroupBy(g.id, { column: e.target.value })}
                placeholder="group column"
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeGroupBy(g.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.having.map((h, i) => (
            <div key={h.id} className="grid grid-cols-[80px_1fr_140px_1fr_auto] gap-2 items-center">
              <select
                value={h.conjunction}
                onChange={(e) => updateHaving(h.id, { conjunction: e.target.value as LogicalOp })}
                className="h-8 text-xs rounded border bg-background px-2"
                disabled={i === 0}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
              <Input
                value={h.column}
                onChange={(e) => updateHaving(h.id, { column: e.target.value })}
                placeholder="aggregate col"
                className="h-8 text-xs font-mono"
              />
              <select
                value={h.operator}
                onChange={(e) => updateHaving(h.id, { operator: e.target.value as WhereOperator })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {WHERE_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Input
                value={h.value}
                onChange={(e) => updateHaving(h.id, { value: e.target.value })}
                placeholder="value"
                className="h-8 text-xs font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeHaving(h.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {model.groupBy.length === 0 && model.having.length === 0 && (
            <p className="text-xs text-muted-foreground">No GROUP BY / HAVING. If SELECT has aggregates and no explicit GROUP BY, non-aggregated columns are auto-added.</p>
          )}
        </CardContent>
      </Card>

      {/* ORDER BY + LIMIT/OFFSET */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <ArrowDownUp className="h-4 w-4" /> ORDER BY &amp; LIMIT/OFFSET
            </h3>
            <Button variant="outline" size="sm" onClick={addOrderBy} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add ORDER BY
            </Button>
          </div>
          {model.orderBy.map((o) => (
            <div key={o.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
              <Input
                value={o.column}
                onChange={(e) => updateOrderBy(o.id, { column: e.target.value })}
                placeholder="column"
                className="h-8 text-xs font-mono"
              />
              <select
                value={o.direction}
                onChange={(e) => updateOrderBy(o.id, { direction: e.target.value as SortDirection })}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {SORT_DIRECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Button variant="ghost" size="icon" onClick={() => removeOrderBy(o.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 max-w-md pt-1">
            <Field label="LIMIT">
              <Input
                type="number"
                min={0}
                value={model.limit ?? ""}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="(none)"
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field label="OFFSET">
              <Input
                type="number"
                min={0}
                value={model.offset ?? ""}
                onChange={(e) => setOffset(e.target.value)}
                placeholder="(none)"
                className="h-8 text-xs font-mono"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ErrorBanner message={errors[0].message} />
      )}

      {warnings.length > 0 && sql && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      {sql ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Generated SQL
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return sql; }} label="Copy SQL" />
                <DownloadButton
                  getText={() => { handleRecordHistory(); return sql; }}
                  filename="query.sql"
                  mime="application/sql"
                  label="Download .sql"
                />
                <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(model, dialect); }} />
              </div>
            </div>
            <Textarea readOnly value={sql} className="min-h-[200px] resize-y font-mono text-xs" />
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{dialect}</Badge>
              <Badge variant="outline">{model.tables.length} tables</Badge>
              <Badge variant="outline">{model.columns.length} columns</Badge>
              {model.joins.length > 0 && <Badge variant="outline">{model.joins.length} joins</Badge>}
              {model.where.length > 0 && <Badge variant="outline">{model.where.length} WHERE</Badge>}
              {model.distinct && <Badge variant="outline">DISTINCT</Badge>}
              {model.limit != null && <Badge variant="outline">LIMIT {model.limit}</Badge>}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Build a SELECT query visually"
          hint="Add a table, pick columns, then layer WHERE / JOIN / GROUP BY / ORDER BY. SQL generates live. Or load a preset above."
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
                    <Badge variant="outline" className="text-[10px]">{h.tables.length} tables</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.columnCount} cols</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate font-mono">{h.sqlPreview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side. No DB connection. Your schema and
            queries never leave the browser. History (max 20) lives in localStorage on this device only.
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
