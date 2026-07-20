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
  QUERY_OPERATORS,
  VALUE_TYPES,
  LOGIC_OPS,
  OPERATIONS,
  DRIVER_TARGETS,
  VALUELESS_OPS,
  ARRAY_OPS,
  SUBDOC_OPS,
  SAMPLE_DOCS,
  createEmptyCondition,
  createEmptyGroup,
  createDefaultState,
  generateMqlJson,
  generateMqlShell,
  generateDriverCode,
  runFilter,
  extractFields,
  safeJsonParse,
  validateJsonDoc,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QueryState,
  type Group,
  type Condition,
  type QueryOperator,
  type ValueType,
  type LogicOp,
  type Operation,
  type DriverTarget,
  type HistoryEntry,
} from "./logic";
import { History, Database, Plus, Trash2, Filter, Braces, Code2, FileJson, Beaker } from "lucide-react";

// ---------------------------------------------------------------------------
// Immutable tree mutation helpers
// ---------------------------------------------------------------------------

function mapGroup(root: Group, fn: (g: Group) => Group): Group {
  const next = fn(root);
  return {
    ...next,
    groups: next.groups.map((g) => mapGroup(g, fn)),
  };
}

function findAndMapGroup(root: Group, groupId: string, fn: (g: Group) => Group): Group {
  if (root.id === groupId) return fn(root);
  return {
    ...root,
    groups: root.groups.map((g) => findAndMapGroup(g, groupId, fn)),
  };
}

function updateConditionInTree(root: Group, groupId: string, condId: string, patch: Partial<Condition>): Group {
  return findAndMapGroup(root, groupId, (g) => ({
    ...g,
    conditions: g.conditions.map((c) => (c.id === condId ? { ...c, ...patch } : c)),
  }));
}

function addConditionToTree(root: Group, groupId: string): Group {
  return findAndMapGroup(root, groupId, (g) => ({
    ...g,
    conditions: [...g.conditions, createEmptyCondition()],
  }));
}

function removeConditionFromTree(root: Group, groupId: string, condId: string): Group {
  return findAndMapGroup(root, groupId, (g) => ({
    ...g,
    conditions: g.conditions.length > 1 ? g.conditions.filter((c) => c.id !== condId) : g.conditions,
  }));
}

function addGroupToTree(root: Group, parentId: string): Group {
  return findAndMapGroup(root, parentId, (g) => ({
    ...g,
    groups: [...g.groups, createEmptyGroup("and")],
  }));
}

function removeGroupFromTree(root: Group, groupId: string): Group {
  if (root.id === groupId) return root; // cannot remove root
  const recurse = (g: Group): Group => ({
    ...g,
    groups: g.groups
      .filter((sub) => sub.id !== groupId)
      .map((sub) => recurse(sub)),
  });
  return recurse(root);
}

function updateGroupInTree(root: Group, groupId: string, patch: Partial<Group>): Group {
  return findAndMapGroup(root, groupId, (g) => ({ ...g, ...patch }));
}

// ---------------------------------------------------------------------------
// Group renderer (recursive)
// ---------------------------------------------------------------------------

function GroupRenderer({
  group,
  depth,
  fields,
  onUpdateGroup,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onAddGroup,
  onRemoveGroup,
}: {
  group: Group;
  depth: number;
  fields: string[];
  onUpdateGroup: (groupId: string, patch: Partial<Group>) => void;
  onAddCondition: (groupId: string) => void;
  onRemoveCondition: (groupId: string, condId: string) => void;
  onUpdateCondition: (groupId: string, condId: string, patch: Partial<Condition>) => void;
  onAddGroup: (parentId: string) => void;
  onRemoveGroup: (groupId: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border ${depth === 0 ? "bg-card" : "bg-muted/30"} p-3 space-y-2`}
      style={{ marginLeft: depth * 12 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{depth === 0 ? "ROOT" : `GROUP`}</Badge>
          <select
            value={group.logic}
            onChange={(e) => onUpdateGroup(group.id, { logic: e.target.value as LogicOp })}
            className="h-7 text-xs rounded border bg-background px-2"
          >
            {LOGIC_OPS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <span className="text-[10px] text-muted-foreground">
            {group.conditions.length} cond · {group.groups.length} sub
          </span>
        </div>
        {depth > 0 && (
          <Button variant="ghost" size="icon" onClick={() => onRemoveGroup(group.id)} title="Remove group">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {group.conditions.map((c) => (
        <ConditionRow
          key={c.id}
          cond={c}
          fields={fields}
          onUpdate={(patch) => onUpdateCondition(group.id, c.id, patch)}
          onRemove={() => onRemoveCondition(group.id, c.id)}
          canRemove={group.conditions.length > 1 || group.groups.length > 0}
        />
      ))}

      {group.groups.map((sub) => (
        <GroupRenderer
          key={sub.id}
          group={sub}
          depth={depth + 1}
          fields={fields}
          onUpdateGroup={onUpdateGroup}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUpdateCondition={onUpdateCondition}
          onAddGroup={onAddGroup}
          onRemoveGroup={onRemoveGroup}
        />
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddCondition(group.id)}>
          <Plus className="h-3 w-3" /> Condition
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddGroup(group.id)}>
          <Plus className="h-3 w-3" /> Sub-group
        </Button>
      </div>
    </div>
  );
}

function ConditionRow({
  cond,
  fields,
  onUpdate,
  onRemove,
  canRemove,
}: {
  cond: Condition;
  fields: string[];
  onUpdate: (patch: Partial<Condition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const isValueless = VALUELESS_OPS.includes(cond.op);
  const isArray = ARRAY_OPS.includes(cond.op);
  const isSubdoc = SUBDOC_OPS.includes(cond.op);
  const valuePlaceholder = isArray
    ? 'comma or JSON: ["a","b"]'
    : isSubdoc
      ? '{"$gt": 5}'
      : cond.valueType === "objectId"
        ? "24 hex chars"
        : cond.valueType === "date"
          ? "ISO date"
          : "value";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_1fr_auto] gap-1.5 items-center">
      <Input
        list="mql-field-list"
        value={cond.field}
        onChange={(e) => onUpdate({ field: e.target.value })}
        placeholder="field (or field.subfield)"
        className="h-8 text-xs font-mono"
      />
      <datalist id="mql-field-list">
        {fields.map((f) => <option key={f} value={f} />)}
      </datalist>
      <select
        value={cond.op}
        onChange={(e) => onUpdate({ op: e.target.value as QueryOperator })}
        className="h-8 text-xs rounded border bg-background px-2"
      >
        {QUERY_OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.value}</option>
        ))}
      </select>
      {!isValueless && !isSubdoc && (
        <select
          value={cond.valueType}
          onChange={(e) => onUpdate({ valueType: e.target.value as ValueType })}
          className="h-8 text-xs rounded border bg-background px-2"
        >
          {VALUE_TYPES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      )}
      {!isValueless && (
        <Input
          value={cond.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={valuePlaceholder}
          className="h-8 text-xs font-mono"
        />
      )}
      {(isValueless || isSubdoc) && <div />}
      <Button variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove} title="Remove condition">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MongodbQueryBuilder() {
  const [state, setState] = useState<QueryState>(createDefaultState);
  const [sampleText, setSampleText] = useState("");
  const [driverTarget, setDriverTarget] = useState<DriverTarget>("mongosh");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setState((prev) => ({ ...prev, ...p }));
        toast.info("Loaded query from share link");
      }
    }
  }, []);

  // ---- tree ops ----
  const updateGroup = useCallback((groupId: string, patch: Partial<Group>) => {
    setState((s) => ({ ...s, root: updateGroupInTree(s.root, groupId, patch) }));
  }, []);
  const addCondition = useCallback((groupId: string) => {
    setState((s) => ({ ...s, root: addConditionToTree(s.root, groupId) }));
  }, []);
  const removeCondition = useCallback((groupId: string, condId: string) => {
    setState((s) => ({ ...s, root: removeConditionFromTree(s.root, groupId, condId) }));
  }, []);
  const updateCondition = useCallback((groupId: string, condId: string, patch: Partial<Condition>) => {
    setState((s) => ({ ...s, root: updateConditionInTree(s.root, groupId, condId, patch) }));
  }, []);
  const addGroup = useCallback((parentId: string) => {
    setState((s) => ({ ...s, root: addGroupToTree(s.root, parentId) }));
  }, []);
  const removeGroup = useCallback((groupId: string) => {
    setState((s) => ({ ...s, root: removeGroupFromTree(s.root, groupId) }));
  }, []);

  // ---- top-level ops ----
  const setOperation = useCallback((op: Operation) => {
    setState((s) => ({ ...s, operation: op }));
  }, []);
  const setCollection = useCallback((coll: string) => {
    setState((s) => ({ ...s, collection: coll }));
  }, []);

  // ---- projection / sort / limit / skip ----
  const addProjection = useCallback(() => {
    setState((s) => ({ ...s, projection: [...s.projection, { field: "", include: true }] }));
  }, []);
  const updateProjection = useCallback((idx: number, patch: Partial<{ field: string; include: boolean }>) => {
    setState((s) => ({ ...s, projection: s.projection.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  }, []);
  const removeProjection = useCallback((idx: number) => {
    setState((s) => ({ ...s, projection: s.projection.filter((_, i) => i !== idx) }));
  }, []);
  const addSort = useCallback(() => {
    setState((s) => ({ ...s, sort: [...s.sort, { field: "", dir: 1 as const }] }));
  }, []);
  const updateSort = useCallback((idx: number, patch: Partial<{ field: string; dir: 1 | -1 }>) => {
    setState((s) => ({ ...s, sort: s.sort.map((sp, i) => (i === idx ? { ...sp, ...patch } : sp)) }));
  }, []);
  const removeSort = useCallback((idx: number) => {
    setState((s) => ({ ...s, sort: s.sort.filter((_, i) => i !== idx) }));
  }, []);

  // ---- derived outputs ----
  const mqlJson = useMemo(() => generateMqlJson(state), [state]);
  const shellResult = useMemo(() => generateMqlShell(state), [state]);
  const driverResult = useMemo(() => generateDriverCode(state, driverTarget), [state, driverTarget]);

  const sampleDocs = useMemo(() => {
    if (!sampleText.trim()) return null;
    const p = safeJsonParse(sampleText);
    if (!p.ok || !Array.isArray(p.value)) return null;
    return p.value as unknown[];
  }, [sampleText]);

  const fields = useMemo(() => (sampleDocs ? extractFields(sampleDocs) : []), [sampleDocs]);

  const filterResult = useMemo(() => {
    if (!sampleDocs) return null;
    return runFilter(sampleDocs, state);
  }, [sampleDocs, state]);

  const docValidation = useMemo(() => {
    if (state.operation === "insertOne") return validateJsonDoc(state.insertDoc);
    if (state.operation === "updateMany" || state.operation === "updateOne") return validateJsonDoc(state.updateDoc);
    if (state.operation === "replaceOne") return validateJsonDoc(state.replaceDoc);
    return { ok: true as const };
  }, [state]);

  const handleClear = useCallback(() => {
    setState(createDefaultState());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    const filterJson = mqlJson.ok ? mqlJson.output.slice(0, 120) : "";
    saveHistory({
      ts: Date.now(),
      collection: state.collection,
      operation: state.operation,
      filterPreview: filterJson,
      matched: filterResult?.ok ? filterResult.matched.length : 0,
    });
    setHistory(loadHistory());
  }, [mqlJson, state, filterResult]);

  const handleLoadSample = useCallback(() => {
    setSampleText(SAMPLE_DOCS);
    toast.info("Loaded sample documents");
  }, []);

  const showError = (msg: string) => (
    <ErrorBanner message={msg} />
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Top controls: collection + operation */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mql-coll" className="text-xs">Collection</Label>
              <Input
                id="mql-coll"
                value={state.collection}
                onChange={(e) => setCollection(e.target.value)}
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mql-op" className="text-xs">Operation</Label>
              <select
                id="mql-op"
                value={state.operation}
                onChange={(e) => setOperation(e.target.value as Operation)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {OPERATIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter tree */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Filter className="h-4 w-4" /> Filter Conditions
          </h3>
          <GroupRenderer
            group={state.root}
            depth={0}
            fields={fields}
            onUpdateGroup={updateGroup}
            onAddCondition={addCondition}
            onRemoveCondition={removeCondition}
            onUpdateCondition={updateCondition}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
          />
        </CardContent>
      </Card>

      {/* Operation-specific doc editor */}
      {(state.operation === "insertOne" || state.operation === "updateMany" ||
        state.operation === "updateOne" || state.operation === "replaceOne") && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Braces className="h-4 w-4" />
              {state.operation === "insertOne" ? "Insert Document" : state.operation === "replaceOne" ? "Replacement Document" : "Update Operators Doc"}
            </h3>
            <Textarea
              value={
                state.operation === "insertOne" ? state.insertDoc :
                state.operation === "replaceOne" ? state.replaceDoc : state.updateDoc
              }
              onChange={(e) => {
                const v = e.target.value;
                setState((s) => ({
                  ...s,
                  insertDoc: state.operation === "insertOne" ? v : s.insertDoc,
                  updateDoc: state.operation === "updateMany" || state.operation === "updateOne" ? v : s.updateDoc,
                  replaceDoc: state.operation === "replaceOne" ? v : s.replaceDoc,
                }));
              }}
              className="min-h-[100px] font-mono text-xs"
            />
            {!docValidation.ok && showError(docValidation.error)}
            <p className="text-[10px] text-muted-foreground">
              For updates use $set, $unset, $inc, $push, $pull. For replace/insert use a plain document.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Projection + sort + limit + skip (only for find/findOne) */}
      {(state.operation === "find" || state.operation === "findOne") && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Braces className="h-4 w-4" /> Options
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Projection</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addProjection}>
                  <Plus className="h-3 w-3" /> Field
                </Button>
              </div>
              {state.projection.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                  <Input
                    value={p.field}
                    onChange={(e) => updateProjection(i, { field: e.target.value })}
                    placeholder="field"
                    list="mql-field-list"
                    className="h-8 text-xs font-mono"
                  />
                  <select
                    value={p.include ? "1" : "0"}
                    onChange={(e) => updateProjection(i, { include: e.target.value === "1" })}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="1">include</option>
                    <option value="0">exclude</option>
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeProjection(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Sort</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSort}>
                  <Plus className="h-3 w-3" /> Field
                </Button>
              </div>
              {state.sort.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                  <Input
                    value={s.field}
                    onChange={(e) => updateSort(i, { field: e.target.value })}
                    placeholder="field"
                    list="mql-field-list"
                    className="h-8 text-xs font-mono"
                  />
                  <select
                    value={String(s.dir)}
                    onChange={(e) => updateSort(i, { dir: Number(e.target.value) as 1 | -1 })}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="1">asc</option>
                    <option value="-1">desc</option>
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeSort(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Limit</Label>
                <Input
                  type="number"
                  value={state.limit ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    setState((s) => ({ ...s, limit: v != null && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null }));
                  }}
                  placeholder="off"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Skip</Label>
                <Input
                  type="number"
                  value={state.skip ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    setState((s) => ({ ...s, skip: v != null && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null }));
                  }}
                  placeholder="off"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample docs */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Beaker className="h-4 w-4" /> Sample Documents (in-browser test)
            </h3>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder='[{"name":"Alice","age":30}, ...]'
            className="min-h-[100px] font-mono text-xs"
          />
          {sampleText.trim() && !sampleDocs && (
            <ErrorBanner message="Sample input must be a JSON array of documents." />
          )}
          {filterResult?.ok && sampleDocs && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{filterResult.matched.length} matched</Badge>
                <Badge variant="outline" className="text-[10px]">{sampleDocs.length - filterResult.matched.length} not matched</Badge>
                {filterResult.errors.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{filterResult.errors.length} errors</Badge>
                )}
              </div>
              <div className="max-h-[200px] overflow-auto rounded border bg-background">
                {filterResult.matched.slice(0, 10).map((d, i) => (
                  <pre key={i} className="text-[10px] font-mono px-2 py-1 border-b last:border-0">
                    {JSON.stringify(d)}
                  </pre>
                ))}
                {filterResult.matched.length > 10 && (
                  <div className="text-[10px] text-muted-foreground px-2 py-1">… and {filterResult.matched.length - 10} more</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Code2 className="h-4 w-4" /> Output
          </h3>
          {!mqlJson.ok && showError(mqlJson.error)}
          {!shellResult.ok && showError(shellResult.error)}
          {!driverResult.ok && showError(driverResult.error)}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileJson className="h-3.5 w-3.5" />
              <Label className="text-xs">MQL JSON</Label>
            </div>
            <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[200px]">
              {mqlJson.ok ? mqlJson.output : "—"}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                <Label className="text-xs">Driver code</Label>
              </div>
              <select
                value={driverTarget}
                onChange={(e) => setDriverTarget(e.target.value as DriverTarget)}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                {DRIVER_TARGETS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[300px]">
              {driverResult.ok ? driverResult.output : shellResult.ok ? shellResult.output : "—"}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { handleRecordHistory(); return mqlJson.ok ? mqlJson.output : ""; }}
              label="Copy JSON"
            />
            <CopyButton
              getText={() => shellResult.ok ? shellResult.output : ""}
              label="Copy shell"
            />
            <CopyButton
              getText={() => driverResult.ok ? driverResult.output : ""}
              label={`Copy ${driverTarget}`}
            />
            <DownloadButton
              getText={() => mqlJson.ok ? mqlJson.output : ""}
              filename="mongo-query.json"
              mime="application/json"
              label="Download JSON"
            />
            <DownloadButton
              getText={() => driverResult.ok ? driverResult.output : ""}
              filename={`mongo-query.${driverTarget === "python" ? "py" : driverTarget === "java" ? "java" : driverTarget === "csharp" ? "cs" : driverTarget === "php" ? "php" : driverTarget === "node" ? "js" : "sh"}`}
              label={`Download ${driverTarget}`}
            />
            <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(state); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {history.length === 0 && !sampleText && (
        <EmptyState
          title="Start building a MongoDB query"
          hint="Add conditions to the filter tree, choose an operation, and the MQL JSON + driver code is generated live. Load sample documents to test your filter in-browser."
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
                  <Badge variant="outline" className="mr-2">{h.operation}</Badge>
                  <Badge variant="outline" className="mr-2">{h.collection}</Badge>
                  <span className="text-muted-foreground font-mono">{h.filterPreview}</span>
                  <span className="text-muted-foreground ml-2">· {h.matched} matched · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All query building, sample-document matching, and driver-code generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
