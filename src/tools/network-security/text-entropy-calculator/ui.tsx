"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process,
  processBatch,
  toCsv,
  toAsciiHistogram,
  formatSummary,
  randomnessVerdict,
  validateOptions,
  type EntropyResult,
} from "./logic";

export default function TextEntropyCalculator() {
  const [input, setInput] = useState("Hello, World!");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [base, setBase] = useState(2);
  const [result, setResult] = useState<EntropyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opts = useMemo(() => ({ caseSensitive, ignoreWhitespace, base }), [caseSensitive, ignoreWhitespace, base]);
  const optsValid = useMemo(() => validateOptions(opts), [opts]);

  const run = useCallback(() => {
    if ("error" in optsValid) { setError(optsValid.error); return; }
    setError(null);
    setResult(process(input, opts));
  }, [input, opts, optsValid]);

  const batch = useMemo(() => {
    if (!input) return null;
    const lines = input.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return null;
    return processBatch(lines, opts);
  }, [input, opts]);

  const summary = useMemo(() => (result ? formatSummary(result) : ""), [result]);
  const asciiHist = useMemo(() => (result ? toAsciiHistogram(result) : ""), [result]);
  const verdict = useMemo(() => (result ? randomnessVerdict(result) : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste text or password to analyze randomness…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Case-sensitive
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} /> Ignore whitespace
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Label>Log base:</Label>
              <select className="h-8 rounded-md border px-2 text-xs" value={base} onChange={(e) => setBase(Number(e.target.value))}>
                <option value={2}>2 (bits)</option>
                <option value={10}>10 (dits)</option>
                <option value={Math.E}>e (nats)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Compute</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Shannon entropy</p><p className="text-lg font-bold">{result.shannonEntropy} bits/char</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total bits</p><p className="text-lg font-bold">{result.totalBits}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Unique chars</p><p className="text-lg font-bold">{result.uniqueChars}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Randomness</p><p className="text-lg font-bold text-emerald-600">{result.randomnessScore}%</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Char count</p><p className="text-lg font-bold">{result.charCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Max entropy</p><p className="text-lg font-bold">{result.maxEntropy}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Entropy ratio</p><p className="text-lg font-bold">{result.entropyRatio}</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-3"><p className="text-sm"><strong>Verdict:</strong> {verdict}</p></CardContent></Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3">{result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}</CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Summary</Label>
                <div className="flex gap-2">
                  <CopyButton getText={() => summary} />
                  <DownloadButton getText={() => summary} filename="entropy-summary.txt" />
                </div>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap">{summary}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">ASCII histogram (top 30)</Label>
                <CopyButton getText={() => asciiHist} />
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">{asciiHist}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Top {result.topChars.length} chars</Badge>
                <DownloadButton getText={() => toCsv(result)} filename="entropy.csv" mime="text/csv" />
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Char</th><th className="p-2 text-right">Count</th><th className="p-2 text-right">Frequency</th><th className="p-2 text-right">%</th><th className="p-2">Bar</th></tr></thead>
                <tbody>
                  {result.topChars.map((c, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono text-base">{c.char === " " ? "␣" : c.char === "\n" ? "⏎" : c.char === "\t" ? "⇥" : c.char}</td>
                      <td className="p-2 text-right font-mono">{c.count}</td>
                      <td className="p-2 text-right font-mono">{(c.frequency * 100).toFixed(2)}%</td>
                      <td className="p-2 text-right font-mono">{c.percentage.toFixed(2)}%</td>
                      <td className="p-2"><div className="h-2 bg-emerald-500/60 rounded" style={{ width: `${Math.round(c.frequency * 100 * 4)}px` }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {batch && batch.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Per-line batch analysis</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Line (preview)</th><th className="p-2 text-right">Chars</th><th className="p-2 text-right">Unique</th><th className="p-2 text-right">Entropy</th><th className="p-2 text-right">Score</th></tr></thead>
              <tbody>
                {batch.map((b, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono">{i + 1}</td>
                    <td className="p-2 font-mono truncate max-w-[200px]">{input.split(/\r?\n/)[i]?.slice(0, 40) ?? ""}</td>
                    <td className="p-2 text-right font-mono">{b.charCount}</td>
                    <td className="p-2 text-right font-mono">{b.uniqueChars}</td>
                    <td className="p-2 text-right font-mono">{b.shannonEntropy}</td>
                    <td className="p-2 text-right font-mono">{b.randomnessScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all analysis runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
