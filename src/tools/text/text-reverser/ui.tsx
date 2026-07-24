"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { reverseText, reverseBatch, batchToCsv, type ReverseMode, type ReverseOptions } from "./logic";

export default function TextReverser() {
  const [input, setInput] = useState("Hello World\nThis is a test");
  const [mode, setMode] = useState<ReverseMode>("chars");
  const [preserveCasePosition, setPreserveCasePosition] = useState(false);
  const [skipPunctuation, setSkipPunctuation] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof reverseText> | null>(null);
  const [batchResult, setBatchResult] = useState<ReturnType<typeof reverseBatch> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reverse = useCallback(() => {
    setError(null);
    try {
      if (batchMode) {
        const lines = input.split("\n");
        const r = reverseBatch(lines, { mode, preserveCasePosition, skipPunctuation });
        setBatchResult(r);
        setResult(null);
      } else {
        const r = reverseText(input, { mode, preserveCasePosition, skipPunctuation });
        if ("error" in r) { setError(r.error); setResult(null); }
        else { setResult(r); setBatchResult(null); }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, mode, preserveCasePosition, skipPunctuation, batchMode]);

  const getOutputText = useCallback((): string => {
    if (batchResult) return batchResult.map((r) => r.output).join("\n");
    if (result && !("error" in result)) return result.output;
    return "";
  }, [result, batchResult]);

  const getCsv = useCallback((): string => {
    if (!batchResult) return "";
    return batchToCsv(batchResult, input.split("\n"));
  }, [batchResult, input]);

  const MODES: { value: ReverseMode; label: string; description: string }[] = [
    { value: "chars", label: "Characters", description: "Reverse the entire string char by char" },
    { value: "words", label: "Words", description: "Reverse word order (keep word chars intact)" },
    { value: "lines", label: "Lines", description: "Reverse line order" },
    { value: "sentences", label: "Sentences", description: "Reverse sentence order" },
    { value: "words-chars", label: "Words + Chars", description: "Reverse word order, then reverse each word's chars" },
    { value: "preserve-punctuation", label: "Preserve Punctuation", description: "Reverse each word but keep punctuation in place" },
    { value: "digits-only", label: "Digits Only", description: "Reverse only digit characters" },
    { value: "letters-only", label: "Letters Only", description: "Reverse only letter characters" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button key={m.value} size="sm" variant={mode === m.value ? "default" : "outline"} onClick={() => setMode(m.value)} title={m.description}>
                {m.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={preserveCasePosition} onChange={(e) => setPreserveCasePosition(e.target.checked)} /><span>Preserve case position</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={skipPunctuation} onChange={(e) => setSkipPunctuation(e.target.checked)} /><span>Skip punctuation (chars mode)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} /><span>Batch mode (one input per line)</span></label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={reverse}>Reverse</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("Hello World\nThis is a test"); setResult(null); setBatchResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setBatchResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output ({result.mode})</CardTitle>
              <CopyButton getText={() => result.output} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            <p className="text-xs text-muted-foreground p-2">Input: {result.inputLength} chars · Output: {result.outputLength} chars</p>
          </CardContent>
        </Card>
      )}

      {batchResult && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Batch output ({batchResult.length} results)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={getOutputText} />
                <DownloadButton getText={getCsv} filename="reversed-batch.csv" mime="text/csv" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Input</th><th className="p-2 text-left">Output</th></tr></thead>
              <tbody>
                {batchResult.map((r, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono">{input.split("\n")[i]}</td>
                    <td className="p-2 font-mono">{r.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all reversal runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
