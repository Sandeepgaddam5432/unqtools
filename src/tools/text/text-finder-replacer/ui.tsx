"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { process, batchProcess, batchToCsv, type FindOptions } from "./logic";

export default function TextFinderReplacer() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog.");
  const [find, setFind] = useState("the");
  const [replace, setReplace] = useState("a");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [batchRows, setBatchRows] = useState<ReturnType<typeof batchProcess> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const opts: FindOptions = { find, replace, useRegex, caseSensitive, wholeWord };
    if (batchMode) {
      const rows = batchProcess(input.split("\n"), opts);
      setBatchRows(rows);
      setResult(null);
    } else {
      const r = process(input, opts);
      if ("error" in r) { setError(r.error); setResult(null); }
      else { setResult(r); setBatchRows(null); }
    }
  }, [input, find, replace, useRegex, caseSensitive, wholeWord, batchMode]);

  const outputText = useCallback((): string => {
    if (batchRows) return batchRows.map((r) => "error" in r.result ? "" : r.result.output).join("\n");
    if (result && !("error" in result)) return result.output;
    return "";
  }, [result, batchRows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Find</Label>
              <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="text or regex" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Replace</Label>
              <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="replacement" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} /><span>Use regex</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /><span>Case-sensitive</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} /><span>Whole word</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} /><span>Batch mode (line-by-line)</span></label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setBatchRows(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{result.matches} matches</Badge>
              {result.matchLines.length > 0 && <Badge variant="outline">lines: {result.matchLines.join(", ")}</Badge>}
              <div className="ml-auto flex gap-2"><CopyButton getText={() => result.output} /></div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.output}</pre>
          </CardContent>
        </Card>
      )}

      {batchRows && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{batchRows.length} rows</Badge>
              <div className="flex gap-2">
                <CopyButton getText={outputText} />
                <DownloadButton getText={() => batchToCsv(batchRows)} filename="replace.csv" mime="text/csv" />
              </div>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Input</th><th className="p-2 text-left">Output</th><th className="p-2 text-right">Matches</th></tr></thead>
              <tbody>
                {batchRows.map((r, i) => {
                  const out = "error" in r.result ? r.result.error : r.result.output;
                  const m = "error" in r.result ? 0 : r.result.matches;
                  return (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono">{r.input}</td>
                      <td className="p-2 font-mono">{out}</td>
                      <td className="p-2 text-right font-mono">{m}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
