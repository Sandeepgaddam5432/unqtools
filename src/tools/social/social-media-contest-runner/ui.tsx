"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { pickWinners, parseEntries, makeCryptoRandomSource, type Prize } from "./logic";

export default function SocialMediaContestRunner() {
  const [entryText, setEntryText] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([{ label: "Grand Prize", count: 1 }, { label: "Runner Up", count: 2 }]);
  const [result, setResult] = useState<ReturnType<typeof pickWinners> | null>(null);

  const entries = useMemo(() => parseEntries(entryText), [entryText]);

  const handleRun = () => {
    const r = pickWinners(entries, prizes, makeCryptoRandomSource());
    setResult(r);
  };

  const addPrize = () => setPrizes((arr) => [...arr, { label: `Prize ${arr.length + 1}`, count: 1 }]);
  const updatePrize = (i: number, patch: Partial<Prize>) => setPrizes((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePrize = (i: number) => setPrizes((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="entries" className="text-xs text-muted-foreground">Entries (one handle per line)</Label>
            <Textarea
              id="entries"
              placeholder={"@alice\n@bob\n@carol"}
              value={entryText}
              onChange={(e) => setEntryText(e.target.value)}
              className="font-mono text-sm min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Prizes</Label>
              <button type="button" onClick={addPrize} className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer">+ Add prize</button>
            </div>
            {prizes.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_40px] gap-2 items-center">
                <Input value={p.label} onChange={(e) => updatePrize(i, { label: e.target.value })} className="text-sm h-8" placeholder="Prize name" />
                <Input type="number" min={1} value={p.count} onChange={(e) => updatePrize(i, { count: parseInt(e.target.value, 10) || 0 })} className="text-sm h-8 font-mono" />
                <button type="button" onClick={() => removePrize(i)} className="text-xs text-red-600 hover:underline cursor-pointer" aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{entries.length} entries</Badge>
            <Badge variant="outline" className="text-xs">{prizes.reduce((s, p) => s + p.count, 0)} winners</Badge>
            <button
              type="button"
              onClick={handleRun}
              disabled={entries.length === 0 || prizes.length === 0}
              className="ml-auto px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer"
            >
              Pick winners
            </button>
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Could not pick winners"} />}

      {result?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{result.winners.length} winners</Badge>
              <Badge variant="outline" className="text-xs">{result.entriesConsidered} entries considered</Badge>
              {result.duplicatesRemoved > 0 && (
                <Badge variant="outline" className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">{result.duplicatesRemoved} duplicates removed</Badge>
              )}
            </div>
            <div className="space-y-1">
              {result.winners.map((w, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_120px] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <code className="font-mono">@{w.entry.handle}</code>
                  <Badge variant="outline" className="text-[10px]">{w.prizeLabel}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <EmptyState
          title="Paste entries and pick winners"
          hint="One handle per line. Add prizes with their counts. Winners are picked with cryptographic randomness, fully in your browser."
        />
      )}
    </div>
  );
}
