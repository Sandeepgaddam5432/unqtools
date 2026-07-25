"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { simplifyRatio, solveProportion, ratioToDecimal, formatRatio } from "./logic";

export default function RatioCalculator() {
  const [a, setA] = useState("12");
  const [b, setB] = useState("18");
  const [c, setC] = useState("");
  const [d, setD] = useState("");
  const [error, setError] = useState<string | null>(null);

  const simplified = useMemo(() => {
    setError(null);
    const an = Number(a); const bn = Number(b);
    if (!Number.isFinite(an) || !Number.isFinite(bn)) { setError("A and B must be numbers"); return null; }
    const r = simplifyRatio(an, bn);
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [a, b]);

  const proportion = useMemo(() => {
    setError(null);
    const an = a === "" ? null : Number(a);
    const bn = b === "" ? null : Number(b);
    const cn = c === "" ? null : Number(c);
    const dn = d === "" ? null : Number(d);
    if ([an, bn, cn, dn].some((v) => v !== null && !Number.isFinite(v as number))) {
      setError("All non-empty values must be numbers");
      return null;
    }
    const r = solveProportion({ a: an, b: bn, c: cn, d: dn });
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [a, b, c, d]);

  const decimal = useMemo(() => {
    const an = Number(a); const bn = Number(b);
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return null;
    return ratioToDecimal(an, bn);
  }, [a, b]);

  const csv = useMemo(() => {
    const lines = ["Metric,Value"];
    if (simplified) lines.push(`Simplified,${formatRatio(simplified.a, simplified.b)}`);
    if (decimal && typeof decimal === "number") lines.push(`Decimal,${decimal.toFixed(4)}`);
    if (proportion?.solved) lines.push(`Solved ${proportion.solved.missing},${proportion.solved.value}`);
    return lines.join("\n");
  }, [simplified, decimal, proportion]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-sm font-medium">Simplify a ratio A:B</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">A</Label>
              <Input value={a} onChange={(e) => setA(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">B</Label>
              <Input value={b} onChange={(e) => setB(e.target.value)} />
            </div>
          </div>
          <Label className="text-sm font-medium">Solve proportion A:B = C:D (leave one blank)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">A</Label>
              <Input value={a} onChange={(e) => setA(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">B</Label>
              <Input value={b} onChange={(e) => setB(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">C</Label>
              <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="?" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">D</Label>
              <Input value={d} onChange={(e) => setD(e.target.value)} placeholder="?" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setA("12"); setB("18"); setC("6"); setD(""); }}>Load sample</Button>
            <CopyButton getText={() => csv} disabled={!simplified && !proportion} />
            <DownloadButton getText={() => csv} filename="ratio.csv" mime="text/csv" disabled={!simplified && !proportion} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Simplified</p>
            <p className="text-xl font-bold">{simplified ? formatRatio(simplified.a, simplified.b) : "—"}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Decimal (A/B)</p>
            <p className="text-xl font-bold">{decimal && typeof decimal === "number" ? decimal.toFixed(4) : "—"}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Solved term</p>
            <p className="text-xl font-bold">
              {proportion?.solved ? `${proportion.solved.missing} = ${proportion.solved.value}` : "—"}
            </p>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
