"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { getAllCodecs, compareCodecs, type CodecSpec } from "./logic";

export default function CodecComparison() {
  const codecs = useMemo(() => getAllCodecs(), []);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");

  const result = useMemo(() => (aId && bId && aId !== bId ? compareCodecs(aId, bId) : null), [aId, bId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Codec A</Label>
              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— pick —</option>
                {codecs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Codec B</Label>
              <select
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— pick —</option>
                {codecs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => { setAId("h264"); setBId("av1"); }}
            >
              H.264 vs AV1
            </button>
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => { setAId("mp3"); setBId("opus"); }}
            >
              MP3 vs Opus
            </button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">A: {result.a.name}</Badge>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <Badge variant="outline" className="text-xs">B: {result.b.name}</Badge>
                </div>
                {result.overallWinner !== "tie" && (
                  <Badge variant="outline" className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Winner: {result.overallWinner === "a" ? result.a.name : result.b.name}
                  </Badge>
                )}
                <CopyButton getText={() => result.recommendation} />
              </div>
              <p className="text-sm text-foreground">{result.recommendation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Metric-by-metric</Label>
              <div className="space-y-1">
                {result.metrics.map((m) => (
                  <div key={m.metric} className="grid grid-cols-[100px_1fr_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground">{m.metric}</span>
                    <div className={`flex items-center gap-1 ${m.winner === "a" ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-foreground"}`}>
                      {String(m.a)} {m.winner === "a" && <span className="text-[10px]">★</span>}
                    </div>
                    <div className={`flex items-center gap-1 ${m.winner === "b" ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-foreground"}`}>
                      {String(m.b)} {m.winner === "b" && <span className="text-[10px]">★</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.better}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CodecCard codec={result.a} label="A" />
            <CodecCard codec={result.b} label="B" />
          </div>
        </>
      )}

      {!result && (
        <EmptyState
          title="Pick two codecs to compare"
          hint="Quality, compression, compatibility, royalty status, and year — all side by side."
        />
      )}
    </div>
  );
}

function CodecCard({ codec, label }: { codec: CodecSpec; label: string }) {
  const rows = [
    { label: "Type", value: codec.type },
    { label: "Typical bitrate", value: codec.typicalBitrate },
    { label: "Year", value: String(codec.yearIntroduced) },
    { label: "Encoding", value: codec.encodingSpeed },
    { label: "Royalty-free", value: codec.royaltyFree ? "Yes" : "No" },
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{label}</Badge>
          <span className="text-sm font-semibold">{codec.name}</span>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[120px_1fr] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground">{r.label}</span>
              <code className="font-mono">{r.value}</code>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
