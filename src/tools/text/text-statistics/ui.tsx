"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { process, statsToCsv, type StatsResult } from "./logic";

export default function TextStatistics() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog. The dog barked loudly.");
  const [result, setResult] = useState<StatsResult | null>(null);

  const run = useCallback(() => {
    setResult(process(input));
  }, [input]);

  const metrics = result ? [
    { label: "Characters", value: result.characters },
    { label: "Characters (no spaces)", value: result.charactersNoSpaces },
    { label: "Words", value: result.words },
    { label: "Sentences", value: result.sentences },
    { label: "Paragraphs", value: result.paragraphs },
    { label: "Lines", value: result.lines },
    { label: "Syllables", value: result.syllables },
    { label: "Reading time (min)", value: result.readingTimeMinutes.toFixed(2) },
    { label: "Flesch Reading Ease", value: result.fleschReadingEase.toFixed(1) },
    { label: "Flesch-Kincaid Grade", value: result.fleschKincaidGrade.toFixed(1) },
    { label: "Avg word length", value: result.averageWordLength.toFixed(2) },
    { label: "Avg sentence length", value: result.averageSentenceLength.toFixed(2) },
  ] : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Analyze</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {!result && <EmptyState title="No analysis yet" hint="Click Analyze to see word counts, readability, and more." />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3">{result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}</CardContent></Card>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <Card key={m.label}><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold">{m.value}</p>
              </CardContent></Card>
            ))}
          </div>
          {result.longestWord && (
            <Card><CardContent className="p-3 flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">Longest word</p><p className="text-sm font-mono font-bold">{result.longestWord}</p></div>
              <Badge variant="outline">{result.longestWord.length} chars</Badge>
            </CardContent></Card>
          )}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Export stats as CSV</p>
              <div className="flex gap-2">
                <CopyButton getText={() => statsToCsv(result)} />
                <DownloadButton getText={() => statsToCsv(result)} filename="text-stats.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
