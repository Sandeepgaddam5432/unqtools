"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  buildWordCloud,
  wordCloudToCsv,
  wordCloudToJson,
  buildCorpus,
  type WordCloudResult,
} from "./logic";

const PALETTE = [
  "text-rose-500",
  "text-orange-500",
  "text-amber-500",
  "text-emerald-500",
  "text-teal-500",
  "text-sky-500",
  "text-indigo-500",
  "text-violet-500",
  "text-fuchsia-500",
  "text-pink-500",
];

export default function TextWordCloudData() {
  const [input, setInput] = useState(
    "The quick brown fox jumps over the lazy dog. The dog barked loudly at the fox. The fox ran away quickly.",
  );
  const [corpusInput, setCorpusInput] = useState("");
  const [removeStop, setRemoveStop] = useState(true);
  const [minLen, setMinLen] = useState("2");
  const [maxResults, setMaxResults] = useState("100");
  const [result, setResult] = useState<WordCloudResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      const corpusDocs = corpusInput
        .split(/\n\s*\n/)
        .map((d) => d.trim())
        .filter(Boolean);
      const corpus = corpusDocs.length > 1 ? buildCorpus(corpusDocs) : undefined;
      const r = buildWordCloud(input, {
        removeStopWords: removeStop,
        minWordLength: Number(minLen) || 2,
        maxResults: Number(maxResults) || 100,
      }, corpus);
      setResult(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build word cloud.");
    }
  }, [input, corpusInput, removeStop, minLen, maxResults]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const sample = useCallback(() => {
    setInput(
      "Innovation drives progress. Progress requires innovation. Technology and creativity fuel innovation.",
    );
    setCorpusInput("Innovation and technology.\n\nProgress and creativity.\n\nTechnology requires creativity.");
  }, []);

  const maxCount = useMemo(
    () => (result && result.words.length ? result.words[0]!.count : 1),
    [result],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Input text"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Corpus (optional, blank-line-separated docs for TF-IDF)</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
              value={corpusInput}
              onChange={(e) => setCorpusInput(e.target.value)}
              aria-label="Corpus documents"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Min word length</Label>
              <Input type="number" min={1} max={20} value={minLen} onChange={(e) => setMinLen(e.target.value)} aria-label="Min word length" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Max results</Label>
              <Input type="number" min={5} max={500} value={maxResults} onChange={(e) => setMaxResults(e.target.value)} aria-label="Max results" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Stop words</Label>
              <Button
                size="sm"
                variant={removeStop ? "default" : "outline"}
                onClick={() => setRemoveStop((v) => !v)}
                aria-pressed={removeStop}
              >
                {removeStop ? "Removing stop words" : "Keeping stop words"}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Build cloud</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total tokens</p>
              <p className="text-lg font-bold">{result.totalTokens}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Unique words</p>
              <p className="text-lg font-bold">{result.uniqueWords}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Avg word length</p>
              <p className="text-lg font-bold">{result.averageWordLength.toFixed(2)}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Visual cloud</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {result.words.length === 0 ? (
                <p className="text-sm text-muted-foreground">No words to display.</p>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 min-h-[180px]">
                  {result.words.slice(0, 60).map((w, i) => {
                    const fontSize = 12 + (w.weight / 100) * 36;
                    return (
                      <span
                        key={w.word}
                        className={`${PALETTE[i % PALETTE.length]} font-semibold`}
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}
                        title={`${w.word}: ${w.count}× (weight ${w.weight})`}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top terms</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.words.slice(0, 20).map((w) => (
                <div key={w.word} className="flex items-center gap-2">
                  <span className="text-sm font-mono w-32 truncate">{w.word}</span>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(w.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <Badge variant="outline" className="w-12 justify-end">{w.count}</Badge>
                  <Badge variant="secondary" className="w-12 justify-end">{w.weight}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export as CSV / JSON</p>
              <div className="flex gap-2">
                <CopyButton getText={() => wordCloudToCsv(result)} label="Copy CSV" />
                <CopyButton getText={() => wordCloudToJson(result)} label="Copy JSON" />
                <DownloadButton getText={() => wordCloudToCsv(result)} filename="word-cloud.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
