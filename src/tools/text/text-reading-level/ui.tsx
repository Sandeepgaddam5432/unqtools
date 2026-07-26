"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { analyzeReadingLevel, toCsv, type ReadingResult } from "./logic";

export default function TextReadingLevel() {
  const [text, setText] = useState("The cat sat on the mat. The dog ran fast. It was a good day. The sun was bright. We had fun.");
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = analyzeReadingLevel(text);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text to analyze</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border bg-background p-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Analyze</Button>
            <Button size="sm" variant="ghost" onClick={() => setText("The multifaceted institutional apparatus necessitates comprehensive methodological considerations. Interdisciplinary frameworks require sophisticated analytical paradigms."))}>Hard sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setText("The cat sat on the mat. The dog ran fast. It was a good day. The sun was bright. We had fun.")}>Easy sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">Consensus grade</p>
                <p className="text-3xl font-bold text-primary">{result.consensusGrade}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Flesch Reading Ease</p>
                <p className="text-2xl font-bold">{result.fleschReadingEase}</p>
                <p className="text-[10px] text-muted-foreground">{result.fleschInterpretation}</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Reading time</p>
                <p className="text-2xl font-bold">{result.readingTimeMin200} min</p>
                <p className="text-[10px] text-muted-foreground">@ 200 wpm</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-xs text-muted-foreground">Complex words</p>
                <p className="text-2xl font-bold">{result.complexWordCount}</p>
                <p className="text-[10px] text-muted-foreground">{((result.complexWordCount / Math.max(1, result.wordCount)) * 100).toFixed(1)}% of total</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">Words: {result.wordCount}</Badge>
              <Badge variant="outline">Sentences: {result.sentenceCount}</Badge>
              <Badge variant="outline">Syllables: {result.syllableCount}</Badge>
              <Badge variant="outline">Chars: {result.characterCount}</Badge>
              <Badge variant="outline">Avg words/sentence: {result.avgWordsPerSentence}</Badge>
              <Badge variant="outline">Avg syllables/word: {result.avgSyllablesPerWord}</Badge>
              <CopyButton getText={() => toCsv([result])} label="Copy CSV" />
              <DownloadButton getText={() => toCsv([result])} filename="reading-level.csv" mime="text/csv" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">All readability formulas</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                <div className="p-2 rounded bg-muted/30">Flesch-Kincaid Grade: <strong>{result.fleschKincaidGrade}</strong></div>
                <div className="p-2 rounded bg-muted/30">Gunning Fog: <strong>{result.gunningFog}</strong></div>
                <div className="p-2 rounded bg-muted/30">SMOG: <strong>{result.smog}</strong></div>
                <div className="p-2 rounded bg-muted/30">Coleman-Liau: <strong>{result.colemanLiau}</strong></div>
                <div className="p-2 rounded bg-muted/30">ARI: <strong>{result.ari}</strong></div>
                <div className="p-2 rounded bg-muted/30">Linsear Write: <strong>{result.linsearWrite}</strong></div>
                <div className="p-2 rounded bg-muted/30">RIX: <strong>{result.rix}</strong></div>
                <div className="p-2 rounded bg-muted/30">Reading time @ 250wpm: <strong>{result.readingTimeMin250} min</strong></div>
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Per-sentence breakdown</Label>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Sentence</th><th className="p-2 text-right">Words</th><th className="p-2 text-right">Syllables</th><th className="p-2 text-right">Complex</th><th className="p-2 text-right">Flesch</th></tr></thead>
                  <tbody>
                    {result.perSentence.map((s, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 max-w-xs truncate" title={s.sentence}>{s.sentence}</td>
                        <td className="p-2 text-right font-mono">{s.words}</td>
                        <td className="p-2 text-right font-mono">{s.syllables}</td>
                        <td className="p-2 text-right font-mono">{s.complexWords}</td>
                        <td className="p-2 text-right font-mono">{s.flesch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>

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

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all readability analysis runs locally. No cloud APIs.</p></CardContent></Card>
    </div>
  );
}
