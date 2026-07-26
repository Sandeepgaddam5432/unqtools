"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { reduceText, toCsv, type ReduceResult } from "./logic";

const SAMPLE = `Artificial intelligence is transforming industries. Machine learning models can now perform tasks that once required human intelligence. The introduction of deep learning marked a major breakthrough.

Researchers use large datasets to train these models. The methodology involves collecting data, preprocessing it, and selecting appropriate architectures. Neural networks learn patterns through backpropagation.

Results show that AI systems outperform traditional methods in many domains. Studies demonstrate 95% accuracy on benchmark tasks. The findings have significant implications for healthcare and finance.

In conclusion, AI continues to evolve rapidly. Future work will focus on interpretability and fairness. We recommend continued investment in AI research.`;

export default function TextReducer() {
  const [text, setText] = useState(SAMPLE);
  const [targetType, setTargetType] = useState<"ratio" | "count">("ratio");
  const [targetValue, setTargetValue] = useState("0.3");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<ReduceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = reduceText({
      text,
      target: { type: targetType, value: Number(targetValue) },
      keywords: keywords.split(/[,\s]+/).filter(Boolean),
    });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text, targetType, targetValue, keywords]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text to summarize</Label>
            <textarea
              className="w-full min-h-[150px] rounded-md border bg-background p-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Target type</Label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as "ratio" | "count")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="ratio">Ratio (0-1)</option>
                <option value="count">Sentence count</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target value</Label>
              <Input type="number" step="0.05" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Keywords (comma separated)</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="AI, healthcare" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Summarize</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(SAMPLE); setTargetType("ratio"); setTargetValue("0.3"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">Original: {result.originalWordCount} words</Badge>
              <Badge variant="outline">Summary: {result.summaryWordCount} words</Badge>
              <Badge variant="outline">Compression: {(result.compressionRatio * 100).toFixed(0)}%</Badge>
              <Badge variant="outline">Sentences: {result.selectedSentences.length}/{result.allSentences.length}</Badge>
              <CopyButton getText={() => result.summary} label="Copy summary" />
              <DownloadButton getText={() => toCsv(result)} filename="reduction.csv" mime="text/csv" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Summary</Label>
              <p className="mt-1 text-sm">{result.summary}</p>
            </CardContent></Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Top keywords</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.keywordsExtracted.map((k) => (
                    <Badge key={k.word} variant="secondary">{k.word}: {k.count}</Badge>
                  ))}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">IMRaD structure</Label>
                {result.imradStructure ? (
                  <ul className="mt-1 text-xs space-y-0.5">
                    {result.imradStructure.map((s, i) => (
                      <li key={i} className="font-mono">{s.type}: sentences {s.startIdx + 1}-{s.endIdx + 1}</li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground mt-1">No IMRaD structure detected.</p>}
              </CardContent></Card>
            </div>

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Sentence scores (selected highlighted)</Label>
              <div className="mt-1 space-y-1 max-h-[300px] overflow-y-auto">
                {result.allSentences.map((s) => (
                  <div key={s.index} className={`p-2 rounded text-xs ${s.selected ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono">[{s.index + 1}] score={s.score}</span>
                      <div className="flex gap-1">
                        {s.hasNumber && <Badge variant="outline" className="text-[10px]">data</Badge>}
                        {s.isHeading && <Badge variant="outline" className="text-[10px]">heading</Badge>}
                        {s.selected && <Badge variant="default" className="text-[10px]">selected</Badge>}
                      </div>
                    </div>
                    <p className="break-words">{s.sentence}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.reasons.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all summarization runs locally — no cloud AI, no uploads.</p></CardContent></Card>
    </div>
  );
}
