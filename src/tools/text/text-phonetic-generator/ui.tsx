"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  toPhonetic,
  toPhoneticDetailed,
  toPhoneticWithPronunciation,
  toPhoneticBatch,
  computeStats,
  perCharBreakdown,
  listAlphabet,
  breakdownToCsv,
  type PhoneticScheme,
} from "./logic";

const SCHEMES: { value: PhoneticScheme; label: string }[] = [
  { value: "nato", label: "NATO" },
  { value: "international", label: "International" },
  { value: "faa", label: "FAA" },
];

type OutputMode = "compact" | "detailed" | "pronunciation";

export default function TextPhoneticGenerator() {
  const [input, setInput] = useState("SOS");
  const [scheme, setScheme] = useState<PhoneticScheme>("nato");
  const [mode, setMode] = useState<OutputMode>("compact");

  const { output, error } = useMemo(() => {
    try {
      if (mode === "detailed") return { output: toPhoneticDetailed(input, scheme), error: null as string | null };
      if (mode === "pronunciation") return { output: toPhoneticWithPronunciation(input, scheme), error: null as string | null };
      return { output: toPhonetic(input, scheme), error: null as string | null };
    } catch (e) {
      return { output: "", error: (e as Error).message };
    }
  }, [input, scheme, mode]);

  const stats = useMemo(() => (input ? computeStats(input, scheme) : null), [input, scheme]);
  const breakdown = useMemo(() => (input ? perCharBreakdown(input, scheme) : []), [input, scheme]);
  const alphabet = useMemo(() => listAlphabet(scheme), [scheme]);
  const batchOut = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return toPhoneticBatch(lines, scheme).join("\n");
  }, [input, scheme]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <Textarea
            className="min-h-[100px] font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {SCHEMES.map((s) => (
              <Button key={s.value} size="sm" variant={scheme === s.value ? "default" : "outline"} onClick={() => setScheme(s.value)}>{s.label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "compact" ? "default" : "outline"} onClick={() => setMode("compact")}>Compact</Button>
            <Button size="sm" variant={mode === "detailed" ? "default" : "outline"} onClick={() => setMode("detailed")}>Detailed</Button>
            <Button size="sm" variant={mode === "pronunciation" ? "default" : "outline"} onClick={() => setMode("pronunciation")}>Pronunciation</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Phonetic output</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="phonetic.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Letters</p><p className="text-lg font-bold">{stats.letters}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Digits</p><p className="text-lg font-bold">{stats.digits}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Spaces</p><p className="text-lg font-bold">{stats.spaces}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Other</p><p className="text-lg font-bold">{stats.otherChars}</p></CardContent></Card>
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

      {breakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Per-character breakdown</CardTitle>
              <DownloadButton getText={() => breakdownToCsv(breakdown)} filename="phonetic-breakdown.csv" mime="text/csv" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Char</th><th className="p-2 text-left">Phonetic</th><th className="p-2 text-left">Pronunciation</th><th className="p-2 text-right">Count</th></tr></thead>
              <tbody>
                {breakdown.map((e, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono text-base">{e.char === " " ? "␣" : e.char}</td>
                    <td className="p-2 font-mono">{e.word}</td>
                    <td className="p-2 text-muted-foreground">{e.pronunciation ?? "—"}</td>
                    <td className="p-2 text-right font-mono">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">{scheme.toUpperCase()} alphabet reference</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {alphabet.map((e) => (
              <div key={e.char} className="rounded-md border border-border/50 p-2 text-xs" title={e.pronunciation ?? ""}>
                <div className="font-bold text-base">{e.char}</div>
                <div className="font-mono">{e.word}</div>
                {e.pronunciation && <div className="text-muted-foreground text-[10px]">{e.pronunciation}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
