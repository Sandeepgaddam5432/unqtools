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
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Table as TableIcon, Plus, Minus, ArrowUp, ArrowDown, ArrowLeft,
  ArrowRight, FlipVertical2, ArrowDownUp, CopyX, Bold, Upload, FileDown,
} from "lucide-react";
import {
  createEmptyTable,
  normalizeTable,
  setCell,
  setHeader,
  setAlignment,
  addRow,
  removeRow,
  moveRow,
  addColumn,
  removeColumn,
  moveColumn,
  toggleHeaderRow,
  transposeTable,
  sortRows,
  dedupeRows,
  boldRow,
  renderMarkdown,
  renderHtml,
  renderCsv,
  renderTsv,
  renderJson,
  renderJira,
  parseMarkdownTable,
  importFromCsv,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TableModel,
  type Alignment,
  type HistoryEntry,
} from "./logic";

type ExportFormat = "markdown" | "html" | "csv" | "tsv" | "json" | "jira";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown",
  html: "HTML",
  csv: "CSV",
  tsv: "TSV",
  json: "JSON",
  jira: "Jira",
};

const FORMAT_MIME: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  html: "text/html",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  jira: "text/plain",
};

const FORMAT_EXT: Record<ExportFormat, string> = {
  markdown: "md",
  html: "html",
  csv: "csv",
  tsv: "tsv",
  json: "json",
  jira: "txt",
};

export default function MarkdownTableGenerator() {
  const [table, setTable] = useState<TableModel>(() => createEmptyTable(3, 3));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [padded, setPadded] = useState(true);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.table) {
        setTable(normalizeTable(p.table));
        toast.info("Loaded table from share link");
      }
    }
  }, []);

  const stats = useMemo(() => computeStats(table), [table]);

  const output = useMemo(() => {
    switch (format) {
      case "html": return renderHtml(table);
      case "csv": return renderCsv(table);
      case "tsv": return renderTsv(table);
      case "json": return renderJson(table);
      case "jira": return renderJira(table);
      case "markdown":
      default: return renderMarkdown(table, { padded });
    }
  }, [table, format, padded]);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      rows: table.rows.length,
      cols: table.headers.length,
      preview: table.headers.join(" | ") || "(empty)",
    });
    setHistory(loadHistory());
  }, [table]);

  const updateCell = (r: number, c: number, v: string) => {
    setTable((prev) => setCell(prev, r, c, v));
  };
  const updateHeader = (c: number, v: string) => {
    setTable((prev) => setHeader(prev, c, v));
  };
  const updateAlign = (c: number, a: Alignment) => {
    setTable((prev) => setAlignment(prev, c, a));
  };

  const handleImport = () => {
    const text = importText.trim();
    if (!text) {
      toast.error("Paste some CSV, TSV, or a markdown table first");
      return;
    }
    // Try markdown table first (if it has pipes and a separator)
    if (text.includes("|") && /[\-:]{2,}/.test(text)) {
      const parsed = parseMarkdownTable(text);
      if (parsed) {
        setTable(normalizeTable(parsed));
        toast.success("Imported markdown table");
        setShowImport(false);
        setImportText("");
        return;
      }
    }
    // Otherwise treat as CSV/TSV
    setTable(importFromCsv(text));
    toast.success("Imported CSV/TSV");
    setShowImport(false);
    setImportText("");
  };

  const handleClear = useCallback(() => {
    setTable(createEmptyTable(3, 3));
    toast.info("Reset to a fresh 3×3 table");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleShare = useCallback((): string => {
    handleSaveHistory();
    const r = buildShareUrl(table);
    if (r.tooLarge) {
      toast.error("Table too large for a share link — copied markdown instead.");
      void navigator.clipboard?.writeText(renderMarkdown(table));
      return renderMarkdown(table);
    }
    return r.url;
  }, [table, handleSaveHistory]);

  const handleDownload = useCallback(() => {
    handleSaveHistory();
    return output;
  }, [output, handleSaveHistory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setTable((p) => addRow(p))} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Row
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTable((p) => addColumn(p))} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Column
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button size="sm" variant="ghost" onClick={() => setTable((p) => transposeTable(p))} className="gap-1.5">
              <FlipVertical2 className="h-3.5 w-3.5" /> Transpose
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTable((p) => dedupeRows(p))} className="gap-1.5">
              <CopyX className="h-3.5 w-3.5" /> Dedupe
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTable((p) => boldRow(p, "first"))} className="gap-1.5">
              <Bold className="h-3.5 w-3.5" /> Bold 1st
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTable(toggleHeaderRow)} className="gap-1.5">
              {table.headerRow ? "Header: on" : "Header: off"}
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowImport((s) => !s)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <ClearButton onClick={handleClear} />
            </div>
          </div>
        </CardContent>
      </Card>

      {showImport && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="mtg-import" className="text-xs">
              Paste CSV, TSV, or an existing markdown table
            </Label>
            <Textarea
              id="mtg-import"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Name,Age\nAda,36\nLinus,54\n\n— or —\n\n| Name | Age |\n| --- | --- |\n| Ada | 36 |"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleImport} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import &amp; replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TableIcon className="h-4 w-4" /> Editor
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{stats.rows} rows × {stats.cols} cols</Badge>
              <Badge variant="outline" className="text-[10px]">{stats.cells - stats.emptyCells} filled</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-8 border border-border bg-muted/40 p-1 text-[10px] text-muted-foreground">#</th>
                  {table.headers.map((h, c) => (
                    <th key={c} className="border border-border bg-muted/40 p-1 min-w-[120px]">
                      <div className="flex items-center gap-1 mb-1">
                        <Input
                          value={h}
                          onChange={(e) => updateHeader(c, e.target.value)}
                          className="h-7 text-xs font-semibold"
                          placeholder={`Col ${c + 1}`}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          value={table.aligns[c] ?? "left"}
                          onChange={(e) => updateAlign(c, e.target.value as Alignment)}
                          className="h-6 text-[10px] rounded border bg-background px-1"
                        >
                          <option value="left">L</option>
                          <option value="center">C</option>
                          <option value="right">R</option>
                        </select>
                        <button
                          onClick={() => setTable((p) => moveColumn(p, c, -1))}
                          disabled={c === 0}
                          title="Move column left"
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setTable((p) => moveColumn(p, c, 1))}
                          disabled={c === table.headers.length - 1}
                          title="Move column right"
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setTable((p) => sortRows(p, c, "asc"))}
                          title="Sort asc"
                          className="p-0.5 rounded hover:bg-accent"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setTable((p) => sortRows(p, c, "desc"))}
                          title="Sort desc"
                          className="p-0.5 rounded hover:bg-accent"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setTable((p) => removeColumn(p, c))}
                          disabled={table.headers.length <= 1}
                          title="Remove column"
                          className="p-0.5 rounded hover:bg-destructive/20 disabled:opacity-30"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-8 border border-border bg-muted/40 p-1">
                    <button
                      onClick={() => setTable((p) => addColumn(p))}
                      title="Add column"
                      className="p-0.5 rounded hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    <td className="border border-border bg-muted/40 p-1 text-[10px] text-muted-foreground text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{r + 1}</span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => setTable((p) => moveRow(p, r, -1))}
                            disabled={r === 0}
                            title="Move up"
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setTable((p) => moveRow(p, r, 1))}
                            disabled={r === table.rows.length - 1}
                            title="Move down"
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setTable((p) => removeRow(p, r))}
                            title="Remove row"
                            className="p-0.5 rounded hover:bg-destructive/20"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    {table.headers.map((_, c) => (
                      <td key={c} className="border border-border p-0">
                        <input
                          type="text"
                          value={row[c] ?? ""}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                          className="w-full h-8 px-2 text-xs bg-transparent outline-none focus:bg-accent/30"
                          placeholder=""
                        />
                      </td>
                    ))}
                    <td className="border border-border bg-muted/40 p-1"></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={table.headers.length + 2} className="border border-border p-1 text-center">
                    <button
                      onClick={() => setTable((p) => addRow(p))}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                    >
                      <Plus className="h-3 w-3" /> Add row
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileDown className="h-4 w-4" /> Output
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
              {format === "markdown" && (
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={padded} onChange={(e) => setPadded(e.target.checked)} />
                  Padded
                </label>
              )}
            </div>
          </div>
          <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return output; }} label={`Copy ${FORMAT_LABELS[format]}`} />
            <DownloadButton
              getText={handleDownload}
              filename={`table.${FORMAT_EXT[format]}`}
              mime={FORMAT_MIME[format]}
              label={`Download .${FORMAT_EXT[format]}`}
            />
            <ShareButton getUrl={handleShare} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Stat label="Rows" value={stats.rows} />
            <Stat label="Columns" value={stats.cols} />
            <Stat label="Total cells" value={stats.cells} />
            <Stat label="Empty cells" value={stats.emptyCells} highlight={stats.emptyCells > 0 ? "bad" : "good"} />
            <Stat label="Characters" value={stats.chars} />
          </div>
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.rows}×{h.cols}</Badge>
                  <span className="font-mono text-muted-foreground">{h.preview.slice(0, 80) || "(empty)"}</span>
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
            <strong className="text-foreground">Privacy:</strong> Everything runs in your browser — no
            uploads, no accounts. Pipes and newlines in cells are escaped so the output is always valid
            GFM. History is stored in localStorage on this device only.
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
    ? "text-amber-600 dark:text-amber-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint for icons that may not be referenced
export const _icons = { ArrowDownUp };
