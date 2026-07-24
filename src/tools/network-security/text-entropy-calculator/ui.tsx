"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { process, toCsv, type EntropyResult } from "./logic";

export default function TextEntropyCalculator() {
  const [input, setInput] = useState("Hello, World!");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [result, setResult] = useState<EntropyResult | null>(null);

  const run = useCallback(() => {
    setResult(process(input, { caseSensitive }));
  }, [input, caseSensitive]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /><span>Case-sensitive</span></label>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Compute</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Shannon entropy</p><p className="text-lg font-bold">{result.shannonEntropy} bits/char</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Char count</p><p className="text-lg font-bold">{result.charCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Unique chars</p><p className="text-lg font-bold">{result.uniqueChars}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Randomness</p><p className="text-lg font-bold text-emerald-600">{result.randomnessScore}%</p></CardContent></Card>
          </div>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3">{result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}</CardContent></Card>
          )}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Top {result.topChars.length} chars</Badge>
                <DownloadButton getText={() => toCsv(result)} filename="entropy.csv" mime="text/csv" />
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Char</th><th className="p-2 text-right">Count</th><th className="p-2 text-right">Frequency</th><th className="p-2">Bar</th></tr></thead>
                <tbody>
                  {result.topChars.map((c, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono text-base">{c.char === " " ? "␣" : c.char === "\n" ? "⏎" : c.char === "\t" ? "⇥" : c.char}</td>
                      <td className="p-2 text-right font-mono">{c.count}</td>
                      <td className="p-2 text-right font-mono">{(c.frequency * 100).toFixed(2)}%</td>
                      <td className="p-2"><div className="h-2 bg-emerald-500/60 rounded" style={{ width: `${Math.round(c.frequency * 100 * 4)}px` }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
