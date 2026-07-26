"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  toLeet, fromLeet, toLeetCustom, fromLeetCustom, buildInverse,
  batchToLeet, batchToCsv, stats, mergeMap, fmt,
  type LeetLevel,
} from "./logic";

const LEVELS: { value: LeetLevel; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function TextLeetspeak() {
  const [input, setInput] = useState("leet speak");
  const [direction, setDirection] = useState<"to" | "from">("to");
  const [level, setLevel] = useState<LeetLevel>("basic");
  const [customMap, setCustomMap] = useState("a:4\ne:3\ni:1");
  const [batch, setBatch] = useState("leet\nhacker\nelite");
  const [error, setError] = useState<string | null>(null);

  const output = useMemo(() => {
    try {
      queueMicrotask(() => setError(null));
      return direction === "to" ? toLeet(input, level) : fromLeet(input, level);
    } catch (e) {
      queueMicrotask(() => setError((e as Error).message));
      return "";
    }
  }, [input, direction, level]);

  const customOutput = useMemo(() => {
    const map: Record<string, string> = {};
    for (const line of customMap.split("\n")) {
      const [k, v] = line.split(":");
      if (k && v !== undefined) map[k.trim()] = v.trim();
    }
    return direction === "to" ? toLeetCustom(input, map) : fromLeetCustom(input, map);
  }, [input, direction, customMap]);

  const inverseTable = useMemo(() => buildInverse(level), [level]);
  const stat = useMemo(() => stats(input, level), [input, level]);
  const batchResult = useMemo(() => batchToLeet(batch.split("\n").filter(Boolean), level), [batch, level]);

  const csv = useMemo(() => {
    return [
      "Field,Value",
      `Direction,${direction}`,
      `Level,${level}`,
      `Input length,${input.length}`,
      `Output length,${output.length}`,
      `Substituted,${stat.substituted}`,
      `Unchanged,${stat.unchanged}`,
      `Substitution ratio,${fmt(stat.ratio, 4)}`,
      `Output,"${output.replace(/"/g, '""')}"`,
    ].join("\n");
  }, [direction, level, input.length, output, stat]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={direction === "to" ? "default" : "outline"} onClick={() => setDirection("to")}>Text → Leet</Button>
            <Button size="sm" variant={direction === "from" ? "default" : "outline"} onClick={() => setDirection("from")}>Leet → Text</Button>
            {LEVELS.map((l) => (
              <Button key={l.value} size="sm" variant={level === l.value ? "default" : "outline"} onClick={() => setLevel(l.value)}>{l.label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setInput("leet speak"); setLevel("basic"); setDirection("to"); }}>Load sample</Button>
            <CopyButton getText={() => output} disabled={!output} />
            <DownloadButton getText={() => csv} filename="leetspeak.csv" mime="text/csv" disabled={!output} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output ({output.length} chars)</Label>
            <Badge variant="outline">{stat.substituted}/{stat.total} substituted ({fmt(stat.ratio * 100, 1)}%)</Badge>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Custom substitution map (key:value per line)</Label>
        <textarea value={customMap} onChange={(e) => setCustomMap(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        <p className="text-xs text-muted-foreground">Custom output: <span className="font-mono">{customOutput || "—"}</span></p>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Inverse table ({level})</Label>
        <div className="flex flex-wrap gap-2 text-xs">
          {inverseTable.slice(0, 24).map((p) => (
            <Badge key={p.key} variant="outline" className="font-mono">{p.key} → {p.value}</Badge>
          ))}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch (one per line)</Label>
          {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
        </div>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {batchResult.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batchResult.map((r) => (
              <div key={r.i} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">#{r.i + 1}</p>
                <p className="font-mono">{r.output || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
