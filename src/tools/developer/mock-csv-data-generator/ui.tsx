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
  COLUMN_TYPES,
  COLUMN_TYPE_LABELS,
  COLUMN_PRESETS,
  DEFAULT_COLUMNS,
  HONESTY_BANNER,
  generateFormat,
  computeStats,
  inferColumns,
  validateOptions,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type ColumnDef,
  type ColumnType,
  type Delimiter,
  type QuotingPolicy,
  type LineEnding,
  type OutputFormat,
  type GenerateOptions,
  type HistoryEntry,
} from "./logic";
import { Table, Plus, Trash2, History, Wand2, Lightbulb, AlertTriangle } from "lucide-react";

export default function MockCsvDataGenerator() {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [rowCount, setRowCount] = useState(10);
  const [delimiter, setDelimiter] = useState<Delimiter>("comma");
  const [customDelimiter, setCustomDelimiter] = useState("|");
  const [quoting, setQuoting] = useState<QuotingPolicy>("minimal");
  const [lineEnding, setLineEnding] = useState<LineEnding>("lf");
  const [bom, setBom] = useState(false);
  const [header, setHeader] = useState(true);
  const [seed, setSeed] = useState("");
  const [format, setFormat] = useState<OutputFormat>("csv");
  const [inferInput, setInferInput] = useState("");
  const [inferSample, setInferSample] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setRowCount(parsed.options.rowCount);
      setDelimiter(parsed.options.delimiter);
      setCustomDelimiter(parsed.options.customDelimiter || "|");
      setQuoting(parsed.options.quoting);
      setLineEnding(parsed.options.lineEnding);
      setBom(parsed.options.bom);
      setHeader(parsed.options.header);
      setSeed(parsed.options.seed);
      setFormat(parsed.options.format);
      setColumns(parsed.columns);
      if (parsed.options.rowCount || parsed.columns.length > 0) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateOptions({
    columns, rowCount, delimiter, customDelimiter,
    quoting, lineEnding, bom, header, seed, format,
  }), [columns, rowCount, delimiter, customDelimiter, quoting, lineEnding, bom, header, seed, format]);

  const result = useMemo(() => {
    if (!validation.ok) return null;
    try {
      const opts: GenerateOptions = {
        columns, rowCount, delimiter, customDelimiter,
        quoting, lineEnding, bom, header, seed, format,
      };
      return generateFormat(opts, format);
    } catch {
      return null;
    }
  }, [columns, rowCount, delimiter, customDelimiter, quoting, lineEnding, bom, header, seed, format, validation.ok]);

  const stats = useMemo(() => {
    if (!result) return null;
    return computeStats({
      columns, rowCount, delimiter, customDelimiter,
      quoting, lineEnding, bom, header, seed, format,
    }, result);
  }, [result, columns, rowCount, delimiter, customDelimiter, quoting, lineEnding, bom, header, seed, format]);

  const previewRows = useMemo(() => {
    if (!result) return [];
    return result.rows.slice(0, 20);
  }, [result]);

  const handleAddColumn = useCallback(() => {
    setColumns((prev) => [...prev, { name: `col${prev.length + 1}`, type: "string" }]);
  }, []);

  const handleRemoveColumn = useCallback((idx: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleUpdateColumn = useCallback((idx: number, patch: Partial<ColumnDef>) => {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }, []);

  const handleInfer = useCallback(() => {
    if (!inferInput.trim()) {
      toast.error("Paste a header row first");
      return;
    }
    const inferred = inferColumns(inferInput, inferSample || undefined);
    if (inferred.length === 0) {
      toast.error("Could not infer any columns");
      return;
    }
    setColumns(inferred);
    toast.success(`Inferred ${inferred.length} columns`);
  }, [inferInput, inferSample]);

  const handlePreset = useCallback((presetId: string) => {
    const preset = COLUMN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setColumns(preset.columns.map((c) => ({ ...c })));
    toast.success(`Loaded "${preset.name}" preset`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!result || result.rowCount === 0) return;
    saveHistory({
      ts: Date.now(),
      rowCount: result.rowCount,
      columnCount: result.columnCount,
      format,
      delimiter,
      seed,
      columnSummary: columns.map((c) => c.name).join(", "),
    });
    setHistory(loadHistory());
  }, [result, format, delimiter, seed, columns]);

  const handleClear = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
    setRowCount(10);
    setDelimiter("comma");
    setCustomDelimiter("|");
    setQuoting("minimal");
    setLineEnding("lf");
    setBom(false);
    setHeader(true);
    setSeed("");
    setFormat("csv");
    setInferInput("");
    setInferSample("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const downloadFilename = useMemo(() => {
    const ext = format === "csv" ? "csv" : format === "tsv" ? "tsv" : "json";
    return `mock-data-${rowCount}rows.${ext}`;
  }, [format, rowCount]);

  const downloadMime = useMemo(() => {
    if (format === "json") return "application/json";
    return "text/csv";
  }, [format]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner */}
      <Card>
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{HONESTY_BANNER}</p>
        </CardContent>
      </Card>

      {/* Presets + infer from header */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Quick start</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {COLUMN_PRESETS.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                title={p.description}
                onClick={() => handlePreset(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcsv-infer" className="text-xs">Infer columns from pasted header row</Label>
            <Textarea
              id="mcsv-infer"
              value={inferInput}
              onChange={(e) => setInferInput(e.target.value)}
              placeholder={"id,email,first_name,last_name,age,created_at"}
              className="min-h-[50px] resize-y font-mono text-xs"
            />
            <Textarea
              value={inferSample}
              onChange={(e) => setInferSample(e.target.value)}
              placeholder={"optional: paste one sample data row to improve inference"}
              className="min-h-[40px] resize-y font-mono text-xs"
            />
            <Button size="sm" onClick={handleInfer} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Infer columns
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Column builder */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Table className="h-4 w-4" /> Columns ({columns.length})
            </h3>
            <Button variant="outline" size="sm" onClick={handleAddColumn} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add column
            </Button>
          </div>
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div key={idx} className="rounded border bg-background p-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={col.name}
                    onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                    placeholder="column name"
                    className="h-7 text-xs flex-1 min-w-[120px] font-mono"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => handleUpdateColumn(idx, { type: e.target.value as ColumnType })}
                    className="h-7 text-xs rounded border bg-background px-2 flex-1 min-w-[120px]"
                  >
                    {COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>{COLUMN_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => handleRemoveColumn(idx)}
                    aria-label="Remove column"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ColumnOptions col={col} onChange={(patch) => handleUpdateColumn(idx, patch)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Output options */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Output options</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Row count</Label>
              <Input
                type="number"
                value={rowCount}
                min={0}
                max={1000000}
                onChange={(e) => setRowCount(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                <option value="csv">CSV (.csv)</option>
                <option value="tsv">TSV (.tsv)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delimiter</Label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as Delimiter)}
                disabled={format === "tsv" || format === "json"}
                className="h-8 text-xs rounded border bg-background px-2 w-full disabled:opacity-50"
              >
                <option value="comma">Comma (,)</option>
                <option value="semicolon">Semicolon (;)</option>
                <option value="tab">Tab (\t)</option>
                <option value="pipe">Pipe (|)</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
            {delimiter === "custom" && format !== "tsv" && format !== "json" && (
              <div className="space-y-1">
                <Label className="text-xs">Custom delimiter</Label>
                <Input
                  value={customDelimiter}
                  onChange={(e) => setCustomDelimiter(e.target.value.slice(0, 1))}
                  maxLength={1}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Quoting</Label>
              <select
                value={quoting}
                onChange={(e) => setQuoting(e.target.value as QuotingPolicy)}
                disabled={format === "json"}
                className="h-8 text-xs rounded border bg-background px-2 w-full disabled:opacity-50"
              >
                <option value="minimal">Minimal (RFC 4180)</option>
                <option value="always">Always quote</option>
                <option value="none">Never quote</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Line endings</Label>
              <select
                value={lineEnding}
                onChange={(e) => setLineEnding(e.target.value as LineEnding)}
                disabled={format === "json"}
                className="h-8 text-xs rounded border bg-background px-2 w-full disabled:opacity-50"
              >
                <option value="lf">LF (\n)</option>
                <option value="crlf">CRLF (\r\n)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seed (optional)</Label>
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="leave blank for random"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} disabled={format === "json"} />
              Header row
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} disabled={format === "json"} />
              UTF-8 BOM (Excel)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {!validation.ok && validation.errors.length > 0 && (
        <ErrorBanner message={validation.errors.join(" ")} />
      )}

      {/* Stats + preview + output */}
      {result && stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Generated {stats.rowCount.toLocaleString()} rows × {stats.columnCount} columns
                {" "}({(stats.bytes / 1024).toFixed(1)} KB)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Rows" value={stats.rowCount} />
                <Stat label="Columns" value={stats.columnCount} />
                <Stat label="Unique cols" value={stats.uniqueColumns} />
                <Stat label="Blank cols" value={stats.blankColumns} />
              </div>
            </CardContent>
          </Card>

          {previewRows.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Preview (first 20 rows)</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {previewRows.length} / {result.rowCount} shown
                  </Badge>
                </div>
                <div className="overflow-auto max-h-[400px] rounded border">
                  <table className="w-full text-xs font-mono">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {columns.map((c, i) => (
                          <th key={i} className="text-left px-2 py-1 font-semibold border-b whitespace-nowrap">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                              {cell === "" ? <span className="text-muted-foreground italic">∅</span> : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Output ({result.bytes.toLocaleString()} bytes)</h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return result.output; }}
                    label="Copy"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return result.output; }}
                    filename={downloadFilename}
                    mime={downloadMime}
                    label={`Download .${format}`}
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        rowCount, delimiter, customDelimiter, quoting, lineEnding,
                        bom, header, seed, format,
                      }, columns);
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <Textarea
                readOnly
                value={result.output.slice(0, 50000)}
                className="min-h-[200px] resize-y font-mono text-xs"
                placeholder="Output will appear here…"
              />
              {result.output.length > 50000 && (
                <p className="text-[10px] text-muted-foreground">
                  Output truncated to 50 KB for display. Download to get full {result.bytes.toLocaleString()} bytes.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Fix the errors above to generate data"
          hint="Add at least one column, set a row count, and click a preset or use the column builder."
          icon={<Table className="h-8 w-8" />}
        />
      )}

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
                  <Badge variant="outline" className="mr-2">{h.rowCount} rows</Badge>
                  <Badge variant="outline" className="mr-2">{h.columnCount} cols</Badge>
                  <Badge variant="outline" className="mr-2">{h.format}</Badge>
                  {h.seed && <Badge variant="outline" className="mr-2">seed: {h.seed}</Badge>}
                  <span className="text-muted-foreground">{h.columnSummary}</span>
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
            <strong className="text-foreground">Privacy:</strong> All generation runs locally. History stores metadata only (not the data itself) in localStorage on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Column options sub-component -----------------------------------------

function ColumnOptions({
  col,
  onChange,
}: {
  col: ColumnDef;
  onChange: (patch: Partial<ColumnDef>) => void;
}) {
  const showMinMax = col.type === "number" || col.type === "age" || col.type === "money";
  const showScale = col.type === "number" || col.type === "money";
  const showBlank = col.type !== "constant";
  const showUnique = col.type !== "constant" && col.type !== "boolean";
  const showEnum = col.type === "enum";
  const showRegex = col.type === "regex";
  const showConstant = col.type === "constant";

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      {showMinMax && (
        <>
          <label className="flex items-center gap-1">
            min
            <Input
              type="number"
              value={col.min ?? ""}
              onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
              className="h-6 w-16 text-[10px] font-mono"
            />
          </label>
          <label className="flex items-center gap-1">
            max
            <Input
              type="number"
              value={col.max ?? ""}
              onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
              className="h-6 w-16 text-[10px] font-mono"
            />
          </label>
        </>
      )}
      {showScale && (
        <label className="flex items-center gap-1">
          scale
          <Input
            type="number"
            min={0}
            max={10}
            value={col.scale ?? 0}
            onChange={(e) => onChange({ scale: Number(e.target.value) })}
            className="h-6 w-12 text-[10px] font-mono"
          />
        </label>
      )}
      {showBlank && (
        <label className="flex items-center gap-1">
          blank%
          <Input
            type="number"
            min={0}
            max={100}
            value={col.blankPercent ?? 0}
            onChange={(e) => onChange({ blankPercent: Number(e.target.value) })}
            className="h-6 w-12 text-[10px] font-mono"
          />
        </label>
      )}
      {showUnique && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={col.unique ?? false}
            onChange={(e) => onChange({ unique: e.target.checked })}
          />
          unique
        </label>
      )}
      {showEnum && (
        <Input
          value={col.enumValues?.map((v) => Array.isArray(v) ? `${v[0]}:${v[1]}` : v).join(",") ?? ""}
          onChange={(e) => {
            const txt = e.target.value;
            const vals: Array<string | [string, number]> = txt
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => {
                const [v, w] = s.split(":");
                return w !== undefined ? [v, Number(w)] as [string, number] : s;
              });
            onChange({ enumValues: vals });
          }}
          placeholder="value:weight,value,value"
          className="h-6 flex-1 min-w-[200px] text-[10px] font-mono"
        />
      )}
      {showRegex && (
        <Input
          value={col.pattern ?? ""}
          onChange={(e) => onChange({ pattern: e.target.value })}
          placeholder="\\d{3}-\\d{4}"
          className="h-6 flex-1 min-w-[200px] text-[10px] font-mono"
        />
      )}
      {showConstant && (
        <Input
          value={col.constantValue ?? ""}
          onChange={(e) => onChange({ constantValue: e.target.value })}
          placeholder="constant value"
          className="h-6 flex-1 min-w-[200px] text-[10px] font-mono"
        />
      )}
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
      <div className="text-base font-semibold text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
