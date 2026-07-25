"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { parseFraction, add, sub, mul, div, formatFraction, toDecimal } from "./logic";

type Op = "add" | "sub" | "mul" | "div";

export default function FractionCalculator() {
  const [a, setA] = useState("1/2");
  const [b, setB] = useState("1/3");
  const [op, setOp] = useState<Op>("add");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const fa = parseFraction(a);
    if ("error" in fa) { setError(fa.error); return null; }
    const fb = parseFraction(b);
    if ("error" in fb) { setError(fb.error); return null; }
    let r;
    if (op === "add") r = add(fa, fb);
    else if (op === "sub") r = sub(fa, fb);
    else if (op === "mul") r = mul(fa, fb);
    else { const d = div(fa, fb); if ("error" in d) { setError(d.error); return null; } r = d; }
    return r;
  }, [a, b, op]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fraction A</Label>
              <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. 1/2 or 5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fraction B</Label>
              <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="e.g. 1/3 or 7" />
            </div>
          </div>
          <Label className="text-sm font-medium">Operation</Label>
          <div className="flex flex-wrap gap-2">
            {(["add", "sub", "mul", "div"] as Op[]).map((o) => (
              <Button key={o} variant={op === o ? "default" : "outline"} size="sm" onClick={() => setOp(o)}>
                {o === "add" ? "A + B" : o === "sub" ? "A − B" : o === "mul" ? "A × B" : "A ÷ B"}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setA("3/4"); setB("2/3"); }}>Load sample</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Result (fraction)</p>
                <p className="text-2xl font-bold">{formatFraction(result)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => formatFraction(result)} />
                <DownloadButton getText={() => `${formatFraction(result)}\n${toDecimal(result)}`} filename="fraction.txt" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Decimal: <strong className="text-foreground">{toDecimal(result).toFixed(6)}</strong></p>
          </CardContent>
        </Card>
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
