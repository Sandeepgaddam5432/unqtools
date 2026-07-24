"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { sortText, statsToCsv, type SortOptions, type SortBy, type SortUnit } from "./logic";

export default function TextSorter() {
  const [input, setInput] = useState("banana\napple\ncherry\n10\n2\n1");
  const [options, setOptions] = useState<SortOptions>({
    unit: "lines", by: "alphabetical", reverse: false, caseInsensitive: false,
    removeDuplicates: false, keepEmpty: false, csvDelimiter: ",",
  });
  const [result, setResult] = useState<ReturnType<typeof sortText> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sort = useCallback(() => {
    setError(null);
    try {
      const r = sortText(input, options);
      if ("error" in r) { setError(r.error); setResult(null); }
      else { setResult(r); }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, options]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sort unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.unit} onChange={(e) => setOptions({ ...options, unit: e.target.value as SortUnit })}>
                <option value="lines">Lines</option>
                <option value="words">Words</option>
                <option value="paragraphs">Paragraphs</option>
                <option value="csv-column">CSV column</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sort by</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.by} onChange={(e) => setOptions({ ...options, by: e.target.value as SortBy })}>
                <option value="alphabetical">Alphabetical</option>
                <option value="numeric">Numeric</option>
                <option value="natural">Natural (numeric-aware)</option>
                <option value="length">Length</option>
                <option value="random">Random</option>
                <option value="reverse">Reverse (only)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Locale (BCP-47)</Label>
              <Input value={options.locale ?? ""} onChange={(e) => setOptions({ ...options, locale: e.target.value || undefined })} placeholder="en-US" />
            </div>
            {options.unit === "csv-column" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">CSV column (0-indexed)</Label>
                  <Input type="number" min="0" value={options.csvColumn ?? 0} onChange={(e) => setOptions({ ...options, csvColumn: Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">CSV delimiter</Label>
                  <Input value={options.csvDelimiter ?? ","} onChange={(e) => setOptions({ ...options, csvDelimiter: e.target.value })} />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.reverse ?? false} onChange={(e) => setOptions({ ...options, reverse: e.target.checked })} /><span>Reverse</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.caseInsensitive ?? false} onChange={(e) => setOptions({ ...options, caseInsensitive: e.target.checked })} /><span>Case-insensitive</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.removeDuplicates ?? false} onChange={(e) => setOptions({ ...options, removeDuplicates: e.target.checked })} /><span>Remove duplicates</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.keepEmpty ?? false} onChange={(e) => setOptions({ ...options, keepEmpty: e.target.checked })} /><span>Keep empty lines</span></label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={sort}>Sort</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("banana\napple\ncherry\n10\n2\n1"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Input</p><p className="text-sm font-bold">{result.inputCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Output</p><p className="text-sm font-bold">{result.outputCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Duplicates removed</p><p className="text-sm font-bold">{result.duplicatesRemoved}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sort by</p><p className="text-sm font-bold">{options.by}</p></CardContent></Card>
          </div>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Sorted output</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => result.output} />
                  <DownloadButton getText={() => statsToCsv(result, options)} filename="sort-stats.csv" mime="text/csv" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-auto">{result.output}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all sorting runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
