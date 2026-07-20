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
  JOIN_TYPES,
  JOIN_OPERATORS,
  PRESET_TABLES,
  formatValue,
  runJoin,
  parseSqlJoin,
  buildSql,
  renderAsciiDiagram,
  renderHtmlDiagram,
  joinTypeLabel,
  joinTypeDescription,
  educationalNote,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type JoinType,
  type SampleTable,
  type JoinConfig,
  type JoinOperator,
  type HistoryEntry,
} from "./logic";
import {
  History,
  GitMerge,
  Table2,
  Info,
  Database,
  Code2,
  Play,
  ChevronRight,
} from "lucide-react";

export default function SqlJoinVisualizer() {
  const [presetId, setPresetId] = useState<string>(PRESET_TABLES[0].id);
  const [leftTable, setLeftTable] = useState<SampleTable>(PRESET_TABLES[0].tables[0]);
  const [rightTable, setRightTable] = useState<SampleTable>(PRESET_TABLES[0].tables[1]);
  const [config, setConfig] = useState<JoinConfig>(PRESET_TABLES[0].config);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSqlInput, setShowSqlInput] = useState(false);
  const [sqlInput, setSqlInput] = useState("");
  const [stepIdx, setStepIdx] = useState<number>(-1);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setLeftTable(p.left);
        setRightTable(p.right);
        setConfig(p.config);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // For self-join, the right table is the same as the left.
  const effectiveRight = config.type === "self" ? leftTable : rightTable;

  const result = useMemo(
    () => runJoin(leftTable, effectiveRight, config),
    [leftTable, effectiveRight, config],
  );

  const ascii = useMemo(
    () => renderAsciiDiagram(leftTable, effectiveRight, config, result),
    [leftTable, effectiveRight, config, result],
  );
  const html = useMemo(
    () => renderHtmlDiagram(leftTable, effectiveRight, config, result),
    [leftTable, effectiveRight, config, result],
  );
  const sql = useMemo(() => buildSql(config), [config]);

  const loadPreset = useCallback((id: string) => {
    const p = PRESET_TABLES.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setLeftTable(p.tables[0]);
    setRightTable(p.tables[1]);
    setConfig(p.config);
    setStepIdx(-1);
    toast.info(`Loaded preset: ${p.label}`);
  }, []);

  const handleParseSql = useCallback(() => {
    const p = parseSqlJoin(sqlInput);
    if (!p.ok || !p.config) {
      toast.error(p.error ?? "Could not parse SQL");
      return;
    }
    const newConfig = p.config;
    // Build sample tables from the parsed config (we keep the existing tables
    // but rename them to match the parsed SQL).
    setLeftTable((prev) => ({ ...prev, name: newConfig.leftTable }));
    if (newConfig.type !== "self") {
      setRightTable((prev) => ({ ...prev, name: newConfig.rightTable }));
    }
    setConfig(newConfig);
    setStepIdx(-1);
    toast.success(`Parsed: ${joinTypeLabel(newConfig.type)}`);
  }, [sqlInput]);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      type: config.type,
      leftTable: config.leftTable,
      rightTable: config.rightTable,
      leftRows: leftTable.rows.length,
      rightRows: effectiveRight.rows.length,
      outputRows: result.rows.length,
    });
    setHistory(loadHistory());
  }, [config, leftTable, effectiveRight, result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Editable table helpers.
  const updateCell = (
    table: "left" | "right",
    rowIdx: number,
    col: string,
    value: string,
  ) => {
    const parsed = parseCellValue(value);
    if (table === "left") {
      setLeftTable((prev) => {
        const rows = prev.rows.map((r, i) => (i === rowIdx ? { ...r, [col]: parsed } : r));
        return { ...prev, rows };
      });
    } else {
      setRightTable((prev) => {
        const rows = prev.rows.map((r, i) => (i === rowIdx ? { ...r, [col]: parsed } : r));
        return { ...prev, rows };
      });
    }
    setStepIdx(-1);
  };

  const addRow = (table: "left" | "right") => {
    const empty: Record<string, unknown> = {};
    const t = table === "left" ? leftTable : rightTable;
    for (const c of t.columns) empty[c] = null;
    if (table === "left") setLeftTable((prev) => ({ ...prev, rows: [...prev.rows, empty] }));
    else setRightTable((prev) => ({ ...prev, rows: [...prev.rows, empty] }));
    setStepIdx(-1);
  };

  const removeRow = (table: "left" | "right", rowIdx: number) => {
    if (table === "left") setLeftTable((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== rowIdx) }));
    else setRightTable((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== rowIdx) }));
    setStepIdx(-1);
  };

  const handleTypeChange = (t: JoinType) => {
    setConfig((prev) => {
      // If switching to self-join and the tables are different, keep the left
      // table as the basis. The right becomes a logical alias only.
      if (t === "self" && prev.leftTable !== prev.rightTable) {
        return {
          ...prev,
          type: t,
          rightTable: prev.leftTable,
          leftAlias: prev.leftAlias ?? "a",
          rightAlias: prev.rightAlias ?? "b",
          conditions: prev.conditions.length > 0
            ? prev.conditions
            : [{ leftTable: prev.leftAlias ?? "a", leftColumn: "id", operator: "=", rightTable: prev.rightAlias ?? "b", rightColumn: "id" }],
        };
      }
      return { ...prev, type: t };
    });
    setStepIdx(-1);
  };

  const handleConditionChange = (
    idx: number,
    field: "leftColumn" | "operator" | "rightColumn",
    value: string,
  ) => {
    setConfig((prev) => {
      const conditions = prev.conditions.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c,
      );
      return { ...prev, conditions };
    });
    setStepIdx(-1);
  };

  const isLeftOnly = config.type === "left-anti" || config.type === "left-semi";

  // Animation: step through matched pairs.
  const stepForward = () => {
    setStepIdx((prev) => Math.min(prev + 1, result.steps.length - 1));
  };
  const stepBack = () => {
    setStepIdx((prev) => Math.max(prev - 1, -1));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs">Preset</Label>
            <div className="flex flex-wrap gap-1">
              {PRESET_TABLES.map((p) => (
                <Button
                  key={p.id}
                  variant={presetId === p.id ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Join type</Label>
              <select
                value={config.type}
                onChange={(e) => handleTypeChange(e.target.value as JoinType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {JOIN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">{joinTypeDescription(config.type)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conditions (ON clause)</Label>
              {config.type === "cross" ? (
                <p className="text-[11px] text-muted-foreground italic">CROSS JOIN has no ON clause (cartesian product).</p>
              ) : (
                <div className="space-y-1">
                  {config.conditions.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-xs flex-wrap">
                      <span className="font-mono text-muted-foreground">{config.leftAlias ?? config.leftTable}.</span>
                      <select
                        value={c.leftColumn}
                        onChange={(e) => handleConditionChange(idx, "leftColumn", e.target.value)}
                        className="h-7 text-xs rounded border bg-background px-1"
                      >
                        {leftTable.columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                      <select
                        value={c.operator}
                        onChange={(e) => handleConditionChange(idx, "operator", e.target.value as JoinOperator)}
                        className="h-7 text-xs rounded border bg-background px-1"
                      >
                        {JOIN_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <span className="font-mono text-muted-foreground">{config.rightAlias ?? config.rightTable}.</span>
                      <select
                        value={c.rightColumn}
                        onChange={(e) => handleConditionChange(idx, "rightColumn", e.target.value)}
                        className="h-7 text-xs rounded border bg-background px-1"
                      >
                        {effectiveRight.columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSqlInput((v) => !v)} className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> {showSqlInput ? "Hide" : "Paste SQL"}
            </Button>
          </div>
          {showSqlInput && (
            <div className="space-y-1.5">
              <Label className="text-xs">Paste a SELECT ... JOIN ... statement</Label>
              <Textarea
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder={"SELECT * FROM users u INNER JOIN orders o ON u.id = o.user_id"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <Button size="sm" onClick={handleParseSql} className="gap-1.5">
                <Play className="h-3.5 w-3.5" /> Parse & apply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EditableTableCard
          title={config.leftAlias ?? leftTable.name}
          subtitle={leftTable.name}
          table={leftTable}
          onCellChange={(rowIdx, col, val) => updateCell("left", rowIdx, col, val)}
          onAddRow={() => addRow("left")}
          onRemoveRow={(rowIdx) => removeRow("left", rowIdx)}
        />
        {config.type !== "self" ? (
          <EditableTableCard
            title={config.rightAlias ?? rightTable.name}
            subtitle={rightTable.name}
            table={rightTable}
            onCellChange={(rowIdx, col, val) => updateCell("right", rowIdx, col, val)}
            onAddRow={() => addRow("right")}
            onRemoveRow={(rowIdx) => removeRow("right", rowIdx)}
          />
        ) : (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table2 className="h-4 w-4" /> {config.rightAlias ?? rightTable.name} <span className="text-muted-foreground">(self-join alias)</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                In a self-join, the same table is referenced twice using two aliases. The right-side rows are the same as the left-side rows.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <GitMerge className="h-4 w-4" /> Result ({result.rows.length} rows)
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={stepBack} disabled={stepIdx <= -1}>◀ Prev</Button>
              <span className="text-[11px] text-muted-foreground">
                {stepIdx === -1 ? "no step" : `step ${stepIdx + 1}/${result.steps.length}`}
              </span>
              <Button variant="ghost" size="sm" onClick={stepForward} disabled={stepIdx >= result.steps.length - 1}>Next ▶</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Stat label="Left in" value={result.stats.leftInput} />
            <Stat label="Right in" value={result.stats.rightInput} />
            <Stat label="Matched" value={result.stats.matched} highlight="good" />
            <Stat label="Left only" value={result.stats.leftUnmatched} highlight={result.stats.leftUnmatched > 0 ? "bad" : undefined} />
            <Stat label="Right only" value={result.stats.rightUnmatched} highlight={result.stats.rightUnmatched > 0 ? "bad" : undefined} />
          </div>
          <div className="overflow-auto max-h-[400px] border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-[10px] text-muted-foreground">#</th>
                  {result.columns.map((c) => (
                    <th key={c} className="px-2 py-1 text-left font-mono text-[10px]">
                      <span className={c.startsWith((config.leftAlias ?? config.leftTable) + ".") ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {c}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr><td colSpan={result.columns.length + 1} className="px-2 py-4 text-center text-muted-foreground italic">No rows in result.</td></tr>
                ) : (
                  result.rows.map((r, i) => {
                    // Highlight rows that participate in the current animation step.
                    const isStepRow = stepIdx >= 0
                      && result.steps[stepIdx]
                      && (r.leftRowIdx === result.steps[stepIdx].leftRowIdx && r.rightRowIdx === result.steps[stepIdx].rightRowIdx);
                    return (
                      <tr key={i} className={isStepRow ? "bg-amber-100 dark:bg-amber-900/30" : i % 2 === 0 ? "" : "bg-muted/10"}>
                        <td className="px-2 py-1 text-muted-foreground text-[10px]">{i + 1}</td>
                        {result.columns.map((c) => {
                          const cell = r.cells[c];
                          const isNull = cell.value === null || cell.value === undefined;
                          return (
                            <td key={c} className={`px-2 py-1 font-mono text-[11px] ${isNull ? "text-muted-foreground italic" : "text-foreground"}`}>
                              {formatValue(cell.value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {stepIdx >= 0 && result.steps[stepIdx] && (
            <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
              <Badge variant="outline" className="mr-2 text-[10px]">step {stepIdx + 1}</Badge>
              <span className="font-mono">
                L[{result.steps[stepIdx].leftRowIdx}] × R[{result.steps[stepIdx].rightRowIdx}]
              </span>
              <span className={`ml-2 ${result.steps[stepIdx].matched ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {result.steps[stepIdx].matched ? "MATCH" : "no match"} — {result.steps[stepIdx].reason}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4" /> Why this isn&apos;t a Venn diagram
          </h3>
          <p className="text-xs text-muted-foreground">
            {educationalNote(config.type)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Visualization
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => ascii} label="Copy ASCII" />
              <CopyButton getText={() => sql} label="Copy SQL" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return sql; }}
                filename="join.sql"
                mime="text/plain"
                label="Download .sql"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ type: config.type, left: leftTable, right: rightTable, config }); }} />
            </div>
          </div>
          <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto text-foreground whitespace-pre">
            {ascii}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Code2 className="h-4 w-4" /> Generated SQL
          </h3>
          <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto text-foreground whitespace-pre-wrap">
            {sql}
          </pre>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="mr-2">{joinTypeLabel(h.type)}</Badge>
                  <span className="font-mono text-muted-foreground">{h.leftTable} × {h.rightTable}</span>
                  <span className="text-muted-foreground ml-2">· {h.leftRows}+{h.rightRows} → {h.outputRows} rows</span>
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
            <strong className="text-foreground">Honesty:</strong> This visualizer runs joins entirely in your browser — no database required. NULL handling follows ANSI SQL (NULL keys never match). Real-world SQL without ORDER BY does not guarantee row order; the order shown here is for educational clarity only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EditableTableCard({
  title,
  subtitle,
  table,
  onCellChange,
  onAddRow,
  onRemoveRow,
}: {
  title: string;
  subtitle: string;
  table: SampleTable;
  onCellChange: (rowIdx: number, col: string, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowIdx: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Table2 className="h-4 w-4" /> {title}
            {title !== subtitle && <span className="text-muted-foreground text-[11px]">({subtitle})</span>}
          </h3>
          <Button variant="ghost" size="sm" onClick={onAddRow} className="h-7 text-[11px]">+ row</Button>
        </div>
        <div className="overflow-auto max-h-[300px] border rounded">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="px-1 py-1 text-left text-[10px] text-muted-foreground w-8"></th>
                {table.columns.map((c) => (
                  <th key={c} className="px-2 py-1 text-left font-mono text-[10px]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/10"}>
                  <td className="px-1 py-0.5 text-center">
                    <button
                      onClick={() => onRemoveRow(i)}
                      className="text-muted-foreground hover:text-destructive text-[11px]"
                      title="Remove row"
                    >×</button>
                  </td>
                  {table.columns.map((c) => (
                    <td key={c} className="px-1 py-0.5">
                      <Input
                        type="text"
                        value={formatValue(r[c])}
                        onChange={(e) => onCellChange(i, c, e.target.value)}
                        className="h-7 text-[11px] font-mono px-1"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "good" | "bad";
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

function parseCellValue(s: string): unknown {
  const t = s.trim();
  if (t === "" || t === "NULL" || t === "null") return null;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}

// Suppress unused-import lint
export type _Unused = typeof ChevronRight;
