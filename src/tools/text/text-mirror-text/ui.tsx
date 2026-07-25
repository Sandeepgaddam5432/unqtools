"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import {
  applyMirror,
  applyMirrorBatch,
  computeStats,
  characterMap,
  listMirrorableChars,
  perCharBreakdown,
  breakdownToCsv,
  sampleText,
  type MirrorMode,
} from "./logic";

const MODES: { value: MirrorMode; label: string }[] = [
  { value: "horizontal", label: "Horizontal (backwards)" },
  { value: "vertical", label: "Vertical (upside-down)" },
  { value: "both", label: "Both" },
];

export default function TextMirrorText() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MirrorMode>("horizontal");

  const output = useMemo(() => applyMirror(input, mode), [input, mode]);
  const stats = useMemo(() => (input ? computeStats(input, mode) : null), [input, mode]);
  const breakdown = useMemo(() => (input ? perCharBreakdown(input) : []), [input]);
  const mirrorable = useMemo(() => (input ? listMirrorableChars(input) : []), [input]);
  const map = useMemo(() => characterMap().slice(0, 40), []);
  const batchOut = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return applyMirrorBatch(lines, mode).join("\n");
  }, [input, mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="tm-input">Input text</Label>
          <Textarea
            id="tm-input"
            placeholder="Type text to mirror…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y"
          />
          <Label className="text-sm font-medium">Mirror mode</Label>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button key={m.value} variant={mode === m.value ? "default" : "outline"} size="sm" onClick={() => setMode(m.value)}>
                {m.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput(sampleText())}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium">Mirrored output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="mirrored.txt" />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[120px] resize-y font-mono" />
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lines</p><p className="text-lg font-bold">{stats.lines}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Chars mirrored</p><p className="text-lg font-bold text-emerald-600">{stats.charsMirrored}</p></CardContent></Card>
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

      {mirrorable.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Mirrorable characters ({mirrorable.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {mirrorable.map((c) => (
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
              <CardTitle className="text-sm">Character map (used in input)</CardTitle>
              <DownloadButton getText={() => breakdownToCsv(breakdown)} filename="mirror-breakdown.csv" mime="text/csv" />
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-center text-xs font-mono">
              {breakdown.map((e) => (
                <div key={e.char} className="rounded-md border border-border/50 p-1.5">
                  <div className="font-bold">{e.char}</div>
                  <div className="text-muted-foreground">↓</div>
                  <div className="font-bold text-primary">{e.mirrored}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Full character map (first 40)</CardTitle></CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1 text-center text-xs font-mono">
            {map.map((e) => (
              <div key={e.from} className="rounded-md border border-border/50 p-1.5" title={`${e.from} ↔ ${e.to}`}>
                <div className="font-bold">{e.from}</div>
                <div className="text-muted-foreground">↓</div>
                <div className="font-bold text-primary">{e.to}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all mirroring runs locally in your browser.
            Vertical mirror uses Unicode lookalikes; rendering varies by font.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
