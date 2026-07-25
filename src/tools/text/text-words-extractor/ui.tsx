"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { extractWords, frequencyToCsv, type ExtractResult } from "./logic";

export default function TextWordsExtractor() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog. The dog barks.");
  const [minLength, setMinLength] = useState(1);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [ignoreStopWords, setIgnoreStopWords] = useState(false);
  const [ngramSize, setNgramSize] = useState(1);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(() => {
    try {
      setError(null);
      setResult(extractWords(input, { minLength, caseSensitive, ignoreStopWords, ngramSize }));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  }, [input, minLength, caseSensitive, ignoreStopWords, ngramSize]);

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
              <Label className="text-xs text-muted-foreground">Min length</Label>
              <Input type="number" min={1} value={minLength} onChange={(e) => setMinLength(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">N-gram size</Label>
              <Input type="number" min={1} max={5} value={ngramSize} onChange={(e) => setNgramSize(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /><span>Case-sensitive</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ignoreStopWords} onChange={(e) => setIgnoreStopWords(e.target.checked)} /><span>Ignore stop words</span></label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={extract}>Extract</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("The quick brown fox jumps over the lazy dog."); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total words</p><p className="text-xl font-bold">{result.stats.totalWords}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Unique words</p><p className="text-xl font-bold">{result.stats.uniqueWords}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Avg length</p><p className="text-xl font-bold">{result.stats.avgWordLength}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Longest</p><p className="text-xl font-bold truncate">{result.stats.longestWord || "—"}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{ngramSize > 1 ? `${ngramSize}-grams` : "Word frequency"} (top 50)</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => result.frequency.map((e) => `${e.word}: ${e.count}`).join("\n")} />
                  <DownloadButton getText={() => frequencyToCsv(result.ngramSize > 1 ? result.ngrams : result.frequency)} filename={ngramSize > 1 ? "ngrams.csv" : "word-frequency.csv"} mime="text/csv" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-2">{ngramSize > 1 ? "N-gram" : "Word"}</th>
                      <th className="p-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ngramSize > 1 ? result.ngrams : result.frequency).slice(0, 50).map((e) => (
                      <tr key={e.word} className="border-t border-border/50">
                        <td className="p-2 font-mono">{e.word}</td>
                        <td className="p-2 text-right font-mono">{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> tokenization runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
