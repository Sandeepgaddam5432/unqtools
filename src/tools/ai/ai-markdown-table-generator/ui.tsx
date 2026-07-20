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
  ALIGNMENT_VALUES,
  ALIGNMENT_LABELS,
  CASE_VALUES,
  CASE_LABELS,
  MODE_VALUES,
  MODE_LABELS,
  LLM_KEY_STORAGE,
  SAMPLE_TABLES,
  detectFormat,
  parseInput,
  generateTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Alignment,
  type CaseTransform,
  type InputFormat,
  type OutputMode,
  type SortDirection,
  type TableOptions,
  type TableTransforms,
  type HistoryEntry,
} from "./logic";
import {
  Table, History, Key, Sparkles, ArrowUpDown, ArrowLeftRight,
  CopyCheck, FilterX,
} from "lucide-react";

type Tab = "markdown" | "html" | "csv" | "json" | "history";

export default function AiMarkdownTableGenerator() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<InputFormat>("auto");
  const [alignmentsText, setAlignmentsText] = useState<string>("");
  const [mode, setMode] = useState<OutputMode>("compact");
  const [boldHeader, setBoldHeader] = useState(true);
  const [brForNewlines, setBrForNewlines] = useState(true);
  const [nfEnabled, setNfEnabled] = useState(false);
  const [nfDecimals, setNfDecimals] = useState(2);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [transpose, setTranspose] = useState(false);
  const [dedupe, setDedupe] = useState(false);
  const [caseTransform, setCaseTransform] = useState<CaseTransform>("none");
  const [tab, setTab] = useState<Tab>("markdown");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmResult, setLlmResult] = useState("");
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    try {
      const k = localStorage.getItem(LLM_KEY_STORAGE);
      if (k) setLlmKey(k);
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setFormat(parsed.format);
        setInput(parsed.input);
        setAlignmentsText(parsed.alignments.join(","));
        setMode(parsed.mode);
        setBoldHeader(parsed.boldHeader);
        setBrForNewlines(parsed.brForNewlines);
        setNfEnabled(parsed.numberFormat.enabled);
        setNfDecimals(parsed.numberFormat.decimals);
        setSortColumn(parsed.sortColumn);
        setSortDirection(parsed.sortDirection);
        setTranspose(parsed.transpose);
        setDedupe(parsed.dedupe);
        setCaseTransform(parsed.caseTransform);
        if (parsed.input) toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedFormat = useMemo(
    () => (format === "auto" ? detectFormat(input) : format),
    [format, input],
  );

  // Parse to know headers count for column-picker UIs
  const parsed = useMemo(
    () => (input.trim() ? parseInput(input, format) : { headers: [] as string[], rows: [] as string[][] }),
    [input, format],
  );

  // Parse alignments from comma-separated string (e.g. "left,right,default")
  const alignments: Alignment[] = useMemo(() => {
    if (!alignmentsText.trim()) return [];
    const valid: Alignment[] = ["default", "left", "center", "right"];
    return alignmentsText
      .split(",")
      .map((s) => s.trim().toLowerCase() as Alignment)
      .filter((a) => valid.includes(a));
  }, [alignmentsText]);

  const options: TableOptions = useMemo(
    () => ({
      alignments,
      mode,
      boldHeader,
      brForNewlines,
      numberFormat: { enabled: nfEnabled, decimals: nfDecimals },
    }),
    [alignments, mode, boldHeader, brForNewlines, nfEnabled, nfDecimals],
  );

  const transforms: TableTransforms = useMemo(
    () => ({
      sortColumn,
      sortDirection,
      transpose,
      dedupe,
      caseTransform,
    }),
    [sortColumn, sortDirection, transpose, dedupe, caseTransform],
  );

  const result = useMemo(
    () => generateTable(input, format, options, transforms),
    [input, format, options, transforms],
  );

  const handleSaveHistory = useCallback(() => {
    if (result.rowCount > 0) {
      saveHistory({
        ts: Date.now(),
        format: detectedFormat,
        rowCount: result.rowCount,
        columnCount: result.columnCount,
        preview: input.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [result, input, detectedFormat]);

  const handleClear = useCallback(() => {
    setInput("");
    setAlignmentsText("");
    setSortColumn(null);
    setSortDirection("asc");
    setTranspose(false);
    setDedupe(false);
    setCaseTransform("none");
    setNfEnabled(false);
    setNfDecimals(2);
    setLlmResult("");
    setLlmError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback((sample: { format: InputFormat; input: string }) => {
    setFormat(sample.format);
    setInput(sample.input);
    toast.success(`Loaded sample (${sample.format})`);
  }, []);

  const toggleSortColumn = (i: number) => {
    if (sortColumn === i) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortColumn(null); setSortDirection("asc"); }
    } else {
      setSortColumn(i);
      setSortDirection("asc");
    }
  };

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    if (!input.trim()) {
      toast.error("Paste some input data first");
      return;
    }
    setLlmBusy(true);
    setLlmError(null);
    try {
      const prompt = buildLlmPrompt(input, detectedFormat);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const rendered = renderLlmResult(raw);
      setLlmResult(rendered);
      setFormat("markdown");
      setInput(rendered);
      toast.success("LLM polish applied — verify the result!");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
      toast.error("LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, input, detectedFormat]);

  const currentOutput = useMemo(() => {
    switch (tab) {
      case "markdown": return result.markdown;
      case "html": return result.html;
      case "csv": return result.csv;
      case "json": return result.json;
      default: return "";
    }
  }, [tab, result]);

  const currentFilename = useMemo(() => {
    switch (tab) {
      case "markdown": return "table.md";
      case "html": return "table.html";
      case "csv": return "table.csv";
      case "json": return "table.json";
      default: return "table.txt";
    }
  }, [tab]);

  const currentMime = useMemo(() => {
    switch (tab) {
      case "markdown": return "text/markdown";
      case "html": return "text/html";
      case "csv": return "text/csv";
      case "json": return "application/json";
      default: return "text/plain";
    }
  }, [tab]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt-format" className="text-xs">Input format</Label>
              <select
                id="amt-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as InputFormat)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                <option value="auto">Auto-detect (detected: {detectedFormat})</option>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown (import)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Output mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as OutputMode)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {MODE_VALUES.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt-input" className="text-xs">
              Input data (CSV / TSV / JSON / Markdown table)
            </Label>
            <Textarea
              id="amt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"a,b,c\n1,2,3\n4,5,6"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_TABLES.map((s) => (
                <Button
                  key={s.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(s)}
                >+ {s.name}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt-align" className="text-xs">
              Per-column alignments (comma-separated: left,center,right,default) — optional
            </Label>
            <Input
              id="amt-align"
              value={alignmentsText}
              onChange={(e) => setAlignmentsText(e.target.value)}
              placeholder="left,right"
              className="font-mono text-xs"
            />
            {parsed.headers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {parsed.headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground font-mono">{h || `#${i + 1}`}:</span>
                    <select
                      value={alignments[i] ?? "default"}
                      onChange={(e) => {
                        const next = [...alignments];
                        while (next.length < i) next.push("default");
                        next[i] = e.target.value as Alignment;
                        setAlignmentsText(next.join(","));
                      }}
                      className="h-6 text-[10px] rounded border bg-background px-1"
                    >
                      {ALIGNMENT_VALUES.map((a) => (
                        <option key={a} value={a}>{ALIGNMENT_LABELS[a]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={boldHeader}
                onChange={(e) => setBoldHeader(e.target.checked)}
              />
              Bold header
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={brForNewlines}
                onChange={(e) => setBrForNewlines(e.target.checked)}
              />
              Newlines → &lt;br&gt;
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={transpose}
                onChange={(e) => setTranspose(e.target.checked)}
              />
              Transpose
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dedupe}
                onChange={(e) => setDedupe(e.target.checked)}
              />
              Dedupe rows
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={nfEnabled}
                onChange={(e) => setNfEnabled(e.target.checked)}
              />
              Format numbers
            </label>
            {nfEnabled && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                Decimals:
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={nfDecimals}
                  onChange={(e) => setNfDecimals(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                  className="h-7 w-14 text-xs"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Case transform</Label>
              <select
                value={caseTransform}
                onChange={(e) => setCaseTransform(e.target.value as CaseTransform)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CASE_VALUES.map((c) => (
                  <option key={c} value={c}>{CASE_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort column (0-indexed; click column header below to toggle)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={-1}
                  value={sortColumn ?? -1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSortColumn(v < 0 ? null : v);
                  }}
                  className="h-9 w-20 text-sm"
                />
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                  className="h-9 flex-1 text-sm rounded border bg-background px-2"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>

          {parsed.headers.length > 0 && (
            <div className="rounded border bg-muted/30 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Click a column header to sort
              </div>
              <div className="flex flex-wrap gap-1">
                {parsed.headers.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSortColumn(i)}
                    className={`h-6 px-2 text-[11px] rounded border flex items-center gap-1 ${
                      sortColumn === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    {h || `Col ${i + 1}`}
                    {sortColumn === i && (
                      <span className="text-[9px]">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLlm((v) => !v)}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Polish with LLM"}
            </Button>
            <ClearButton onClick={handleClear} />
          </div>

          {showLlm && (
            <div className="rounded border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> OpenAI API key (BYO — stored in localStorage only)
              </Label>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleLlmKeySave}>Save key</Button>
                <Button
                  size="sm"
                  onClick={handleLlmEnhance}
                  disabled={llmBusy || !llmKey || !input.trim()}
                  className="gap-1.5"
                >
                  {llmBusy ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {llmBusy ? "Polishing…" : "Polish table"}
                </Button>
              </div>
              {llmError && <ErrorBanner message={llmError} />}
              {llmResult && (
                <p className="text-[11px] text-muted-foreground">
                  Last LLM result loaded into the input box (Markdown format). Verify against the original data.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {result.markdown ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table className="h-4 w-4" /> Generated table
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Rows" value={result.rowCount} />
                <Stat label="Columns" value={result.columnCount} />
                <Stat label="Chars" value={result.charCount} />
                <Stat label="Format" value={detectedFormat} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["markdown", "html", "csv", "json"] as Tab[]).map((t) => (
                    <Button
                      key={t}
                      variant={tab === t ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setTab(t)}
                    >{t.toUpperCase()}</Button>
                  ))}
                </div>
              </div>
              <Textarea
                value={currentOutput}
                readOnly
                className="min-h-[260px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return currentOutput; }}
                  label={`Copy ${tab.toUpperCase()}`}
                />
                <DownloadButton
                  getText={() => currentOutput}
                  filename={currentFilename}
                  mime={currentMime}
                  label={`Download .${tab === "markdown" ? "md" : tab}`}
                />
                <ShareButton getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({
                    format, input, alignments, mode, boldHeader, brForNewlines,
                    numberFormat: { enabled: nfEnabled, decimals: nfDecimals },
                    sortColumn, sortDirection, transpose, dedupe, caseTransform,
                  });
                }} />
              </div>
              {tab === "markdown" && (
                <div className="rounded border bg-muted/30 p-3 overflow-auto">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
                  <div className="prose dark:prose-invert max-w-none text-xs">
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">{result.markdown}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste CSV/TSV/JSON/Markdown to generate a GFM table"
          hint="Click a sample to load demo data. Auto-detects the format; toggle alignment, sort, transpose, dedupe, and case transforms. Round-trips existing Markdown tables."
          icon={<Table className="h-8 w-8" />}
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
                  onClick={() => { setFormat(h.format); setInput(h.preview); toast.info("Loaded preview — paste full data to regenerate"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.format}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.rowCount}×{h.columnCount}</Badge>
                  <span className="font-mono text-muted-foreground truncate">{h.preview.slice(0, 60)}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, alignment, transforms, and Markdown serialization run locally in your browser. Nothing is uploaded. The only network call is if you paste your own LLM API key and click 'Polish' — that goes directly to OpenAI.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <ArrowLeftRight className="inline h-3 w-3" /> Round-trip: paste a GFM Markdown table to re-edit it. <FilterX className="inline h-3 w-3" /> Honesty: GFM is the default flavor; rendering varies slightly across Markdown parsers.
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
