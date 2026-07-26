"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { analyzeTone, toneReport, type ToneResult } from "./logic";

function ToneBar({ value, label, leftLabel, rightLabel }: { value: number; label: string; leftLabel: string; rightLabel: string }) {
  const pct = ((value + 100) / 200) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Badge variant="outline">{value.toFixed(0)}</Badge>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <div
          className={`absolute top-0 h-full ${value >= 0 ? "bg-emerald-500" : "bg-orange-500"}`}
          style={value >= 0 ? { left: "50%", width: `${pct - 50}%` } : { right: `${100 - pct}%`, width: `${50 - pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export default function TextToneAnalyzer() {
  const [input, setInput] = useState(
    "I think this product is amazing! It's definitely the best I've ever used. Highly recommend!",
  );
  const [result, setResult] = useState<ToneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      setResult(analyzeTone(input));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze tone.");
    }
  }, [input]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const sample = useCallback(() => {
    setInput("Hey everyone 👋 lol just wanted to say this is kinda cool. Maybe try it out? Idk, just my opinion.");
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
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Analyze tone</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample (casual)</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("The committee deliberated extensively regarding the proposed amendments. Furthermore, the board will carefully consider all recommendations before reaching a final decision.")}>Sample (formal)</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Dominant tone</p>
                  <p className="text-2xl font-bold text-primary">{result.dominantTone}</p>
                </div>
                <Badge variant="secondary">{result.metrics.wordCount} words · {result.metrics.sentenceCount} sentences</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Tone axes</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <ToneBar value={result.formality} label={`Formality (${result.labels.formality})`} leftLabel="Casual" rightLabel="Formal" />
              <ToneBar value={result.sentiment} label={`Sentiment (${result.labels.sentiment})`} leftLabel="Negative" rightLabel="Positive" />
              <ToneBar value={result.confidence} label={`Confidence (${result.labels.confidence})`} leftLabel="Tentative" rightLabel="Confident" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Contractions</p>
              <p className="text-lg font-bold">{result.metrics.contractionCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Emojis</p>
              <p className="text-lg font-bold">{result.metrics.emojiCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Exclamation marks</p>
              <p className="text-lg font-bold">{result.metrics.exclamationCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Question marks</p>
              <p className="text-lg font-bold">{result.metrics.questionCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Slang words</p>
              <p className="text-lg font-bold">{result.metrics.slangCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Hedge words</p>
              <p className="text-lg font-bold">{result.metrics.hedgeCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Positive words</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.metrics.positiveWordCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Negative words</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{result.metrics.negativeWordCount}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          {(result.matchedWords.positive.length > 0 || result.matchedWords.negative.length > 0 || result.matchedWords.hedges.length > 0 || result.matchedWords.slang.length > 0) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Matched signal words</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                {result.matchedWords.positive.length > 0 && (
                  <div><span className="text-muted-foreground text-xs mr-2">Positive:</span>{result.matchedWords.positive.map((w) => <Badge key={w} variant="outline" className="mr-1 mb-1 text-emerald-700 dark:text-emerald-300">{w}</Badge>)}</div>
                )}
                {result.matchedWords.negative.length > 0 && (
                  <div><span className="text-muted-foreground text-xs mr-2">Negative:</span>{result.matchedWords.negative.map((w) => <Badge key={w} variant="outline" className="mr-1 mb-1 text-red-700 dark:text-red-300">{w}</Badge>)}</div>
                )}
                {result.matchedWords.hedges.length > 0 && (
                  <div><span className="text-muted-foreground text-xs mr-2">Hedges:</span>{result.matchedWords.hedges.map((w) => <Badge key={w} variant="outline" className="mr-1 mb-1">{w}</Badge>)}</div>
                )}
                {result.matchedWords.slang.length > 0 && (
                  <div><span className="text-muted-foreground text-xs mr-2">Slang:</span>{result.matchedWords.slang.map((w) => <Badge key={w} variant="outline" className="mr-1 mb-1">{w}</Badge>)}</div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export tone report</p>
              <div className="flex gap-2">
                <CopyButton getText={() => toneReport(result)} label="Copy report" />
                <DownloadButton getText={() => toneReport(result)} filename="tone-report.txt" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
