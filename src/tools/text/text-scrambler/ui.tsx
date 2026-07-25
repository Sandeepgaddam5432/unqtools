"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  scrambleText,
  scrambleBatch,
  computeStats,
  listScramblableWords,
  diffWords,
  type ScrambleMethod,
} from "./logic";

const METHODS: { value: ScrambleMethod; label: string }[] = [
  { value: "random", label: "Random (seeded)" },
  { value: "sorted", label: "Sorted (A→Z)" },
  { value: "reversed", label: "Reversed" },
];

export default function TextScrambler() {
  const [input, setInput] = useState("");
  const [seed, setSeed] = useState(42);
  const [method, setMethod] = useState<ScrambleMethod>("random");
  const [minLength, setMinLength] = useState(4);

  const opts = useMemo(() => ({ seed, method, minLength }), [seed, method, minLength]);

  const { output, error } = useMemo(() => {
    try {
      return { output: scrambleText(input, opts), error: null as string | null };
    } catch (e) {
      return { output: "", error: (e as Error).message };
    }
  }, [input, opts]);

  const stats = useMemo(() => (input ? computeStats(input, opts) : null), [input, opts]);
  const batch = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return scrambleBatch(lines, opts).join("\n");
  }, [input, opts]);

  const diffs = useMemo(() => (input && output ? diffWords(input, output).slice(0, 50) : []), [input, output]);
  const wordList = useMemo(() => (input ? listScramblableWords(input, minLength).slice(0, 30) : []), [input, minLength]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="ts-input">Input text</Label>
          <Textarea
            id="ts-input"
            placeholder="Type text to scramble middle letters…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y"
          />
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Button key={m.value} size="sm" variant={method === m.value ? "default" : "outline"} onClick={() => setMethod(m.value)}>
                {m.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Random seed: {seed}</Label>
              <input type="range" min={1} max={9999} value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Min word length: {minLength}</Label>
              <Input type="number" min={2} max={20} value={minLength} onChange={(e) => setMinLength(Number(e.target.value) || 4)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("the quick brown fox jumps over the lazy dog")}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setSeed(Math.floor(Math.random() * 9999) + 1)}>Randomize seed</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Scrambled output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="scrambled.txt" />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[120px] resize-y font-mono" />
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Words total</p><p className="text-lg font-bold">{stats.wordsTotal}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Scrambled</p><p className="text-lg font-bold text-emerald-600">{stats.wordsScrambled}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Skipped (short)</p><p className="text-lg font-bold">{stats.wordsSkipped}</p></CardContent></Card>
        </div>
      )}

      {batch && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Batch output (per-line)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs overflow-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{batch}</pre>
          </CardContent>
        </Card>
      )}

      {diffs.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Word-by-word diff (first 50)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {diffs.map((d, i) => (
                <li key={i} className="p-2 flex items-center gap-3">
                  <span className="font-mono flex-1">{d.original}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono flex-1 text-primary">{d.scrambled}</span>
                  <Badge variant={d.changed ? "default" : "secondary"}>{d.changed ? "changed" : "same"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {wordList.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Scramblable words ({wordList.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {wordList.map((w, i) => (
                <Badge key={i} variant="outline" className="font-mono">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all scrambling runs locally in your browser.
            First and last letters are preserved; middle letters are scrambled deterministically by your seed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
