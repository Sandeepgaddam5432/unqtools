"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { extractKeywords, keywordsToCsv, keywordsToJson, type KeywordResult } from "./logic";

export default function TextKeywordExtractor() {
  const [input, setInput] = useState(
    "Machine learning is a subfield of artificial intelligence. Machine learning algorithms build models from sample data. The future of machine learning is bright.",
  );
  const [topK, setTopK] = useState("15");
  const [minLen, setMinLen] = useState("3");
  const [includeBigrams, setIncludeBigrams] = useState(true);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      const r = extractKeywords(input, {
        topK: Number(topK) || 15,
        minWordLength: Number(minLen) || 3,
        includeBigrams,
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract keywords.");
    }
  }, [input, topK, minLen, includeBigrams]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const sample = useCallback(() => {
    setInput(
      "Climate change is one of the most pressing issues of our time. Climate scientists study rising temperatures, melting ice caps, and extreme weather. Climate policy must address carbon emissions. The climate crisis affects everyone.",
    );
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Input text"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Top K keywords</Label>
              <Input type="number" min={1} max={100} value={topK} onChange={(e) => setTopK(e.target.value)} aria-label="Top K keywords" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Min word length</Label>
              <Input type="number" min={1} max={20} value={minLen} onChange={(e) => setMinLen(e.target.value)} aria-label="Min word length" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bigrams</Label>
              <Button size="sm" variant={includeBigrams ? "default" : "outline"} onClick={() => setIncludeBigrams((v) => !v)} aria-pressed={includeBigrams}>
                {includeBigrams ? "Including bigrams" : "Unigrams only"}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Extract keywords</Button>
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
              <p className="text-xs text-muted-foreground">Unique unigrams</p>
              <p className="text-lg font-bold">{result.uniqueUnigrams}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Unique bigrams</p>
              <p className="text-lg font-bold">{result.uniqueBigrams}</p>
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
            <CardHeader className="pb-3"><CardTitle className="text-sm">Extracted keywords</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.keywords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No keywords extracted.</p>
              ) : (
                result.keywords.map((k, i) => (
                  <div key={`${k.word}-${i}`} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-8 justify-center">{i + 1}</Badge>
                    <span className="text-sm font-mono flex-1 truncate">{k.word}</span>
                    {k.isBigram && <Badge variant="secondary" className="text-[10px]">bigram</Badge>}
                    <div className="w-24 h-2 bg-muted rounded overflow-hidden" aria-hidden="true">
                      <div className="h-full bg-primary" style={{ width: `${k.score}%` }} />
                    </div>
                    <Badge variant="secondary" className="w-10 justify-end">{k.score}</Badge>
                    <Badge variant="outline" className="w-10 justify-end">×{k.count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export keywords as CSV / JSON</p>
              <div className="flex gap-2">
                <CopyButton getText={() => keywordsToCsv(result)} label="Copy CSV" />
                <CopyButton getText={() => keywordsToJson(result)} label="Copy JSON" />
                <DownloadButton getText={() => keywordsToCsv(result)} filename="keywords.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
