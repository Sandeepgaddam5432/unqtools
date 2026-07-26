"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { countLetters, toCsv, type LetterResult } from "./logic";

export default function TextLetterCounter() {
  const [text, setText] = useState("The quick brown fox jumps over the lazy dog.");
  const [result, setResult] = useState<LetterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = countLetters(text);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text</Label>
            <textarea
              className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Count</Button>
            <Button size="sm" variant="ghost" onClick={() => setText("The quick brown fox jumps over the lazy dog.")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">Letters: {result.totalLetters}</Badge>
              <Badge variant="outline">Chars: {result.totalChars}</Badge>
              <Badge variant="outline">Vowels: {result.vowels.count} ({result.vowels.density.toFixed(1)}%)</Badge>
              <Badge variant="outline">Consonants: {result.consonants.count} ({result.consonants.density.toFixed(1)}%)</Badge>
              <Badge variant="outline">χ² vs English: {result.chiSquaredVsEnglish}</Badge>
              <CopyButton getText={() => toCsv(result)} label="Copy CSV" />
              <DownloadButton getText={() => toCsv(result)} filename="letter-count.csv" mime="text/csv" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Letter distribution (histogram)</Label>
              <div className="mt-2 space-y-1">
                {result.perLetter.map((p) => (
                  <div key={p.letter} className="flex items-center gap-2 text-xs">
                    <span className="font-mono w-4 font-bold">{p.letter.toUpperCase()}</span>
                    <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-primary rounded-sm" style={{ width: `${p.histogram}%` }} />
                    </div>
                    <span className="font-mono w-12 text-right">{p.count}</span>
                    <span className="font-mono w-14 text-right text-muted-foreground">{p.density.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Top letters</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.topLetters.slice(0, 10).map((t) => (
                    <Badge key={t.letter} variant="secondary">{t.letter.toUpperCase()}: {t.count}</Badge>
                  ))}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Missing letters</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.missingLetters.length === 0
                    ? <span className="text-xs text-muted-foreground">None — pangram!</span>
                    : result.missingLetters.map((l) => (
                      <Badge key={l} variant="outline">{l.toUpperCase()}</Badge>
                    ))}
                </div>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Top bigrams</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.bigrams.slice(0, 12).map((b) => (
                    <Badge key={b.bigram} variant="outline" className="font-mono">{b.bigram}: {b.count}</Badge>
                  ))}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Top trigrams</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.trigrams.slice(0, 12).map((t) => (
                    <Badge key={t.trigram} variant="outline" className="font-mono">{t.trigram}: {t.count}</Badge>
                  ))}
                </div>
              </CardContent></Card>
            </div>

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Word-initial letters (top 10)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.firstLetterCounts.slice(0, 10).map((f) => (
                  <Badge key={f.letter} variant="secondary">{f.letter.toUpperCase()}: {f.count}</Badge>
                ))}
              </div>
            </CardContent></Card>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all counting runs locally.</p></CardContent></Card>
    </div>
  );
}
