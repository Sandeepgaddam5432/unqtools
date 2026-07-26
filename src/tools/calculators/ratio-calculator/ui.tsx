"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  simplifyRatio, solveProportion, ratioToDecimal, ratioToPercentage,
  compareRatios, continuedFraction, partToWhole, inverseRatio, scaleRatio,
  simplifyBatch, batchToCsv, formatRatio, closestAspect, ASPECT_PRESETS,
} from "./logic";

export default function RatioCalculator() {
  const [a, setA] = useState("12");
  const [b, setB] = useState("18");
  const [c, setC] = useState("");
  const [d, setD] = useState("");
  const [scale, setScale] = useState("1");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const an = Number(a); const bn = Number(b);
  const simplified = useMemo(() => {
    queueMicrotask(() => setError(null));
    if (!Number.isFinite(an) || !Number.isFinite(bn)) { queueMicrotask(() => setError("A and B must be numbers")); return null; }
    const r = simplifyRatio(an, bn);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    return r;
  }, [an, bn]);

  const proportion = useMemo(() => {
    const cn = c === "" ? null : Number(c);
    const dn = d === "" ? null : Number(d);
    if ([an, bn, cn, dn].some((v) => v !== null && !Number.isFinite(v as number))) return null;
    const r = solveProportion({ a: an || null, b: bn || null, c: cn, d: dn });
    if ("error" in r) return null;
    return r;
  }, [an, bn, c, d]);

  const decimal = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return ratioToDecimal(an, bn);
  }, [an, bn]);

  const pct = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return ratioToPercentage(an, bn);
  }, [an, bn]);

  const inverse = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return inverseRatio(an, bn);
  }, [an, bn]);

  const scaled = useMemo(() => {
    const f = Number(scale);
    if (!Number.isFinite(f) || !Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return scaleRatio(an, bn, f);
  }, [an, bn, scale]);

  const cf = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn) || bn === 0) return null;
    return continuedFraction(an, bn);
  }, [an, bn]);

  const ptw = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return partToWhole(an, bn);
  }, [an, bn]);

  const aspect = useMemo(() => {
    if (!Number.isFinite(an) || !Number.isFinite(bn) || bn === 0) return null;
    return closestAspect(an, bn);
  }, [an, bn]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0), [batchText]);
  const batchRatios = useMemo<[number, number][]>(() => {
    return batchLines.map((line) => {
      const m = line.match(/^(-?[\d.]+)\s*[:/]\s*(-?[\d.]+)$/);
      if (!m) return [NaN, NaN];
      return [Number(m[1]), Number(m[2])];
    }).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) as [number, number][];
  }, [batchLines]);
  const batchSimplified = useMemo(() => simplifyBatch(batchRatios), [batchRatios]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-sm font-medium">Simplify a ratio A:B</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">A</Label><Input value={a} onChange={(e) => setA(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">B</Label><Input value={b} onChange={(e) => setB(e.target.value)} /></div>
          </div>
          <Label className="text-sm font-medium">Solve proportion A:B = C:D (leave one blank, fill other 3)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">A</Label><Input value={a} onChange={(e) => setA(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">B</Label><Input value={b} onChange={(e) => setB(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">C</Label><Input value={c} onChange={(e) => setC(e.target.value)} placeholder="?" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">D</Label><Input value={d} onChange={(e) => setD(e.target.value)} placeholder="?" /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Scale factor</Label><Input value={scale} onChange={(e) => setScale(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setA("12"); setB("18"); setC("6"); setD(""); setScale("4"); }}>Load sample</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && simplified && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Simplified</p><p className="text-xl font-bold">{formatRatio(simplified.a, simplified.b)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Inverse (B:A)</p><p className="text-xl font-bold">{inverse && !("error" in inverse) ? formatRatio(inverse.a, inverse.b) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Decimal (A/B)</p><p className="text-xl font-bold">{decimal && typeof decimal === "number" ? decimal.toFixed(4) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Percentage</p><p className="text-xl font-bold">{typeof pct === "string" ? pct : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Scaled by {scale}</p><p className="text-xl font-bold">{scaled && !("error" in scaled) ? formatRatio(scaled.a, scaled.b) : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Solved term</p><p className="text-xl font-bold">{proportion?.solved ? `${proportion.solved.missing} = ${proportion.solved.value}` : "—"}</p></CardContent></Card>
        </div>
      )}

      {ptw && !("error" in ptw) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Badge variant="secondary">Part-to-whole breakdown</Badge>
            <div className="text-xs space-y-1">
              <p>Total: <span className="font-mono">{ptw.total}</span></p>
              <p>A share: <span className="font-mono">{(ptw.aFraction * 100).toFixed(2)}%</span></p>
              <p>B share: <span className="font-mono">{(ptw.bFraction * 100).toFixed(2)}%</span></p>
              <p>Continued fraction: <span className="font-mono">{Array.isArray(cf) ? cf.join(", ") : "—"}</span></p>
              <p>Closest aspect preset: <span className="font-mono">{aspect?.label ?? "—"}</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one ratio per line, e.g. "12:18")</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"12:18\n3:9"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchSimplified.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchSimplified.length} rows</Badge>
              <DownloadButton getText={() => batchToCsv(batchRatios, batchSimplified)} filename="ratio-batch.csv" mime="text/csv" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Common aspect-ratio presets</Badge>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {ASPECT_PRESETS.map((p) => (
              <div key={p.label} className="rounded-md border border-border/50 p-2">
                <p className="font-medium">{p.label}</p>
                <p className="font-mono text-muted-foreground">{p.w}:{p.h}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
