"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  parseFraction, add, sub, mul, div, formatFraction, formatMixed, toDecimal,
  toMixed, reciprocal, negate, compare, commonDenominator, fromDecimal,
  parseBatch, batchToCsv, evaluateExpression, type Fraction,
} from "./logic";

type Op = "add" | "sub" | "mul" | "div";

export default function FractionCalculator() {
  const [a, setA] = useState("1/2");
  const [b, setB] = useState("1/3");
  const [op, setOp] = useState<Op>("add");
  const [expr, setExpr] = useState("1/2 + 1/4");
  const [decimal, setDecimal] = useState("0.75");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    queueMicrotask(() => setError(null));
    const fa = parseFraction(a);
    if ("error" in fa) { queueMicrotask(() => setError(fa.error)); return null; }
    const fb = parseFraction(b);
    if ("error" in fb) { queueMicrotask(() => setError(fb.error)); return null; }
    let r: Fraction;
    if (op === "add") r = add(fa, fb);
    else if (op === "sub") r = sub(fa, fb);
    else if (op === "mul") r = mul(fa, fb);
    else {
      const d = div(fa, fb);
      if ("error" in d) { queueMicrotask(() => setError(d.error)); return null; }
      r = d;
    }
    return { r, fa, fb };
  }, [a, b, op]);

  const exprResult = useMemo(() => evaluateExpression(expr), [expr]);
  const decResult = useMemo(() => fromDecimal(Number(decimal)), [decimal]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0), [batchText]);
  const batchParsed = useMemo(() => parseBatch(batchLines), [batchLines]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fraction A</Label>
              <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. 1/2 or 5 or 1 1/2" />
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
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Result</p>
                  <p className="text-2xl font-bold">{formatFraction(result.r)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Mixed: {formatMixed(result.r)} · Decimal: {toDecimal(result.r).toFixed(6)}</p>
                </div>
                <div className="flex gap-2">
                  <CopyButton getText={() => formatFraction(result.r)} />
                  <DownloadButton getText={() => `fraction: ${formatFraction(result.r)}\nmixed: ${formatMixed(result.r)}\ndecimal: ${toDecimal(result.r)}`} filename="fraction.txt" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <Badge variant="secondary">Related operations</Badge>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">Reciprocal of A</p><p className="font-mono font-bold">{(() => { const r = reciprocal(result.fa); return typeof r === "object" && !("error" in r) ? formatFraction(r) : "—"; })()}</p></div>
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">Negated A</p><p className="font-mono font-bold">{formatFraction(negate(result.fa))}</p></div>
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">A vs B</p><p className="font-mono font-bold">{compare(result.fa, result.fb) === 0 ? "equal" : compare(result.fa, result.fb) < 0 ? "A < B" : "A > B"}</p></div>
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">Common denom</p><p className="font-mono font-bold">{commonDenominator(result.fa, result.fb)}</p></div>
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">A as mixed</p><p className="font-mono font-bold">{formatMixed(result.fa)}</p></div>
                <div className="rounded-md border border-border/50 p-2"><p className="text-muted-foreground">B as mixed</p><p className="font-mono font-bold">{formatMixed(result.fb)}</p></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Evaluate expression (e.g. "1/2 + 1/4")</Label>
          <Input value={expr} onChange={(e) => setExpr(e.target.value)} />
          {(() => {
            const r = exprResult;
            if ("error" in r) return <p className="text-xs text-yellow-700 dark:text-yellow-400">{r.error}</p>;
            return <p className="text-sm">= <strong className="font-mono">{formatFraction(r)}</strong> ({toDecimal(r).toFixed(6)})</p>;
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Decimal → Fraction</Label>
          <Input value={decimal} onChange={(e) => setDecimal(e.target.value)} />
          {(() => {
            if ("error" in decResult) return <p className="text-xs text-yellow-700 dark:text-yellow-400">{decResult.error}</p>;
            return <p className="text-sm"><strong className="font-mono">{formatFraction(decResult)}</strong> (mixed: {formatMixed(decResult)})</p>;
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one fraction per line)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"1/2\n3/4\n5"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchParsed.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchParsed.length} rows</Badge>
              <DownloadButton getText={() => batchToCsv(batchLines, batchParsed)} filename="fraction-batch.csv" mime="text/csv" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
