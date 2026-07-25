"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  removeAccents,
  removeAccentsBatch,
  countAccentsRemoved,
  hasAccents,
  computeStats,
  perCharBreakdown,
  listAccentedChars,
  breakdownToCsv,
  type StripMode,
} from "./logic";

export default function TextAccentRemover() {
  const [input, setInput] = useState("Café résumé über niño");
  const [mode, setMode] = useState<StripMode>("all");
  const [normalizeWhitespace, setNormalizeWhitespace] = useState(false);

  const opts = useMemo(() => ({ mode, normalizeWhitespace }), [mode, normalizeWhitespace]);

  const { output, error } = useMemo(() => {
    try {
      return { output: removeAccents(input, opts), error: null as string | null };
    } catch (e) {
      return { output: "", error: (e as Error).message };
    }
  }, [input, opts]);

  const removed = useMemo(() => countAccentsRemoved(input, opts), [input, opts]);
  const hadAccents = useMemo(() => hasAccents(input), [input]);
  const stats = useMemo(() => (input ? computeStats(input, opts) : null), [input, opts]);
  const breakdown = useMemo(() => (input ? perCharBreakdown(input) : []), [input]);
  const accentedChars = useMemo(() => (input ? listAccentedChars(input) : []), [input]);
  const batchOut = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return removeAccentsBatch(lines, opts).join("\n");
  }, [input, opts]);

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
            <Button size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => setMode("all")}>Strip all</Button>
            <Button size="sm" variant={mode === "keep-common" ? "default" : "outline"} onClick={() => setMode("keep-common")}>Keep common (ñ, ü)</Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
              <input type="checkbox" checked={normalizeWhitespace} onChange={(e) => setNormalizeWhitespace(e.target.checked)} />
              Normalize whitespace
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("Café résumé über niño")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output ({output.length} chars · {removed} accents removed)</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="accents-removed.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
          {!hadAccents && input.length > 0 && (
            <p className="text-xs text-muted-foreground">No accents detected in input.</p>
          )}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Accents removed</p><p className="text-lg font-bold text-emerald-600">{stats.accentsRemoved}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Unique marks</p><p className="text-lg font-bold">{stats.charsAffected}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Mode</p><p className="text-lg font-bold">{stats.mode}</p></CardContent></Card>
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

      {accentedChars.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Accented characters detected</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {accentedChars.map((c) => (
                <Badge key={c} variant="outline" className="font-mono text-base">{c}</Badge>
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
              <DownloadButton getText={() => breakdownToCsv(breakdown)} filename="accent-breakdown.csv" mime="text/csv" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr><th className="p-2 text-left">Original</th><th className="p-2 text-left">Base</th><th className="p-2 text-left">Marks (Unicode)</th><th className="p-2 text-right">Count</th></tr></thead>
              <tbody>
                {breakdown.map((e, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="p-2 font-mono text-base">{e.original}</td>
                    <td className="p-2 font-mono text-base text-primary">{e.base}</td>
                    <td className="p-2 font-mono">{e.marks.map((m) => `U+${m.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" ") || "—"}</td>
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
