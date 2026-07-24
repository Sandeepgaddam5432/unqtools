"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { process, type DedupeOptions, type Mode, type MatchMethod } from "./logic";

export default function TextDeduplicator() {
  const [input, setInput] = useState("apple\nbanana\napple\ncherry\nBanana");
  const [mode, setMode] = useState<Mode>("lines");
  const [method, setMethod] = useState<MatchMethod>("case-insensitive");
  const [threshold, setThreshold] = useState(0.85);
  const [sortOutput, setSortOutput] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const opts: DedupeOptions = { mode, method, fuzzyThreshold: threshold, sortOutput };
    const r = process(input, opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [input, mode, method, threshold, sortOutput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="lines">Lines</option>
                <option value="words">Words</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Match method</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value as MatchMethod)}>
                <option value="exact">Exact</option>
                <option value="case-insensitive">Case-insensitive</option>
                <option value="fuzzy">Fuzzy (Levenshtein)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fuzzy threshold (0-1)</Label>
              <Input type="number" step="0.05" min="0" max="1" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} disabled={method !== "fuzzy"} />
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sortOutput} onChange={(e) => setSortOutput(e.target.checked)} /><span>Sort output</span></label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Dedupe</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{result.inputCount} in</Badge>
              <Badge variant="secondary">{result.outputCount} out</Badge>
              <Badge variant="outline" className="text-emerald-600">{result.duplicatesRemoved} removed</Badge>
              <div className="ml-auto"><CopyButton getText={() => result.output} /></div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.output}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
