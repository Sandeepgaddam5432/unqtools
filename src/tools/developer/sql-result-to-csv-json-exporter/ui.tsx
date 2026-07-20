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
  DEFAULT_PARSE,
  DEFAULT_EXPORT,
  parseInput,
  convert,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  type InputFormat,
  type OutputFormat,
  type CsvDelimiter,
  type CsvQuoting,
  type HistoryEntry,
} from "./logic";
import { History, FileOutput, Database, AlertTriangle } from "lucide-react";

const INPUT_LABELS: Record<InputFormat, string> = {
  "auto": "Auto-detect",
  "grid-tab": "Grid (tab-separated)",
  "grid-pipe": "Grid (pipe-separated)",
  "grid-comma": "Grid (CSV)",
  "grid-whitespace": "Grid (whitespace)",
  "insert": "INSERT statements",
  "markdown": "Markdown table",
};

const OUTPUT_LABELS: Record<OutputFormat, string> = {
  csv: "CSV",
  json: "JSON (array)",
  ndjson: "NDJSON",
  tsv: "TSV",
  markdown: "Markdown",
  html: "HTML table",
};

const OUTPUT_MIME: Record<OutputFormat, string> = {
  csv: "text/csv",
  json: "application/json",
  ndjson: "application/x-ndjson",
  tsv: "text/tab-separated-values",
  markdown: "text/markdown",
  html: "text/html",
};

const OUTPUT_EXT: Record<OutputFormat, string> = {
  csv: "csv", json: "json", ndjson: "ndjson", tsv: "tsv", markdown: "md", html: "html",
};

export default function SqlResultToCsvJsonExporter() {
  const [input, setInput] = useState("");
  const [inFmt, setInFmt] = useState<InputFormat>("auto");
  const [outFmt, setOutFmt] = useState<OutputFormat>("csv");
  const [hasHeader, setHasHeader] = useState(true);
  const [nullToken, setNullToken] = useState("NULL");
  const [emptyAsNull, setEmptyAsNull] = useState(true);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [quoting, setQuoting] = useState<CsvQuoting>("auto");
  const [prettyJson, setPrettyJson] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [columnSelect, setColumnSelect] = useState<string>("");
  const [columnLabels, setColumnLabels] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const { parseOpts, exportOpts } = parseShareUrl(window.location.hash);
      if (parseOpts.format) setInFmt(parseOpts.format);
      if (parseOpts.hasHeader !== undefined) setHasHeader(parseOpts.hasHeader);
      if (parseOpts.nullToken !== undefined) setNullToken(parseOpts.nullToken);
      if (parseOpts.emptyAsNull !== undefined) setEmptyAsNull(parseOpts.emptyAsNull);
      if (exportOpts.format) setOutFmt(exportOpts.format);
      if (exportOpts.delimiter) setDelimiter(exportOpts.delimiter);
      if (exportOpts.quoting) setQuoting(exportOpts.quoting);
      if (exportOpts.prettyJson !== undefined) setPrettyJson(exportOpts.prettyJson);
      if (exportOpts.includeHeader !== undefined) setIncludeHeader(exportOpts.includeHeader);
      if (parseOpts.format || exportOpts.format) toast.info("Loaded settings from share link");
    }
  }, []);

  const parseOpts = useMemo(
    () => ({ ...DEFAULT_PARSE, format: inFmt, hasHeader, nullToken, emptyAsNull }),
    [inFmt, hasHeader, nullToken, emptyAsNull],
  );

  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    try {
      setError("");
      return parseInput(input, parseOpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [input, parseOpts]);

  // Column-select + label maps
  const selectArr = useMemo(
    () => columnSelect.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    [columnSelect],
  );
  const labelMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const line of columnLabels.split("\n")) {
      const m = line.match(/^([^=]+)=(.+)$/);
      if (m) out[m[1].trim()] = m[2].trim();
    }
    return out;
  }, [columnLabels]);

  const exportOpts = useMemo(
    () => ({
      ...DEFAULT_EXPORT,
      format: outFmt,
      delimiter,
      quoting,
      prettyJson,
      includeHeader,
      columnSelect: selectArr,
      columnLabels: labelMap,
    }),
    [outFmt, delimiter, quoting, prettyJson, includeHeader, selectArr, labelMap],
  );

  const result = useMemo(() => {
    if (!input.trim() || !parsed) return null;
    try {
      return convert(input, parseOpts, exportOpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [input, parsed, parseOpts, exportOpts]);

  const handleSaveHistory = useCallback(() => {
    if (result && result.stats.rowCount > 0) {
      saveHistory({
        ts: Date.now(),
        inputFormat: parsed?.format ?? inFmt,
        outputFormat: outFmt,
        rowCount: result.stats.rowCount,
        columnCount: result.stats.columnCount,
        outputBytes: result.stats.outputBytes,
      });
      setHistory(loadHistory());
    }
  }, [result, parsed, inFmt, outFmt]);

  const handleClear = useCallback(() => {
    setInput("");
    setColumnSelect("");
    setColumnLabels("");
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const sampleInput = `INSERT INTO users (id, name, email, active, signup) VALUES
  (1, 'Alice', 'alice@example.com', true, '2024-01-15'),
  (2, 'Bob', 'bob@example.com', false, '2024-02-20'),
  (3, 'Carol', NULL, true, '2024-03-30');`;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sr-input">SQL result text (paste grid, INSERT statements, or Markdown table)</Label>
            <Button variant="ghost" size="sm" onClick={() => setInput(sampleInput)} className="h-7 text-[11px]">
              Load sample
            </Button>
          </div>
          <Textarea
            id="sr-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={sampleInput}
            className="min-h-[160px] resize-y font-mono text-xs"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <Label className="text-[10px] uppercase">Input format</Label>
              <select
                value={inFmt}
                onChange={(e) => setInFmt(e.target.value as InputFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {INPUT_FORMATS.map((f) => <option key={f} value={f}>{INPUT_LABELS[f]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase">Output format</Label>
              <select
                value={outFmt}
                onChange={(e) => setOutFmt(e.target.value as OutputFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{OUTPUT_LABELS[f]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase">CSV delimiter</Label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as CsvDelimiter)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
                disabled={outFmt !== "csv"}
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value={"\t"}>Tab</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase">CSV quoting</Label>
              <select
                value={quoting}
                onChange={(e) => setQuoting(e.target.value as CsvQuoting)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
                disabled={outFmt !== "csv"}
              >
                <option value="auto">Auto</option>
                <option value="always">Always quote</option>
                <option value="never">Never quote</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Input has header
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={emptyAsNull} onChange={(e) => setEmptyAsNull(e.target.checked)} />
              Empty = NULL
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} />
              Output header row
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={prettyJson} onChange={(e) => setPrettyJson(e.target.checked)} disabled={outFmt !== "json"} />
              Pretty JSON
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <Label className="text-[10px] uppercase">NULL token (input)</Label>
              <input
                value={nullToken}
                onChange={(e) => setNullToken(e.target.value)}
                className="h-8 w-full text-xs rounded border bg-background px-2 font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Column select (comma/newline-separated)</Label>
              <input
                value={columnSelect}
                onChange={(e) => setColumnSelect(e.target.value)}
                placeholder="name, id"
                className="h-8 w-full text-xs rounded border bg-background px-2 font-mono"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Column renames (one per line: old=new)</Label>
            <Textarea
              value={columnLabels}
              onChange={(e) => setColumnLabels(e.target.value)}
              placeholder={"id=ID\nname=Full Name"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {parsed && parsed.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          <div className="flex items-center gap-1.5 font-medium mb-1">
            <AlertTriangle className="h-4 w-4" /> {parsed.warnings.length} warning(s)
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {parsed.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {result && result.result.columns.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Preview ({result.stats.rowCount} rows × {result.stats.columnCount} cols)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Rows" value={result.stats.rowCount} />
                <Stat label="Columns" value={result.stats.columnCount} />
                <Stat label="NULLs" value={result.stats.nullCount} />
                <Stat label="Output bytes" value={result.stats.outputBytes} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.result.columns.map((c) => (
                  <Badge key={c.name} variant="outline" className="text-[10px]">
                    {c.label ?? c.name}
                    <span className="ml-1 text-muted-foreground">: {c.type}</span>
                  </Badge>
                ))}
              </div>
              <div className="overflow-auto max-h-[300px] rounded border">
                <table className="min-w-full text-xs font-mono">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {result.result.columns.map((c) => (
                        <th key={c.name} className="text-left px-2 py-1 border-b whitespace-nowrap">
                          {c.label ?? c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.result.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 border-b whitespace-nowrap">
                            {cell === "" ? <span className="text-muted-foreground italic">∅</span> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.result.rows.length > 50 && (
                  <div className="p-2 text-center text-[10px] text-muted-foreground">
                    … showing first 50 of {result.result.rows.length} rows
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileOutput className="h-4 w-4" /> {OUTPUT_LABELS[outFmt]} output
              </h3>
              <Textarea
                readOnly
                value={result.output}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return result.output; }} label="Copy output" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return result.output; }}
                  filename={`sql-export.${OUTPUT_EXT[outFmt]}`}
                  mime={OUTPUT_MIME[outFmt]}
                  label="Download"
                />
                <ShareButton
                  getUrl={() => { handleSaveHistory(); return buildShareUrl(parseOpts, exportOpts); }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste SQL results to export"
          hint="Paste a result grid (tab/pipe/CSV), INSERT statements, or a Markdown table. Output formats: CSV / JSON / NDJSON / TSV / Markdown / HTML. Click 'Load sample' to try it."
          icon={<FileOutput className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.inputFormat}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">→ {h.outputFormat}</Badge>
                  <span className="text-muted-foreground">{h.rowCount} rows × {h.columnCount} cols · {h.outputBytes} B</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing and conversion runs locally in your browser. Nothing is uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label, value,
}: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
