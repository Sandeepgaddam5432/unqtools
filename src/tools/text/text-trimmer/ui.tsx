"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { trimText, trimBatch, diffStatsToCsv, type TrimOptions } from "./logic";

export default function TextTrimmer() {
  const [input, setInput] = useState("  Hello   World  \n\n  This is a test  \n\n\n  Final line  ");
  const [options, setOptions] = useState<TrimOptions>({
    trimBoth: true,
    perLine: true,
    removeEmptyLines: true,
  });
  const [result, setResult] = useState<ReturnType<typeof trimText> | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchResult, setBatchResult] = useState<ReturnType<typeof trimBatch> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trim = useCallback(() => {
    setError(null);
    try {
      if (batchMode) {
        const lines = input.split("\n");
        const r = trimBatch(lines, options);
        setBatchResult(r);
        setResult(null);
      } else {
        const r = trimText(input, options);
        if ("error" in r) { setError(r.error); setResult(null); }
        else { setResult(r); setBatchResult(null); }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, options, batchMode]);

  const getOutputText = useCallback((): string => {
    if (batchResult) return batchResult.map((r) => r.output).join("\n");
    if (result && !("error" in result)) return result.output;
    return "";
  }, [result, batchResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.trimBoth ?? false} onChange={(e) => setOptions({ ...options, trimBoth: e.target.checked })} /><span>Trim both (leading + trailing)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.trimLeading ?? false} onChange={(e) => setOptions({ ...options, trimLeading: e.target.checked })} /><span>Trim leading only</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.trimTrailing ?? false} onChange={(e) => setOptions({ ...options, trimTrailing: e.target.checked })} /><span>Trim trailing only</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.collapseInternalWhitespace ?? false} onChange={(e) => setOptions({ ...options, collapseInternalWhitespace: e.target.checked })} /><span>Collapse internal whitespace</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.removeEmptyLines ?? false} onChange={(e) => setOptions({ ...options, removeEmptyLines: e.target.checked })} /><span>Remove empty lines</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.perLine ?? false} onChange={(e) => setOptions({ ...options, perLine: e.target.checked })} /><span>Apply per line</span></label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.stripMarkdownSyntax ?? false} onChange={(e) => setOptions({ ...options, stripMarkdownSyntax: e.target.checked })} /><span>Strip markdown syntax</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.stripHtmlTags ?? false} onChange={(e) => setOptions({ ...options, stripHtmlTags: e.target.checked })} /><span>Strip HTML tags</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.stripZeroWidthChars ?? false} onChange={(e) => setOptions({ ...options, stripZeroWidthChars: e.target.checked })} /><span>Strip zero-width chars</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.stripBom ?? false} onChange={(e) => setOptions({ ...options, stripBom: e.target.checked })} /><span>Strip BOM</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} /><span>Batch mode (one item per line)</span></label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom chars to trim (each char)</Label>
              <Input value={options.customChars ?? ""} onChange={(e) => setOptions({ ...options, customChars: e.target.value })} placeholder="e.g. x0/" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Strip quotes</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.stripQuotes ?? "none"} onChange={(e) => setOptions({ ...options, stripQuotes: e.target.value as TrimOptions["stripQuotes"] })}>
                <option value="none">None</option>
                <option value="single">Single (')</option>
                <option value="double">Double (")</option>
                <option value="backtick">Backtick (`)</option>
                <option value="all">All quote types</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={trim}>Trim</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("  Hello   World  \n\n  This is a test  \n\n\n  Final line  "); setResult(null); setBatchResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setBatchResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Input</p><p className="text-sm font-bold">{result.inputLength} chars</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Output</p><p className="text-sm font-bold">{result.outputLength} chars</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Chars removed</p><p className="text-sm font-bold text-emerald-500">{result.charsRemoved}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Empty lines removed</p><p className="text-sm font-bold">{result.linesRemoved}</p></CardContent></Card>
          </div>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Output</CardTitle>
                <CopyButton getText={() => result.output} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            </CardContent>
          </Card>
        </>
      )}

      {batchResult && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Batch output ({batchResult.length} results)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={getOutputText} />
                <DownloadButton getText={() => diffStatsToCsv(batchResult, input.split("\n"))} filename="trim-stats.csv" mime="text/csv" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Input</th><th className="p-2 text-left">Output</th><th className="p-2 text-right">Removed</th></tr></thead>
              <tbody>
                {batchResult.map((r, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono">{input.split("\n")[i]}</td>
                    <td className="p-2 font-mono">{r.output}</td>
                    <td className="p-2 text-right font-mono">{r.charsRemoved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all trimming runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
