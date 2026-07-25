"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  applyAccents,
  applyAccentsBatch,
  computeStats,
  perCharBreakdown,
  listVowels,
  breakdownToCsv,
  type AccentMode,
} from "./logic";

const ACCENTS: { value: AccentMode; label: string }[] = [
  { value: "acute", label: "Acute (á)" },
  { value: "grave", label: "Grave (à)" },
  { value: "circumflex", label: "Circumflex (â)" },
  { value: "umlaut", label: "Umlaut (ä)" },
  { value: "tilde", label: "Tilde (ã)" },
  { value: "cycle", label: "Cycle all" },
  { value: "random", label: "Random (seeded)" },
];

export default function TextAccentAdder() {
  const [input, setInput] = useState("Hello world");
  const [accent, setAccent] = useState<AccentMode>("acute");
  const [seed, setSeed] = useState(7);

  const { output, error } = useMemo(() => {
    try {
      return { output: applyAccents(input, accent, seed), error: null as string | null };
    } catch (e) {
      return { output: "", error: (e as Error).message };
    }
  }, [input, accent, seed]);

  const stats = useMemo(() => (input ? computeStats(input, accent) : null), [input, accent]);
  const breakdown = useMemo(() => (input ? perCharBreakdown(input, accent, seed) : []), [input, accent, seed]);
  const vowels = useMemo(() => (input ? listVowels(input) : []), [input]);
  const batchOut = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return applyAccentsBatch(lines, accent, seed).join("\n");
  }, [input, accent, seed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <Textarea
            className="min-h-[120px] font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <Button key={a.value} size="sm" variant={accent === a.value ? "default" : "outline"} onClick={() => setAccent(a.value)}>{a.label}</Button>
            ))}
          </div>
          {accent === "random" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Seed: {seed}</Label>
              <input type="range" min={1} max={9999} value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output ({output.length} chars)</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="accented.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Vowels accented</p><p className="text-lg font-bold text-emerald-600">{stats.vowelsAccented}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preserved</p><p className="text-lg font-bold">{stats.charsPreserved}</p></CardContent></Card>
        </div>
      )}

      {batchOut && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Batch output (per line)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs overflow-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{batchOut}</pre>
          </CardContent>
        </Card>
      )}

      {vowels.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Vowels detected</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {vowels.map((v) => (
                <Badge key={v} variant="outline" className="font-mono text-base">{v}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {breakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Per-character breakdown</CardTitle>
              <DownloadButton getText={() => breakdownToCsv(breakdown)} filename="accent-add-breakdown.csv" mime="text/csv" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Original</th><th className="p-2 text-left">Accented</th><th className="p-2 text-left">Accent</th><th className="p-2 text-right">Count</th></tr></thead>
              <tbody>
                {breakdown.map((e, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono text-base">{e.original}</td>
                    <td className="p-2 font-mono text-base text-primary">{e.accented}</td>
                    <td className="p-2">{e.accent}</td>
                    <td className="p-2 text-right font-mono">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
