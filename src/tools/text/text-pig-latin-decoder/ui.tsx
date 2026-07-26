"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  decodeSentence,
  decodeWithAlternatives,
  encodeWord,
  validateWord,
  decodeStats,
  batchDecode,
  suggestBest,
} from "./logic";

export default function PigLatinDecoderUI() {
  const [text, setText] = useState("elloHay orldway! Isthay isyay igpay atinlay.");
  const [vowelSuffix, setVowelSuffix] = useState("way");
  const [useHeuristic, setUseHeuristic] = useState(true);

  const decoded = useMemo(
    () => decodeSentence(text, { vowelSuffix: [vowelSuffix, "yay", "ay"], useHeuristic }),
    [text, vowelSuffix, useHeuristic],
  );
  const alternatives = useMemo(
    () => decodeWithAlternatives(text, { vowelSuffix: [vowelSuffix, "yay", "ay"], useHeuristic }),
    [text, vowelSuffix, useHeuristic],
  );
  const stats = useMemo(() => decodeStats(text), [text]);

  const reencoded = useMemo(
    () => decoded.split(/\s+/).map((w) => encodeWord(w.replace(/[^A-Za-z]/g, ""))).join(" "),
    [decoded],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Pig Latin input</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm font-mono"
            aria-label="Pig Latin input"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Vowel-start suffix</Label>
              <Input value={vowelSuffix} onChange={(e) => setVowelSuffix(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-6">
              <input type="checkbox" checked={useHeuristic} onChange={(e) => setUseHeuristic(e.target.checked)} />
              Use heuristic (prefer common English words)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-medium">Decoded</Label>
            <CopyButton getText={() => decoded} />
            <DownloadButton getText={() => decoded} filename="decoded.txt" />
          </div>
          <pre className="w-full min-h-[60px] rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{decoded}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total words</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Valid Pig Latin</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.valid}</p>
        </div>
        <div className="rounded-md border p-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">Invalid</p>
          <p className="text-2xl font-bold text-amber-600">{stats.invalid}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-medium">Per-word alternatives</Label>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {alternatives.map((a, i) => (
              <div key={i} className="text-xs border-b border-border/30 py-1 flex items-baseline gap-2">
                <span className="font-mono text-muted-foreground">{a.word}</span>
                <span className="text-foreground">→</span>
                <div className="flex flex-wrap gap-1">
                  {a.alternatives.slice(0, 5).map((alt, j) => (
                    <span
                      key={j}
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        j === 0
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {alt}
                    </span>
                  ))}
                  {a.alternatives.length === 0 && <span className="text-muted-foreground">—</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-medium">Re-encoded (verification)</Label>
          <p className="text-xs text-muted-foreground">Re-encoding the decoded output should approximately match the input.</p>
          <pre className="w-full min-h-[60px] rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">{reencoded}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% local. Decoder uses rule-based reversal + heuristic ranking (prefers common English words and known consonant clusters like "qu", "ch", "str"). Some words are inherently ambiguous.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
