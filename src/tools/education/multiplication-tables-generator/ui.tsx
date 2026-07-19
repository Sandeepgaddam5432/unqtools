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
  DEFAULT_INPUT,
  SIZE_PRESETS,
  COLOR_SCHEME_LABELS,
  MODE_LABELS,
  validateInput,
  sanitizeInput,
  generateTables,
  renderText,
  renderHtml,
  renderCsv,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TableInput,
  type Mode,
  type ColorScheme,
  type HistoryEntry,
} from "./logic";
import { History, Grid3x3, Printer } from "lucide-react";

export default function MultiplicationTablesGenerator() {
  const [input, setInput] = useState<TableInput>({ ...DEFAULT_INPUT });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setInput(parsed);
      if (parsed && window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  const validation = useMemo(() => validateInput(input), [input]);
  const clean = useMemo(() => sanitizeInput(input), [input]);
  const { tables, summary } = useMemo(() => generateTables(clean), [clean]);
  const text = useMemo(() => renderText(tables), [tables]);
  const html = useMemo(() => renderHtml(tables, clean.colorScheme), [tables, clean.colorScheme]);
  const csv = useMemo(() => renderCsv(tables), [tables]);
  const md = useMemo(() => renderMarkdown(tables), [tables]);

  const handleSaveHistory = useCallback(() => {
    if (tables.length > 0 && summary.totalCells > 0) {
      saveHistory({
        ts: Date.now(),
        mode: clean.mode,
        startNumber: clean.startNumber,
        endNumber: clean.endNumber,
        tableSize: clean.tableSize,
        totalCells: summary.totalCells,
      });
      setHistory(loadHistory());
    }
  }, [tables, summary, clean]);

  const handlePrint = useCallback(() => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Could not open print window");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  }, [html]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const patch = (p: Partial<TableInput>) => setInput((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Mode</Label>
            <select
              value={input.mode}
              onChange={(e) => patch({ mode: e.target.value as Mode })}
              className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
            >
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="mtg-start" className="text-xs">Start number</Label>
              <Input
                id="mtg-start"
                type="number"
                value={input.startNumber}
                onChange={(e) => patch({ startNumber: Number(e.target.value) })}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="mtg-end" className="text-xs">End number</Label>
              <Input
                id="mtg-end"
                type="number"
                value={input.endNumber}
                onChange={(e) => patch({ endNumber: Number(e.target.value) })}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="mtg-size" className="text-xs">
                Table size {clean.mode === "complete-grid" ? "(derived from range)" : ""}
              </Label>
              <Input
                id="mtg-size"
                type="number"
                min={1}
                max={25}
                value={input.tableSize}
                onChange={(e) => patch({ tableSize: Number(e.target.value) })}
                disabled={clean.mode === "complete-grid"}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SIZE_PRESETS.map((n) => (
              <Button
                key={n}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => {
                  patch({ tableSize: n, startNumber: 1, endNumber: n, mode: "complete-grid" });
                  toast.info(`Preset ${n}×${n} grid applied`);
                }}
              >{n}×{n}</Button>
            ))}
          </div>
          <div>
            <Label className="text-xs">Color scheme</Label>
            <select
              value={input.colorScheme}
              onChange={(e) => patch({ colorScheme: e.target.value as ColorScheme })}
              className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
            >
              {(Object.keys(COLOR_SCHEME_LABELS) as ColorScheme[]).map((c) => (
                <option key={c} value={c}>{COLOR_SCHEME_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={input.highlightMultiples}
              onChange={(e) => patch({ highlightMultiples: e.target.checked })}
            />
            Highlight multiples
          </label>
          {!validation.ok && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {validation.errors.map((e, i) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tables.length > 0 && summary.totalCells > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Grid3x3 className="h-4 w-4" /> {summary.totalTables} table(s) · {summary.totalCells} cells
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tables" value={summary.totalTables} />
                <Stat label="Total cells" value={summary.totalCells} />
                <Stat label="Range" value={`${summary.rangeMin}–${summary.rangeMax}`} />
                <Stat label="Max product" value={summary.maxProduct} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Grid3x3 className="h-4 w-4" /> Tables
                </h3>
                <Badge variant="outline" className="text-[10px]">{MODE_LABELS[clean.mode].split(" ")[0]}</Badge>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-auto">
                {tables.map((t, ti) => (
                  <TablePreview key={ti} table={t} scheme={clean.colorScheme} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="multiplication-tables.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return html; }}
                  filename="multiplication-tables.html"
                  mime="text/html"
                  label="Download .html"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="multiplication-tables.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return md; }}
                  filename="multiplication-tables.md"
                  mime="text/markdown"
                  label="Download MD"
                />
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Pick a mode and numbers to generate tables"
          hint="Single-table generates one number × 1 to N; range generates multiple tables side-by-side; complete-grid builds an NxN matrix."
          icon={<Grid3x3 className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => setInput({
                    mode: h.mode,
                    startNumber: h.startNumber,
                    endNumber: h.endNumber,
                    tableSize: h.tableSize,
                    highlightMultiples: true,
                    colorScheme: "rainbow",
                  })}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <Badge variant="outline" className="mr-2">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalCells} cells</Badge>
                  <span className="text-muted-foreground">
                    {h.startNumber === h.endNumber
                      ? `× ${h.startNumber}`
                      : `${h.startNumber}–${h.endNumber}`} · size {h.tableSize}
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TablePreview({
  table,
  scheme,
}: {
  table: { base: number; cells: { i: number; j: number; product: number; isHighlight: boolean }[] };
  scheme: ColorScheme;
}) {
  // Build matrix.
  const rowsByI = new Map<number, typeof table.cells>();
  const jSet = new Set<number>();
  for (const c of table.cells) {
    if (!rowsByI.has(c.i)) rowsByI.set(c.i, []);
    rowsByI.get(c.i)!.push(c);
    jSet.add(c.j);
  }
  const js = Array.from(jSet).sort((a, b) => a - b);
  const is = Array.from(rowsByI.keys()).sort((a, b) => a - b);
  return (
    <div className="rounded border bg-background p-2">
      <div className="text-[11px] font-medium mb-1 text-foreground">× Table of {table.base}</div>
      <div className="overflow-auto">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-border bg-muted px-2 py-1">×</th>
              {js.map((j) => (
                <th key={j} className="border border-border bg-muted px-2 py-1">{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {is.map((i) => {
              const rowCells = rowsByI.get(i)!.sort((a, b) => a.j - b.j);
              const byJ = new Map(rowCells.map((c) => [c.j, c]));
              return (
                <tr key={i}>
                  <th className="border border-border bg-muted px-2 py-1">{i}</th>
                  {js.map((j) => {
                    const c = byJ.get(j);
                    if (!c) return <td key={j} className="border border-border px-2 py-1" />;
                    const color = cellColorPreview(c.product, table.base, scheme);
                    return (
                      <td
                        key={j}
                        className="border border-border px-2 py-1 text-center font-mono"
                        style={{
                          background: color,
                          fontWeight: c.isHighlight ? 700 : 400,
                          outline: c.isHighlight ? "2px solid #f59e0b" : undefined,
                          outlineOffset: c.isHighlight ? "-2px" : undefined,
                        }}
                      >
                        {c.product}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellColorPreview(product: number, base: number, scheme: ColorScheme): string {
  if (scheme === "mono") {
    const t = Math.min(1, Math.abs(product) / 100);
    const v = Math.round(245 - t * 100);
    return `rgb(${v}, ${v}, ${v})`;
  }
  if (scheme === "blue-scale") {
    const t = Math.min(1, Math.abs(product) / 100);
    const r = Math.round(219 - t * 180);
    const g = Math.round(234 - t * 180);
    const b = Math.round(254 - t * 80);
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (scheme === "green-scale") {
    const t = Math.min(1, Math.abs(product) / 100);
    const r = Math.round(220 - t * 150);
    const g = Math.round(252 - t * 80);
    const b = Math.round(231 - t * 180);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const hue = ((base * 37) % 360 + 360) % 360;
  return `hsl(${hue}, 70%, 80%)`;
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
