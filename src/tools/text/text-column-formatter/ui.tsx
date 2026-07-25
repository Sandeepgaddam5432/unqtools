"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { process, toCsv, toMarkdown, validateOptions, type Alignment, type ColumnOptions } from "./logic";

export default function TextColumnFormatter() {
  const [input, setInput] = useState("apple banana cherry date elderberry fig grape honeydew");
  const [columns, setColumns] = useState(3);
  const [width, setWidth] = useState(10);
  const [separator, setSeparator] = useState(" | ");
  const [alignment, setAlignment] = useState<Alignment>("left");
  const [fillChar, setFillChar] = useState(" ");
  const [header, setHeader] = useState("");
  const [border, setBorder] = useState(false);
  const [csvInput, setCsvInput] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opts: ColumnOptions = useMemo(
    () => ({
      columns,
      width,
      separator,
      alignment,
      fillChar,
      header: header ? header.split(csvInput ? csvDelimiter : /\s+/).map((s) => s.trim()).filter(Boolean) : undefined,
      border,
      csvInput,
      csvDelimiter,
    }),
    [columns, width, separator, alignment, fillChar, header, border, csvInput, csvDelimiter],
  );

  const run = useCallback(() => {
    setError(null);
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    const r = process(input, opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [input, opts]);

  const csvOut = useMemo(() => {
    if (!result || "error" in result) return "";
    return toCsv(input, opts);
  }, [result, input, opts]);

  const mdOut = useMemo(() => {
    if (!result || "error" in result) return "";
    return toMarkdown(input, opts);
  }, [result, input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input items ({csvInput ? "CSV" : "whitespace-separated"})</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Columns</Label>
              <Input type="number" min={1} max={20} value={columns} onChange={(e) => setColumns(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input type="number" min={1} max={200} value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <Input value={separator} onChange={(e) => setSeparator(e.target.value)} disabled={border} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={alignment} onChange={(e) => setAlignment(e.target.value as Alignment)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fill char</Label>
              <Input value={fillChar} maxLength={1} onChange={(e) => setFillChar(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Header row (optional)</Label>
              <Input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Col1, Col2, Col3" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">CSV delimiter</Label>
              <Input value={csvDelimiter} maxLength={1} onChange={(e) => setCsvDelimiter(e.target.value)} disabled={!csvInput} />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} /> Border
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={csvInput} onChange={(e) => setCsvInput(e.target.checked)} /> CSV input
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Format</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("apple banana cherry date elderberry fig grape honeydew"); setHeader(""); setBorder(false); setCsvInput(false); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{result.rowsOutput} rows</Badge>
              <Badge variant="secondary">{result.columnsUsed} cols</Badge>
              <Badge variant="secondary">{result.stats.truncated} truncated</Badge>
              <Badge variant="secondary">{result.stats.padded} padded</Badge>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="columns.txt" />
                <DownloadButton getText={() => csvOut} filename="columns.csv" mime="text/csv" />
                <DownloadButton getText={() => mdOut} filename="columns.md" mime="text/markdown" />
              </div>
            </div>
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre">{result.output}</pre>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Markdown version</summary>
              <pre className="mt-2 text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre">{mdOut}</pre>
            </details>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all formatting runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
