"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { analyzeHeadline, batchAnalyze, toCsv, type HeadlineResult } from "./logic";

export default function TextHeadlineAnalyzer() {
  const [headline, setHeadline] = useState("10 Amazing Tips for Marketing Your Small Business");
  const [result, setResult] = useState<HeadlineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchAnalyze> | null>(null);

  const run = useCallback(() => {
    const r = analyzeHeadline(headline);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [headline]);

  const runBatch = useCallback(() => {
    setBatchOut(batchAnalyze(batchText));
    setError(null);
  }, [batchText]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Headline</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Enter your headline" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Analyze</Button>
            <Button size="sm" variant="ghost" onClick={() => setHeadline("10 Amazing Tips for Marketing Your Small Business")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); setHeadline(""); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Overall Score</p>
                <p className="text-3xl font-bold text-primary">{result.overallScore}</p>
                <Badge variant="outline" className="mt-1">Grade: {result.grade}</Badge>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">SEO</p>
                <p className="text-2xl font-bold">{result.seoScore}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Emotional</p>
                <p className="text-2xl font-bold">{result.emotionalScore}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="text-2xl font-bold">{result.powerScore}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              <div><p className="text-xs text-muted-foreground">Characters</p><p className="font-bold">{result.characters}</p></div>
              <div><p className="text-xs text-muted-foreground">Words</p><p className="font-bold">{result.words}</p></div>
              <div><p className="text-xs text-muted-foreground">Syllables</p><p className="font-bold">{result.syllables}</p></div>
              <div><p className="text-xs text-muted-foreground">Reading time</p><p className="font-bold">{result.readingTimeSec}s</p></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="font-bold">{result.type}</p></div>
              <div><p className="text-xs text-muted-foreground">Sentiment</p><p className="font-bold">{result.sentimentScore}</p></div>
              <div><p className="text-xs text-muted-foreground">Flesch score</p><p className="font-bold">{result.fleschScore}</p></div>
              <div><p className="text-xs text-muted-foreground">Flesch grade</p><p className="font-bold">{result.fleschGrade}</p></div>
              <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-bold">{result.balanceScore}</p></div>
              <div><p className="text-xs text-muted-foreground">Common words</p><p className="font-bold">{result.commonWords}</p></div>
              <div><p className="text-xs text-muted-foreground">Uncommon</p><p className="font-bold">{result.uncommonWords}</p></div>
              <div><p className="text-xs text-muted-foreground">Power words</p><p className="font-bold">{result.powerWords.length}</p></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {result.hasNumber && <Badge variant="outline">Has number</Badge>}
              {result.hasBracket && <Badge variant="outline">Has brackets</Badge>}
              {result.hasQuestion && <Badge variant="outline">Question</Badge>}
              {result.hasColon && <Badge variant="outline">Has colon</Badge>}
              {result.hasQuote && <Badge variant="outline">Has quote</Badge>}
              <CopyButton getText={() => JSON.stringify(result, null, 2)} label="Copy JSON" />
            </div>

            {result.powerWords.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Power words found</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.powerWords.map((w, i) => <Badge key={i} variant="secondary">{w}</Badge>)}
                </div>
              </div>
            )}

            {result.emotionWords.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Emotional words</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.emotionWords.map((e, i) => (
                    <Badge key={i} variant={e.sentiment > 0 ? "default" : "destructive"}>{e.word} ({e.sentiment > 0 ? "+" : ""}{e.sentiment})</Badge>
                  ))}
                </div>
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Suggestions</Label>
              <ul className="mt-1 space-y-1 text-xs">
                {result.suggestions.map((s, i) => (
                  <li key={i} className={s.severity === "good" ? "text-green-700 dark:text-green-400" : s.severity === "warn" ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"}>
                    {s.severity === "good" ? "✓" : s.severity === "warn" ? "⚠️" : "•"} {s.message}
                  </li>
                ))}
              </ul>
            </CardContent></Card>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch analyze (one per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-xs"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={"10 Amazing Tips\nHow to Win at Marketing"}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch} disabled={!batchText.trim()}>Run batch</Button>
            {batchOut && batchOut.results.length > 0 && (
              <DownloadButton getText={() => toCsv(batchOut.results)} filename="headlines.csv" mime="text/csv" />
            )}
          </div>
          {batchOut && batchOut.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Headline</th><th className="p-2 text-right">Chars</th><th className="p-2 text-right">Overall</th><th className="p-2 text-right">Grade</th><th className="p-2 text-left">Type</th></tr></thead>
                <tbody>
                  {batchOut.results.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2">{r.headline}</td>
                      <td className="p-2 text-right">{r.characters}</td>
                      <td className="p-2 text-right font-bold">{r.overallScore}</td>
                      <td className="p-2 text-right">{r.grade}</td>
                      <td className="p-2">{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all analysis runs locally. No telemetry.</p></CardContent></Card>
    </div>
  );
}
