"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { countSyllables, toCsv, type SyllableResult } from "./logic";

export default function TextSyllableCounter() {
  const [text, setText] = useState("The quick brown fox jumps over the lazy dog. The dog barks loudly.");
  const [forceHeur, setForceHeur] = useState(false);
  const [customDictText, setCustomDictText] = useState("");
  const [result, setResult] = useState<SyllableResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const customDict: Record<string, number> = {};
    for (const line of customDictText.split(/\n/)) {
      const m = line.match(/^\s*(\w+)\s*[:=,]\s*(\d+)\s*$/);
      if (m) customDict[m[1]!.toLowerCase()] = Number(m[2]);
    }
    const r = countSyllables(text, { customDict, forceHeuristic: forceHeur });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text, forceHeur, customDictText]);

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
          <div>
            <Label className="text-xs text-muted-foreground">Custom dictionary (one word=count per line)</Label>
            <textarea
              className="w-full min-h-[60px] rounded-md border bg-background p-2 text-xs font-mono"
              value={customDictText}
              onChange={(e) => setCustomDictText(e.target.value)}
              placeholder={"supercalifragilistic=7\nalgorithm=4"}
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={forceHeur} onChange={(e) => setForceHeur(e.target.checked)} />
            Force heuristic mode (ignore dictionary)
          </label>
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
              <Badge variant="outline">Words: {result.totalWords}</Badge>
              <Badge variant="outline">Syllables: {result.totalSyllables}</Badge>
              <Badge variant="outline">Avg/word: {result.avgSyllablesPerWord}</Badge>
              <Badge variant="outline">Polysyllabic (3+): {result.polysyllabicCount}</Badge>
              <Badge variant="outline">Monosyllabic: {result.monosyllabicCount}</Badge>
              <Badge variant={result.difficulty === "easy" ? "default" : result.difficulty === "medium" ? "secondary" : "destructive"}>Difficulty: {result.difficulty}</Badge>
              <CopyButton getText={() => toCsv(result)} label="Copy CSV" />
              <DownloadButton getText={() => toCsv(result)} filename="syllables.csv" mime="text/csv" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Per-sentence</Label>
              <ul className="mt-1 text-xs divide-y divide-border/50">
                {result.perSentence.map((s, i) => (
                  <li key={i} className="p-2 flex items-center justify-between gap-2">
                    <span className="flex-1 truncate">{s.sentence}</span>
                    <Badge variant="outline" className="font-mono">{s.syllables} syll / {s.words} words</Badge>
                  </li>
                ))}
              </ul>
            </CardContent></Card>

            {result.perParagraph.length > 1 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Per-paragraph</Label>
                <ul className="mt-1 text-xs divide-y divide-border/50">
                  {result.perParagraph.map((p) => (
                    <li key={p.index} className="p-2 flex items-center justify-between gap-2">
                      <span>Paragraph {p.index}</span>
                      <Badge variant="outline" className="font-mono">{p.syllables} syll / {p.words} words</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent></Card>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Top words by syllable count</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.topBySyllables.map((w, i) => (
                  <Badge key={i} variant="secondary">{w.word}: {w.syllables}</Badge>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">Per-word breakdown (first 200)</Label>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">Word</th><th className="p-2 text-right">Syllables</th><th className="p-2 text-left">Source</th></tr></thead>
                  <tbody>
                    {result.words.slice(0, 200).map((w, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 font-mono">{w.word}</td>
                        <td className="p-2 text-right font-mono">{w.syllables}</td>
                        <td className="p-2 text-muted-foreground">{w.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all syllable counting runs locally.</p></CardContent></Card>
    </div>
  );
}
